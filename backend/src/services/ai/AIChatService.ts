/**
 * AIChatService — Core ReAct Loop with SSE Streaming
 *
 * Orchestrates the agentic AI copilot: system prompts, ReAct loop,
 * SSE streaming, and safety limits. Shared logic lives in chat-helpers.ts.
 */

import { Response } from 'express';
import { getAIManager } from './manager';
import { toolRegistry } from './tools';
import { SSEEvent, SSEEventType, ToolResult } from './tools/types';
import { ChatMessage } from './types';
import { classifyTool } from './AutonomyClassifier';
import { evaluateSuggestion } from './ProactiveSuggestionEngine';
import { estimateMessageTokens } from './token-budget';
import { PersonaSelection } from './PersonaRouter';
import { logger } from '@/utils/logger';
import {
    ChatRequest,
    ChatContext,
    MAX_TOOL_CALLS,
    MAX_REACT_ITERATIONS,
    prepareChatContext,
    detectToolCalls,
    executeTool,
    createConfirmation,
    checkToolAccess,
    pushToolMessage,
    appendToolLimitMessages,
} from './chat-helpers';

export type { ChatRequest } from './chat-helpers';

const STREAM_CHUNK_SIZE = 12;
const STREAM_CHUNK_DELAY = 30;

function sendSSE(res: Response, event: SSEEvent): void {
    if (res.writableEnded) return;
    res.write(`data: ${JSON.stringify(event)}\n\n`);
}

function createEvent(type: SSEEventType, data: string, tool?: string): SSEEvent {
    return { type, tool, data, timestamp: new Date().toISOString() };
}

async function streamAnswer(res: Response, text: string): Promise<void> {
    for (let i = 0; i < text.length; i += STREAM_CHUNK_SIZE) {
        if (res.writableEnded) return;
        sendSSE(res, createEvent('answer_chunk' as SSEEventType, text.slice(i, i + STREAM_CHUNK_SIZE)));
        await new Promise(resolve => setTimeout(resolve, STREAM_CHUNK_DELAY));
    }
    sendSSE(res, createEvent('answer', text));
}

/**
 * Handle a single tool call in streaming mode.
 * Returns 'stop' if the loop should end (confirmation requested), 'continue' otherwise.
 */
