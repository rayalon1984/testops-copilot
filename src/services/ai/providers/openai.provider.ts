/**
 * AI Providers - OpenAI Implementation
 */

import OpenAI from 'openai';
import { BaseProvider, CompletionOptions, EmbeddingOptions, ProviderConfig, ProviderLimits, ProviderPricing } from './base.provider';
import { AIProviderName, AIResponse, ChatMessage } from '../types';

export class OpenAIProvider extends BaseProvider {
  private client: OpenAI;

  constructor(config: ProviderConfig & { orgId?: string }) {
    super(config);
    this.validateConfig();

    this.client = new OpenAI({
      apiKey: config.apiKey,
      organization: config.orgId,
      timeout: config.timeout || 60000,
    });
  }

  getName(): AIProviderName {
    return 'openai';
  }

  getPricing(): ProviderPricing {
    // Pricing for GPT-4 Turbo as of January 2025
    // Check https://openai.com/pricing for latest pricing
    // Note: Prices vary by model
    const modelPricing: Record<string, ProviderPricing> = {
      'gpt-4-turbo': {
        inputTokenCostPer1k: 0.01,
        outputTokenCostPer1k: 0.03,
        embeddingCostPer1k: undefined,
      },
      'gpt-4': {
        inputTokenCostPer1k: 0.03,
        outputTokenCostPer1k: 0.06,
        embeddingCostPer1k: undefined,
      },
      'gpt-3.5-turbo': {
        inputTokenCostPer1k: 0.0005,
        outputTokenCostPer1k: 0.0015,
        embeddingCostPer1k: undefined,
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

    return modelPricing[this.config.model] || modelPricing['gpt-4-turbo'];
  }

  getLimits(): ProviderLimits {
    // Limits vary by tier - these are for Tier 1
    return {
      maxInputTokens: 128000,      // 128k for GPT-4 Turbo
      maxOutputTokens: 4096,
      requestsPerMinute: 500,
      tokensPerMinute: 30000,
    };
  }

  async chat(messages: ChatMessage[], options?: CompletionOptions): Promise<AIResponse> {
    const startTime = Date.now();

    try {
      // Convert messages to OpenAI format
      const openaiMessages = messages.map(msg => ({
        role: msg.role as 'system' | 'user' | 'assistant',
        content: msg.content,
      }));

      // Add system prompt if provided in options
      if (options?.systemPrompt && !messages.find(m => m.role === 'system')) {
        openaiMessages.unshift({
          role: 'system',
          content: options.systemPrompt,
        });
      }

      // Make API call
      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: openaiMessages,
        max_tokens: options?.maxTokens || this.config.maxTokens || 4096,
        temperature: options?.temperature ?? this.config.temperature ?? 1.0,
        top_p: options?.topP,
        stop: options?.stopSequences,
      });

      const choice = response.choices[0];
      if (!choice || !choice.message) {
        throw new Error('No response from OpenAI');
      }

      // Calculate costs
      const inputTokens = response.usage?.prompt_tokens || 0;
      const outputTokens = response.usage?.completion_tokens || 0;
      const cost = this.calculateCost(inputTokens, outputTokens);

      return {
        content: choice.message.content || '',
        provider: this.getName(),
        model: this.config.model,
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
      const embeddingModel = options?.model || 'text-embedding-3-small';

      const response = await this.client.embeddings.create({
        model: embeddingModel,
        input: text,
      });

      if (!response.data || response.data.length === 0) {
        throw new Error('No embedding returned from OpenAI');
      }

      return response.data[0].embedding;
    } catch (error) {
      this.handleError(error);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 5,
      });

      return response.choices.length > 0;
    } catch (error) {
      console.error(`OpenAI health check failed:`, error);
      return false;
    }
  }
}
