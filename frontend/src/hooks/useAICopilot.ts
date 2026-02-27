/**
 * useAICopilot — React hook for SSE chat with the AI Copilot backend.
 *
 * v3: Extended with toolData for rich cards, cardState for lifecycle,
 *     updateMessage for in-card mutations, sendActionPrompt for card actions.
 */

import { useState, useCallback, useRef, useEffect } from 'react';

// Re-export types so existing imports keep working
export type { MessageRole, CardState, PersonaInfo, ChatMessage, UseAICopilotReturn } from './copilot/types';
import type { ChatMessage, PersonaInfo, CardState, UseAICopilotReturn } from './copilot/types';
import { generateId, generateSessionId, processSSEEvent } from './copilot/sseProcessor';
import { handleConfirmAction } from './copilot/confirmAction';

export function useAICopilot(): UseAICopilotReturn {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isStreaming, setIsStreaming] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activePersona, setActivePersona] = useState<PersonaInfo | null>(null);
    const sessionIdRef = useRef<string>(generateSessionId());
    const abortRef = useRef<AbortController | null>(null);
    const messagesRef = useRef<ChatMessage[]>(messages);

    // Keep messagesRef in sync without triggering callback recreation
    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    const updateMessage = useCallback((id: string, patch: Partial<ChatMessage>) => {
        setMessages(prev => prev.map(msg =>
            msg.id === id ? { ...msg, ...patch } : msg
        ));
    }, []);

    const sendMessage = useCallback(async (message: string, uiContext?: string) => {
        if (!message.trim() || isStreaming) return;

        const userMsg: ChatMessage = {
            id: generateId(),
            role: 'user',
            content: message,
            timestamp: new Date(),
        };
        setMessages(prev => [...prev, userMsg]);
        setIsStreaming(true);
        setError(null);

        const history = messagesRef.current
            .filter(m => m.role === 'user' || m.role === 'assistant')
            .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

        try {
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
                    sessionId: sessionIdRef.current,
                    ...(uiContext ? { uiContext } : {}),
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
            const sseState = { currentAssistantId: null as string | null, streamingContent: '' };

            // eslint-disable-next-line
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const jsonStr = line.slice(6).trim();
                    if (!jsonStr) continue;

                    try {
                        const event = JSON.parse(jsonStr);
                        processSSEEvent(event, sseState, setMessages, setActivePersona);
                    } catch {
                        // Skip malformed JSON lines from SSE stream
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
    }, [isStreaming]);

    const sendActionPrompt = useCallback((prompt: string, sourceMessageId: string) => {
        setMessages(prev => prev.map(msg =>
            msg.id === sourceMessageId ? { ...msg, cardState: 'action_pending' as CardState } : msg
        ));
        sendMessage(prompt);
    }, [sendMessage]);

    const confirmAction = useCallback(async (actionId: string, approved: boolean) => {
        await handleConfirmAction(actionId, approved, setMessages, setError, sendMessage);
    }, [sendMessage]);

    const clearMessages = useCallback(() => {
        abortRef.current?.abort();
        setMessages([]);
        setError(null);
        setIsStreaming(false);
        setActivePersona(null);
    }, []);

    return {
        messages, isStreaming, error, activePersona,
        sendMessage, confirmAction, clearMessages,
        updateMessage, sendActionPrompt,
    };
}
