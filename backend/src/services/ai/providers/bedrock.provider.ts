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
import { AIProviderName, AIResponse, ChatMessage } from '../types';

export interface BedrockProviderConfig extends ProviderConfig {
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

export class BedrockProvider extends BaseProvider {
  private client: BedrockRuntimeClient;
  private region: string;

  constructor(config: BedrockProviderConfig) {
    // Bedrock doesn't need a traditional API key — use a placeholder so base validation passes
    super({ ...config, apiKey: config.apiKey || 'bedrock-iam-auth' });

    this.region = config.region || 'us-east-1';

    const clientConfig: Record<string, unknown> = {
      region: this.region,
    };

    // Explicit credentials override IAM role (useful for local dev)
    if (config.accessKeyId && config.secretAccessKey) {
      clientConfig.credentials = {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      };
    }

    this.client = new BedrockRuntimeClient(clientConfig);
  }

  getName(): AIProviderName {
    return 'bedrock';
  }

  getPricing(): ProviderPricing {
    // Bedrock pricing for Anthropic Claude models (February 2026)
    // Slightly higher than direct Anthropic API due to Bedrock margin
    const modelPricing: Record<string, ProviderPricing> = {
      'claude-opus': {
        inputTokenCostPer1k: 0.018,
        outputTokenCostPer1k: 0.09,
      },
      'claude-sonnet': {
        inputTokenCostPer1k: 0.003,
        outputTokenCostPer1k: 0.015,
      },
      'claude-haiku': {
        inputTokenCostPer1k: 0.0008,
        outputTokenCostPer1k: 0.004,
      },
    };

    const model = this.config.model.toLowerCase();
    for (const [key, pricing] of Object.entries(modelPricing)) {
      if (model.includes(key)) {
        return pricing;
      }
    }

    // Default to Sonnet pricing
    return modelPricing['claude-sonnet'];
  }

  getLimits(): ProviderLimits {
    return {
      maxInputTokens: 200000,
      maxOutputTokens: 8192,
      requestsPerMinute: 50,   // Bedrock default — varies by provisioned throughput
      tokensPerMinute: 80000,
    };
  }

  async chat(messages: ChatMessage[], options?: CompletionOptions): Promise<AIResponse> {
    const startTime = Date.now();

    try {
      // Extract system message
      const systemMessage = messages.find(m => m.role === 'system')?.content || options?.systemPrompt;
      const chatMessages = messages.filter(m => m.role !== 'system');

      // Convert to Anthropic Messages API format (Bedrock uses this natively for Claude)
      const anthropicMessages: Array<{ role: string; content: unknown }> = chatMessages.map(msg => {
        if (msg.role === 'user') {
          return { role: 'user', content: msg.content };
        }

        if (msg.role === 'assistant') {
          const content: Array<Record<string, unknown>> = [];
          if (msg.content) content.push({ type: 'text', text: msg.content });
          if (msg.toolCalls) {
            msg.toolCalls.forEach(tc => {
              content.push({
                type: 'tool_use',
                id: tc.id,
                name: tc.name,
                input: tc.arguments,
              });
            });
          }
          return { role: 'assistant', content };
        }

        if (msg.role === 'tool') {
          return {
            role: 'user',
            content: [{
              type: 'tool_result',
              tool_use_id: msg.toolCallId,
              content: msg.content,
            }],
          };
        }

        return { role: 'user', content: msg.content };
      });

      // Build Bedrock request body (Anthropic Messages API format)
      const body: Record<string, unknown> = {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: options?.maxTokens || this.config.maxTokens || 4096,
        temperature: options?.temperature ?? this.config.temperature ?? 1.0,
        messages: anthropicMessages,
        stop_sequences: options?.stopSequences,
        top_p: options?.topP,
      };

      if (systemMessage) {
        body.system = systemMessage;
      }

      // Add tools if provided
      if (options?.tools && options.tools.length > 0) {
        body.tools = options.tools.map((t: Record<string, any>) => ({
          name: t.name,
          description: t.description,
          input_schema: {
            type: 'object',
            properties: t.parameters.reduce((acc: Record<string, unknown>, p: Record<string, any>) => {
              acc[p.name] = {
                type: p.type,
                description: p.description,
                enum: p.enum,
              };
              return acc;
            }, {}),
            required: t.parameters.filter((p: Record<string, any>) => p.required).map((p: Record<string, any>) => p.name),
          },
        }));
      }

      const command = new InvokeModelCommand({
        modelId: this.config.model,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(body),
      });

      const response = await this.client.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));

      // Parse response (same structure as Anthropic Messages API)
      let content = '';
      const toolCalls: Array<{ id: string; name: string; arguments: Record<string, any> }> = [];

      if (Array.isArray(responseBody.content)) {
        responseBody.content.forEach((block: Record<string, any>) => {
          if (block.type === 'text') {
            content += block.text;
          } else if (block.type === 'tool_use') {
            toolCalls.push({
              id: block.id,
              name: block.name,
              arguments: block.input as Record<string, any>,
            });
          }
        });
      }

      const inputTokens = responseBody.usage?.input_tokens || 0;
      const outputTokens = responseBody.usage?.output_tokens || 0;
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
    // Bedrock supports embedding models (e.g. Amazon Titan Embeddings)
    // but our Bedrock integration focuses on Claude chat models
    throw new Error(
      'Bedrock embedding requires a separate embedding model deployment. Use Amazon Titan Embeddings or Cohere Embed via Bedrock directly.',
    );
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
      console.error('Bedrock health check failed:', error);
      return false;
    }
  }
}
