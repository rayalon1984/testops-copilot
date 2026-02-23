/**
 * AI Providers - OpenRouter Implementation
 *
 * OpenRouter provides a unified, OpenAI-compatible API gateway to hundreds
 * of models from Anthropic, OpenAI, Google, Meta, Mistral, Cohere, and more.
 *
 * Users can specify any model available on OpenRouter (e.g. 'meta-llama/llama-4-maverick',
 * 'mistralai/mistral-large', 'anthropic/claude-opus-4-6') and pricing/limits are
 * fetched dynamically from the OpenRouter API.
 *
 * @see https://openrouter.ai/docs
 */

import OpenAI from 'openai';
import { BaseProvider, CompletionOptions, EmbeddingOptions, ProviderConfig, ProviderLimits, ProviderPricing } from './base.provider';
import { AIProviderName, AIResponse, ChatMessage } from '../types';
import { logger } from '@/utils/logger';

export interface OpenRouterProviderConfig extends ProviderConfig {
  /** Optional site URL sent as HTTP-Referer for OpenRouter analytics */
  siteUrl?: string;
  /** Optional app name sent as X-Title for OpenRouter analytics */
  appName?: string;
}

/** Model metadata from the OpenRouter /models API */
interface OpenRouterModelInfo {
  id: string;
  pricing: {
    prompt: string;   // USD per token as string
    completion: string;
  };
  context_length: number;
  top_provider?: {
    max_completion_tokens?: number;
  };
}

export class OpenRouterProvider extends BaseProvider {
  private client: OpenAI;
  private siteUrl: string;
  private appName: string;
  private modelInfo: OpenRouterModelInfo | null = null;

  constructor(config: OpenRouterProviderConfig) {
    super(config);
    this.validateConfig();

    this.siteUrl = config.siteUrl || process.env.OPENROUTER_SITE_URL || 'https://testops-companion.dev';
    this.appName = config.appName || process.env.OPENROUTER_APP_NAME || 'TestOps Companion';

    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      timeout: config.timeout || 60000,
      defaultHeaders: {
        'HTTP-Referer': this.siteUrl,
        'X-Title': this.appName,
      },
    });
  }

  getName(): AIProviderName {
    return 'openrouter';
  }

  getPricing(): ProviderPricing {
    // If we've fetched model info, use real pricing
    if (this.modelInfo) {
      const promptCostPerToken = parseFloat(this.modelInfo.pricing.prompt);
      const completionCostPerToken = parseFloat(this.modelInfo.pricing.completion);

      return {
        inputTokenCostPer1k: promptCostPerToken * 1000,
        outputTokenCostPer1k: completionCostPerToken * 1000,
        embeddingCostPer1k: undefined,
      };
    }

    // Conservative default fallback until model info is fetched
    return {
      inputTokenCostPer1k: 0.005,
      outputTokenCostPer1k: 0.015,
      embeddingCostPer1k: undefined,
    };
  }

  getLimits(): ProviderLimits {
    // Use fetched model info if available
    if (this.modelInfo) {
      return {
        maxInputTokens: this.modelInfo.context_length,
        maxOutputTokens: this.modelInfo.top_provider?.max_completion_tokens || 4096,
        requestsPerMinute: 200, // OpenRouter free tier default
        tokensPerMinute: 100000,
      };
    }

    // Conservative defaults
    return {
      maxInputTokens: 128000,
      maxOutputTokens: 4096,
      requestsPerMinute: 200,
      tokensPerMinute: 100000,
    };
  }

  /**
   * Fetch model metadata from OpenRouter's /models endpoint.
   * Updates internal pricing and limits with real values.
   */
  async fetchModelInfo(): Promise<OpenRouterModelInfo | null> {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: { 'Authorization': `Bearer ${this.config.apiKey}` },
      });

      if (!response.ok) {
        logger.warn(`[OpenRouterProvider] Models API returned ${response.status}`);
        return null;
      }

      const data = await response.json() as { data: OpenRouterModelInfo[] };
      const model = data.data.find(m => m.id === this.config.model);

      if (model) {
        this.modelInfo = model;
        // Refresh pricing and limits with real data
        this.pricing = this.getPricing();
        this.limits = this.getLimits();
      } else {
        logger.warn(`[OpenRouterProvider] Model '${this.config.model}' not found on OpenRouter`);
      }

      return model || null;
    } catch (error) {
      logger.warn('[OpenRouterProvider] Failed to fetch model info:', error);
      return null;
    }
  }

  async chat(messages: ChatMessage[], options?: CompletionOptions): Promise<AIResponse> {
    const startTime = Date.now();

    try {
      // Lazily fetch model info on first call if not loaded yet
      if (!this.modelInfo) {
        await this.fetchModelInfo();
      }

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

      // Make API call via OpenRouter (OpenAI-compatible)
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
        throw new Error('No response from OpenRouter');
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

  async embed(_text: string, _options?: EmbeddingOptions): Promise<number[]> {
    // OpenRouter doesn't support embeddings directly for most models
    throw new Error(
      'OpenRouter does not support embeddings. Use a dedicated embedding provider (OpenAI, Voyage AI, or Google) instead.'
    );
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
      logger.error(`[OpenRouterProvider] Health check failed:`, error);
      return false;
    }
  }

  /**
   * Get the cached model info (null if not yet fetched)
   */
  getModelInfo(): OpenRouterModelInfo | null {
    return this.modelInfo;
  }

  /**
   * Override error handling for OpenRouter-specific errors
   */
  protected handleError(error: unknown): never {
    const err = error as Record<string, unknown>;
    const response = err.response as Record<string, unknown> | undefined;
    const errorMessage = err.message as string | undefined;

    if (response) {
      const status = response.status as number;
      const data = response.data as Record<string, unknown> | undefined;
      const nestedError = data?.error as Record<string, unknown> | undefined;
      const message = (nestedError?.message as string) || errorMessage || 'Unknown error';

      if (status === 401) {
        throw new Error(`${this.getName()} authentication failed: Invalid API key`);
      } else if (status === 402) {
        throw new Error(`${this.getName()} payment required: Insufficient credits`);
      } else if (status === 429) {
        throw new Error(`${this.getName()} rate limit exceeded: ${message}`);
      } else if (status === 502 || status === 503) {
        throw new Error(`${this.getName()} upstream provider error: ${message}`);
      } else {
        throw new Error(`${this.getName()} error (${status}): ${message}`);
      }
    }

    throw new Error(`${this.getName()} request failed: ${errorMessage || error}`);
  }
}
