/**
 * Chat helpers — shared logic for stream and buffered chat handlers.
 * Extracted from AIChatService.ts to keep handler functions focused.
 */

import { getAIManager } from './manager';
import { toolRegistry } from './tools';
import * as confirmationService from './ConfirmationService';
import * as chatSessionService from './ChatSessionService';
import { ToolContext, ToolResult, hasRequiredRole } from './tools/types';
import { AIProviderName, ChatMessage } from './types';
import { getConfigManager } from './config';
import { getMockToolResult } from './mock-tool-results';
import { routeToPersona, PersonaSelection } from './PersonaRouter';
import { getPersonaInstruction } from './PersonaInstructions';
import { ContextWindowManager } from './context-window-manager';
import { estimateMessageTokens, TokenBudgetTracker } from './token-budget';
import { BaseProvider } from './providers/base.provider';
import { logger } from '@/utils/logger';
import type { AutonomyLevel } from './AutonomyClassifier';

export interface ChatRequest {
    message: string;
    sessionId?: string;
    userId: string;
    userRole: string;
    history?: ChatMessage[];
    autonomyLevel?: AutonomyLevel;
    uiContext?: string;
    providerOverride?: BaseProvider;
    providerName?: string;
}

export interface ChatContext {
    persona: PersonaSelection;
    systemPrompt: string;
    toolContext: ToolContext;
    messages: ChatMessage[];
    tracker: TokenBudgetTracker;
    ctxManager: ContextWindowManager;
    useNativeTools: boolean;
    toolDefinitions: ReturnType<typeof toolRegistry.getToolDefinitions>;
    provider: BaseProvider;
    providerName: string;
}

const MAX_TOOL_CALLS = 5;
const MAX_REACT_ITERATIONS = 8;

export { MAX_TOOL_CALLS, MAX_REACT_ITERATIONS };

/** Build the system prompt with tool definitions, role context, and persona. */
export function buildSystemPrompt(userRole: string, persona?: PersonaSelection): string {
    const toolDefs = toolRegistry.formatForSystemPrompt(false);
    const roleGreetings: Record<string, string> = {
        admin: 'You are assisting an Admin/Manager. Emphasize system health, costs, and release readiness.',
        manager: 'You are assisting a Manager. Focus on team metrics, blockers, and progress summaries.',
        engineer: 'You are assisting an Engineer. Focus on specific test failures, logs, root causes, and fixes.',
        viewer: 'You are assisting a Viewer. Provide high-level summaries and status updates.',
    };
    const roleContext = roleGreetings[userRole] || roleGreetings.viewer;
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

/** Parse a tool call from LLM response text (legacy ```tool_call``` blocks). */
export function parseToolCall(text: string): { tool: string; args: Record<string, unknown> } | null {
    const match = text.match(/```tool_call\s*\n?([\s\S]*?)\n?```/);
    if (!match) return null;
    try {
        const parsed = JSON.parse(match[1].trim());
        if (parsed.tool && typeof parsed.tool === 'string') {
            return { tool: parsed.tool, args: parsed.args || {} };
        }
    } catch {
        logger.warn('[AIChatService] Failed to parse tool call JSON:', match[1]);
    }
    return null;
}

/** Detect tool calls from AI response — native first, legacy regex fallback. */
export function detectToolCalls(
    aiResponse: { toolCalls?: Array<{ id: string; name: string; arguments: Record<string, unknown> }> },
    responseText: string
): Array<{ id: string; name: string; arguments: Record<string, unknown> }> | null {
    if (aiResponse.toolCalls && aiResponse.toolCalls.length > 0) return aiResponse.toolCalls;
    const legacy = parseToolCall(responseText);
    if (legacy) {
        return [{ id: 'legacy_call_' + Date.now(), name: legacy.tool, arguments: legacy.args }];
    }
    return null;
}

/** Shared setup: persona routing, session init, context window, message prep. */
export async function prepareChatContext(req: ChatRequest): Promise<ChatContext> {
    const aiManager = getAIManager();
    // When user has their own provider, skip the global enabled check
    if (!req.providerOverride) {
        if (!aiManager.isInitialized() || !aiManager.isEnabled()) {
            throw new Error('AI services are not initialized or enabled.');
        }
    }

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

    const systemPrompt = buildSystemPrompt(req.userRole, persona);
    const toolContext: ToolContext = {
        userId: req.userId,
        userRole: req.userRole,
        sessionId: req.sessionId || 'anonymous',
    };

    const configManager = getConfigManager();
    const provider = req.providerOverride || aiManager.getProvider()!;
    const resolvedProviderName = (req.providerName || configManager.getProvider()) as AIProviderName;
    const resolvedModelId = req.providerOverride
        ? ((req.providerOverride as unknown as { config?: { model?: string } }).config?.model || configManager.getModel())
        : configManager.getModel();

    const ctxWindowConfig = configManager.getContextWindowConfig();
    const ctxManager = new ContextWindowManager({
        modelId: resolvedModelId,
        provider: resolvedProviderName,
        contextWindowOverride: ctxWindowConfig?.sizeOverride,
        budgetOverride: ctxWindowConfig ? {
            maxToolResultTokens: ctxWindowConfig.maxToolResultTokens,
            maxTotalToolResultTokens: ctxWindowConfig.maxTotalToolResultTokens,
        } : undefined,
    });

    const userContent = req.uiContext
        ? `[UI Context: ${req.uiContext}]\n\n${req.message}`
        : req.message;

    const rawMessages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        ...(req.history || []),
        { role: 'user', content: userContent },
    ];

    const { messages, tracker } = ctxManager.prepareMessages(rawMessages);

    return {
        persona,
        systemPrompt,
        toolContext,
        messages,
        tracker,
        ctxManager,
        useNativeTools: ctxManager.supportsNativeToolCalling(),
        toolDefinitions: toolRegistry.getToolDefinitions(),
        provider,
        providerName: resolvedProviderName,
    };
}

