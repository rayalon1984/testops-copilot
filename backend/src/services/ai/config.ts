/**
 * AI Configuration Management
 *
 * Loads and manages AI configuration from environment variables and config files.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { AIConfig, AIProviderName } from './types';

/**
 * Default AI configuration
 */
const DEFAULT_CONFIG: AIConfig = {
  enabled: false,
  provider: 'anthropic',
  model: 'claude-opus-4-6',
  features: {
    rcaMatching: true,
    categorization: true,
    logSummary: true,
    nlQueries: false,
    ticketGeneration: true,
  },
  cost: {
    monthlyBudgetUSD: 100,
    alertThresholdPercent: 80,
  },
  cache: {
    enabled: true,
    ttlSeconds: 604800, // 7 days
  },
  rateLimit: {
    perMinute: 100,
    perDay: 10000,
  },
};

/**
 * AI Configuration Manager
 */
export class AIConfigManager {
  private config: AIConfig;
  private configPath: string;

  constructor(configPath?: string) {
    this.configPath = configPath || this.findConfigPath();
    this.config = this.loadConfig();
  }

  /**
   * Find config file path
   */
  private findConfigPath(): string {
    const possiblePaths = [
      path.join(process.cwd(), 'config', 'ai.yml'),
      path.join(process.cwd(), 'config', 'ai.yaml'),
      path.join(process.cwd(), '.testops', 'ai.yml'),
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }

    // Return default path even if doesn't exist
    return possiblePaths[0];
  }

  /**
   * Load configuration from file and environment variables
   * Environment variables override file config
   */
  private loadConfig(): AIConfig {
    let fileConfig: Partial<AIConfig> = {};

    // Load from YAML file if exists
    if (fs.existsSync(this.configPath)) {
      try {
        const fileContent = fs.readFileSync(this.configPath, 'utf8');
        const yamlData = yaml.load(fileContent) as any;
        fileConfig = this.parseYamlConfig(yamlData.ai || yamlData);
      } catch (error) {
        console.warn(`Failed to load AI config from ${this.configPath}:`, error);
      }
    }

    // Start with defaults, override with file config, then env vars
    const config: AIConfig = {
      ...DEFAULT_CONFIG,
      ...fileConfig,
      ...this.loadFromEnv(),
    };

    return config;
  }

  /**
   * Parse YAML config to AIConfig format
   */
  private parseYamlConfig(yaml: any): Partial<AIConfig> {
    return {
      enabled: yaml.enabled,
      provider: yaml.provider,
      model: yaml.model,
      features: yaml.features ? {
        rcaMatching: yaml.features.rca_matching,
        categorization: yaml.features.categorization,
        logSummary: yaml.features.log_summary,
        nlQueries: yaml.features.nl_queries,
        ticketGeneration: yaml.features.ticket_generation,
      } : undefined,
      cost: yaml.cost ? {
        monthlyBudgetUSD: yaml.cost.monthly_budget_usd,
        alertThresholdPercent: yaml.cost.alert_threshold_percent,
        alertEmail: yaml.cost.alert_email,
      } : undefined,
      cache: yaml.cache ? {
        enabled: yaml.cache.enabled,
        ttlSeconds: yaml.cache.ttl_seconds,
      } : undefined,
      rateLimit: yaml.rate_limit ? {
        perMinute: yaml.rate_limit.per_minute,
        perDay: yaml.rate_limit.per_day,
      } : undefined,
    };
  }