async function handleStreamToolCall(
    toolCall: { id: string; name: string; arguments: Record<string, unknown> },
    req: ChatRequest,
    ctx: ChatContext,
    res: Response,
    collectedResults: { name: string; result: ToolResult }[],
): Promise<'stop' | 'continue'> {
    const accessError = checkToolAccess(toolCall.name, req.userRole);
    if (accessError) {
        if (!toolRegistry.get(toolCall.name)) {
            pushToolMessage(ctx.messages, ctx.tracker, { role: 'tool', toolCallId: toolCall.id, name: toolCall.name, content: accessError });
        } else {
            logger.warn(`[AIChatService] ${accessError}`);
            sendSSE(res, createEvent('tool_result', JSON.stringify({ summary: accessError, data: null }), toolCall.name));
            pushToolMessage(ctx.messages, ctx.tracker, { role: 'tool', toolCallId: toolCall.id, name: toolCall.name, content: accessError });
        }
        return 'continue';
    }

    const tool = toolRegistry.get(toolCall.name)!;

    // Graduated autonomy: confirmation tiers 2/3 pause the loop
    if (tool.requiresConfirmation) {
        const classification = classifyTool(tool, {
            autonomyLevel: req.autonomyLevel || 'balanced',
            toolArgs: toolCall.arguments,
        });

        if (classification.tier >= 2) {
            if (!req.sessionId) {
                pushToolMessage(ctx.messages, ctx.tracker, { role: 'tool', toolCallId: toolCall.id, name: tool.name, content: `Error: Tool "${tool.name}" requires confirmation but no session ID.` });
                return 'continue';
            }
            try {
                const pending = await createConfirmation(req, tool.name, toolCall.arguments);
                sendSSE(res, createEvent('confirmation_request', JSON.stringify({
                    actionId: pending.id, tool: tool.name, args: toolCall.arguments,
                    summary: `Call ${tool.name} with args: ${JSON.stringify(toolCall.arguments)}`,
                    tier: classification.tier,
                })));
                sendSSE(res, createEvent('done', ''));
                return 'stop';
            } catch (error) {
                logger.error('[AIChatService] Failed to create pending action:', error);
                sendSSE(res, createEvent('error', 'Failed to request confirmation.'));
                sendSSE(res, createEvent('done', ''));
                return 'stop';
            }
        }

        // Tier 1: auto-execute
        logger.info(`[AIChatService] Tier 1 auto-execute: ${tool.name} (${classification.reason})`);
    }

    sendSSE(res, createEvent('tool_start', `Calling ${tool.name}...`, tool.name));
    const toolResult = await executeTool(toolCall.name, toolCall.arguments, ctx.toolContext);
    collectedResults.push({ name: tool.name, result: toolResult });

    // Emit result — Tier 1 auto-executed write tools use 'autonomous_action'
    const wasTier1 = tool.requiresConfirmation && classifyTool(tool, {
        autonomyLevel: req.autonomyLevel || 'balanced',
        toolArgs: toolCall.arguments,
    }).autoExecute;

    const eventType = wasTier1 ? 'autonomous_action' as SSEEventType : 'tool_result';
    sendSSE(res, createEvent(eventType, JSON.stringify({ summary: toolResult.summary, data: toolResult.data }), tool.name));

    // Proactive suggestion engine — skip during analysis chain (rca_identify drives its own 3-card flow)
    const isAnalysisChain = collectedResults.some(r => r.name === 'rca_identify');
    if (!isAnalysisChain) {
        const suggestion = evaluateSuggestion({ toolName: tool.name, toolResult, previousResults: collectedResults, userMessage: req.message });
        if (suggestion) {
            sendSSE(res, createEvent('proactive_suggestion' as SSEEventType, JSON.stringify(suggestion)));
        }
    }

    // Feed result back with token budgeting
    const resultContent = ctx.ctxManager.truncateToolResultForBudget(toolResult.data ?? toolResult.error, ctx.tracker);
    ctx.messages.push({ role: 'tool', toolCallId: toolCall.id, name: tool.name, content: resultContent });
    return 'continue';
}

/** Execute the ReAct loop for a chat request, streaming SSE events. */
export async function handleChatStream(req: ChatRequest, res: Response): Promise<void> {
    let ctx: ChatContext;
    try {
        ctx = await prepareChatContext(req);
    } catch {
        sendSSE(res, createEvent('error', 'AI services are not initialized or enabled.'));
        sendSSE(res, createEvent('done', ''));
        return;
    }

    sendSSE(res, createEvent('persona_selected', JSON.stringify({
        persona: ctx.persona.persona, displayName: ctx.persona.displayName,
        confidence: ctx.persona.confidence, reasoning: ctx.persona.reasoning,
    })));

    let toolCallCount = 0;
    const collectedResults: { name: string; result: ToolResult }[] = [];

    for (let iteration = 0; iteration < MAX_REACT_ITERATIONS; iteration++) {
        sendSSE(res, createEvent('thinking', iteration === 0 ? 'Analyzing your question...' : 'Continuing analysis...'));

        let aiResponse;
        try {
            aiResponse = await getAIManager().getProvider()!.chat(ctx.messages, {
                maxTokens: ctx.ctxManager.getMaxOutputTokens(2048),
                temperature: 0.3,
                tools: ctx.useNativeTools ? ctx.toolDefinitions : undefined,
            });
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'LLM call failed';
            logger.error('[AIChatService] LLM call failed:', error);
            sendSSE(res, createEvent('error', `AI provider error: ${msg}`));
            sendSSE(res, createEvent('done', ''));
            return;
        }

        const toolCalls = detectToolCalls(aiResponse, aiResponse.content);
        if (!toolCalls) {
            const cleanAnswer = aiResponse.content.replace(/```tool_call[\s\S]*?```/g, '').trim();
            await streamAnswer(res, cleanAnswer);
            sendSSE(res, createEvent('done', ''));
            return;
        }

        if (toolCallCount >= MAX_TOOL_CALLS) {
            sendSSE(res, createEvent('error', `Tool call limit reached (${MAX_TOOL_CALLS}).`));
            appendToolLimitMessages(ctx.messages, ctx.tracker, aiResponse.content);
            continue;
        }

        const assistantMsg: ChatMessage = { role: 'assistant', content: aiResponse.content, toolCalls };
        ctx.messages.push(assistantMsg);
        ctx.tracker.recordLoopOverhead(estimateMessageTokens(assistantMsg));

        for (const tc of toolCalls) {
            toolCallCount++;
            const result = await handleStreamToolCall(tc, req, ctx, res, collectedResults);
            if (result === 'stop') return;
        }
    }

    sendSSE(res, createEvent('error', 'Reached maximum reasoning iterations.'));
    sendSSE(res, createEvent('done', ''));
}