/** Execute a tool call — handles mock mode and real execution. */
export async function executeTool(
    toolName: string,
    toolArgs: Record<string, unknown>,
    context: ToolContext,
    providerName?: string,
): Promise<ToolResult> {
    const tool = toolRegistry.get(toolName)!;
    const effectiveProvider = providerName || getConfigManager().getProvider();
    const mockResult = effectiveProvider === 'mock'
        ? getMockToolResult(toolName, toolArgs)
        : null;
    if (mockResult) return mockResult;
    try {
        return await tool.execute(toolArgs, context);
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Tool execution failed';
        return { success: false, error: msg, summary: msg };
    }
}

/** Create a pending confirmation action (shared by stream tiers 2/3 and buffered). */
export async function createConfirmation(
    req: ChatRequest,
    toolName: string,
    toolArgs: Record<string, unknown>,
): Promise<{ id: string }> {
    return confirmationService.createPendingAction({
        sessionId: req.sessionId!,
        userId: req.userId,
        toolName,
        parameters: toolArgs,
    });
}

/** Check role enforcement for a tool. Returns error message or null if allowed. */
export function checkToolAccess(
    toolName: string,
    userRole: string,
): string | null {
    const tool = toolRegistry.get(toolName);
    if (!tool) return `Error: Tool "${toolName}" does not exist.`;
    if (tool.requiredRole && !hasRequiredRole(userRole, tool.requiredRole)) {
        return `Access denied: tool "${tool.name}" requires ${tool.requiredRole} role or higher. Your role: ${userRole}.`;
    }
    return null;
}

/** Push a tool message to conversation and record overhead. */
export function pushToolMessage(
    messages: ChatMessage[],
    tracker: TokenBudgetTracker,
    msg: ChatMessage,
): void {
    messages.push(msg);
    tracker.recordLoopOverhead(estimateMessageTokens(msg));
}

/** Append tool-limit messages and record overhead. */
export function appendToolLimitMessages(
    messages: ChatMessage[],
    tracker: TokenBudgetTracker,
    responseText: string,
): void {
    const assistMsg: ChatMessage = { role: 'assistant', content: responseText };
    const userMsg: ChatMessage = { role: 'user', content: 'You have reached the tool call limit. Please provide your best answer with the information gathered so far.' };
    messages.push(assistMsg, userMsg);
    tracker.recordLoopOverhead(estimateMessageTokens(assistMsg) + estimateMessageTokens(userMsg));
}
