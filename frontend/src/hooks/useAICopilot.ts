/**
 * useAICopilot — React hook for SSE chat with the AI Copilot backend.
 *
 * v3: Extended with toolData for rich cards, cardState for lifecycle,
 *     updateMessage for in-card mutations, sendActionPrompt for card actions.
 */

import { useState, useCallback, useRef } from 'react';

export type MessageRole = 'user' | 'assistant' | 'tool_start' | 'tool_result' | 'thinking' | 'error' | 'confirmation_request';

export type CardState = 'idle' | 'action_pending' | 'updated';

export interface ChatMessage {
    id: string;
    role: MessageRole;
    content: string;
    toolName?: string;
    timestamp: Date;
    // v3: structured tool result data for rich card rendering
    toolData?: Record<string, unknown>;
    // v3: card lifecycle state
    cardState?: CardState;
    // Metadata for confirmation items
    actionId?: string;
    toolArgs?: Record<string, unknown>;
    confirmationStatus?: 'pending' | 'approved' | 'denied';
    // v3: link card action back to source card
    sourceMessageId?: string;
}

export interface UseAICopilotReturn {
    messages: ChatMessage[];
    isStreaming: boolean;
    error: string | null;
    sendMessage: (message: string) => void;
    confirmAction: (actionId: string, approved: boolean) => Promise<void>;
    clearMessages: () => void;
    // v3: mutate a card in-place (e.g., after action completes)
    updateMessage: (id: string, patch: Partial<ChatMessage>) => void;
    // v3: card-triggered action — sends prompt linked to source card
    sendActionPrompt: (prompt: string, sourceMessageId: string) => void;
}

let messageIdCounter = 0;
function generateId(): string {
    return `msg-${Date.now()}-${++messageIdCounter}`;
}

function generateSessionId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'session-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

export function useAICopilot(): UseAICopilotReturn {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isStreaming, setIsStreaming] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const sessionIdRef = useRef<string>(generateSessionId());
    const abortRef = useRef<AbortController | null>(null);

    const updateMessage = useCallback((id: string, patch: Partial<ChatMessage>) => {
        setMessages(prev => prev.map(msg =>
            msg.id === id ? { ...msg, ...patch } : msg
        ));
    }, []);

    const sendMessage = useCallback(async (message: string) => {
        if (!message.trim() || isStreaming) return;

        // Add user message immediately
        const userMsg: ChatMessage = {
            id: generateId(),
            role: 'user',
            content: message,
            timestamp: new Date(),
        };
        setMessages(prev => [...prev, userMsg]);
        setIsStreaming(true);
        setError(null);

        // Build history from existing messages (only user/assistant for the LLM)
        const history = messages
            .filter(m => m.role === 'user' || m.role === 'assistant')
            .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

        try {
            // Abort previous request if any
            abortRef.current?.abort();
            const controller = new AbortController();
            abortRef.current = controller;

            const token = localStorage.getItem('accessToken');
            const response = await fetch('/api/v1/ai/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                    message,
                    history,
                    sessionId: sessionIdRef.current
                }),
                signal: controller.signal,
            });

            if (!response.ok) {
                throw new Error(`Chat request failed: ${response.status}`);
            }

            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('No response stream');
            }

            const decoder = new TextDecoder();
            let buffer = '';
            let currentAssistantId: string | null = null;

            // eslint-disable-next-line
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep incomplete line

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const jsonStr = line.slice(6).trim();
                    if (!jsonStr) continue;

                    try {
                        const event = JSON.parse(jsonStr);

                        switch (event.type) {
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
                                // v3: parse { summary, data } JSON format with legacy fallback
                                let content = event.data;
                                let toolData: Record<string, unknown> | undefined;
                                try {
                                    const parsed = JSON.parse(event.data);
                                    if (parsed.summary !== undefined) {
                                        content = parsed.summary;
                                        toolData = parsed.data as Record<string, unknown>;
                                    }
                                } catch {
                                    // Legacy string format — content is already the summary
                                }
                                setMessages(prev => [...prev, {
                                    id: generateId(),
                                    role: 'tool_result',
                                    content,
                                    toolName: event.tool,
                                    toolData,
                                    cardState: 'idle',
                                    timestamp: new Date(),
                                }]);
                                break;
                            }

                            case 'confirmation_request': {
                                // event.data is a JSON string with details
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

                            case 'answer':
                                currentAssistantId = generateId();
                                setMessages(prev => [...prev, {
                                    id: currentAssistantId!,
                                    role: 'assistant',
                                    content: event.data,
                                    timestamp: new Date(),
                                }]);
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
                                // Stream complete
                                break;
                        }
                    } catch (e) {
                        console.error('Failed to parse SSE event:', jsonStr, e);
                        // Skip malformed JSON lines
                    }
                }
            }
        } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') return;
            const msg = err instanceof Error ? err.message : 'Connection failed';
            setError(msg);
            setMessages(prev => [...prev, {
                id: generateId(),
                role: 'error',
                content: msg,
                timestamp: new Date(),
            }]);
        } finally {
            setIsStreaming(false);
        }
    }, [isStreaming, messages]);

    const sendActionPrompt = useCallback((prompt: string, sourceMessageId: string) => {
        // Mark the source card as pending
        setMessages(prev => prev.map(msg =>
            msg.id === sourceMessageId ? { ...msg, cardState: 'action_pending' as CardState } : msg
        ));
        // Send the prompt as a normal message (it will trigger the AI to call the write tool)
        sendMessage(prompt);
    }, [sendMessage]);

    const confirmAction = useCallback(async (actionId: string, approved: boolean) => {
        // Optimistic update
        setMessages(prev => prev.map(msg =>
            msg.actionId === actionId
                ? { ...msg, confirmationStatus: approved ? 'approved' : 'denied' }
                : msg
        ));

        try {
            const token = localStorage.getItem('accessToken');
            const response = await fetch('/api/v1/ai/confirm', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ actionId, approved }),
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to confirm action');
            }

            const result = await response.json();

            // If approved and tool executed successfully, append the result card
            if (approved && result.toolResult) {
                const toolName = result.data?.toolName;
                setMessages(prev => [...prev, {
                    id: generateId(),
                    role: 'tool_result',
                    content: result.toolResult.summary || JSON.stringify(result.toolResult),
                    toolName,
                    toolData: result.toolResult.data as Record<string, unknown> | undefined,
                    cardState: 'idle',
                    timestamp: new Date(),
                }]);

                // Auto-resume: send a continuation message so the AI can finish
                // its reasoning with the tool result. Short delay to let the card render.
                setTimeout(() => {
                    sendMessage(
                        `The tool ${toolName || 'action'} was executed successfully. ` +
                        `Please summarize the result and suggest any follow-up actions.`
                    );
                }, 500);
            }

        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Confirmation failed';
            setError(msg);
            setMessages(prev => [...prev, {
                id: generateId(),
                role: 'error',
                content: `Confirmation failed: ${msg}`,
                timestamp: new Date(),
            }]);
        }
    }, [sendMessage]);

    const clearMessages = useCallback(() => {
        abortRef.current?.abort();
        setMessages([]);
        setError(null);
        setIsStreaming(false);
    }, []);

    return {
        messages, isStreaming, error,
        sendMessage, confirmAction, clearMessages,
        updateMessage, sendActionPrompt,
    };
}
