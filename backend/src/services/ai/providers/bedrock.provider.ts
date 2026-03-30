/**
 * AI Providers - AWS Bedrock Implementation
 *
 * Uses the AWS Bedrock Runtime SDK to invoke Anthropic Claude models
 * hosted on AWS Bedrock. Supports IAM role-based auth or explicit
 * credentials via environment variables.
 */

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { BaseProvider, CompletionOptions, EmbeddingOptions, ProviderConfig, ProviderLimits, ProviderPricing } from './base.provider';
import { AIProviderName, AIResponse, ChatMessage, ToolCall } from '../types';
import { ToolParameter } from '../tools/types';
import { logger } from '@/utils/logger';

export interface BedrockProviderConfig extends ProviderConfig {
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  embeddingModel?: string;
}

/** Bedrock message in Anthropic Messages API format */
interface BedrockMessage {
  role: string;
  content: unknown;
}

export class BedrockProvider extends BaseProvider {
  private client: BedrockRuntimeClient;
  private region: string;
  private embeddingModel: string;

  constructor(config: BedrockProviderConfig) {
    // Bedrock doesn't need a traditional API key — use a placeholder so base validation passes
    super({ ...config, apiKey: config.apiKey || 'bedrock-iam-auth' });

    this.region = config.region || 'us-east-1';
    this.embeddingModel = config.embeddingModel || 'amazon.titan-embed-text-v2:0';

    const clientConfig: Record<string, unknown> = {
      region: this.region,
    };

    // Explicit credentials override IAM role (useful for local dev / SSO)
    if (config.accessKeyId && config.secretAccessKey) {
      clientConfig.credentials = {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
        ...(config.sessionToken && { sessionToken: config.sessionToken }),
      };
    }

    this.client = new BedrockRuntimeClient(clientConfig);
  }

  getName(): AIProviderName {
    return 'bedrock';
  }

  getPricing(): ProviderPricing {
    const modelPricing: Record<string, ProviderPricing> = {
      'claude-opus': { inputTokenCostPer1k: 0.018, outputTokenCostPer1k: 0.09 },
      'claude-sonnet': { inputTokenCostPer1k: 0.003, outputTokenCostPer1k: 0.015 },
      'claude-haiku': { inputTokenCostPer1k: 0.0008, outputTokenCostPer1k: 0.004 },
    };

    const model = this.config.model.toLowerCase();
    for (const [key, pricing] of Object.entries(modelPricing)) {
      if (model.includes(key)) return pricing;
    }
    return modelPricing['claude-sonnet'];
  }

  getLimits(): ProviderLimits {
    return {
      maxInputTokens: 200000,
      maxOutputTokens: 8192,
      requestsPerMinute: 50,
      tokensPerMinute: 80000,
    };
  }

  async chat(messages: ChatMessage[], options?: CompletionOptions): Promise<AIResponse> {
    const startTime = Date.now();

    try {
      const systemMessage = messages.find(m => m.role === 'system')?.content || options?.systemPrompt;
      const chatMessages = messages.filter(m => m.role !== 'system');

      const body: Record<string, unknown> = {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: options?.maxTokens || this.config.maxTokens || 4096,
        temperature: options?.temperature ?? this.config.temperature ?? 1.0,
        messages: this.convertMessages(chatMessages),
        stop_sequences: options?.stopSequences,
        top_p: options?.topP,
      };
      if (systemMessage) body.system = systemMessage;
      if (options?.tools?.length) body.tools = this.buildToolSchemas(options.tools);

      const command = new InvokeModelCommand({
        modelId: this.config.model,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(body),
      });

      const response = await this.client.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      const { content, toolCalls } = this.parseResponseContent(responseBody);

      const inputTokens = responseBody.usage?.input_tokens || 0;
      const outputTokens = responseBody.usage?.output_tokens || 0;

      return {
        content,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        provider: this.getName(),
        model: this.config.model,
        usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens },
        cost: this.calculateCost(inputTokens, outputTokens),
        cached: false,
        responseTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      this.handleError(error);
    }
  }

  async embed(text: string, options?: EmbeddingOptions): Promise<number[]> {
    const modelId = options?.model || this.embeddingModel;

    try {
      const body = JSON.stringify({
        inputText: text,
        dimensions: 1024,
        normalize: true,
      });

      const command = new InvokeModelCommand({
        modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: new TextEncoder().encode(body),
      });

      const response = await this.client.send(command);
      const result = JSON.parse(new TextDecoder().decode(response.body));

      if (!Array.isArray(result.embedding)) {
        throw new Error(`Unexpected Titan Embedding response — missing embedding array`);
      }

      return result.embedding;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Bedrock embedding failed (model: ${modelId}): ${message}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const command = new InvokeModelCommand({
        modelId: this.config.model,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }],
        }),
      });

      const response = await this.client.send(command);
      const body = JSON.parse(new TextDecoder().decode(response.body));
      return Array.isArray(body.content) && body.content.length > 0;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const name = error instanceof Error ? error.name : 'UnknownError';
      logger.error(`[BedrockProvider] Health check failed (${name}): ${msg}`);
      // Store last error for diagnostics
      this.lastHealthError = `${name}: ${msg}`;
      return false;
    }
  }

  /** Last health check error message (for diagnostics) */
  lastHealthError: string | null = null;

  // ── Private helpers ──

  private convertMessages(messages: ChatMessage[]): BedrockMessage[] {
    return messages.map(msg => {
      if (msg.role === 'user') {
        return { role: 'user', content: msg.content };
      }
      if (msg.role === 'assistant') {
        const content: Array<Record<string, unknown>> = [];
        if (msg.content) content.push({ type: 'text', text: msg.content });
        if (msg.toolCalls) {
          msg.toolCalls.forEach(tc => {
            content.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.arguments });
          });
        }
        return { role: 'assistant', content };
      }
      if (msg.role === 'tool') {
        return {
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: msg.toolCallId, content: msg.content }],
        };
      }
      return { role: 'user', content: msg.content };
    });
  }

  private buildToolSchemas(tools: CompletionOptions['tools'] & object) {
    return tools.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: {
        type: 'object',
        properties: t.parameters.reduce((acc: Record<string, unknown>, p: ToolParameter) => {
          acc[p.name] = { type: p.type, description: p.description, enum: p.enum };
          return acc;
        }, {}),
        required: t.parameters.filter((p: ToolParameter) => p.required).map((p: ToolParameter) => p.name),
      },
    }));
  }

  private parseResponseContent(responseBody: Record<string, unknown>): { content: string; toolCalls: ToolCall[] } {
    let content = '';
    const toolCalls: ToolCall[] = [];

    const blocks = responseBody.content as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(blocks)) {
      blocks.forEach(block => {
        if (block.type === 'text') {
          content += block.text as string;
        } else if (block.type === 'tool_use') {
          toolCalls.push({
            id: block.id as string,
            name: block.name as string,
            arguments: block.input as Record<string, unknown>,
          });
        }
      });
    }
    return { content, toolCalls };
  }
}
