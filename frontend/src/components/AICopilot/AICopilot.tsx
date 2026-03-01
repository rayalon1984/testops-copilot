/**
 * AICopilot — Agentic Command Center (Embedded Panel) — v3
 *
 * DESIGN SPEC: DESIGN_LANG_V2.md §3.2
 * - Embedded in 3-column grid (column 3)
 * - 360px width, full viewport height
 * - Always visible on lg+ breakpoints
 * - borderLeft divider separating from main content
 *
 * v3: Service-native cards, role-aware actions, markdown rendering,
 *     multi-line input, confirmation previews with countdown timers.
 */

import { useRef, useEffect } from 'react';
import { Box, Typography, IconButton, Chip } from '@mui/material';
import {
    AutoAwesome as SparkleIcon,
    DeleteOutline as ClearIcon,
} from '@mui/icons-material';
import { useAICopilot, ChatMessage } from '../../hooks/useAICopilot';
import { useAuth } from '../../hooks/useAuth';
import { useAIContext } from '../../contexts/AIContext';

// Message components
import UserMessage from './messages/UserMessage';
import AssistantMessage from './messages/AssistantMessage';
import ThinkingIndicator from './messages/ThinkingIndicator';
import ErrorMessage from './messages/ErrorMessage';
import ToolResultCard from './messages/ToolResultCard';

// Proactive suggestions (Sprint 6)
import ProactiveSuggestionCard from './cards/ProactiveSuggestionCard';
import type { ProactiveSuggestionData } from './cards/ProactiveSuggestionCard';

// Confirmation previews
import ConfirmationShell from './cards/shared/ConfirmationShell';
import JiraCreatePreview from './cards/JiraCreatePreview';
import JiraTransitionPreview from './cards/JiraTransitionPreview';
import JiraCommentPreview from './cards/JiraCommentPreview';
import GitHubPRPreview from './cards/GitHubPRPreview';
import GitHubBranchPreview from './cards/GitHubBranchPreview';
import GitHubFileChangePreview from './cards/GitHubFileChangePreview';
import GenericResultCard from './cards/GenericResultCard';

// Shell components
import ChatInput from './ChatInput';
import EmptyState from './EmptyState';
import MessageActions from './MessageActions';
import ProviderPicker from './ProviderPicker';
import QuotaIndicator from './QuotaIndicator';

function useUserRole(): string {
    const { user } = useAuth();
    return user?.role?.toUpperCase() || 'VIEWER';
}

