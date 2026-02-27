/**
 * Shared types for the AI Copilot hook system.
 */

export type MessageRole = 'user' | 'assistant' | 'tool_start' | 'tool_result' | 'thinking' | 'error' | 'confirmation_request' | 'proactive_suggestion' | 'autonomous_action';

export type CardState = 'idle' | 'action_pending' | 'updated';

/** Virtual team persona selected by the PersonaRouter */
export interface PersonaInfo {
    persona: string;
    displayName: string;
    confidence: number;
    reasoning: string;
}

export interface ChatMessage {
    id: string;
    role: MessageRole;
    content: string;
    toolName?: string;
    timestamp: Date;
    toolData?: Record<string, unknown>;
    cardState?: CardState;
    actionId?: string;
    toolArgs?: Record<string, unknown>;
    confirmationStatus?: 'pending' | 'approved' | 'denied';
    sourceMessageId?: string;
    suggestionData?: Record<string, unknown>;
    suggestionStatus?: 'pending' | 'accepted' | 'dismissed';
}

export interface UseAICopilotReturn {
    messages: ChatMessage[];
    isStreaming: boolean;
    error: string | null;
    activePersona: PersonaInfo | null;
    sendMessage: (message: string, uiContext?: string) => void;
    confirmAction: (actionId: string, approved: boolean) => Promise<void>;
    clearMessages: () => void;
    updateMessage: (id: string, patch: Partial<ChatMessage>) => void;
    sendActionPrompt: (prompt: string, sourceMessageId: string) => void;
}
