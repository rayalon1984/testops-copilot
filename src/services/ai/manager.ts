/**
 * AI Service Manager
 *
 * Main orchestrator for all AI features. Coordinates providers, caching,
 * cost tracking, and vector database operations.
 */

import { Pool } from 'pg';
import { AIConfigManager, getConfigManager } from './config';
import { BaseProvider } from './providers/base.provider';
import { createProviderFromEnv } from './providers/registry';
import { WeaviateVectorClient, getVectorClient } from './vector/client';
import { initializeSchemas } from './vector/schema';
import { RCAMatchingService } from './features/rca-matching';
import { CategorizationService } from './features/categorization';
import { LogSummarizationService } from './features/log-summary';
import { AICache, getCache } from './cache';
import { CostTracker, getCostTracker, UsageRecord } from './cost-tracker';
import { TestFailure, SimilarFailure, HealthStatus, FailureCategorization, LogSummary } from './types';
import { RCAMatchingOptions } from './features/rca-matching';
import { CategorizationOptions } from './features/categorization';
import { SummarizationOptions } from './features/log-summary';

export interface AIManagerConfig {
  db: Pool;
  configPath?: string;
}

/**
 * AI Service Manager
 */
export class AIManager {
  private configManager: AIConfigManager;
  private provider: BaseProvider | null = null;
  private vectorClient: WeaviateVectorClient | null = null;
  private cache: AICache;
  private costTracker: CostTracker;
  private rcaMatching: RCAMatchingService | null = null;
  private categorization: CategorizationService | null = null;
  private logSummarization: LogSummarizationService | null = null;
  private initialized: boolean = false;
  private db: Pool;

  constructor(config: AIManagerConfig) {
    this.db = config.db;
    this.configManager = getConfigManager();
    this.cache = getCache();
    this.costTracker = getCostTracker(this.db, this.configManager.getCostConfig());
  }

  /**
   * Initialize all AI services
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('ℹ️  AI services already initialized');
      return;
    }

    console.log('🚀 Initializing AI services...');

    // Check if AI is enabled
    if (!this.configManager.isEnabled()) {
      console.log('ℹ️  AI features are disabled');
      this.initialized = true;
      return;
    }

    // Validate configuration
    const validation = this.configManager.validate();
    if (!validation.valid) {
      throw new Error(`AI configuration is invalid:\n${validation.errors.join('\n')}`);
    }

    try {
      // Initialize cost tracker database schema
      await this.costTracker.initialize();
      console.log('✅ Cost tracker initialized');

      // Initialize AI provider
      this.provider = createProviderFromEnv();
      console.log(`✅ AI provider initialized: ${this.provider.getName()}`);

      // Initialize categorization service (always available)
      if (this.configManager.isFeatureEnabled('categorization')) {
        this.categorization = new CategorizationService(this.provider);
        console.log('✅ Categorization service initialized');
      }

      // Initialize log summarization service (always available)
      if (this.configManager.isFeatureEnabled('logSummary')) {
        this.logSummarization = new LogSummarizationService(this.provider);
        console.log('✅ Log summarization service initialized');
      }

      // Initialize vector database
      if (this.configManager.isFeatureEnabled('rcaMatching')) {
        this.vectorClient = getVectorClient();
        await this.vectorClient.connect();
        await initializeSchemas(this.vectorClient);
        console.log('✅ Vector database initialized');

        // Initialize RCA matching service
        this.rcaMatching = new RCAMatchingService(this.provider, this.vectorClient);
        console.log('✅ RCA matching service initialized');
      }

      this.initialized = true;
      console.log('✅ AI services initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize AI services:', error);
      throw error;
    }
  }

  /**
   * Check if AI services are initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Check if AI is enabled
   */
  isEnabled(): boolean {
    return this.configManager.isEnabled();
  }

  /**
   * Check if a feature is enabled
   */
  isFeatureEnabled(feature: keyof AIConfigManager['config']['features']): boolean {
    return this.configManager.isFeatureEnabled(feature);
  }

