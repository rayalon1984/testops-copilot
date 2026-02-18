/**
 * AIChatService — Core ReAct Loop with SSE Streaming
 *
 * This is the heart of the Agentic AI Copilot. It orchestrates:
 *  1. Building role-based system prompts
 *  2. Executing the ReAct (Reason → Act → Observe) loop
 *  3. Streaming SSE events to the frontend in real-time
 *  4. Enforcing safety limits (max tool calls, cost cap)
 */

import { Response } from 'express';
import { getAIManager } from './manager';
import { toolRegistry } from './tools';
import * as confirmationService from './ConfirmationService';
import * as chatSessionService from './ChatSessionService';
import { SSEEvent, SSEEventType, ToolContext } from './tools/types';
import { ChatMessage } from './types';
import { logger } from '@/utils/logger';

/** Configuration for a single chat request */
export interface ChatRequest {
    message: string;
    sessionId?: string;
    userId: string;
    userRole: string;
    history?: ChatMessage[];
}

/** Safety limits */
const MAX_TOOL_CALLS = 5;
const MAX_REACT_ITERATIONS = 8;

/**
 * Build the system prompt with tool definitions and role context.
 */
function buildSystemPrompt(userRole: string): string {
    const toolDefs = toolRegistry.formatForSystemPrompt(/* readOnlyOnly */ false);

    const roleGreetings: Record<string, string> = {
        admin: 'You are assisting an Admin/Manager. Emphasize system health, costs, and release readiness.',
        manager: 'You are assisting a Manager. Focus on team metrics, blockers, and progress summaries.',
        engineer: 'You are assisting an Engineer. Focus on specific test failures, logs, root causes, and fixes.',
        viewer: 'You are assisting a Viewer. Provide high-level summaries and status updates.',
    };

    const roleContext = roleGreetings[userRole] || roleGreetings.viewer;

    return `You are TestOps Copilot, an intelligent assistant for the TestOps Companion platform.
${roleContext}

## Available Tools
You can use the following tools to look up information. To call a tool, respond with a JSON block like:
\`\`\`tool_call
{"tool": "tool_name", "args": {"param1": "value1"}}
\`\`\`

After receiving tool results, reason about them and provide a helpful answer.

${toolDefs}

## Rules
1. Always use tools when the user asks about test failures, Jira issues, pipelines, or documentation.
2. You may call multiple tools in sequence, but no more than ${MAX_TOOL_CALLS} tool calls per request.
3. If a tool fails, explain the issue gracefully and suggest alternatives.
4. Format your responses in Markdown for readability.
5. Be concise but thorough. Include relevant links and data.
6. Never fabricate data — if you don't have information, say so.`;
}

/**
 * Parse a tool call from the LLM response text.
 * Looks for ```tool_call ... ``` blocks.
 */
function parseToolCall(text: string): { tool: string; args: Record<string, unknown> } | null {
    const match = text.match(/```tool_call\s*\n?([\s\S]*?)\n?```/);
    if (!match) return null;

    try {
        const parsed = JSON.parse(match[1].trim());
        if (parsed.tool && typeof parsed.tool === 'string') {
            return { tool: parsed.tool, args: parsed.args || {} };
        }
    } catch {
        // Invalid JSON in tool call
        logger.warn('[AIChatService] Failed to parse tool call JSON:', match[1]);
    }
    return null;
}

/**
 * Send an SSE event to the response stream.
 */
function sendSSE(res: Response, event: SSEEvent): void {
    if (res.writableEnded) return;
    res.write(`data: ${JSON.stringify(event)}\n\n`);
}

/**
 * Helper to create SSE events.
 */
function createEvent(type: SSEEventType, data: string, tool?: string): SSEEvent {
    return {
        type,
        tool,
        data,
        timestamp: new Date().toISOString(),
    };
}

/**
 * Execute the ReAct loop for a chat request, streaming SSE events.
 *
 * Flow:
 *   1. Build system prompt + inject history
 *   2. Call LLM
 *   3. If LLM wants to call a tool → execute it → feed result back → repeat
 *   4. If LLM gives a final answer → stream it and stop
 */