function CopilotHeader({ messages, clearMessages }: { messages: ChatMessage[]; clearMessages: () => void }) {
    return (
        <Box sx={{
            px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            bgcolor: 'background.default', minHeight: 56,
        }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SparkleIcon color="primary" fontSize="small" />
                <Typography variant="subtitle2" fontWeight={600}>TestOps Copilot</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <QuotaIndicator />
                <ProviderPicker />
                {messages.length > 0 && (
                    <IconButton size="small" onClick={clearMessages} title="Clear chat">
                        <ClearIcon fontSize="small" />
                    </IconButton>
                )}
            </Box>
        </Box>
    );
}

function StreamingIndicator({ activePersona }: { activePersona: { displayName: string } | null }) {
    return (
        <Box sx={{ mt: 1 }}>
            {activePersona && (
                <Chip
                    label={activePersona.displayName}
                    size="small"
                    variant="outlined"
                    sx={{ fontSize: '0.65rem', height: 20, mb: 0.5, color: 'text.secondary', borderColor: 'divider' }}
                />
            )}
            <ThinkingIndicator text="TOCing" />
        </Box>
    );
}

function MessageRenderer({ msg, activePersona, userRole, messages, sendActionPrompt, confirmAction, sendWithContext, handleSuggestionAccept, handleSuggestionDismiss }: {
    msg: ChatMessage; activePersona: { persona: string; displayName: string } | null; userRole: string;
    messages: ChatMessage[]; sendActionPrompt: (prompt: string, sourceMessageId: string) => void;
    confirmAction: (id: string, approved: boolean) => void; sendWithContext: (msg: string) => void;
    handleSuggestionAccept: (suggestion: ProactiveSuggestionData, messageId: string) => void;
    handleSuggestionDismiss: (messageId: string) => void;
}) {
    switch (msg.role) {
        case 'user':
            return <UserMessage key={msg.id} content={msg.content} />;
        case 'assistant':
            return (
                <Box key={msg.id} sx={{ alignSelf: 'flex-start', mb: 2, maxWidth: '90%', minWidth: 0 }}>
                    {activePersona && activePersona.persona !== 'SENIOR_ENGINEER' && (
                        <Chip label={activePersona.displayName} size="small" variant="outlined"
                            sx={{ fontSize: '0.6rem', height: 18, mb: 0.5, color: 'text.secondary', borderColor: 'divider', fontWeight: 500 }}
                        />
                    )}
                    <AssistantMessage content={msg.content} id={msg.id} />
                    <MessageActions content={msg.content} timestamp={msg.timestamp} persona={activePersona?.displayName} />
                </Box>
            );
        case 'thinking':
            // Suppressed: StreamingIndicator at bottom of chat handles live thinking state.
            // Rendering these as permanent messages creates noise between cards (DESIGN_LANG_V2 §6.4).
            return null;
        case 'tool_start':
            // Suppressed: V2 card headers already identify the tool; "ACTION: xxx" labels are dev noise.
            return null;
        case 'tool_result':
            return (
                <Box key={msg.id} sx={{ mb: 1.5, minWidth: 0 }}>
                    <ToolResultCard message={msg} userRole={userRole} onAction={sendActionPrompt} />
                </Box>
            );
        case 'confirmation_request':
            return (
                <Box key={msg.id} sx={{ mb: 1.5, minWidth: 0 }}>
                    <ConfirmationPreview
                        msg={msg} userRole={userRole}
                        onConfirm={() => msg.actionId && confirmAction(msg.actionId, true)}
                        onDeny={() => msg.actionId && confirmAction(msg.actionId, false)}
                    />
                </Box>
            );
        case 'proactive_suggestion':
            return (
                <Box key={msg.id} sx={{ mb: 1.5, minWidth: 0 }}>
                    <ProactiveSuggestionCard
                        suggestion={msg.suggestionData as unknown as ProactiveSuggestionData}
                        onAccept={(s) => handleSuggestionAccept(s, msg.id)}
                        onDismiss={() => handleSuggestionDismiss(msg.id)}
                        accepted={msg.suggestionStatus === 'accepted'}
                        dismissed={msg.suggestionStatus === 'dismissed'}
                    />
                </Box>
            );
        case 'autonomous_action':
            return (
                <Box key={msg.id} sx={{ mb: 1.5, minWidth: 0 }}>
                    <ToolResultCard message={{ ...msg, role: 'tool_result' }} userRole={userRole} onAction={sendActionPrompt} />
                </Box>
            );
        case 'error': {
            const lastUserMsg = messages.filter(m => m.role === 'user').pop();
            return (
                <ErrorMessage key={msg.id} content={msg.content} onRetry={lastUserMsg ? () => sendWithContext(lastUserMsg.content) : undefined} />
            );
        }
        default:
            return null;
    }
}

function ConfirmationPreview({ msg, onConfirm, onDeny, userRole }: {
    msg: ChatMessage;
    onConfirm: () => void;
    onDeny: () => void;
    userRole: string;
}) {
    const toolName = msg.toolName || '';
    const args = msg.toolArgs || {};

    const inner = (() => {
        switch (toolName) {
            case 'jira_create_issue':     return <JiraCreatePreview args={args} />;
            case 'jira_transition_issue': return <JiraTransitionPreview args={args} />;
            case 'jira_comment':          return <JiraCommentPreview args={args} />;
            case 'github_create_pr':      return <GitHubPRPreview args={args} />;
            case 'github_create_branch':  return <GitHubBranchPreview args={args} />;
            case 'github_update_file':    return <GitHubFileChangePreview args={args} />;
            default:                      return <GenericResultCard toolName={toolName} summary={msg.content} data={args} />;
        }
    })();

    return (
        <ConfirmationShell
            tool={toolName}
            actionId={msg.actionId || ''}
            status={msg.confirmationStatus || 'pending'}
            createdAt={msg.timestamp}
            userRole={userRole}
            onConfirm={onConfirm}
            onDeny={onDeny}
        >
            {inner}
        </ConfirmationShell>
    );
}

export default function AICopilot() {
    const {
        messages, isStreaming, activePersona,
        sendMessage, confirmAction, clearMessages,
        sendActionPrompt, updateMessage,
    } = useAICopilot();
    const bottomRef = useRef<HTMLDivElement>(null);
    const userRole = useUserRole();
    const { getContextString } = useAIContext();

    // Context-aware send: injects current UI context into every message
    const sendWithContext = (message: string) => {
        sendMessage(message, getContextString());
    };

    // Auto-scroll to bottom
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isStreaming]);

    const handleSuggestionAccept = (suggestion: ProactiveSuggestionData, messageId: string) => {
        updateMessage(messageId, { suggestionStatus: 'accepted' });
        // Trigger the suggested tool via a natural language prompt
        const argsPreview = Object.entries(suggestion.preparedArgs)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
            .join(', ');
        sendActionPrompt(
            `Please execute ${suggestion.tool} with these parameters: ${argsPreview}`,
            messageId
        );
    };

    const handleSuggestionDismiss = (messageId: string) => {
        updateMessage(messageId, { suggestionStatus: 'dismissed' });
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', borderLeft: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
            <CopilotHeader messages={messages} clearMessages={clearMessages} />

            <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0, px: 2, pt: 2, pb: 4, display: 'flex', flexDirection: 'column' }}>
                {messages.length === 0 && <EmptyState onSend={sendWithContext} />}

                {messages.map((msg) => (
                    <MessageRenderer
                        key={msg.id} msg={msg} activePersona={activePersona} userRole={userRole}
                        messages={messages} sendActionPrompt={sendActionPrompt} confirmAction={confirmAction}
                        sendWithContext={sendWithContext}
                        handleSuggestionAccept={handleSuggestionAccept} handleSuggestionDismiss={handleSuggestionDismiss}
                    />
                ))}

                {isStreaming && <StreamingIndicator activePersona={activePersona} />}
                <div ref={bottomRef} />
            </Box>

            <ChatInput onSend={sendWithContext} disabled={isStreaming} />
        </Box>
    );
}
