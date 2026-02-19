/**
 * MessageActions — Copy, thumbs up/down, timestamp for assistant messages.
 */

import { useState, useCallback } from 'react';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import {
    ContentCopy as CopyIcon,
    ThumbUpOutlined as ThumbUpIcon,
    ThumbDownOutlined as ThumbDownIcon,
    Check as CheckIcon,
} from '@mui/icons-material';

interface MessageActionsProps {
    content: string;
    timestamp: Date;
}

export default function MessageActions({ content, timestamp }: MessageActionsProps) {
    const [copied, setCopied] = useState(false);
    const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);

    const handleCopy = useCallback(() => {
        navigator.clipboard.writeText(content).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    }, [content]);

    const timeStr = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, mt: 0.5, opacity: 0.5, '&:hover': { opacity: 1 }, transition: 'opacity 0.15s' }}>
            <Tooltip title={copied ? 'Copied!' : 'Copy'}>
                <IconButton size="small" onClick={handleCopy} sx={{ width: 24, height: 24 }}>
                    {copied ? <CheckIcon sx={{ fontSize: 12 }} /> : <CopyIcon sx={{ fontSize: 12 }} />}
                </IconButton>
            </Tooltip>

            <Tooltip title="Helpful">
                <IconButton
                    size="small"
                    onClick={() => setFeedback('up')}
                    sx={{ width: 24, height: 24, color: feedback === 'up' ? 'primary.main' : undefined }}
                >
                    <ThumbUpIcon sx={{ fontSize: 12 }} />
                </IconButton>
            </Tooltip>

            <Tooltip title="Not helpful">
                <IconButton
                    size="small"
                    onClick={() => setFeedback('down')}
                    sx={{ width: 24, height: 24, color: feedback === 'down' ? 'error.main' : undefined }}
                >
                    <ThumbDownIcon sx={{ fontSize: 12 }} />
                </IconButton>
            </Tooltip>

            <Typography variant="caption" color="text.disabled" sx={{ ml: 'auto', fontSize: '0.6rem' }}>
                {timeStr}
            </Typography>
        </Box>
    );
}