export async function handleChatStream(req: ChatRequest, res: Response): Promise<void> {
    const aiManager = getAIManager();

    if (!aiManager.isInitialized() || !aiManager.isEnabled()) {
        sendSSE(res, createEvent('error', 'AI services are not initialized or enabled.'));
        sendSSE(res, createEvent('done', ''));
        return;
    }

    const systemPrompt = buildSystemPrompt(req.userRole);
    const context: ToolContext = {
        userId: req.userId,
        userRole: req.userRole,
        sessionId: req.sessionId || 'anonymous',
    };

    // Build conversation history
    const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        ...(req.history || []),
        { role: 'user', content: req.message },
    ];

    let toolCallCount = 0;

    // Get tool definitions for native tool calling
    const toolDefinitions = toolRegistry.getToolDefinitions();
    logger.info(`[AIChatService] Available tools: ${toolDefinitions.map(t => t.name).join(', ')}`);
    console.log(`[AIChatService] Available tools: ${toolDefinitions.map(t => t.name).join(', ')}`);

    // ReAct Loop
    for (let iteration = 0; iteration < MAX_REACT_ITERATIONS; iteration++) {
        // 1. Call the LLM
        sendSSE(res, createEvent('thinking', iteration === 0 ? 'Analyzing your question...' : 'Continuing analysis...'));

        let aiResponse;
        try {
            // Use the provider via the internal chat method, passing tools
            aiResponse = await (aiManager as any).provider.chat(messages, {
                maxTokens: 2048,
                temperature: 0.3,
                tools: toolDefinitions // Native tool definitions
            });
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'LLM call failed';
            logger.error('[AIChatService] LLM call failed:', error);
            sendSSE(res, createEvent('error', `AI provider error: ${msg}`));
            sendSSE(res, createEvent('done', ''));
            return;
        }

        const responseText = aiResponse.content;

        // 2. Determine if tools are called (Native vs Legacy Regex)
        let toolCalls = aiResponse.toolCalls;

        // Fallback to regex parsing if no native tool calls found (for backward compatibility/mock provider)
        if (!toolCalls || toolCalls.length === 0) {
            const legacyToolCall = parseToolCall(responseText);
            if (legacyToolCall) {
                toolCalls = [{
                    id: 'legacy_call_' + Date.now(),
                    name: legacyToolCall.tool,
                    arguments: legacyToolCall.args
                }];
            }
        }

        if (!toolCalls || toolCalls.length === 0) {
            // No tool call → this is the final answer
            // Strip any ```tool_call blocks that might be malformed (legacy cleanup)
            const cleanAnswer = responseText.replace(/```tool_call[\s\S]*?```/g, '').trim();
            sendSSE(res, createEvent('answer', cleanAnswer));
            sendSSE(res, createEvent('done', ''));

            // Add assistant message to history for persistence
            messages.push({ role: 'assistant', content: cleanAnswer });
            return;
        }

        // 3. Process Tool Calls
        if (toolCallCount >= MAX_TOOL_CALLS) {
            sendSSE(res, createEvent('error', `Tool call limit reached (${MAX_TOOL_CALLS}). Providing answer with available information.`));
            // Force the LLM to answer without more tools
            messages.push({ role: 'assistant', content: responseText });
            messages.push({ role: 'user', content: 'You have reached the tool call limit. Please provide your best answer with the information gathered so far.' });
            continue;
        }

        // Add assistant message with tool calls to history
        messages.push({
            role: 'assistant',
            content: responseText,
            toolCalls: toolCalls
        });

        // Execute each tool
        for (const toolCall of toolCalls) {
            const tool = toolRegistry.get(toolCall.name);
            console.log(`[AIChatService] Processing tool call: ${toolCall.name}, Found: ${!!tool}, SessionID: ${req.sessionId}`);
            logger.info(`[AIChatService] Processing tool call: ${toolCall.name}, Found: ${!!tool}, SessionID: ${req.sessionId}`);

            if (!tool) {
                messages.push({
                    role: 'tool',
                    toolCallId: toolCall.id,
                    name: toolCall.name,
                    content: `Error: Tool "${toolCall.name}" does not exist.`
                });
                continue;
            }

            // Check for confirmation requirement
            if (tool.requiresConfirmation) {
                if (!req.sessionId) {
                    messages.push({
                        role: 'tool',
                        toolCallId: toolCall.id,
                        name: tool.name,
                        content: `Error: Tool "${tool.name}" requires user confirmation, but no session ID was provided.`
                    });
                    continue;
                }

                try {
                    const summary = `Call ${tool.name} with args: ${JSON.stringify(toolCall.arguments)}`;
                    const pendingAction = await confirmationService.createPendingAction({
                        sessionId: req.sessionId,
                        userId: req.userId,
                        toolName: tool.name,
                        parameters: toolCall.arguments,
                    });

                    sendSSE(res, createEvent('confirmation_request', JSON.stringify({
                        actionId: pendingAction.id,
                        tool: tool.name,
                        args: toolCall.arguments,
                        summary
                    })));
                    sendSSE(res, createEvent('done', ''));

                    // Stop stream here. Client must resume after approval.
                    return;
                } catch (error) {
                    logger.error('[AIChatService] Failed to create pending action:', error);
                    sendSSE(res, createEvent('error', 'Failed to request confirmation.'));
                    sendSSE(res, createEvent('done', ''));
                    return;
                }
            }

            // Notify frontend
            sendSSE(res, createEvent('tool_start', `Calling ${tool.name}...`, tool.name));

            let toolResult;
            try {
                toolResult = await tool.execute(toolCall.arguments, context);
            } catch (error) {
                const msg = error instanceof Error ? error.message : 'Tool execution failed';
                toolResult = { success: false, error: msg, summary: msg };
            }

            toolCallCount++;

            // Notify frontend: tool result
            sendSSE(res, createEvent('tool_result', toolResult.summary, tool.name));

            // Feed result back
            messages.push({
                role: 'tool',
                toolCallId: toolCall.id,
                name: tool.name,
                content: JSON.stringify(toolResult.data ?? toolResult.error)
            });
        }
    }

    // If we exhausted iterations
    sendSSE(res, createEvent('error', 'Reached maximum reasoning iterations.'));
    sendSSE(res, createEvent('done', ''));
}
