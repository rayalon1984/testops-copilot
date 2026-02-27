/**
 * AI Providers - Provider Registry
 *
 * Central registry for all AI providers. Handles provider instantiation,
 * configuration, and management.
 */

import { AIProviderName } from '../types';
import { AIConfigManager, getConfigManager } from '../config';
import { BaseProvider, ProviderConfig } from './base.provider';
import { AnthropicProvider } from './anthropic.provider';
import { OpenAIProvider } from './openai.provider';
import { GoogleProvider } from './google.provider';
import { AzureProvider, AzureProviderConfig } from './azure.provider';
import { OpenRouterProvider, OpenRouterProviderConfig } from './openrouter.provider';
import { MockProvider } from './mock.provider';
import { BedrockProvider, BedrockProviderConfig } from './bedrock.provider';

export type ProviderFactory = (config: ProviderConfig) => BaseProvider;

/**
 * Registry of available AI providers
 */
class ProviderRegistry {
  private providers: Map<AIProviderName, ProviderFactory> = new Map();
  private instances: Map<string, BaseProvider> = new Map();

  constructor() {
    this.registerDefaultProviders();
  }

  /**
   * Register default providers
   */
  private registerDefaultProviders(): void {
    this.register('anthropic', (config) => new AnthropicProvider(config));
    this.register('openai', (config) => new OpenAIProvider(config));
    this.register('google', (config) => new GoogleProvider(config));
    this.register('azure', (config) => new AzureProvider(config as AzureProviderConfig));
    this.register('openrouter', (config) => new OpenRouterProvider(config as OpenRouterProviderConfig));
    this.register('bedrock', (config) => new BedrockProvider(config as BedrockProviderConfig));
    this.register('mock', (config) => new MockProvider(config));
  }

  /**
   * Register a new provider
   */
  register(name: AIProviderName, factory: ProviderFactory): void {
    this.providers.set(name, factory);
  }

  /**
   * Get a provider instance (creates if not exists, reuses if exists)
   */
  getProvider(name: AIProviderName, config: ProviderConfig): BaseProvider {
    const cacheKey = `${name}:${config.model}`;

    // Return cached instance if available
    if (this.instances.has(cacheKey)) {
      return this.instances.get(cacheKey)!;
    }

    // Create new instance
    const factory = this.providers.get(name);
    if (!factory) {
      throw new Error(`Provider '${name}' is not registered`);
    }

    const provider = factory(config);
    this.instances.set(cacheKey, provider);
    return provider;
  }

  /**
   * Create a provider from AIConfigManager (central config source)
   */
  createFromConfig(configManager?: AIConfigManager): BaseProvider {
    const cm = configManager || getConfigManager();
    const providerName = cm.getProvider();
    const model = cm.getModel() || this.getDefaultModel(providerName);
    const settings = cm.getProviderSettings();
    const secrets = cm.getProviderSecrets();

    const baseConfig: ProviderConfig = {
      apiKey: cm.getApiKeyForProvider(providerName),
      model,
      maxTokens: settings.maxTokens,
      temperature: settings.temperature,
      timeout: settings.timeoutMs,
    };

    // Add provider-specific config
    const extendedConfig = baseConfig as ProviderConfig & Record<string, unknown>;
    switch (providerName) {
      case 'openai':
        extendedConfig.orgId = secrets.openaiOrgId;
        break;
      case 'azure':
        extendedConfig.endpoint = secrets.azureOpenaiEndpoint;
        extendedConfig.deploymentName = secrets.azureDeploymentName;
        break;
      case 'openrouter':
        extendedConfig.siteUrl = secrets.openrouterSiteUrl;
        extendedConfig.appName = secrets.openrouterAppName;
        break;
      case 'bedrock':
        extendedConfig.region = secrets.bedrockRegion || 'us-east-1';
        extendedConfig.accessKeyId = secrets.bedrockAccessKeyId;
        extendedConfig.secretAccessKey = secrets.bedrockSecretAccessKey;
        extendedConfig.embeddingModel = secrets.bedrockEmbeddingModel;
        break;
    }

    return this.getProvider(providerName, baseConfig);
  }

  /**
   * Create a provider from environment variables
   * @deprecated Use createFromConfig() instead — reads from AIConfigManager
   */
  createFromEnv(): BaseProvider {
    return this.createFromConfig();
  }

  /**
   * Get default model for a provider
   */
  private getDefaultModel(provider: AIProviderName): string {
    const defaults: Record<AIProviderName, string> = {
      anthropic: 'claude-opus-4-6',
      openai: 'gpt-4.1',
      google: 'gemini-3.0-flash',
      azure: 'gpt-4.1',
      openrouter: 'anthropic/claude-sonnet-4-5',
      bedrock: 'anthropic.claude-sonnet-4-5-20250514-v1:0',
      mock: 'mock-model',
    };

    return defaults[provider];
  }

  /**
   * Check if a provider is available (has API key configured)
   */
  isProviderAvailable(provider: AIProviderName): boolean {
    const cm = getConfigManager();
    const apiKey = cm.getApiKeyForProvider(provider);
    return !!apiKey;
  }

  /**
   * List all available providers (those with API keys configured)
   */
  listAvailableProviders(): AIProviderName[] {
    const allProviders: AIProviderName[] = ['anthropic', 'openai', 'google', 'azure', 'openrouter', 'bedrock', 'mock'];
    return allProviders.filter(p => this.isProviderAvailable(p));
  }

  /**
   * Clear all cached provider instances
   */
  clearCache(): void {
    this.instances.clear();
  }
}

// Export singleton instance
export const providerRegistry = new ProviderRegistry();

// Export convenience functions
export function getProvider(name: AIProviderName, config: ProviderConfig): BaseProvider {
  return providerRegistry.getProvider(name, config);
}

export function createProviderFromConfig(configManager?: AIConfigManager): BaseProvider {
  return providerRegistry.createFromConfig(configManager);
}

/** @deprecated Use createProviderFromConfig() instead */
export function createProviderFromEnv(): BaseProvider {
  return providerRegistry.createFromConfig();
}

export function listAvailableProviders(): AIProviderName[] {
  return providerRegistry.listAvailableProviders();
}