// ─── Buffered Chat Handler (for non-streaming channels: Slack, Teams) ───

export interface BufferedChatResponse {
    persona: PersonaSelection;
    toolCalls: { name: string; summary: string; data?: unknown }[];
    answer: string;
    pendingConfirmation?: { actionId: string; tool: string; args: Record<string, unknown> };
}

/** Non-streaming ReAct loop for channel adapters (Slack, Teams). */
export async function handleChatBuffered(req: ChatRequest): Promise<BufferedChatResponse> {
    const ctx = await prepareChatContext(req);
    const collectedToolCalls: BufferedChatResponse['toolCalls'] = [];
    let toolCallCount = 0;

    for (let iteration = 0; iteration < MAX_REACT_ITERATIONS; iteration++) {
        let aiResponse;
        try {
            aiResponse = await getAIManager().getProvider()!.chat(ctx.messages, {
                maxTokens: ctx.ctxManager.getMaxOutputTokens(2048),
                temperature: 0.3,
                tools: ctx.useNativeTools ? ctx.toolDefinitions : undefined,
            });
        } catch (error) {
            throw new Error(`AI provider error: ${error instanceof Error ? error.message : 'LLM call failed'}`);
        }

        const toolCalls = detectToolCalls(aiResponse, aiResponse.content);
        if (!toolCalls) {
            return { persona: ctx.persona, toolCalls: collectedToolCalls, answer: aiResponse.content.replace(/```tool_call[\s\S]*?```/g, '').trim() };
        }

        if (toolCallCount >= MAX_TOOL_CALLS) {
            appendToolLimitMessages(ctx.messages, ctx.tracker, aiResponse.content);
            continue;
        }

        pushToolMessage(ctx.messages, ctx.tracker, { role: 'assistant', content: aiResponse.content, toolCalls });

        for (const tc of toolCalls) {
            const accessError = checkToolAccess(tc.name, req.userRole);
            if (accessError) {
                pushToolMessage(ctx.messages, ctx.tracker, { role: 'tool', toolCallId: tc.id, name: tc.name, content: accessError });
                continue;
            }

            const tool = toolRegistry.get(tc.name)!;
            if (tool.requiresConfirmation) {
                if (!req.sessionId) {
                    pushToolMessage(ctx.messages, ctx.tracker, { role: 'tool', toolCallId: tc.id, name: tool.name, content: `Error: Tool "${tool.name}" requires confirmation but no session ID.` });
                    continue;
                }
                const pending = await createConfirmation(req, tool.name, tc.arguments);
                return {
                    persona: ctx.persona, toolCalls: collectedToolCalls,
                    answer: `I need your approval to execute **${tool.name}**. Please confirm in the web UI.`,
                    pendingConfirmation: { actionId: pending.id, tool: tool.name, args: tc.arguments },
                };
            }

            const toolResult = await executeTool(tc.name, tc.arguments, ctx.toolContext);
            toolCallCount++;
            collectedToolCalls.push({ name: tool.name, summary: toolResult.summary, data: toolResult.data });

            const resultContent = ctx.ctxManager.truncateToolResultForBudget(toolResult.data ?? toolResult.error, ctx.tracker);
            ctx.messages.push({ role: 'tool', toolCallId: tc.id, name: tool.name, content: resultContent });
        }
    }

    return { persona: ctx.persona, toolCalls: collectedToolCalls, answer: 'I reached the maximum reasoning limit. Here is what I found so far based on the tools I called.' };
}