  /**
   * Find similar failures using RCA matching
   */
  async findSimilarFailures(
    failure: TestFailure,
    options?: RCAMatchingOptions
  ): Promise<SimilarFailure[]> {
    this.ensureInitialized();
    this.ensureFeatureEnabled('rcaMatching');

    if (!this.rcaMatching) {
      throw new Error('RCA matching service not initialized');
    }

    const startTime = Date.now();

    try {
      const results = await this.rcaMatching.findSimilarFailures(failure, options);

      // Record usage (if AI calls were made)
      // Note: Actual token usage will be recorded by individual provider calls

      return results;
    } catch (error) {
      console.error('RCA matching failed:', error);
      throw error;
    }
  }

  /**
   * Store a test failure for future RCA matching
   */
  async storeFailure(failure: TestFailure): Promise<string> {
    this.ensureInitialized();
    this.ensureFeatureEnabled('rcaMatching');

    if (!this.rcaMatching) {
      throw new Error('RCA matching service not initialized');
    }

    const startTime = Date.now();

    try {
      const id = await this.rcaMatching.storeFailure(failure);

      // Record embedding generation cost
      if (this.provider && failure.embedding) {
        const record: UsageRecord = {
          timestamp: new Date(),
          provider: this.provider.getName(),
          model: failure.embedding.model,
          feature: 'rca_matching',
          inputTokens: this.estimateTokens(this.failureToText(failure)),
          outputTokens: 0,
          totalTokens: this.estimateTokens(this.failureToText(failure)),
          costUSD: 0.0001, // Rough estimate for embedding
          cached: false,
        };
        await this.costTracker.recordUsage(record);
      }

      return id;
    } catch (error) {
      console.error('Failed to store failure:', error);
      throw error;
    }
  }

  /**
   * Mark a failure as resolved
   */
  async markFailureAsResolved(
    failureId: string,
    resolution: string,
    resolvedBy: string,
    ticketUrl?: string
  ): Promise<void> {
    this.ensureInitialized();
    this.ensureFeatureEnabled('rcaMatching');

    if (!this.rcaMatching) {
      throw new Error('RCA matching service not initialized');
    }

    await this.rcaMatching.markAsResolved(failureId, resolution, resolvedBy, ticketUrl);
  }

  /**
   * Categorize a test failure
   */
  async categorizeFailure(
    failure: TestFailure,
    options?: CategorizationOptions
  ): Promise<FailureCategorization> {
    this.ensureInitialized();
    this.ensureFeatureEnabled('categorization');

    if (!this.categorization) {
      throw new Error('Categorization service not initialized');
    }

    try {
      const result = await this.categorization.categorizeFailure(failure, options);

      // Record usage
      if (this.provider) {
        const record: UsageRecord = {
          timestamp: new Date(),
          provider: this.provider.getName(),
          model: this.configManager.getModel(),
          feature: 'categorization',
          inputTokens: this.estimateTokens(this.failureToText(failure)),
          outputTokens: this.estimateTokens(result.reasoning),
          totalTokens: this.estimateTokens(this.failureToText(failure) + result.reasoning),
          costUSD: 0.001, // Rough estimate
          cached: false,
        };
        await this.costTracker.recordUsage(record);
      }

      return result;
    } catch (error) {
      console.error('Categorization failed:', error);
      throw error;
    }
  }

  /**
   * Summarize test failure logs
   */
  async summarizeLogs(
    logs: string,
    testName: string,
    errorMessage: string,
    options?: SummarizationOptions
  ): Promise<LogSummary> {
    this.ensureInitialized();
    this.ensureFeatureEnabled('logSummary');

    if (!this.logSummarization) {
      throw new Error('Log summarization service not initialized');
    }

    try {
      const result = await this.logSummarization.summarizeLogs(
        logs,
        testName,
        errorMessage,
        options
      );

      // Record usage
      if (this.provider) {
        const record: UsageRecord = {
          timestamp: new Date(),
          provider: this.provider.getName(),
          model: this.configManager.getModel(),
          feature: 'log_summary',
          inputTokens: this.estimateTokens(logs.substring(0, 10000)),
          outputTokens: this.estimateTokens(result.summary + result.rootCause),
          totalTokens: this.estimateTokens(logs.substring(0, 10000) + result.summary),
          costUSD: 0.002, // Rough estimate
          cached: false,
        };
        await this.costTracker.recordUsage(record);
      }

      return result;
    } catch (error) {
      console.error('Log summarization failed:', error);
      throw error;
    }
  }

