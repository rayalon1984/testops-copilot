/**
 * Pure functions for processing SSE events from the AI chat stream.
 * Stateless — receives state and dispatchers, returns updated state.
 */

import type { ChatMessage, PersonaInfo } from './types';

let messageIdCounter = 0;

export function generateId(): string {
    return `msg-${Date.now()}-${++messageIdCounter}`;
}

export function generateSessionId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'session-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

export function parseToolPayload(data: string): { content: string; toolData?: Record<string, unknown> } {
    try {
        const parsed = JSON.parse(data);
        if (parsed.summary !== undefined) return { content: parsed.summary, toolData: parsed.data as Record<string, unknown> };
    } catch { /* Legacy string format */ }
    return { content: data };
}

export interface SSEState {
    currentAssistantId: string | null;
    streamingContent: string;
}

export function processSSEEvent(
    event: { type: string; data: string; tool?: string },
    state: SSEState,
    setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
    setActivePersona: React.Dispatch<React.SetStateAction<PersonaInfo | null>>,
): SSEState {
    switch (event.type) {
        case 'persona_selected': {
            const personaData = JSON.parse(event.data);
            setActivePersona({
                persona: personaData.persona,
                displayName: personaData.displayName,
                confidence: personaData.confidence,
                reasoning: personaData.reasoning,
            });
            break;
        }

        case 'thinking':
            setMessages(prev => [...prev, {
                id: generateId(),
                role: 'thinking',
                content: event.data,
                timestamp: new Date(),
            }]);
            break;

        case 'tool_start':
            setMessages(prev => [...prev, {
                id: generateId(),
                role: 'tool_start',
                content: event.data,
                toolName: event.tool,
                timestamp: new Date(),
            }]);
            break;

        case 'tool_result': {
            const { content, toolData } = parseToolPayload(event.data);
            setMessages(prev => [...prev, { id: generateId(), role: 'tool_result', content, toolName: event.tool, toolData, cardState: 'idle', timestamp: new Date() }]);
            break;
        }

        case 'confirmation_request': {
            const { actionId, tool, args, summary } = JSON.parse(event.data);
            setMessages(prev => [...prev, {
                id: generateId(),
                role: 'confirmation_request',
                content: summary,
                toolName: tool,
                actionId: actionId,
                toolArgs: args,
                confirmationStatus: 'pending',
                timestamp: new Date(),
            }]);
            break;
        }

        case 'proactive_suggestion': {
            const suggestion = JSON.parse(event.data);
            setMessages(prev => [...prev, {
                id: generateId(),
                role: 'proactive_suggestion',
                content: suggestion.reason || 'AI has a suggestion',
                toolName: suggestion.tool,
                suggestionData: suggestion,
                suggestionStatus: 'pending',
                timestamp: new Date(),
            }]);
            break;
        }

        case 'autonomous_action': {
            const { content, toolData } = parseToolPayload(event.data);
            setMessages(prev => [...prev, { id: generateId(), role: 'autonomous_action', content, toolName: event.tool, toolData, timestamp: new Date() }]);
            break;
        }

        case 'answer_chunk': {
            state.streamingContent += event.data;
            if (!state.currentAssistantId) {
                state.currentAssistantId = generateId();
                const id = state.currentAssistantId;
                setMessages(prev => [...prev, {
                    id,
                    role: 'assistant',
                    content: state.streamingContent,
                    timestamp: new Date(),
                }]);
            } else {
                const id = state.currentAssistantId;
                const content = state.streamingContent;
                setMessages(prev => prev.map(msg =>
                    msg.id === id ? { ...msg, content } : msg
                ));
            }
            break;
        }

        case 'answer':
            if (state.currentAssistantId) {
                const id = state.currentAssistantId;
                setMessages(prev => prev.map(msg =>
                    msg.id === id ? { ...msg, content: event.data } : msg
                ));
            } else {
                state.currentAssistantId = generateId();
                setMessages(prev => [...prev, {
                    id: state.currentAssistantId!,
                    role: 'assistant',
                    content: event.data,
                    timestamp: new Date(),
                }]);
            }
            state.streamingContent = '';
            state.currentAssistantId = null;
            break;

        case 'error':
            setMessages(prev => [...prev, {
                id: generateId(),
                role: 'error',
                content: event.data,
                timestamp: new Date(),
            }]);
            break;

        case 'done':
            break;
    }
    return state;
}
