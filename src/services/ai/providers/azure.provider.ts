/**
 * AI Providers - Azure OpenAI Implementation
 */

// @ts-ignore - Azure OpenAI SDK v2 has different exports
import { AzureOpenAI } from '@azure/openai';
import { BaseProvider, CompletionOptions, EmbeddingOptions, ProviderConfig, ProviderLimits, ProviderPricing } from './base.provider';
import { AIProviderName, AIResponse, ChatMessage } from '../types';

export interface AzureProviderConfig extends ProviderConfig {
  endpoint: string;
  deploymentName: string;
  apiVersion?: string;
}

export class AzureProvider extends BaseProvider {
  private client: AzureOpenAI;
  private endpoint: string;
  private deploymentName: string;

  constructor(config: AzureProviderConfig) {
    super(config);
    this.validateConfig();

    this.endpoint = config.endpoint;
    this.deploymentName = config.deploymentName;

    if (!this.endpoint) {
      throw new Error('Azure endpoint is required');
    }
    if (!this.deploymentName) {
      throw new Error('Azure deployment name is required');
    }

    this.client = new AzureOpenAI({
      apiKey: config.apiKey,
      endpoint: this.endpoint,
      apiVersion: config.apiVersion || '2024-02-15-preview',
      deployment: this.deploymentName,
    });
  }

  getName(): AIProviderName {
    return 'azure';
  }

  getPricing(): ProviderPricing {
    // Azure OpenAI pricing varies by model and region
    // These are approximate costs - check your Azure portal for exact pricing
    const modelPricing: Record<string, ProviderPricing> = {
      'gpt-4': {
        inputTokenCostPer1k: 0.03,
        outputTokenCostPer1k: 0.06,
        embeddingCostPer1k: undefined,
      },
      'gpt-4-32k': {
        inputTokenCostPer1k: 0.06,
        outputTokenCostPer1k: 0.12,
        embeddingCostPer1k: undefined,
      },
      'gpt-35-turbo': {
        inputTokenCostPer1k: 0.0015,
        outputTokenCostPer1k: 0.002,
        embeddingCostPer1k: undefined,
      },
      'gpt-35-turbo-16k': {
        inputTokenCostPer1k: 0.003,
        outputTokenCostPer1k: 0.004,
        embeddingCostPer1k: undefined,
      },
      'text-embedding-ada-002': {
        inputTokenCostPer1k: 0.0001,
        outputTokenCostPer1k: 0,
        embeddingCostPer1k: 0.0001,
      },
      'text-embedding-3-small': {
        inputTokenCostPer1k: 0.00002,
        outputTokenCostPer1k: 0,
        embeddingCostPer1k: 0.00002,
      },
      'text-embedding-3-large': {
        inputTokenCostPer1k: 0.00013,
        outputTokenCostPer1k: 0,
        embeddingCostPer1k: 0.00013,
      },
    };

    // Use deployment name or model to determine pricing
    const key = this.deploymentName.toLowerCase() || this.config.model.toLowerCase();
    for (const [model, pricing] of Object.entries(modelPricing)) {
      if (key.includes(model)) {
        return pricing;
      }
    }

    return modelPricing['gpt-35-turbo'];
  }

  getLimits(): ProviderLimits {
    // Limits are configured per deployment in Azure
    // These are default values - adjust based on your deployment settings
    return {
      maxInputTokens: 8192,
      maxOutputTokens: 4096,
      requestsPerMinute: 120, // Varies by deployment
      tokensPerMinute: 40000, // Varies by deployment
    };
  }

  async chat(messages: ChatMessage[], options?: CompletionOptions): Promise<AIResponse> {
    const startTime = Date.now();

    try {
      // Convert messages to Azure OpenAI format
      const azureMessages = messages.map(msg => ({
        role: msg.role as 'system' | 'user' | 'assistant',
        content: msg.content,
      }));

      // Add system prompt if provided in options
      if (options?.systemPrompt && !messages.find(m => m.role === 'system')) {
        azureMessages.unshift({
          role: 'system',
          content: options.systemPrompt,
        });
      }

      // Make API call using deployment name
      const response = await this.client.chat.completions.create({
        model: this.deploymentName, // Azure uses deployment name, not model name
        messages: azureMessages,
        max_tokens: options?.maxTokens || this.config.maxTokens || 4096,
        temperature: options?.temperature ?? this.config.temperature ?? 1.0,
        top_p: options?.topP,
        stop: options?.stopSequences,
      });

      const choice = response.choices[0];
      if (!choice || !choice.message) {
        throw new Error('No response from Azure OpenAI');
      }

      // Calculate costs
      const inputTokens = response.usage?.prompt_tokens || 0;
      const outputTokens = response.usage?.completion_tokens || 0;
      const cost = this.calculateCost(inputTokens, outputTokens);

      return {
        content: choice.message.content || '',
        provider: this.getName(),
        model: this.deploymentName,
        usage: {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
        },
        cost,
        cached: false,
        responseTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      this.handleError(error);
    }
  }

  async embed(text: string, options?: EmbeddingOptions): Promise<number[]> {
    try {
      const embeddingDeployment = options?.model || this.deploymentName;

      const response = await this.client.embeddings.create({
        model: embeddingDeployment,
        input: text,
      });

      if (!response.data || response.data.length === 0) {
        throw new Error('No embedding returned from Azure OpenAI');
      }

      return response.data[0].embedding;
    } catch (error) {
      this.handleError(error);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.deploymentName,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 5,
      });

      return response.choices.length > 0;
    } catch (error) {
      console.error(`Azure OpenAI health check failed:`, error);
      return false;
    }
  }

  /**
   * Override error handling for Azure-specific errors
   */
  protected handleError(error: any): never {
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.error?.message || error.message;

      if (status === 401) {
        throw new Error(`${this.getName()} authentication failed: Invalid API key or endpoint`);
      } else if (status === 404) {
        throw new Error(`${this.getName()} deployment not found: ${this.deploymentName}`);
      } else if (status === 429) {
        throw new Error(`${this.getName()} rate limit exceeded: ${message}`);
      } else if (status === 500) {
        throw new Error(`${this.getName()} server error: ${message}`);
      } else {
        throw new Error(`${this.getName()} error (${status}): ${message}`);
      }
    }

    // Network or other error
    throw new Error(`${this.getName()} request failed: ${error.message || error}`);
  }
}
