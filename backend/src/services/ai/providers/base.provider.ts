/**
 * AI Providers - Base Abstract Provider
 *
 * This abstract class defines the interface that all AI providers must implement.
 * It handles common functionality like cost calculation, token counting, and error handling.
 */

import { AIProviderName, AIResponse, ChatMessage } from '../types';
import { ToolSchema } from '../tools/types';

export interface ProviderConfig {
  apiKey: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
}

export interface CompletionOptions {
  maxTokens?: number;
  temperature?: number;
  stopSequences?: string[];
  topP?: number;
  systemPrompt?: string;
  tools?: ToolSchema[];
}

export interface EmbeddingOptions {
  model?: string;
}

export interface ProviderPricing {
  inputTokenCostPer1k: number;
  outputTokenCostPer1k: number;
  embeddingCostPer1k?: number;
}

export interface ProviderLimits {
  maxInputTokens: number;
  maxOutputTokens: number;
  requestsPerMinute: number;
  tokensPerMinute: number;
}

export abstract class BaseProvider {
  protected config: ProviderConfig;
  protected pricing: ProviderPricing;
  protected limits: ProviderLimits;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.pricing = this.getPricing();
    this.limits = this.getLimits();
  }

  /**
   * Get the provider name
   */
  abstract getName(): AIProviderName;

  /**
   * Get pricing information for this provider
   */
  abstract getPricing(): ProviderPricing;

  /**
   * Get rate limits for this provider
   */
  abstract getLimits(): ProviderLimits;

  /**
   * Generate a chat completion
   */
  abstract chat(
    messages: ChatMessage[],
    options?: CompletionOptions
  ): Promise<AIResponse>;

  /**
   * Generate embeddings for text
   */
  abstract embed(
    text: string,
    options?: EmbeddingOptions
  ): Promise<number[]>;

  /**
   * Check if the provider is healthy
   */
  abstract healthCheck(): Promise<boolean>;

  /**
   * Calculate cost based on token usage
   */
  protected calculateCost(inputTokens: number, outputTokens: number): {
    inputCost: number;
    outputCost: number;
    totalCost: number;
  } {
    const inputCost = (inputTokens / 1000) * this.pricing.inputTokenCostPer1k;
    const outputCost = (outputTokens / 1000) * this.pricing.outputTokenCostPer1k;

    return {
      inputCost: parseFloat(inputCost.toFixed(6)),
      outputCost: parseFloat(outputCost.toFixed(6)),
      totalCost: parseFloat((inputCost + outputCost).toFixed(6)),
    };
  }

  /**
   * Calculate embedding cost
   */
  protected calculateEmbeddingCost(tokens: number): number {
    if (!this.pricing.embeddingCostPer1k) {
      return 0;
    }
    return parseFloat(((tokens / 1000) * this.pricing.embeddingCostPer1k).toFixed(6));
  }

  /**
   * Estimate token count from text (rough approximation)
   * More accurate counting should be done by the specific provider
   */
  protected estimateTokens(text: string): number {
    // Rough estimate: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
  }

  /**
   * Validate configuration
   */
  protected validateConfig(): void {
    if (!this.config.apiKey) {
      throw new Error(`${this.getName()} API key is required`);
    }
    if (!this.config.model) {
      throw new Error(`${this.getName()} model is required`);
    }
  }

  /**
   * Handle provider-specific errors
   */
  protected handleError(error: unknown): never {
    const err = error as Record<string, unknown>;
    const response = err.response as Record<string, unknown> | undefined;
    const errorMessage = err.message as string | undefined;

    if (response) {
      // HTTP error from provider
      const status = response.status as number;
      const data = response.data as Record<string, unknown> | undefined;
      const nestedError = data?.error as Record<string, unknown> | undefined;
      const message = (nestedError?.message as string) || errorMessage || 'Unknown error';

      if (status === 401) {
        throw new Error(`${this.getName()} authentication failed: Invalid API key`);
      } else if (status === 429) {
        throw new Error(`${this.getName()} rate limit exceeded: ${message}`);
      } else if (status === 500) {
        throw new Error(`${this.getName()} server error: ${message}`);
      } else {
        throw new Error(`${this.getName()} error (${status}): ${message}`);
      }
    }

    // Network or other error
    throw new Error(`${this.getName()} request failed: ${errorMessage || 'Unknown error'}`);
  }

  /**
   * Format messages for logging (redact sensitive data)
   */
  protected formatMessagesForLog(messages: ChatMessage[]): string {
    return messages
      .map((m) => `${m.role}: ${m.content.substring(0, 100)}...`)
      .join('\n');
  }
}
