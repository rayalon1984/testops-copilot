/**
 * AI Providers - Anthropic Claude Implementation
 */

import Anthropic from '@anthropic-ai/sdk';
import { BaseProvider, CompletionOptions, EmbeddingOptions, ProviderConfig, ProviderLimits, ProviderPricing } from './base.provider';
import { AIProviderName, AIResponse, ChatMessage, ToolCall } from '../types';
import { ToolParameter } from '../tools/types';

/** Anthropic Messages API message format */
interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlock[];
}

/** Content block in an Anthropic message */
type AnthropicContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string | undefined; content: string };

/** Anthropic API request parameters */
interface AnthropicRequestParams {
  model: string;
  max_tokens: number;
  temperature: number;
  system: string | undefined;
  messages: AnthropicMessage[];
  stop_sequences: string[] | undefined;
  top_p: number | undefined;
  tools?: Array<{
    name: string;
    description: string;
    input_schema: {
      type: string;
      properties: Record<string, { type: string; description: string; enum?: string[] }>;
      required: string[];
    };
  }>;
}

export class AnthropicProvider extends BaseProvider {
  private client: Anthropic;

  constructor(config: ProviderConfig) {
    super(config);
    this.validateConfig();

    this.client = new Anthropic({
      apiKey: config.apiKey,
      timeout: config.timeout || 60000, // 60 seconds default
    });
  }

  getName(): AIProviderName {
    return 'anthropic';
  }

  getPricing(): ProviderPricing {
    // Pricing as of February 2026 for Claude Opus 4.6
    // Check https://www.anthropic.com/api for latest pricing
    return {
      inputTokenCostPer1k: 0.015,   // $15 per million input tokens
      outputTokenCostPer1k: 0.075,  // $75 per million output tokens
      embeddingCostPer1k: undefined, // Anthropic doesn't provide embeddings directly
    };
  }

  getLimits(): ProviderLimits {
    return {
      maxInputTokens: 200000,      // 200k context window
      maxOutputTokens: 8192,       // 8k max output
      requestsPerMinute: 50,       // Default tier
      tokensPerMinute: 40000,      // Default tier
    };
  }

  async chat(messages: ChatMessage[], options?: CompletionOptions): Promise<AIResponse> {
    const startTime = Date.now();

    try {
      // Extract system message if present
      const systemMessage = messages.find(m => m.role === 'system')?.content || options?.systemPrompt;
      const chatMessages = messages.filter(m => m.role !== 'system');

      // Convert messages to Anthropic format
      const anthropicMessages: AnthropicMessage[] = chatMessages.map(msg => {
        if (msg.role === 'user') {
          return { role: 'user' as const, content: msg.content };
        }

        if (msg.role === 'assistant') {
          const content: AnthropicContentBlock[] = [];
          if (msg.content) content.push({ type: 'text', text: msg.content });
          if (msg.toolCalls) {
            msg.toolCalls.forEach(tc => {
              content.push({
                type: 'tool_use',
                id: tc.id,
                name: tc.name,
                input: tc.arguments
              });
            });
          }
          return { role: 'assistant' as const, content };
        }

        if (msg.role === 'tool') {
          return {
            role: 'user' as const,
            content: [
              {
                type: 'tool_result' as const,
                tool_use_id: msg.toolCallId,
                content: msg.content
              }
            ]
          };
        }

        return { role: 'user' as const, content: msg.content };
      });

      // Prepare params
      const params: any = {
        model: this.config.model,
        max_tokens: options?.maxTokens || this.config.maxTokens || 4096,
        temperature: options?.temperature ?? this.config.temperature ?? 1.0,
        system: systemMessage,
        messages: anthropicMessages,
        stop_sequences: options?.stopSequences,
        top_p: options?.topP,
      };

      // Add tools if provided
      if (options?.tools && options.tools.length > 0) {
        params.tools = options.tools.map(t => ({
          name: t.name,
          description: t.description,
          input_schema: {
            type: 'object',
            properties: t.parameters.reduce((acc: any, p: any) => {
              acc[p.name] = {
                type: p.type,
                description: p.description,
                enum: p.enum
              };
              return acc;
            }, {}),
            required: t.parameters.filter((p: any) => p.required).map((p: any) => p.name)
          }
        }));
      }

      // Make API call
      const response = await this.client.messages.create(params);

      // Process content and tools
      let content = '';
      const toolCalls: any[] = [];

      response.content.forEach(block => {
        if (block.type === 'text') {
          content += block.text;
        } else if (block.type === 'tool_use') {
          toolCalls.push({
            id: block.id,
            name: block.name,
            arguments: block.input
          });
        }
      });

      // Calculate costs
      const inputTokens = response.usage.input_tokens;
      const outputTokens = response.usage.output_tokens;
      const cost = this.calculateCost(inputTokens, outputTokens);

      return {
        content,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
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
    // Anthropic doesn't provide embeddings directly
    // Users should use Voyage AI which is recommended by Anthropic
    throw new Error(
      'Anthropic does not provide embeddings. Please use Voyage AI (VOYAGE_API_KEY) for embeddings when using Anthropic.'
    );
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Make a minimal API call to check health
      const response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }],
      });

      return response.content.length > 0;
    } catch (error) {
      console.error(`Anthropic health check failed:`, error);
      return false;
    }
  }
}