  /**
   * Get cost summary
   */
  async getCostSummary(startDate?: Date, endDate?: Date) {
    if (startDate && endDate) {
      return await this.costTracker.getSummary(startDate, endDate);
    }
    return await this.costTracker.getCurrentMonthSummary();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cache.getStats();
  }

  /**
   * Get RCA matching statistics
   */
  async getRCAStats() {
    this.ensureInitialized();

    if (!this.rcaMatching) {
      return { total: 0, byCategory: {}, resolved: 0, unresolved: 0 };
    }

    return await this.rcaMatching.getStats();
  }

  /**
   * Health check for all AI services
   */
  async healthCheck(): Promise<HealthStatus> {
    const status: HealthStatus = {
      healthy: true,
      services: {},
    };

    // Check provider
    if (this.provider) {
      try {
        const providerHealthy = await this.provider.healthCheck();
        status.services.provider = {
          healthy: providerHealthy,
          name: this.provider.getName(),
        };
        if (!providerHealthy) status.healthy = false;
      } catch (error) {
        status.services.provider = {
          healthy: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
        status.healthy = false;
      }
    }

    // Check vector database
    if (this.vectorClient) {
      try {
        const vectorHealthy = await this.vectorClient.healthCheck();
        status.services.vectorDB = {
          healthy: vectorHealthy,
        };
        if (!vectorHealthy) status.healthy = false;
      } catch (error) {
        status.services.vectorDB = {
          healthy: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
        status.healthy = false;
      }
    }

    // Check cache
    status.services.cache = {
      healthy: true,
      stats: this.cache.getStats(),
    };

    return status;
  }

  /**
   * Cleanup old data
   */
  async cleanup(daysToKeep: number = 90): Promise<void> {
    if (this.rcaMatching) {
      const deleted = await this.rcaMatching.cleanup(daysToKeep);
      console.log(`🗑️  Cleaned up ${deleted} old failure records`);
    }
  }

  /**
   * Shutdown AI services
   */
  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down AI services...');

    if (this.vectorClient) {
      await this.vectorClient.close();
    }

    if (this.cache) {
      await this.cache.close();
    }

    this.initialized = false;
    console.log('✅ AI services shut down');
  }

  /**
   * Ensure services are initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('AI services not initialized. Call initialize() first.');
    }
  }

  /**
   * Ensure a feature is enabled
   */
  private ensureFeatureEnabled(feature: keyof AIConfigManager['config']['features']): void {
    if (!this.configManager.isFeatureEnabled(feature)) {
      throw new Error(`AI feature '${feature}' is not enabled`);
    }
  }

  /**
   * Convert failure to text (helper)
   */
  private failureToText(failure: TestFailure): string {
    return `${failure.testName}\n${failure.errorMessage}\n${failure.stackTrace || ''}`;
  }

  /**
   * Estimate tokens (helper)
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}

// Singleton instance
let aiManager: AIManager | null = null;

export function getAIManager(config?: AIManagerConfig): AIManager {
  if (!aiManager && config) {
    aiManager = new AIManager(config);
  }
  if (!aiManager) {
    throw new Error('AI Manager not initialized. Provide config on first call.');
  }
  return aiManager;
}

export async function initializeAI(config: AIManagerConfig): Promise<AIManager> {
  const manager = getAIManager(config);
  await manager.initialize();
  return manager;
}

export async function shutdownAI(): Promise<void> {
  if (aiManager) {
    await aiManager.shutdown();
    aiManager = null;
  }
}
