/**
 * useAICopilot — React hook for SSE chat with the AI Copilot backend.
 *
 * Manages:
 *  - Message list state (user + assistant + tool events + confirmation requests)
 *  - SSE connection to POST /api/v1/ai/chat
 *  - Loading/streaming state
 *  - Error handling
 *  - Action confirmation (approve/deny)
 */

import { useState, useCallback, useRef } from 'react';

export type MessageRole = 'user' | 'assistant' | 'tool_start' | 'tool_result' | 'thinking' | 'error' | 'confirmation_request';

export interface ChatMessage {
    id: string;
    role: MessageRole;
    content: string;
    toolName?: string;
    timestamp: Date;
    // Metadata for confirmation items
    actionId?: string;
    toolArgs?: Record<string, unknown>;
    confirmationStatus?: 'pending' | 'approved' | 'denied';
}

interface UseAICopilotReturn {
    messages: ChatMessage[];
    isStreaming: boolean;
    error: string | null;
    sendMessage: (message: string) => void;
    confirmAction: (actionId: string, approved: boolean) => Promise<void>;
    clearMessages: () => void;
}

let messageIdCounter = 0;
function generateId(): string {
    return `msg-${Date.now()}-${++messageIdCounter}`;
}

export function useAICopilot(): UseAICopilotReturn {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isStreaming, setIsStreaming] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);

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
                body: JSON.stringify({ message, history }),
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

                            case 'tool_result':
                                setMessages(prev => [...prev, {
                                    id: generateId(),
                                    role: 'tool_result',
                                    content: event.data,
                                    toolName: event.tool,
                                    timestamp: new Date(),
                                }]);
                                break;

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

    const confirmAction = useCallback(async (actionId: string, approved: boolean) => {
        // Optimistic update
        setMessages(prev => prev.map(msg =>
            msg.actionId === actionId
                ? { ...msg, confirmationStatus: approved ? 'approved' : 'denied' }
                : msg
        ));

        // If approved, we might want to resume streaming or just wait for the outcome
        // Ideally, the confirm endpoint returns the tool result which we can append

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

            // If approved and tool executed successfully, append the result
            if (approved && result.toolResult) {
                setMessages(prev => [...prev, {
                    id: generateId(),
                    role: 'tool_result',
                    content: result.toolResult.summary || JSON.stringify(result.toolResult),
                    toolName: result.data.toolName,
                    timestamp: new Date(),
                }]);

                // Note: The backend doesn't automatically resume the chat stream here. 
                // In a full implementation, we might want to automatically trigger a new chat request 
                // with the updated history (tool result included) to let the AI finish its thought.
                // For now, we'll just show the result.
            }

        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Confirmation failed';
            setError(msg);
            // Revert optimistic update on error? Or just show error message.
            setMessages(prev => [...prev, {
                id: generateId(),
                role: 'error',
                content: `Confirmation failed: ${msg}`,
                timestamp: new Date(),
            }]);
        }
    }, []);

    const clearMessages = useCallback(() => {
        abortRef.current?.abort();
        setMessages([]);
        setError(null);
        setIsStreaming(false);
    }, []);

    return { messages, isStreaming, error, sendMessage, confirmAction, clearMessages };
}
