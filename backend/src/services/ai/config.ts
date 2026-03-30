/**
 * AI Configuration Management
 *
 * Loads and manages AI configuration from environment variables and config files.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { AIConfig, AIProviderName } from './types';
import { logger } from '@/utils/logger';

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
  providerSettings: {
    maxTokens: 4096,
    temperature: 1.0,
    timeoutMs: 60000,
  },
  providerSecrets: {},
  contextWindow: undefined,
  localModel: undefined,
  vectorDB: {
    url: 'http://localhost:8080',
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
        const yamlData = yaml.load(fileContent) as Record<string, unknown>;
        fileConfig = this.parseYamlConfig((yamlData.ai || yamlData) as Record<string, unknown>);
      } catch (error) {
        logger.warn(`[AIConfig] Failed to load AI config from ${this.configPath}:`, error);
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
  private parseYamlConfig(data: Record<string, unknown>): Partial<AIConfig> {
    const features = data.features as Record<string, unknown> | undefined;
    const providerSettings = data.provider_settings as Record<string, unknown> | undefined;
    const vectorDb = data.vector_db as Record<string, unknown> | undefined;
    const cost = data.cost as Record<string, unknown> | undefined;
    const cache = data.cache as Record<string, unknown> | undefined;
    const rateLimit = data.rate_limit as Record<string, unknown> | undefined;

    const contextWindow = data.context_window as Record<string, unknown> | undefined;
    const localModel = data.local_model as Record<string, unknown> | undefined;

    return {
      enabled: data.enabled as boolean | undefined,
      provider: data.provider as AIProviderName | undefined,
      model: data.model as string | undefined,
      features: features ? {
        rcaMatching: features.rca_matching as boolean,
        categorization: features.categorization as boolean,
        logSummary: features.log_summary as boolean,
        nlQueries: features.nl_queries as boolean,
        ticketGeneration: features.ticket_generation as boolean,
      } : undefined,
      providerSettings: providerSettings ? {
        maxTokens: providerSettings.max_tokens as number,
        temperature: providerSettings.temperature as number,
        timeoutMs: providerSettings.timeout_ms as number,
      } : undefined,
      contextWindow: contextWindow ? {
        sizeOverride: contextWindow.size_override as number | undefined,
        maxToolResultTokens: contextWindow.max_tool_result_tokens as number | undefined,
        maxTotalToolResultTokens: contextWindow.max_total_tool_result_tokens as number | undefined,
      } : undefined,
      localModel: localModel ? {
        enabled: localModel.enabled as boolean,
        provider: localModel.provider as AIProviderName,
        model: localModel.model as string,
        baseUrl: localModel.base_url as string | undefined,
      } : undefined,
      vectorDB: vectorDb ? {
        url: vectorDb.url as string,
        apiKey: vectorDb.api_key as string | undefined,
      } : undefined,
      cost: cost ? {
        monthlyBudgetUSD: cost.monthly_budget_usd as number,
        alertThresholdPercent: cost.alert_threshold_percent as number,
        alertEmail: cost.alert_email as string | undefined,
      } : undefined,
      cache: cache ? {
        enabled: cache.enabled as boolean,
        ttlSeconds: cache.ttl_seconds as number,
      } : undefined,
      rateLimit: rateLimit ? {
        perMinute: rateLimit.per_minute as number,
        perDay: rateLimit.per_day as number,
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

    // Provider settings
    if (env.AI_MAX_TOKENS || env.AI_TEMPERATURE || env.AI_TIMEOUT_MS) {
      config.providerSettings = {
        maxTokens: parseInt(env.AI_MAX_TOKENS || '4096', 10),
        temperature: parseFloat(env.AI_TEMPERATURE || '1.0'),
        timeoutMs: parseInt(env.AI_TIMEOUT_MS || '60000', 10),
      };
    }

    // Provider secrets (always load if present — these are sensitive)
    config.providerSecrets = {
      anthropicApiKey: env.ANTHROPIC_API_KEY || undefined,
      openaiApiKey: env.OPENAI_API_KEY || undefined,
      openaiOrgId: env.OPENAI_ORG_ID || undefined,
      googleApiKey: env.GOOGLE_API_KEY || undefined,
      azureOpenaiKey: env.AZURE_OPENAI_KEY || undefined,
      azureOpenaiEndpoint: env.AZURE_OPENAI_ENDPOINT || undefined,
      azureDeploymentName: env.AZURE_DEPLOYMENT_NAME || undefined,
      openrouterApiKey: env.OPENROUTER_API_KEY || undefined,
      openrouterSiteUrl: env.OPENROUTER_SITE_URL || undefined,
      openrouterAppName: env.OPENROUTER_APP_NAME || undefined,
      bedrockRegion: env.AWS_BEDROCK_REGION || env.AWS_DEFAULT_REGION || env.AWS_REGION || undefined,
      bedrockAccessKeyId: env.AWS_BEDROCK_ACCESS_KEY_ID || env.AWS_ACCESS_KEY_ID || undefined,
      bedrockSecretAccessKey: env.AWS_BEDROCK_SECRET_ACCESS_KEY || env.AWS_SECRET_ACCESS_KEY || undefined,
      bedrockSessionToken: env.AWS_SESSION_TOKEN || undefined,
      bedrockEmbeddingModel: env.AWS_BEDROCK_EMBEDDING_MODEL || undefined,
    };

    // Vector DB
    if (env.WEAVIATE_URL || env.WEAVIATE_API_KEY) {
      config.vectorDB = {
        url: env.WEAVIATE_URL || 'http://localhost:8080',
        apiKey: env.WEAVIATE_API_KEY || undefined,
      };
    }

    // Context window overrides
    if (env.AI_CONTEXT_WINDOW_SIZE || env.AI_MAX_TOOL_RESULT_TOKENS || env.AI_MAX_TOTAL_TOOL_RESULT_TOKENS) {
      config.contextWindow = {
        sizeOverride: env.AI_CONTEXT_WINDOW_SIZE ? parseInt(env.AI_CONTEXT_WINDOW_SIZE, 10) : undefined,
        maxToolResultTokens: env.AI_MAX_TOOL_RESULT_TOKENS ? parseInt(env.AI_MAX_TOOL_RESULT_TOKENS, 10) : undefined,
        maxTotalToolResultTokens: env.AI_MAX_TOTAL_TOOL_RESULT_TOKENS ? parseInt(env.AI_MAX_TOTAL_TOOL_RESULT_TOKENS, 10) : undefined,
      };
    }

    // Local model for on-prem
    if (env.AI_LOCAL_MODEL_ENABLED === 'true') {
      config.localModel = {
        enabled: true,
        provider: (env.AI_LOCAL_MODEL_PROVIDER || 'openrouter') as AIProviderName,
        model: env.AI_LOCAL_MODEL || 'meta-llama/llama-3.2-3b-instruct',
        baseUrl: env.AI_LOCAL_MODEL_BASE_URL || undefined,
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
   * Get provider settings (maxTokens, temperature, timeout)
   */
  getProviderSettings() {
    return { ...this.config.providerSettings };
  }

  /**
   * Get provider secrets (API keys and related credentials)
   */
  getProviderSecrets() {
    return { ...this.config.providerSecrets };
  }

  /**
   * Get the API key for the currently configured provider
   */
  getApiKeyForProvider(provider?: AIProviderName): string {
    const p = provider || this.config.provider;
    const secrets = this.config.providerSecrets;
    switch (p) {
      case 'anthropic': return secrets.anthropicApiKey || '';
      case 'openai': return secrets.openaiApiKey || '';
      case 'google': return secrets.googleApiKey || '';
      case 'azure': return secrets.azureOpenaiKey || '';
      case 'openrouter': return secrets.openrouterApiKey || '';
      case 'bedrock': return secrets.bedrockAccessKeyId || 'bedrock-iam-auth';
      case 'mock': return 'mock-key';
      default: return '';
    }
  }

  /**
   * Get vector DB configuration
   */
  getVectorDBConfig() {
    return { ...this.config.vectorDB };
  }

  /**
   * Get context window configuration overrides
   */
  getContextWindowConfig() {
    return this.config.contextWindow ? { ...this.config.contextWindow } : undefined;
  }

  /**
   * Get local model configuration for on-prem deployments
   */
  getLocalModelConfig() {
    return this.config.localModel ? { ...this.config.localModel } : undefined;
  }

  /**
   * Check if a local model is configured and enabled
   */
  isLocalModelEnabled(): boolean {
    return !!this.config.localModel?.enabled;
  }

  /**
   * Apply a runtime override (e.g. from DB-stored provider config).
   * Merges the override into the current config without touching disk/env sources.
   */
  applyRuntimeOverride(override: Partial<AIConfig>): void {
    if (override.provider !== undefined) this.config.provider = override.provider;
    if (override.model !== undefined) this.config.model = override.model;
    if (override.enabled !== undefined) this.config.enabled = override.enabled;
    if (override.providerSecrets) {
      this.config.providerSecrets = { ...this.config.providerSecrets, ...override.providerSecrets };
    }
    if (override.providerSettings) {
      this.config.providerSettings = { ...this.config.providerSettings, ...override.providerSettings };
    }
    if (override.features) {
      this.config.features = { ...this.config.features, ...override.features };
    }
    if (override.contextWindow) {
      this.config.contextWindow = { ...this.config.contextWindow, ...override.contextWindow };
    }
    if (override.localModel) {
      // When base localModel is undefined, require a complete object to avoid
      // partial config with missing required fields (provider, model)
      if (this.config.localModel) {
        this.config.localModel = { ...this.config.localModel, ...override.localModel };
      } else {
        this.config.localModel = override.localModel as AIConfig['localModel'];
      }
    }
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
      const validProviders: AIProviderName[] = ['anthropic', 'openai', 'google', 'azure', 'openrouter', 'bedrock', 'mock'];
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

      // Check context window settings if present
      if (this.config.contextWindow) {
        const cw = this.config.contextWindow;
        if (cw.sizeOverride !== undefined && cw.sizeOverride <= 0) {
          errors.push('Context window size override must be positive');
        }
        if (cw.maxToolResultTokens !== undefined && cw.maxToolResultTokens <= 0) {
          errors.push('maxToolResultTokens must be positive');
        }
        if (cw.maxTotalToolResultTokens !== undefined && cw.maxTotalToolResultTokens <= 0) {
          errors.push('maxTotalToolResultTokens must be positive');
        }
      }

      // Check local model settings if present
      if (this.config.localModel?.enabled) {
        if (!this.config.localModel.model) {
          errors.push('Local model must specify a model ID when enabled');
        }
        if (!validProviders.includes(this.config.localModel.provider)) {
          errors.push(`Invalid local model provider: ${this.config.localModel.provider}`);
        }
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
