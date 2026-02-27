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
import { SSEEvent, SSEEventType, ToolContext, ToolResult, hasRequiredRole } from './tools/types';
import { ChatMessage } from './types';
import { getConfigManager } from './config';
import { getMockToolResult } from './mock-tool-results';
import { routeToPersona, PersonaSelection } from './PersonaRouter';
import { getPersonaInstruction } from './PersonaInstructions';
import { classifyTool, type AutonomyLevel } from './AutonomyClassifier';
import { evaluateSuggestion } from './ProactiveSuggestionEngine';
import { ContextWindowManager } from './context-window-manager';
import { estimateMessageTokens } from './token-budget';
import { logger } from '@/utils/logger';

/** Chunk size for token-by-token answer streaming (characters) */
const STREAM_CHUNK_SIZE = 12;
/** Delay between chunks in ms for typewriter effect */
const STREAM_CHUNK_DELAY = 30;

/** Configuration for a single chat request */
export interface ChatRequest {
    message: string;
    sessionId?: string;
    userId: string;
    userRole: string;
    history?: ChatMessage[];
    /** User's autonomy preference (defaults to 'balanced') */
    autonomyLevel?: AutonomyLevel;
    /** UI context string describing the page/entity the user is currently viewing */
    uiContext?: string;
}

/** Safety limits */
const MAX_TOOL_CALLS = 5;
const MAX_REACT_ITERATIONS = 8;

/**
 * Build the system prompt with tool definitions, role context, and persona instructions.
 */
