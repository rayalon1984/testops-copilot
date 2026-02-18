/**
 * AICopilot — Agentic Command Center (Floating Widget)
 * 
 * DESIGN SPEC: "Floating Card" Style
 * - Fixed bottom-right
 * - 400px width, max 600px height
 * - Distinct drop shadow & border radius
 * - Non-blocking overlay
 */

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import {
    Box,
    Paper,
    Typography,
    IconButton,
    InputBase,
    useTheme,
    Fade,
    Button,
    alpha
} from '@mui/material';
import {
    Close as CloseIcon,
    Send as SendIcon,
    AutoAwesome as SparkleIcon,
    ThumbUp as ThumbUpIcon,
    ThumbDown as ThumbDownIcon,
    SmartToy as BotIcon
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import { useAICopilot, ChatMessage } from '../../hooks/useAICopilot';
// Removed AICopilot.css import as we are using MUI sx

export default function AICopilot() {
    const [input, setInput] = useState('');
    const [isOpen, setIsOpen] = useState(false); // Default to closed (FAB state)
    const { user } = useAuth();
    const { messages, isStreaming, error, sendMessage, confirmAction, clearMessages } = useAICopilot();
    const bottomRef = useRef<HTMLDivElement>(null);
    const theme = useTheme();

    // Auto-scroll to bottom
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isStreaming]);

    // Open chat automatically if there are messages (e.g. from context trigger)
    useEffect(() => {
        if (messages.length > 0 && !isOpen) {
            setIsOpen(true);
        }
    }, [messages.length]);

    const handleSend = () => {
        if (!input.trim() || isStreaming) return;
        sendMessage(input);
        setInput('');
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleSend();
        }
    };

    const renderMessage = (msg: ChatMessage) => {
        switch (msg.role) {
            case 'user':
                return (
                    <Box key={msg.id} sx={{ alignSelf: 'flex-end', mb: 2, maxWidth: '85%' }}>
                        <Paper sx={{
                            bgcolor: 'primary.main',
                            color: 'primary.contrastText',
                            p: 1.5,
                            borderRadius: '16px 16px 0 16px',
                            boxShadow: 2
                        }}>
                            <Typography variant="body2">{msg.content}</Typography>
                        </Paper>
                    </Box>
                );

            case 'assistant':
                return (
                    <Box key={msg.id} sx={{ alignSelf: 'flex-start', mb: 2, maxWidth: '90%' }}>
                        <Paper sx={{
                            bgcolor: 'background.paper',
                            color: 'text.primary',
                            p: 1.5,
                            borderRadius: '16px 16px 16px 0',
                            border: 1,
                            borderColor: 'divider',
                            boxShadow: 1
                        }}>
                            <Typography variant="body2">{msg.content}</Typography>
                        </Paper>
                    </Box>
                );

            case 'thinking':
                return (
                    <Box key={msg.id} sx={{ alignSelf: 'flex-start', mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <span className="dot-pulse">Thinking...</span>
                        </Typography>
                    </Box>
                );

            case 'tool_start':
                return (
                    <Box key={msg.id} sx={{ alignSelf: 'center', mb: 1 }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.65rem' }}>
                            Action: {msg.toolName}
                        </Typography>
                    </Box>
                );

            case 'tool_result':
                return (
                    <Paper key={msg.id} sx={{ mb: 2, borderRadius: 2, overflow: 'hidden', border: 1, borderColor: 'divider' }}>
                        <Box sx={{ bgcolor: 'success.main', px: 1, py: 0.5 }}>
                            <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'common.white' }}>RESULT</Typography>
                        </Box>
                        <Box sx={{ bgcolor: 'background.default', p: 1.5 }}>
                            <Typography variant="caption" fontFamily="monospace" color="text.secondary">
                                {msg.content}
                            </Typography>
                        </Box>
                    </Paper>
                );

            case 'confirmation_request': {
                const isResolved = msg.confirmationStatus !== 'pending';
                const isApproved = msg.confirmationStatus === 'approved';
                // const statusColor = isResolved ? (isApproved ? 'success.main' : 'error.main') : 'warning.main'; // Unused
                const bgGradient = isResolved
                    ? (isApproved ? 'linear-gradient(45deg, #1b5e20, #2e7d32)' : 'linear-gradient(45deg, #c62828, #d32f2f)')
                    : 'linear-gradient(45deg, #ed6c02, #ff9800)';

                const getToolIcon = (name?: string) => {
                    if (name?.includes('jira')) return <BotIcon />; // Placeholder, ideally BugReportIcon
                    if (name?.includes('github')) return <BotIcon />; // Placeholder, ideally GitHubIcon
                    return <SparkleIcon />;
                };

                return (
                    <Paper key={msg.id} elevation={3} sx={{
                        mb: 2,
                        borderRadius: 3,
                        overflow: 'hidden',
                        border: 1,
                        borderColor: 'divider',
                        transition: 'all 0.3s ease'
                    }}>
                        {/* Header Banner */}
                        <Box sx={{
                            background: bgGradient,
                            px: 2,
                            py: 1.5,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            color: 'white'
                        }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                {getToolIcon(msg.toolName)}
                                <Typography variant="subtitle2" fontWeight="bold" sx={{ letterSpacing: 0.5 }}>
                                    {isResolved ? (isApproved ? 'ACTION APPROVED' : 'ACTION DENIED') : 'APPROVAL REQUIRED'}
                                </Typography>
                            </Box>
                            {isResolved ? (isApproved ? '✅' : '🚫') : <Typography variant="caption" sx={{ bgcolor: 'rgba(255,255,255,0.2)', px: 1, borderRadius: 1 }}>WAITING</Typography>}
                        </Box>

                        <Box sx={{ p: 2, bgcolor: 'background.paper' }}>
                            <Typography variant="body2" sx={{ mb: 2, fontWeight: 500 }}>
                                {msg.content}
                            </Typography>

                            {/* Arguments Block */}
                            {msg.toolArgs && (
                                <Box sx={{
                                    mb: 2,
                                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.05),
                                    borderRadius: 2,
                                    border: '1px dashed',
                                    borderColor: 'divider',
                                    position: 'relative',
                                    overflow: 'hidden'
                                }}>
                                    <Box sx={{
                                        px: 1.5, py: 0.5,
                                        bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
                                        borderBottom: '1px dashed',
                                        borderColor: 'divider'
                                    }}>
                                        <Typography variant="caption" fontFamily="monospace" fontWeight={600} color="primary.main">
                                            PAYLOAD PREVIEW
                                        </Typography>
                                    </Box>
                                    <Box sx={{ p: 1.5, maxHeight: 200, overflow: 'auto' }}>
                                        <Typography variant="caption" fontFamily="monospace" component="pre" sx={{ m: 0, whiteSpace: 'pre-wrap', color: 'text.secondary' }}>
                                            {JSON.stringify(msg.toolArgs, null, 2)}
                                        </Typography>
                                    </Box>
                                </Box>
                            )}

                            {/* Action Buttons */}
                            {!isResolved && (
                                <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                                    <Button
                                        fullWidth
                                        variant="outlined"
                                        color="inherit"
                                        onClick={() => msg.actionId && confirmAction(msg.actionId, false)}
                                        sx={{
                                            borderRadius: 2,
                                            borderColor: 'divider',
                                            color: 'text.secondary',
                                            '&:hover': { bgcolor: 'action.hover', color: 'error.main', borderColor: 'error.main' }
                                        }}
                                    >
                                        Deny
                                    </Button>
                                    <Button
                                        fullWidth
                                        variant="contained"
                                        onClick={() => msg.actionId && confirmAction(msg.actionId, true)}
                                        sx={{
                                            borderRadius: 2,
                                            bgcolor: 'success.dark',
                                            '&:hover': { bgcolor: 'success.main' },
                                            boxShadow: 2
                                        }}
                                        startIcon={<ThumbUpIcon />}
                                    >
                                        Approve Action
                                    </Button>
                                </Box>
                            )}
                        </Box>
                    </Paper>
                );
            }

            case 'error':
                return (
                    <Box key={msg.id} sx={{ mb: 2 }}>
                        <Paper sx={{
                            bgcolor: (theme) => alpha(theme.palette.error.main, 0.1),
                            color: 'error.main',
                            p: 1.5,
                            borderRadius: 2
                        }}>
                            <Typography variant="caption">Error: {msg.content}</Typography>
                        </Paper>
                    </Box>
                );

            default:
                return null;
        }
    };

    // FAB implementation using MUI
    if (!isOpen) {
        return (
            <IconButton
                onClick={() => setIsOpen(true)}
                sx={{
                    position: 'fixed',
                    bottom: 24,
                    right: 24,
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                    color: 'common.white',
                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.4)',
                    zIndex: 1000,
                    transition: 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                    '&:hover': {
                        transform: 'scale(1.1)'
                    }
                }}
            >
                <SparkleIcon fontSize="large" />
            </IconButton>
        );
    }

    return (
        <Fade in={isOpen}>
            <Paper
                elevation={10}
                sx={{
                    position: 'fixed',
                    bottom: 90,
                    right: 24,
                    width: 400,
                    maxHeight: 'min(70vh, 600px)',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: 3,
                    zIndex: 1001,
                    overflow: 'hidden',
                    borderColor: 'divider',
                    borderWidth: 1,
                    borderStyle: 'solid',
                    bgcolor: 'background.paper' // Uses theme background
                }}
            >
                {/* Header */}
                <Box sx={{
                    p: 2,
                    borderBottom: 1,
                    borderColor: 'divider',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    bgcolor: 'background.default'
                }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <SparkleIcon color="primary" />
                        <Typography variant="subtitle2" fontWeight={600}>TestOps Copilot</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {isStreaming && (
                            <Typography variant="caption" color="text.secondary" className="dot-pulse">
                                typing...
                            </Typography>
                        )}
                        <IconButton size="small" onClick={() => setIsOpen(false)}>
                            <CloseIcon fontSize="small" />
                        </IconButton>
                    </Box>
                </Box>

                {/* Chat Area */}
                <Box sx={{
                    flex: 1,
                    overflowY: 'auto',
                    p: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    bgcolor: 'background.paper'
                }}>
                    {messages.length === 0 && (
                        <Box sx={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'text.secondary',
                            textAlign: 'center',
                            p: 3
                        }}>
                            <BotIcon sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
                            <Typography variant="body1" fontWeight={500} gutterBottom>How can I help you?</Typography>
                            <Typography variant="caption">
                                Try &quot;Analyze the last failure&quot; or &quot;Create a Jira ticket&quot;.
                            </Typography>
                        </Box>
                    )}

                    {messages.map(renderMessage)}
                    <div ref={bottomRef} />
                </Box>

                {/* Input Area */}
                <Box sx={{
                    p: 2,
                    borderTop: 1,
                    borderColor: 'divider',
                    bgcolor: 'background.default'
                }}>
                    <Paper
                        elevation={0}
                        sx={{
                            p: '2px 4px',
                            display: 'flex',
                            alignItems: 'center',
                            bgcolor: 'background.paper',
                            border: 1,
                            borderColor: 'divider',
                            borderRadius: 3,
                            '&:hover': {
                                borderColor: 'text.secondary'
                            },
                            '&:focus-within': {
                                borderColor: 'primary.main',
                                boxShadow: `0 0 0 1px ${theme.palette.primary.main}`
                            }
                        }}
                    >
                        <InputBase
                            sx={{ ml: 2, flex: 1, fontSize: '0.95rem' }}
                            placeholder="Ask Copilot..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={isStreaming}
                            autoFocus
                        />
                        <IconButton
                            color="primary"
                            sx={{ p: '10px' }}
                            onClick={handleSend}
                            disabled={!input.trim() || isStreaming}
                        >
                            <SendIcon />
                        </IconButton>
                    </Paper>
                </Box>

                <style>{`
                    .dot-pulse::after {
                        content: '.';
                        animation: dots 1.5s steps(5, end) infinite;
                    }
                    @keyframes dots {
                        0%, 20% { content: '.'; }
                        40% { content: '..'; }
                        60% { content: '...'; }
                        80%, 100% { content: ''; }
                    }
                `}</style>
            </Paper>
        </Fade>
    );
}
