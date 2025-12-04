/**
 * AI Providers - Google Gemini Implementation
 */

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { BaseProvider, CompletionOptions, EmbeddingOptions, ProviderConfig, ProviderLimits, ProviderPricing } from './base.provider';
import { AIProviderName, AIResponse, ChatMessage } from '../types';

export class GoogleProvider extends BaseProvider {
  private client: GoogleGenerativeAI;
  private model: GenerativeModel;

  constructor(config: ProviderConfig) {
    super(config);
    this.validateConfig();

    this.client = new GoogleGenerativeAI(config.apiKey);
    this.model = this.client.getGenerativeModel({ model: config.model });
  }

  getName(): AIProviderName {
    return 'google';
  }

  getPricing(): ProviderPricing {
    // Pricing for Gemini models as of January 2025
    // Check https://ai.google.dev/pricing for latest pricing
    const modelPricing: Record<string, ProviderPricing> = {
      'gemini-pro': {
        inputTokenCostPer1k: 0.0005,
        outputTokenCostPer1k: 0.0015,
        embeddingCostPer1k: 0.0001,
      },
      'gemini-1.5-pro': {
        inputTokenCostPer1k: 0.00125,
        outputTokenCostPer1k: 0.00375,
        embeddingCostPer1k: 0.0001,
      },
      'gemini-1.5-flash': {
        inputTokenCostPer1k: 0.000075,
        outputTokenCostPer1k: 0.0003,
        embeddingCostPer1k: 0.00001,
      },
      'text-embedding-004': {
        inputTokenCostPer1k: 0.0000125,
        outputTokenCostPer1k: 0,
        embeddingCostPer1k: 0.0000125,
      },
    };

    return modelPricing[this.config.model] || modelPricing['gemini-pro'];
  }

  getLimits(): ProviderLimits {
    // Limits for Gemini models
    const modelLimits: Record<string, ProviderLimits> = {
      'gemini-pro': {
        maxInputTokens: 30720,
        maxOutputTokens: 2048,
        requestsPerMinute: 60,
        tokensPerMinute: 32000,
      },
      'gemini-1.5-pro': {
        maxInputTokens: 1000000, // 1M context window!
        maxOutputTokens: 8192,
        requestsPerMinute: 360,
        tokensPerMinute: 1000000,
      },
      'gemini-1.5-flash': {
        maxInputTokens: 1000000,
        maxOutputTokens: 8192,
        requestsPerMinute: 1000,
        tokensPerMinute: 4000000,
      },
    };

    return modelLimits[this.config.model] || modelLimits['gemini-pro'];
  }

  async chat(messages: ChatMessage[], options?: CompletionOptions): Promise<AIResponse> {
    const startTime = Date.now();

    try {
      // Extract system message if present
      const systemInstruction = messages.find(m => m.role === 'system')?.content || options?.systemPrompt;
      const chatMessages = messages.filter(m => m.role !== 'system');

      // Convert messages to Gemini format
      const geminiMessages = chatMessages.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      }));

      // Create chat session with history or use single message
      let result;
      if (geminiMessages.length > 1) {
        const chat = this.model.startChat({
          history: geminiMessages.slice(0, -1),
          generationConfig: {
            maxOutputTokens: options?.maxTokens || this.config.maxTokens || 2048,
            temperature: options?.temperature ?? this.config.temperature ?? 1.0,
            topP: options?.topP,
            stopSequences: options?.stopSequences,
          },
          ...(systemInstruction ? { systemInstruction } : {}),
        });

        result = await chat.sendMessage(geminiMessages[geminiMessages.length - 1].parts);
      } else {
        result = await this.model.generateContent({
          contents: geminiMessages,
          generationConfig: {
            maxOutputTokens: options?.maxTokens || this.config.maxTokens || 2048,
            temperature: options?.temperature ?? this.config.temperature ?? 1.0,
            topP: options?.topP,
            stopSequences: options?.stopSequences,
          },
          ...(systemInstruction ? { systemInstruction } : {}),
        });
      }

      const response = await result.response;
      const content = response.text();

      // Gemini doesn't provide detailed token counts in all APIs
      // Estimate based on content length
      const inputTokens = this.estimateTokens(
        messages.map(m => m.content).join('\n')
      );
      const outputTokens = this.estimateTokens(content);
      const cost = this.calculateCost(inputTokens, outputTokens);

      return {
        content,
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
      const embeddingModel = options?.model || 'text-embedding-004';
      const model = this.client.getGenerativeModel({ model: embeddingModel });

      const result = await model.embedContent(text);

      if (!result.embedding || !result.embedding.values) {
        throw new Error('No embedding returned from Google');
      }

      return result.embedding.values;
    } catch (error) {
      this.handleError(error);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.model.generateContent('Hi');
      const response = await result.response;
      return response.text().length > 0;
    } catch (error) {
      console.error(`Google health check failed:`, error);
      return false;
    }
  }

  /**
   * Override error handling for Google-specific errors
   */
  protected handleError(error: any): never {
    if (error.message) {
      const message = error.message;

      if (message.includes('API key')) {
        throw new Error(`${this.getName()} authentication failed: Invalid API key`);
      } else if (message.includes('quota')) {
        throw new Error(`${this.getName()} quota exceeded: ${message}`);
      } else if (message.includes('rate limit')) {
        throw new Error(`${this.getName()} rate limit exceeded: ${message}`);
      }
    }

    // Fall back to base error handling
    throw new Error(`${this.getName()} request failed: ${error.message || error}`);
  }
}