function buildSystemPrompt(userRole: string, persona?: PersonaSelection): string {
    const toolDefs = toolRegistry.formatForSystemPrompt(/* readOnlyOnly */ false);

    const roleGreetings: Record<string, string> = {
        admin: 'You are assisting an Admin/Manager. Emphasize system health, costs, and release readiness.',
        manager: 'You are assisting a Manager. Focus on team metrics, blockers, and progress summaries.',
        engineer: 'You are assisting an Engineer. Focus on specific test failures, logs, root causes, and fixes.',
        viewer: 'You are assisting a Viewer. Provide high-level summaries and status updates.',
    };

    const roleContext = roleGreetings[userRole] || roleGreetings.viewer;

    // Persona-specific instructions injected when the router selects a team member
    const personaBlock = persona
        ? `\n## Your Role\n${getPersonaInstruction(persona.persona).systemPromptAddon}\n`
        : '';

    return `You are TestOps Copilot, an intelligent assistant for the TestOps Copilot platform.
${roleContext}
${personaBlock}
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
 * Stream an answer in chunks for a typewriter effect.
 * Splits the text into small chunks and sends each as an 'answer_chunk' event,
 * finishing with a full 'answer' event for clients that don't support streaming.
 */
async function streamAnswer(res: Response, text: string): Promise<void> {
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += STREAM_CHUNK_SIZE) {
        chunks.push(text.slice(i, i + STREAM_CHUNK_SIZE));
    }

    for (const chunk of chunks) {
        if (res.writableEnded) return;
        sendSSE(res, createEvent('answer_chunk' as SSEEventType, chunk));
        await new Promise(resolve => setTimeout(resolve, STREAM_CHUNK_DELAY));
    }

    // Send final complete answer for clients that buffer
    sendSSE(res, createEvent('answer', text));
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

    // Route query to persona + ensure session in parallel (speed optimization)
    const sessionNeeded = req.sessionId && req.sessionId !== 'anonymous';
    const [persona] = await Promise.all([
        routeToPersona(req.message, req.userRole),
        sessionNeeded
            ? chatSessionService.ensureSession(req.sessionId!, req.userId).catch(error => {
                logger.error(`[AIChatService] Failed to ensure session ${req.sessionId}:`, error);
            })
            : Promise.resolve(),
    ]);
    logger.info(`[AIChatService] Persona: ${persona.displayName} (${persona.tier}, confidence: ${persona.confidence})`);

    // Emit persona_selected SSE event before the ReAct loop
    sendSSE(res, createEvent('persona_selected', JSON.stringify({
        persona: persona.persona,
        displayName: persona.displayName,
        confidence: persona.confidence,
        reasoning: persona.reasoning,
    })));

    const systemPrompt = buildSystemPrompt(req.userRole, persona);
    const context: ToolContext = {
        userId: req.userId,
        userRole: req.userRole,
        sessionId: req.sessionId || 'anonymous',
    };

    // Initialize context window manager for token budgeting
    const configManager = getConfigManager();
    const ctxWindowConfig = configManager.getContextWindowConfig();
    const ctxManager = new ContextWindowManager({
        modelId: configManager.getModel(),
        provider: configManager.getProvider(),
        contextWindowOverride: ctxWindowConfig?.sizeOverride,
        budgetOverride: ctxWindowConfig ? {
            maxToolResultTokens: ctxWindowConfig.maxToolResultTokens,
            maxTotalToolResultTokens: ctxWindowConfig.maxTotalToolResultTokens,
        } : undefined,
    });

    // Build conversation history, injecting UI context when available
    const userContent = req.uiContext
        ? `[UI Context: ${req.uiContext}]\n\n${req.message}`
        : req.message;

    const rawMessages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        ...(req.history || []),
        { role: 'user', content: userContent },
    ];

    // Apply token budgeting — prune history and track usage
    const { messages, tracker } = ctxManager.prepareMessages(rawMessages);

    let toolCallCount = 0;
    const collectedResults: { name: string; result: ToolResult }[] = [];

    // Get tool definitions for native tool calling (skip for models that don't support it)
    const useNativeTools = ctxManager.supportsNativeToolCalling();
    const toolDefinitions = toolRegistry.getToolDefinitions();
    logger.info(`[AIChatService] Available tools: ${toolDefinitions.map(t => t.name).join(', ')}, native: ${useNativeTools}`);

    // ReAct Loop
    for (let iteration = 0; iteration < MAX_REACT_ITERATIONS; iteration++) {
        // 1. Call the LLM
        sendSSE(res, createEvent('thinking', iteration === 0 ? 'Analyzing your question...' : 'Continuing analysis...'));

        let aiResponse;
        try {
            // Use the provider via the internal chat method, passing tools
            const maxOutputTokens = ctxManager.getMaxOutputTokens(2048);
            aiResponse = await aiManager.getProvider()!.chat(messages, {
                maxTokens: maxOutputTokens,
                temperature: 0.3,
                tools: useNativeTools ? toolDefinitions : undefined,
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

            // Stream answer in chunks for typewriter effect
            await streamAnswer(res, cleanAnswer);
            sendSSE(res, createEvent('done', ''));

            // Add assistant message to history for persistence
            messages.push({ role: 'assistant', content: cleanAnswer });
            return;
        }

        // 3. Process Tool Calls
        if (toolCallCount >= MAX_TOOL_CALLS) {
            sendSSE(res, createEvent('error', `Tool call limit reached (${MAX_TOOL_CALLS}). Providing answer with available information.`));
            // Force the LLM to answer without more tools
            const limitAssistantMsg: ChatMessage = { role: 'assistant', content: responseText };
            const limitUserMsg: ChatMessage = { role: 'user', content: 'You have reached the tool call limit. Please provide your best answer with the information gathered so far.' };
            messages.push(limitAssistantMsg);
            messages.push(limitUserMsg);
            tracker.recordLoopOverhead(estimateMessageTokens(limitAssistantMsg) + estimateMessageTokens(limitUserMsg));
            continue;
        }

        // Add assistant message with tool calls to history
        const assistantMsg: ChatMessage = {
            role: 'assistant',
            content: responseText,
            toolCalls: toolCalls
        };
        messages.push(assistantMsg);
        tracker.recordLoopOverhead(estimateMessageTokens(assistantMsg));

        // Execute each tool
        for (const toolCall of toolCalls) {
            const tool = toolRegistry.get(toolCall.name);
            logger.info(`[AIChatService] Processing tool call: ${toolCall.name}, Found: ${!!tool}, SessionID: ${req.sessionId}`);

            if (!tool) {
                const errMsg: ChatMessage = {
                    role: 'tool',
                    toolCallId: toolCall.id,
                    name: toolCall.name,
                    content: `Error: Tool "${toolCall.name}" does not exist.`
                };
                messages.push(errMsg);
                tracker.recordLoopOverhead(estimateMessageTokens(errMsg));
                continue;
            }

            // Role enforcement: check if user has sufficient privileges
            if (tool.requiredRole && !hasRequiredRole(req.userRole, tool.requiredRole)) {
                const msg = `Access denied: tool "${tool.name}" requires ${tool.requiredRole} role or higher. Your role: ${req.userRole}.`;
                logger.warn(`[AIChatService] ${msg}`);
                sendSSE(res, createEvent('tool_result', JSON.stringify({
                    summary: msg,
                    data: null,
                }), tool.name));
                const roleErrMsg: ChatMessage = {
                    role: 'tool',
                    toolCallId: toolCall.id,
                    name: tool.name,
                    content: msg,
                };
                messages.push(roleErrMsg);
                tracker.recordLoopOverhead(estimateMessageTokens(roleErrMsg));
                continue;
            }

            // Graduated Autonomy: classify the tool invocation into a tier
            if (tool.requiresConfirmation) {
                const classification = classifyTool(tool, {
                    autonomyLevel: req.autonomyLevel || 'balanced',
                    toolArgs: toolCall.arguments as Record<string, unknown>,
                });

                // Tier 3: Full confirmation (current behavior — pause loop, wait for user)
                if (classification.tier === 3) {
                    if (!req.sessionId) {
                        const noSessionMsg: ChatMessage = {
                            role: 'tool',
                            toolCallId: toolCall.id,
                            name: tool.name,
                            content: `Error: Tool "${tool.name}" requires user confirmation, but no session ID was provided.`
                        };
                        messages.push(noSessionMsg);
                        tracker.recordLoopOverhead(estimateMessageTokens(noSessionMsg));
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
                            summary,
                            tier: 3,
                        })));
                        sendSSE(res, createEvent('done', ''));
                        return;
                    } catch (error) {
                        logger.error('[AIChatService] Failed to create pending action:', error);
                        sendSSE(res, createEvent('error', 'Failed to request confirmation.'));
                        sendSSE(res, createEvent('done', ''));
                        return;
                    }
                }

                // Tier 2: AI-in-the-Loop — show a proactive suggestion card (don't pause loop)
                // The tool is NOT executed yet — the frontend will show a card with approve/dismiss
                if (classification.tier === 2) {
                    if (!req.sessionId) {
                        const noSessionMsg2: ChatMessage = {
                            role: 'tool',
                            toolCallId: toolCall.id,
                            name: tool.name,
                            content: `Error: Tool "${tool.name}" requires user confirmation, but no session ID was provided.`
                        };
                        messages.push(noSessionMsg2);
                        tracker.recordLoopOverhead(estimateMessageTokens(noSessionMsg2));
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
                            summary,
                            tier: 2,
                        })));
                        sendSSE(res, createEvent('done', ''));
                        return;
                    } catch (error) {
                        logger.error('[AIChatService] Failed to create pending action:', error);
                        sendSSE(res, createEvent('error', 'Failed to request confirmation.'));
                        sendSSE(res, createEvent('done', ''));
                        return;
                    }
                }

                // Tier 1: Full Autonomy — auto-execute and notify after
                logger.info(`[AIChatService] Tier 1 auto-execute: ${tool.name} (${classification.reason})`);
            }

            // Notify frontend (Tier 1 auto-execute tools get a different label)
            sendSSE(res, createEvent('tool_start', `Calling ${tool.name}...`, tool.name));

            let toolResult;
            // Demo mode: use mock tool results instead of calling real external APIs
            const mockResult = getConfigManager().getProvider() === 'mock'
                ? getMockToolResult(toolCall.name, toolCall.arguments)
                : null;
            if (mockResult) {
                toolResult = mockResult;
            } else {
                try {
                    toolResult = await tool.execute(toolCall.arguments, context);
                } catch (error) {
                    const msg = error instanceof Error ? error.message : 'Tool execution failed';
                    toolResult = { success: false, error: msg, summary: msg };
                }
            }

            toolCallCount++;
            collectedResults.push({ name: tool.name, result: toolResult });

            // Notify frontend: tool result (v3: include structured data for rich cards)
            // For Tier 1 auto-executed write tools, use 'autonomous_action' event type
            const wasTier1AutoExec = tool.requiresConfirmation && classifyTool(tool, {
                autonomyLevel: req.autonomyLevel || 'balanced',
                toolArgs: toolCall.arguments as Record<string, unknown>,
            }).autoExecute;

            if (wasTier1AutoExec) {
                sendSSE(res, createEvent('autonomous_action' as SSEEventType, JSON.stringify({
                    summary: toolResult.summary,
                    data: toolResult.data,
                    tool: tool.name,
                }), tool.name));
            } else {
                sendSSE(res, createEvent('tool_result', JSON.stringify({
                    summary: toolResult.summary,
                    data: toolResult.data,
                }), tool.name));
            }

            // Proactive Suggestion Engine: evaluate if AI should suggest a next action
            const suggestion = evaluateSuggestion({
                toolName: tool.name,
                toolResult,
                previousResults: collectedResults,
                userMessage: req.message,
            });
            if (suggestion) {
                sendSSE(res, createEvent('proactive_suggestion' as SSEEventType, JSON.stringify(suggestion)));
                logger.info(`[AIChatService] Proactive suggestion: ${suggestion.tool} (confidence: ${suggestion.confidence})`);
            }

            // Feed result back — truncate to token budget
            const resultContent = ctxManager.truncateToolResultForBudget(
                toolResult.data ?? toolResult.error,
                tracker
            );
            messages.push({
                role: 'tool',
                toolCallId: toolCall.id,
                name: tool.name,
                content: resultContent,
            });
        }
    }

    // If we exhausted iterations
    sendSSE(res, createEvent('error', 'Reached maximum reasoning iterations.'));
    sendSSE(res, createEvent('done', ''));
}

// ─── Buffered Chat Handler (for non-streaming channels: Slack, Teams) ───

/** Result from a buffered (non-streaming) chat interaction */
export interface BufferedChatResponse {
    persona: PersonaSelection;
    toolCalls: { name: string; summary: string; data?: unknown }[];
    answer: string;
    /** Whether the response requires user confirmation (write tool pending) */
    pendingConfirmation?: {
        actionId: string;
        tool: string;
        args: Record<string, unknown>;
    };
}

/**
 * Non-streaming version of handleChatStream for channel adapters (Slack, Teams).
 * Runs the same PersonaRouter → ReAct loop but collects the full result
 * instead of streaming SSE events.
 */
export async function handleChatBuffered(req: ChatRequest): Promise<BufferedChatResponse> {
    const aiManager = getAIManager();

    if (!aiManager.isInitialized() || !aiManager.isEnabled()) {
        throw new Error('AI services are not initialized or enabled.');
    }

    // Route to persona + ensure session in parallel (speed optimization)
    const sessionNeeded = req.sessionId && req.sessionId !== 'anonymous';
    const [persona] = await Promise.all([
        routeToPersona(req.message, req.userRole),
        sessionNeeded
            ? chatSessionService.ensureSession(req.sessionId!, req.userId).catch(error => {
                logger.error(`[AIChatService:Buffered] Failed to ensure session:`, error);
            })
            : Promise.resolve(),
    ]);
    logger.info(`[AIChatService:Buffered] Persona: ${persona.displayName} (${persona.tier})`);

    const systemPrompt = buildSystemPrompt(req.userRole, persona);
    const context: ToolContext = {
        userId: req.userId,
        userRole: req.userRole,
        sessionId: req.sessionId || 'anonymous',
    };

    // Initialize context window manager for token budgeting
    const bufferedConfigManager = getConfigManager();
    const bufferedCtxWindowConfig = bufferedConfigManager.getContextWindowConfig();
    const ctxManagerBuffered = new ContextWindowManager({
        modelId: bufferedConfigManager.getModel(),
        provider: bufferedConfigManager.getProvider(),
        contextWindowOverride: bufferedCtxWindowConfig?.sizeOverride,
        budgetOverride: bufferedCtxWindowConfig ? {
            maxToolResultTokens: bufferedCtxWindowConfig.maxToolResultTokens,
            maxTotalToolResultTokens: bufferedCtxWindowConfig.maxTotalToolResultTokens,
        } : undefined,
    });

    const bufferedUserContent = req.uiContext
        ? `[UI Context: ${req.uiContext}]\n\n${req.message}`
        : req.message;

    const rawBufferedMessages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        ...(req.history || []),
        { role: 'user', content: bufferedUserContent },
    ];

    // Apply token budgeting
    const { messages, tracker: bufferedTracker } = ctxManagerBuffered.prepareMessages(rawBufferedMessages);

    const collectedToolCalls: BufferedChatResponse['toolCalls'] = [];
    let toolCallCount = 0;
    const useNativeToolsBuffered = ctxManagerBuffered.supportsNativeToolCalling();
    const toolDefinitions = toolRegistry.getToolDefinitions();

    // ReAct Loop (same logic as streaming, but collects results)
    for (let iteration = 0; iteration < MAX_REACT_ITERATIONS; iteration++) {
        let aiResponse;
        try {
            const maxOutputTokensBuffered = ctxManagerBuffered.getMaxOutputTokens(2048);
            aiResponse = await aiManager.getProvider()!.chat(messages, {
                maxTokens: maxOutputTokensBuffered,
                temperature: 0.3,
                tools: useNativeToolsBuffered ? toolDefinitions : undefined,
            });
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'LLM call failed';
            throw new Error(`AI provider error: ${msg}`);
        }

        const responseText = aiResponse.content;

        // Determine tool calls
        let toolCalls = aiResponse.toolCalls;
        if (!toolCalls || toolCalls.length === 0) {
            const legacyToolCall = parseToolCall(responseText);
            if (legacyToolCall) {
                toolCalls = [{
                    id: 'legacy_call_' + Date.now(),
                    name: legacyToolCall.tool,
                    arguments: legacyToolCall.args,
                }];
            }
        }

        if (!toolCalls || toolCalls.length === 0) {
            // Final answer
            const cleanAnswer = responseText.replace(/```tool_call[\s\S]*?```/g, '').trim();
            return { persona, toolCalls: collectedToolCalls, answer: cleanAnswer };
        }

        // Tool call limit
        if (toolCallCount >= MAX_TOOL_CALLS) {
            const bLimitAssist: ChatMessage = { role: 'assistant', content: responseText };
            const bLimitUser: ChatMessage = { role: 'user', content: 'You have reached the tool call limit. Please provide your best answer with the information gathered so far.' };
            messages.push(bLimitAssist);
            messages.push(bLimitUser);
            bufferedTracker.recordLoopOverhead(estimateMessageTokens(bLimitAssist) + estimateMessageTokens(bLimitUser));
            continue;
        }

        const bAssistantMsg: ChatMessage = { role: 'assistant', content: responseText, toolCalls };
        messages.push(bAssistantMsg);
        bufferedTracker.recordLoopOverhead(estimateMessageTokens(bAssistantMsg));

        for (const toolCall of toolCalls) {
            const tool = toolRegistry.get(toolCall.name);
            if (!tool) {
                const bToolErr: ChatMessage = { role: 'tool', toolCallId: toolCall.id, name: toolCall.name, content: `Error: Tool "${toolCall.name}" does not exist.` };
                messages.push(bToolErr);
                bufferedTracker.recordLoopOverhead(estimateMessageTokens(bToolErr));
                continue;
            }

            if (tool.requiredRole && !hasRequiredRole(req.userRole, tool.requiredRole)) {
                const msg = `Access denied: tool "${tool.name}" requires ${tool.requiredRole} role.`;
                const bRoleErr: ChatMessage = { role: 'tool', toolCallId: toolCall.id, name: tool.name, content: msg };
                messages.push(bRoleErr);
                bufferedTracker.recordLoopOverhead(estimateMessageTokens(bRoleErr));
                continue;
            }

            // Write tools: create pending action and return immediately
            if (tool.requiresConfirmation) {
                if (!req.sessionId) {
                    const bNoSess: ChatMessage = { role: 'tool', toolCallId: toolCall.id, name: tool.name, content: `Error: Tool "${tool.name}" requires confirmation but no session ID.` };
                    messages.push(bNoSess);
                    bufferedTracker.recordLoopOverhead(estimateMessageTokens(bNoSess));
                    continue;
                }
                const pendingAction = await confirmationService.createPendingAction({
                    sessionId: req.sessionId,
                    userId: req.userId,
                    toolName: tool.name,
                    parameters: toolCall.arguments,
                });
                return {
                    persona,
                    toolCalls: collectedToolCalls,
                    answer: `I need your approval to execute **${tool.name}**. Please confirm in the web UI.`,
                    pendingConfirmation: {
                        actionId: pendingAction.id,
                        tool: tool.name,
                        args: toolCall.arguments as Record<string, unknown>,
                    },
                };
            }

            // Execute tool
            let toolResult;
            const mockResult = getConfigManager().getProvider() === 'mock'
                ? getMockToolResult(toolCall.name, toolCall.arguments)
                : null;

            if (mockResult) {
                toolResult = mockResult;
            } else {
                try {
                    toolResult = await tool.execute(toolCall.arguments, context);
                } catch (error) {
                    const msg = error instanceof Error ? error.message : 'Tool execution failed';
                    toolResult = { success: false, error: msg, summary: msg };
                }
            }

            toolCallCount++;
            collectedToolCalls.push({
                name: tool.name,
                summary: toolResult.summary,
                data: toolResult.data,
            });

            // Truncate tool result to token budget
            const bufferedResultContent = ctxManagerBuffered.truncateToolResultForBudget(
                toolResult.data ?? toolResult.error,
                bufferedTracker
            );
            messages.push({
                role: 'tool',
                toolCallId: toolCall.id,
                name: tool.name,
                content: bufferedResultContent,
            });
        }
    }

    // Exhausted iterations
    return {
        persona,
        toolCalls: collectedToolCalls,
        answer: 'I reached the maximum reasoning limit. Here is what I found so far based on the tools I called.',
    };
}
