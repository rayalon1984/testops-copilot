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
    // Pricing for OpenAI models
    const modelPricing: Record<string, ProviderPricing> = {
      'gpt-4o': {
        inputTokenCostPer1k: 0.0025,
        outputTokenCostPer1k: 0.01,
      },
      'gpt-4o-mini': {
        inputTokenCostPer1k: 0.00015,
        outputTokenCostPer1k: 0.0006,
      },
      'gpt-3.5-turbo': {
        inputTokenCostPer1k: 0.0005,
        outputTokenCostPer1k: 0.0015,
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

    return modelPricing[this.config.model] || modelPricing['gpt-4o'];
  }

  getLimits(): ProviderLimits {
    return {
      maxInputTokens: 128000,
      maxOutputTokens: 4096,
      requestsPerMinute: 3500,
      tokensPerMinute: 60000,
    };
  }

  async chat(messages: ChatMessage[], options?: CompletionOptions): Promise<AIResponse> {
    const startTime = Date.now();

    try {
      // Convert messages to OpenAI format
      const openaiMessages: any[] = messages.map(msg => {
        const out: any = {
          role: msg.role === 'tool' ? 'tool' : (msg.role as 'system' | 'user' | 'assistant'),
          content: msg.content,
        };
        if (msg.toolCallId) out.tool_call_id = msg.toolCallId;
        if (msg.name) out.name = msg.name;
        if (msg.toolCalls) {
          out.tool_calls = msg.toolCalls.map(tc => ({
            id: tc.id,
            type: 'function',
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments)
            }
          }));
        }
        return out;
      });

      // Add system prompt if provided in options
      if (options?.systemPrompt && !messages.find(m => m.role === 'system')) {
        openaiMessages.unshift({
          role: 'system',
          content: options.systemPrompt,
        });
      }

      // Format tools for OpenAI
      const tools = options?.tools?.map(t => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters
        }
      }));

      // Make API call
      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: openaiMessages,
        tools: tools && tools.length > 0 ? (tools as any) : undefined,
        max_tokens: options?.maxTokens || this.config.maxTokens || 4096,
        temperature: options?.temperature ?? this.config.temperature ?? 1.0,
        top_p: options?.topP,
        stop: options?.stopSequences,
      });

      const choice = response.choices[0];
      if (!choice || !choice.message) {
        throw new Error('No response from OpenAI');
      }

      // Parse tool calls if present
      const toolCalls = (choice.message as any).tool_calls?.map((tc: any) => {
        let args: Record<string, unknown>;
        try {
          args = JSON.parse(tc.function.arguments);
        } catch {
          console.warn(`Failed to parse tool call arguments for ${tc.function.name}:`, tc.function.arguments);
          args = {};
        }
        return { id: tc.id, name: tc.function.name, arguments: args };
      });

      // Calculate costs
      const inputTokens = response.usage?.prompt_tokens || 0;
      const outputTokens = response.usage?.completion_tokens || 0;
      const cost = this.calculateCost(inputTokens, outputTokens);

      return {
        content: choice.message.content || '',
        toolCalls,
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