  /**
   * Load configuration from environment variables
   */
  private loadFromEnv(): Partial<AIConfig> {
    const env = process.env;
    const config: Partial<AIConfig> = {};

    if (env.AI_ENABLED !== undefined) {
      config.enabled = env.AI_ENABLED === 'true';
    }

    if (env.AI_PROVIDER) {
      config.provider = env.AI_PROVIDER as AIProviderName;
    }

    if (env.AI_MODEL) {
      config.model = env.AI_MODEL;
    }

    // Features
    if (env.AI_FEATURE_RCA_MATCHING !== undefined ||
      env.AI_FEATURE_CATEGORIZATION !== undefined ||
      env.AI_FEATURE_LOG_SUMMARY !== undefined ||
      env.AI_FEATURE_NL_QUERIES !== undefined ||
      env.AI_FEATURE_TICKET_GENERATION !== undefined) {
      config.features = {
        rcaMatching: (env.AI_FEATURE_RCA_MATCHING ?? 'true') === 'true',
        categorization: (env.AI_FEATURE_CATEGORIZATION ?? 'true') === 'true',
        logSummary: (env.AI_FEATURE_LOG_SUMMARY ?? 'true') === 'true',
        nlQueries: (env.AI_FEATURE_NL_QUERIES ?? 'false') === 'true',
        ticketGeneration: (env.AI_FEATURE_TICKET_GENERATION ?? 'true') === 'true',
      };
    }

    // Cost
    if (env.AI_MONTHLY_BUDGET_USD || env.AI_ALERT_THRESHOLD_PERCENT || env.AI_ALERT_EMAIL) {
      config.cost = {
        monthlyBudgetUSD: parseInt(env.AI_MONTHLY_BUDGET_USD || '100', 10),
        alertThresholdPercent: parseInt(env.AI_ALERT_THRESHOLD_PERCENT || '80', 10),
        alertEmail: env.AI_ALERT_EMAIL,
      };
    }

    // Cache
    if (env.AI_CACHE_ENABLED !== undefined || env.AI_CACHE_TTL_SECONDS) {
      config.cache = {
        enabled: (env.AI_CACHE_ENABLED ?? 'true') === 'true',
        ttlSeconds: parseInt(env.AI_CACHE_TTL_SECONDS || '604800', 10),
      };
    }

    // Rate Limit
    if (env.AI_RATE_LIMIT_PER_MINUTE || env.AI_RATE_LIMIT_PER_DAY) {
      config.rateLimit = {
        perMinute: parseInt(env.AI_RATE_LIMIT_PER_MINUTE || '100', 10),
        perDay: parseInt(env.AI_RATE_LIMIT_PER_DAY || '10000', 10),
      };
    }

    return config;
  }

  /**
   * Get the current configuration
   */
  getConfig(): AIConfig {
    return { ...this.config };
  }

  /**
   * Check if AI is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Check if a specific feature is enabled
   */
  isFeatureEnabled(feature: keyof AIConfig['features']): boolean {
    return this.config.enabled && this.config.features[feature];
  }

  /**
   * Get the configured provider
   */
  getProvider(): AIProviderName {
    return this.config.provider;
  }

  /**
   * Get the configured model
   */
  getModel(): string {
    return this.config.model;
  }

  /**
   * Get cost configuration
   */
  getCostConfig() {
    return { ...this.config.cost };
  }

  /**
   * Get cache configuration
   */
  getCacheConfig() {
    return { ...this.config.cache };
  }

  /**
   * Get rate limit configuration
   */
  getRateLimitConfig() {
    return { ...this.config.rateLimit };
  }

  /**
   * Reload configuration from disk
   */
  reload(): void {
    this.config = this.loadConfig();
  }

  /**
   * Validate configuration
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (this.config.enabled) {
      // Check provider is valid
      const validProviders: AIProviderName[] = ['anthropic', 'openai', 'google', 'azure', 'openrouter', 'mock'];
      if (!validProviders.includes(this.config.provider)) {
        errors.push(`Invalid provider: ${this.config.provider}`);
      }

      // Check model is specified
      if (!this.config.model) {
        errors.push('Model must be specified when AI is enabled');
      }

      // Check cost settings
      if (this.config.cost.monthlyBudgetUSD <= 0) {
        errors.push('Monthly budget must be greater than 0');
      }

      if (this.config.cost.alertThresholdPercent < 0 || this.config.cost.alertThresholdPercent > 100) {
        errors.push('Alert threshold must be between 0 and 100');
      }

      // Check rate limits
      if (this.config.rateLimit.perMinute <= 0) {
        errors.push('Rate limit per minute must be greater than 0');
      }

      if (this.config.rateLimit.perDay <= 0) {
        errors.push('Rate limit per day must be greater than 0');
      }

      if (this.config.rateLimit.perMinute > this.config.rateLimit.perDay) {
        errors.push('Rate limit per minute cannot exceed rate limit per day');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

// Export singleton instance
let configManager: AIConfigManager | null = null;

export function getConfigManager(): AIConfigManager {
  if (!configManager) {
    configManager = new AIConfigManager();
  }
  return configManager;
}

export function getConfig(): AIConfig {
  return getConfigManager().getConfig();
}

export function isAIEnabled(): boolean {
  return getConfigManager().isEnabled();
}

export function isFeatureEnabled(feature: keyof AIConfig['features']): boolean {
  return getConfigManager().isFeatureEnabled(feature);
}
