/**
 * AICopilot — Sparkle Button + Chat Drawer Component
 *
 * A premium, glassmorphism chat drawer that streams AI responses
 * in real-time via SSE. Features:
 *  - Sparkle button with glow animation
 *  - Right-side drawer with blur backdrop
 *  - Tool execution indicators ("🔍 Searching Jira...")
 *  - Markdown rendering for AI responses
 *  - Suggested prompts for first-time users
 */

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import {
    Drawer,
    IconButton,
    Typography,
    Box,
    Tooltip,
    Divider,
    useTheme,
    alpha,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import SearchIcon from '@mui/icons-material/Search';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { useAICopilot, ChatMessage } from '../../hooks/useAICopilot';
import './AICopilot.css';

const SUGGESTED_PROMPTS = [
    '🔍 Which tests failed in the last 24 hours?',
    '📊 Show me the dashboard health summary',
    '🐛 Find Jira issues related to login failures',
    '📖 Search Confluence for RCA documentation',
];

interface AICopilotProps {
    userRole?: string;
}

export default function AICopilot({ userRole }: AICopilotProps) {
    const [open, setOpen] = useState(false);
    const [input, setInput] = useState('');
    const { messages, isStreaming, sendMessage, clearMessages } = useAICopilot();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const theme = useTheme();

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Focus input when drawer opens
    useEffect(() => {
        if (open) {
            setTimeout(() => inputRef.current?.focus(), 300);
        }
    }, [open]);

    const handleSend = () => {
        if (!input.trim() || isStreaming) return;
        sendMessage(input.trim());
        setInput('');
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleSuggestion = (prompt: string) => {
        // Strip the emoji prefix
        const clean = prompt.replace(/^[^\w]*/, '').trim();
        sendMessage(clean);
    };

    const renderMessage = (msg: ChatMessage) => {
        switch (msg.role) {
            case 'user':
                return (
                    <div key={msg.id} className="ai-msg ai-msg-user">
                        {msg.content}
                    </div>
                );
            case 'assistant':
                return (
                    <div key={msg.id} className="ai-msg ai-msg-assistant">
                        {/* Basic markdown: bold, code, links */}
                        <div
                            dangerouslySetInnerHTML={{
                                __html: formatMarkdown(msg.content),
                            }}
                        />
                    </div>
                );
            case 'thinking':
                return (
                    <div key={msg.id} className="ai-msg ai-msg-thinking">
                        <div className="ai-typing-dots">
                            <span /><span /><span />
                        </div>
                        {msg.content}
                    </div>
                );
            case 'tool_start':
                return (
                    <div key={msg.id} className="ai-msg ai-msg-tool ai-msg-tool-start">
                        <SearchIcon sx={{ fontSize: 14 }} />
                        {msg.content}
                    </div>
                );
            case 'tool_result':
                return (
                    <div key={msg.id} className="ai-msg ai-msg-tool ai-msg-tool-result">
                        <CheckCircleOutlineIcon sx={{ fontSize: 14 }} />
                        {msg.content}
                    </div>
                );
            case 'error':
                return (
                    <div key={msg.id} className="ai-msg ai-msg-error">
                        <ErrorOutlineIcon sx={{ fontSize: 14, mr: 0.5 }} />
                        {msg.content}
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <>
            {/* ─── Sparkle Button ─── */}
            <Tooltip title="AI Copilot" arrow>
                <IconButton
                    onClick={() => setOpen(true)}
                    id="ai-copilot-trigger"
                    sx={{
                        background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.15)}, ${alpha('#7c4dff', 0.15)})`,
                        border: `1px solid ${alpha('#7c4dff', 0.3)}`,
                        color: '#7c4dff',
                        width: 36,
                        height: 36,
                        transition: 'all 0.3s ease',
                        animation: 'glow-ring 3s infinite',
                        '&:hover': {
                            background: `linear-gradient(135deg, ${alpha('#7c4dff', 0.25)}, ${alpha(theme.palette.secondary.main, 0.2)})`,
                            transform: 'scale(1.1)',
                            borderColor: alpha('#7c4dff', 0.5),
                            '& svg': {
                                animation: 'sparkle-rotate 0.6s ease-out',
                            },
                        },
                    }}
                >
                    <AutoAwesomeIcon sx={{ fontSize: 18 }} />
                </IconButton>
            </Tooltip>

            {/* ─── Chat Drawer ─── */}
            <Drawer
                anchor="right"
                open={open}
                onClose={() => setOpen(false)}
                className="ai-copilot-drawer"
            >
                {/* Header */}
                <div className="ai-copilot-header">
                    <div className="ai-copilot-header-title">
                        <AutoAwesomeIcon />
                        <Box>
                            <Typography variant="subtitle1" fontWeight={600} color="#fff">
                                TestOps Copilot
                            </Typography>
                            <Typography variant="caption" color="rgba(255,255,255,0.4)">
                                AI-powered assistant
                            </Typography>
                        </Box>
                    </div>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Tooltip title="Clear chat">
                            <IconButton
                                size="small"
                                onClick={clearMessages}
                                sx={{ color: 'rgba(255,255,255,0.3)', '&:hover': { color: 'rgba(255,255,255,0.7)' } }}
                            >
                                <DeleteOutlineIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                        </Tooltip>
                        <IconButton
                            size="small"
                            onClick={() => setOpen(false)}
                            sx={{ color: 'rgba(255,255,255,0.3)', '&:hover': { color: 'rgba(255,255,255,0.7)' } }}
                        >
                            <CloseIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                    </Box>
                </div>

                {/* Messages */}
                <div className="ai-copilot-messages">
                    {messages.length === 0 ? (
                        <div className="ai-copilot-welcome">
                            <AutoAwesomeIcon />
                            <Typography variant="h6" fontWeight={600} color="rgba(255,255,255,0.7)">
                                Hi! I'm your TestOps Copilot
                            </Typography>
                            <Typography variant="body2" color="rgba(255,255,255,0.35)">
                                I can search Jira, check pipelines, find documentation, and analyze test failures.
                            </Typography>
                            <div className="ai-copilot-suggestions">
                                {SUGGESTED_PROMPTS.map((prompt, i) => (
                                    <button
                                        key={i}
                                        className="ai-copilot-suggestion"
                                        onClick={() => handleSuggestion(prompt)}
                                    >
                                        {prompt}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        messages.map(renderMessage)
                    )}

                    {/* Streaming indicator */}
                    {isStreaming && messages[messages.length - 1]?.role !== 'thinking' && (
                        <div className="ai-msg ai-msg-thinking">
                            <div className="ai-typing-dots">
                                <span /><span /><span />
                            </div>
                            Processing...
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="ai-copilot-input">
                    <div className="ai-copilot-input-row">
                        <input
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={isStreaming ? 'Waiting for response...' : 'Ask anything about your tests...'}
                            disabled={isStreaming}
                        />
                        <IconButton
                            size="small"
                            onClick={handleSend}
                            disabled={!input.trim() || isStreaming}
                            sx={{
                                color: input.trim() ? '#7c4dff' : 'rgba(255,255,255,0.15)',
                                transition: 'all 0.2s ease',
                                '&:hover': { color: '#b388ff' },
                            }}
                        >
                            <SendIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                    </div>
                    <Typography
                        variant="caption"
                        color="rgba(255,255,255,0.2)"
                        sx={{ display: 'block', textAlign: 'center', mt: 0.5, fontSize: 10 }}
                    >
                        AI responses may be inaccurate. Always verify critical data.
                    </Typography>
                </div>
            </Drawer>
        </>
    );
}

/**
 * Minimal markdown-to-HTML converter for AI responses.
 * Handles: **bold**, `code`, ```blocks```, [links](url), \n → <br>
 */
function formatMarkdown(text: string): string {
    return text
        // Code blocks
        .replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
        // Inline code
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        // Bold
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        // Italic
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        // Links
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" style="color:#b388ff">$1</a>')
        // Line breaks
        .replace(/\n/g, '<br/>');
}
