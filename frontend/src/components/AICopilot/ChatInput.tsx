/**
 * ChatInput — Multi-line textarea with auto-grow and keyboard hints.
 *
 * Enter sends, Shift+Enter adds newline.
 */

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Box, Paper, IconButton, Typography, useTheme } from '@mui/material';
import { Send as SendIcon } from '@mui/icons-material';

interface ChatInputProps {
    onSend: (message: string) => void;
    disabled?: boolean;
}

const MAX_ROWS = 5;
const LINE_HEIGHT = 20;

export default function ChatInput({ onSend, disabled }: ChatInputProps) {
    const [value, setValue] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const theme = useTheme();

    // Auto-grow textarea
    useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, MAX_ROWS * LINE_HEIGHT) + 'px';
    }, [value]);

    const handleSend = () => {
        if (!value.trim() || disabled) return;
        onSend(value);
        setValue('');
        // Reset height
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', bgcolor: 'background.default' }}>
            <Paper
                elevation={0}
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    bgcolor: 'background.paper',
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 3,
                    '&:focus-within': {
                        borderColor: 'primary.main',
                        boxShadow: `0 0 0 1px ${theme.palette.primary.main}`,
                    },
                }}
            >
                <Box
                    component="textarea"
                    ref={textareaRef}
                    value={value}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={disabled}
                    placeholder="Let's TOC... ask about a failing test"
                    rows={1}
                    sx={{
                        flex: 1,
                        border: 'none',
                        outline: 'none',
                        resize: 'none',
                        bgcolor: 'transparent',
                        color: 'text.primary',
                        fontFamily: 'inherit',
                        fontSize: '0.95rem',
                        lineHeight: `${LINE_HEIGHT}px`,
                        py: 1.25,
                        px: 2,
                        minHeight: LINE_HEIGHT + 12,
                        maxHeight: MAX_ROWS * LINE_HEIGHT,
                        overflow: 'auto',
                        '&::placeholder': { color: 'text.disabled' },
                        '&:disabled': { opacity: 0.5 },
                    }}
                />
                <IconButton
                    color="primary"
                    sx={{ p: '10px', mr: 0.5 }}
                    onClick={handleSend}
                    disabled={!value.trim() || disabled}
                >
                    <SendIcon />
                </IconButton>
            </Paper>
            <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5, display: 'block', textAlign: 'center', fontSize: '0.6rem' }}>
                Enter to send &middot; Shift+Enter for newline
            </Typography>
        </Box>
    );
}
