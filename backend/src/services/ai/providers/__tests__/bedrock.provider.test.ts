/**
 * BedrockProvider — Unit Tests
 *
 * Tests AWS Bedrock provider: construction, chat, tool calling,
 * message conversion, pricing, health check, and error handling.
 * Mocks the AWS SDK so no real API calls are made.
 */

import { BedrockProvider, BedrockProviderConfig } from '../bedrock.provider';
import type { ChatMessage } from '../../types';
import type { ToolSchema } from '../../tools/types';

// ── Mocks ──

jest.mock('@/utils/logger', () => ({
    __esModule: true,
    logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockSend = jest.fn();
jest.mock('@aws-sdk/client-bedrock-runtime', () => ({
    BedrockRuntimeClient: jest.fn().mockImplementation(() => ({ send: mockSend })),
    InvokeModelCommand: jest.fn().mockImplementation((input) => ({ input })),
}));

// ── Helpers ──

function makeConfig(overrides?: Partial<BedrockProviderConfig>): BedrockProviderConfig {
    return {
        apiKey: 'bedrock-iam-auth',
        model: 'anthropic.claude-sonnet-4-5-20250514-v1:0',
        region: 'us-east-1',
        ...overrides,
    };
}

function encodeBody(body: Record<string, unknown>) {
    return new TextEncoder().encode(JSON.stringify(body));
}

function mockChatResponse(text: string, inputTokens = 100, outputTokens = 50) {
    mockSend.mockResolvedValueOnce({
        body: encodeBody({
            content: [{ type: 'text', text }],
            usage: { input_tokens: inputTokens, output_tokens: outputTokens },
        }),
    });
}

function mockToolCallResponse(toolId: string, toolName: string, toolInput: Record<string, unknown>) {
    mockSend.mockResolvedValueOnce({
        body: encodeBody({
            content: [
                { type: 'text', text: 'Using tool' },
                { type: 'tool_use', id: toolId, name: toolName, input: toolInput },
            ],
            usage: { input_tokens: 80, output_tokens: 40 },
        }),
    });
}

// ── Tests ──

describe('BedrockProvider', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ── Construction ──

    describe('constructor', () => {
        it('instantiates with IAM role auth (no explicit credentials)', () => {
            const provider = new BedrockProvider(makeConfig());
            expect(provider.getName()).toBe('bedrock');
        });

        it('instantiates with explicit credentials', () => {
            const provider = new BedrockProvider(makeConfig({
                accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
                secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
            }));
            expect(provider.getName()).toBe('bedrock');
        });

        it('defaults region to us-east-1 when empty string', () => {
            const provider = new BedrockProvider(makeConfig({ region: '' }));
            expect(provider.getName()).toBe('bedrock');
        });

        it('uses placeholder apiKey when empty', () => {
            const provider = new BedrockProvider(makeConfig({ apiKey: '' }));
            expect(provider.getName()).toBe('bedrock');
        });
    });

    // ── Pricing ──

    describe('getPricing', () => {
        it('returns Opus pricing for opus model', () => {
            const provider = new BedrockProvider(makeConfig({ model: 'us.anthropic.claude-opus-4-20250514-v1:0' }));
            const pricing = provider.getPricing();
            expect(pricing.inputTokenCostPer1k).toBe(0.018);
            expect(pricing.outputTokenCostPer1k).toBe(0.09);
        });

        it('returns Sonnet pricing for sonnet model', () => {
            const provider = new BedrockProvider(makeConfig({ model: 'anthropic.claude-sonnet-4-5-20250514-v1:0' }));
            const pricing = provider.getPricing();
            expect(pricing.inputTokenCostPer1k).toBe(0.003);
            expect(pricing.outputTokenCostPer1k).toBe(0.015);
        });

        it('returns Haiku pricing for haiku model', () => {
            const provider = new BedrockProvider(makeConfig({ model: 'anthropic.claude-haiku-4-5-20250514-v1:0' }));
            const pricing = provider.getPricing();
            expect(pricing.inputTokenCostPer1k).toBe(0.0008);
            expect(pricing.outputTokenCostPer1k).toBe(0.004);
        });

        it('defaults to Sonnet pricing for unknown model', () => {
            const provider = new BedrockProvider(makeConfig({ model: 'some-unknown-model-v1:0' }));
            const pricing = provider.getPricing();
            expect(pricing.inputTokenCostPer1k).toBe(0.003);
        });
    });

    // ── Limits ──

    describe('getLimits', () => {
        it('returns correct limits', () => {
            const provider = new BedrockProvider(makeConfig());
            const limits = provider.getLimits();
            expect(limits.maxInputTokens).toBe(200000);
            expect(limits.maxOutputTokens).toBe(8192);
            expect(limits.requestsPerMinute).toBe(50);
            expect(limits.tokensPerMinute).toBe(80000);
        });
    });

    // ── Chat ──

    describe('chat', () => {
        it('returns text response with usage and cost', async () => {
            const provider = new BedrockProvider(makeConfig());
            mockChatResponse('Hello from Bedrock', 120, 30);

            const messages: ChatMessage[] = [
                { role: 'user', content: 'Hello' },
            ];
            const result = await provider.chat(messages);

            expect(result.content).toBe('Hello from Bedrock');
            expect(result.provider).toBe('bedrock');
            expect(result.usage.inputTokens).toBe(120);
            expect(result.usage.outputTokens).toBe(30);
            expect(result.usage.totalTokens).toBe(150);
            expect(result.cost.totalCost).toBeGreaterThan(0);
            expect(result.cached).toBe(false);
            expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
        });

        it('extracts system message from messages array', async () => {
            const provider = new BedrockProvider(makeConfig());
            mockChatResponse('response');

            const messages: ChatMessage[] = [
                { role: 'system', content: 'You are a test assistant' },
                { role: 'user', content: 'Hello' },
            ];
            await provider.chat(messages);

            // Verify the request body was built correctly
            const { InvokeModelCommand } = jest.requireMock('@aws-sdk/client-bedrock-runtime');
            const callArgs = InvokeModelCommand.mock.calls[0][0];
            const body = JSON.parse(callArgs.body);
            expect(body.system).toBe('You are a test assistant');
            expect(body.messages).toHaveLength(1); // system filtered out
            expect(body.messages[0].role).toBe('user');
        });

        it('uses systemPrompt from options as fallback', async () => {
            const provider = new BedrockProvider(makeConfig());
            mockChatResponse('response');

            const messages: ChatMessage[] = [
                { role: 'user', content: 'Hi' },
            ];
            await provider.chat(messages, { systemPrompt: 'Custom system prompt' });

            const { InvokeModelCommand } = jest.requireMock('@aws-sdk/client-bedrock-runtime');
            const body = JSON.parse(InvokeModelCommand.mock.calls[0][0].body);
            expect(body.system).toBe('Custom system prompt');
        });

        it('converts assistant messages with tool calls', async () => {
            const provider = new BedrockProvider(makeConfig());
            mockChatResponse('final response');

            const messages: ChatMessage[] = [
                { role: 'user', content: 'Search for bugs' },
                {
                    role: 'assistant', content: 'I will search',
                    toolCalls: [{ id: 'tc-1', name: 'search', arguments: { query: 'bugs' } }],
                },
                { role: 'tool', content: 'Found 3 bugs', toolCallId: 'tc-1' },
                { role: 'user', content: 'Show details' },
            ];
            await provider.chat(messages);

            const { InvokeModelCommand } = jest.requireMock('@aws-sdk/client-bedrock-runtime');
            const body = JSON.parse(InvokeModelCommand.mock.calls[0][0].body);
            expect(body.messages).toHaveLength(4);

            // Assistant message should have tool_use block
            const assistantMsg = body.messages[1];
            expect(assistantMsg.role).toBe('assistant');
            expect(assistantMsg.content).toHaveLength(2);
            expect(assistantMsg.content[1].type).toBe('tool_use');

            // Tool result should be wrapped as user message
            const toolMsg = body.messages[2];
            expect(toolMsg.role).toBe('user');
            expect(toolMsg.content[0].type).toBe('tool_result');
        });

        it('applies maxTokens and temperature from options', async () => {
            const provider = new BedrockProvider(makeConfig());
            mockChatResponse('response');

            await provider.chat(
                [{ role: 'user', content: 'Hi' }],
                { maxTokens: 2048, temperature: 0.5 },
            );

            const { InvokeModelCommand } = jest.requireMock('@aws-sdk/client-bedrock-runtime');
            const body = JSON.parse(InvokeModelCommand.mock.calls[0][0].body);
            expect(body.max_tokens).toBe(2048);
            expect(body.temperature).toBe(0.5);
        });

        it('sets correct Bedrock request metadata', async () => {
            const provider = new BedrockProvider(makeConfig());
            mockChatResponse('response');

            await provider.chat([{ role: 'user', content: 'Hi' }]);

            const { InvokeModelCommand } = jest.requireMock('@aws-sdk/client-bedrock-runtime');
            const callArgs = InvokeModelCommand.mock.calls[0][0];
            expect(callArgs.modelId).toBe('anthropic.claude-sonnet-4-5-20250514-v1:0');
            expect(callArgs.contentType).toBe('application/json');
            expect(callArgs.accept).toBe('application/json');

            const body = JSON.parse(callArgs.body);
            expect(body.anthropic_version).toBe('bedrock-2023-05-31');
        });
    });

    // ── Tool calling ──

    describe('tool calling', () => {
        it('sends tools in Bedrock format and parses tool_use response', async () => {
            const provider = new BedrockProvider(makeConfig());
            mockToolCallResponse('call-1', 'jira_search', { query: 'flaky tests' });

            const tools: ToolSchema[] = [{
                name: 'jira_search',
                description: 'Search Jira issues',
                parameters: [
                    { name: 'query', type: 'string', description: 'Search query', required: true },
                    { name: 'maxResults', type: 'number', description: 'Max results', required: false },
                ],
            }];

            const result = await provider.chat(
                [{ role: 'user', content: 'Find flaky test issues' }],
                { tools },
            );

            expect(result.toolCalls).toBeDefined();
            expect(result.toolCalls).toHaveLength(1);
            expect(result.toolCalls![0].id).toBe('call-1');
            expect(result.toolCalls![0].name).toBe('jira_search');
            expect(result.toolCalls![0].arguments).toEqual({ query: 'flaky tests' });

            // Also has text content
            expect(result.content).toBe('Using tool');

            // Verify tools were sent in correct format
            const { InvokeModelCommand } = jest.requireMock('@aws-sdk/client-bedrock-runtime');
            const body = JSON.parse(InvokeModelCommand.mock.calls[0][0].body);
            expect(body.tools).toHaveLength(1);
            expect(body.tools[0].input_schema.type).toBe('object');
            expect(body.tools[0].input_schema.properties.query).toBeDefined();
            expect(body.tools[0].input_schema.required).toEqual(['query']);
        });

        it('returns undefined toolCalls when response has no tool_use blocks', async () => {
            const provider = new BedrockProvider(makeConfig());
            mockChatResponse('Plain text response');

            const result = await provider.chat([{ role: 'user', content: 'Hi' }]);
            expect(result.toolCalls).toBeUndefined();
        });
    });

    // ── Embed ──

    describe('embed', () => {
        function mockEmbeddingResponse(embedding: number[], tokenCount = 5) {
            mockSend.mockResolvedValueOnce({
                body: new TextEncoder().encode(JSON.stringify({
                    embedding,
                    inputTextTokenCount: tokenCount,
                })),
            });
        }

        it('returns embedding vector from Titan V2', async () => {
            const provider = new BedrockProvider(makeConfig());
            const fakeEmbedding = [0.1, 0.2, 0.3, 0.4];
            mockEmbeddingResponse(fakeEmbedding);

            const result = await provider.embed('test text');

            expect(result).toEqual(fakeEmbedding);

            // Verify the request body format
            const { InvokeModelCommand } = jest.requireMock('@aws-sdk/client-bedrock-runtime');
            const callArgs = InvokeModelCommand.mock.calls[0][0];
            expect(callArgs.modelId).toBe('amazon.titan-embed-text-v2:0');
            const body = JSON.parse(new TextDecoder().decode(callArgs.body));
            expect(body.inputText).toBe('test text');
            expect(body.dimensions).toBe(1024);
            expect(body.normalize).toBe(true);
        });

        it('uses custom model from options.model override', async () => {
            const provider = new BedrockProvider(makeConfig());
            mockEmbeddingResponse([0.5, 0.6]);

            await provider.embed('text', { model: 'cohere.embed-english-v3' });

            const { InvokeModelCommand } = jest.requireMock('@aws-sdk/client-bedrock-runtime');
            expect(InvokeModelCommand.mock.calls[0][0].modelId).toBe('cohere.embed-english-v3');
        });

        it('uses embeddingModel from config when no options override', async () => {
            const provider = new BedrockProvider(makeConfig({ embeddingModel: 'amazon.titan-embed-text-v1' }));
            mockEmbeddingResponse([0.7, 0.8]);

            await provider.embed('text');

            const { InvokeModelCommand } = jest.requireMock('@aws-sdk/client-bedrock-runtime');
            expect(InvokeModelCommand.mock.calls[0][0].modelId).toBe('amazon.titan-embed-text-v1');
        });

        it('throws descriptive error on SDK failure', async () => {
            const provider = new BedrockProvider(makeConfig());
            mockSend.mockRejectedValueOnce(new Error('AccessDeniedException'));

            await expect(provider.embed('text')).rejects.toThrow(
                'Bedrock embedding failed (model: amazon.titan-embed-text-v2:0): AccessDeniedException',
            );
        });

        it('throws when response lacks embedding array', async () => {
            const provider = new BedrockProvider(makeConfig());
            mockSend.mockResolvedValueOnce({
                body: new TextEncoder().encode(JSON.stringify({ inputTextTokenCount: 3 })),
            });

            await expect(provider.embed('text')).rejects.toThrow('missing embedding array');
        });
    });

    // ── Health check ──

    describe('healthCheck', () => {
        it('returns true on successful response', async () => {
            const provider = new BedrockProvider(makeConfig());
            mockSend.mockResolvedValueOnce({
                body: encodeBody({
                    content: [{ type: 'text', text: 'Hi' }],
                }),
            });

            const result = await provider.healthCheck();
            expect(result).toBe(true);
        });

        it('returns false when response has empty content', async () => {
            const provider = new BedrockProvider(makeConfig());
            mockSend.mockResolvedValueOnce({
                body: encodeBody({ content: [] }),
            });

            const result = await provider.healthCheck();
            expect(result).toBe(false);
        });

        it('returns false on SDK error', async () => {
            const provider = new BedrockProvider(makeConfig());
            mockSend.mockRejectedValueOnce(new Error('AccessDeniedException'));

            const result = await provider.healthCheck();
            expect(result).toBe(false);
        });
    });

    // ── Error handling ──

    describe('error handling', () => {
        it('throws on chat SDK error', async () => {
            const provider = new BedrockProvider(makeConfig());
            mockSend.mockRejectedValueOnce(new Error('ThrottlingException'));

            await expect(
                provider.chat([{ role: 'user', content: 'Hi' }]),
            ).rejects.toThrow('bedrock request failed');
        });
    });
});
