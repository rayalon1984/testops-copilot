/**
 * Handles the confirm/deny flow for AI tool actions.
 */

import { api } from '../../api';
import type { ChatMessage } from './types';
import { generateId } from './sseProcessor';

export async function handleConfirmAction(
    actionId: string,
    approved: boolean,
    setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
    setError: React.Dispatch<React.SetStateAction<string | null>>,
    sendMessage: (message: string) => void,
): Promise<void> {
    setMessages(prev => prev.map(msg =>
        msg.actionId === actionId
            ? { ...msg, confirmationStatus: approved ? 'approved' : 'denied' }
            : msg
    ));

    try {
        const result = await api.post<{ data?: { toolName?: string }; toolResult?: { summary?: string; data?: unknown } }>('/ai/confirm', { actionId, approved });

        const toolResult = result.toolResult;
        if (approved && toolResult) {
            const toolName = result.data?.toolName;
            setMessages(prev => [...prev, {
                id: generateId(),
                role: 'tool_result',
                content: toolResult.summary || JSON.stringify(toolResult),
                toolName,
                toolData: toolResult.data as Record<string, unknown> | undefined,
                cardState: 'idle',
                timestamp: new Date(),
            }]);

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
}
