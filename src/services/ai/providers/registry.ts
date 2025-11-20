/**
 * AI Providers - Provider Registry
 *
 * Central registry for all AI providers. Handles provider instantiation,
 * configuration, and management.
 */

import { AIProviderName } from '../types';
import { BaseProvider, ProviderConfig } from './base.provider';
import { AnthropicProvider } from './anthropic.provider';
import { OpenAIProvider } from './openai.provider';

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
    // TODO: Add Google and Azure providers in future phases
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
   * Create a provider from environment variables
   */
  createFromEnv(): BaseProvider {
    const providerName = (process.env.AI_PROVIDER || 'anthropic') as AIProviderName;
    const model = process.env.AI_MODEL || this.getDefaultModel(providerName);

    const config = this.getConfigFromEnv(providerName, model);
    return this.getProvider(providerName, config);
  }

  /**
   * Get provider configuration from environment variables
   */
  private getConfigFromEnv(provider: AIProviderName, model: string): ProviderConfig {
    const baseConfig: ProviderConfig = {
      apiKey: '',
      model,
      maxTokens: parseInt(process.env.AI_MAX_TOKENS || '4096', 10),
      temperature: parseFloat(process.env.AI_TEMPERATURE || '1.0'),
      timeout: parseInt(process.env.AI_TIMEOUT_MS || '60000', 10),
    };

    switch (provider) {
      case 'anthropic':
        baseConfig.apiKey = process.env.ANTHROPIC_API_KEY || '';
        break;

      case 'openai':
        baseConfig.apiKey = process.env.OPENAI_API_KEY || '';
        (baseConfig as any).orgId = process.env.OPENAI_ORG_ID;
        break;

      case 'google':
        baseConfig.apiKey = process.env.GOOGLE_API_KEY || '';
        break;

      case 'azure':
        baseConfig.apiKey = process.env.AZURE_OPENAI_KEY || '';
        (baseConfig as any).endpoint = process.env.AZURE_OPENAI_ENDPOINT;
        (baseConfig as any).deploymentName = process.env.AZURE_DEPLOYMENT_NAME;
        break;

      default:
        throw new Error(`Unknown provider: ${provider}`);
    }

    return baseConfig;
  }

  /**
   * Get default model for a provider
   */
  private getDefaultModel(provider: AIProviderName): string {
    const defaults: Record<AIProviderName, string> = {
      anthropic: 'claude-sonnet-4-20250514',
      openai: 'gpt-4-turbo',
      google: 'gemini-pro',
      azure: 'gpt-4',
    };

    return defaults[provider];
  }

  /**
   * Check if a provider is available (has API key configured)
   */
  isProviderAvailable(provider: AIProviderName): boolean {
    try {
      const model = this.getDefaultModel(provider);
      const config = this.getConfigFromEnv(provider, model);
      return !!config.apiKey;
    } catch {
      return false;
    }
  }

  /**
   * List all available providers (those with API keys configured)
   */
  listAvailableProviders(): AIProviderName[] {
    const allProviders: AIProviderName[] = ['anthropic', 'openai', 'google', 'azure'];
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

export function createProviderFromEnv(): BaseProvider {
  return providerRegistry.createFromEnv();
}

export function listAvailableProviders(): AIProviderName[] {
  return providerRegistry.listAvailableProviders();
}
