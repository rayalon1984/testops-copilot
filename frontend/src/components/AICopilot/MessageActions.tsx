/**
 * MessageActions — Copy, share, thumbs up/down, timestamp for assistant messages.
 */

import { useState, useCallback, useRef } from 'react';
import {
    Box, IconButton, Tooltip, Typography,
    Popover, TextField, Button, Stack, CircularProgress,
} from '@mui/material';
import {
    ContentCopy as CopyIcon,
    ThumbUpOutlined as ThumbUpIcon,
    ThumbDownOutlined as ThumbDownIcon,
    Check as CheckIcon,
    ShareOutlined as ShareIcon,
    Link as LinkIcon,
    EmailOutlined as EmailIcon,
} from '@mui/icons-material';
import { api } from '../../api';

interface MessageActionsProps {
    content: string;
    timestamp: Date;
    persona?: string;
    sessionId?: string;
}

export default function MessageActions({ content, timestamp, persona, sessionId }: MessageActionsProps) {
    const [copied, setCopied] = useState(false);
    const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);

    // Share state
    const [shareAnchor, setShareAnchor] = useState<HTMLElement | null>(null);
    const [shareUrl, setShareUrl] = useState<string | null>(null);
    const [shareCopied, setShareCopied] = useState(false);
    const [shareLoading, setShareLoading] = useState(false);
    const [emailTo, setEmailTo] = useState('');
    const [emailSent, setEmailSent] = useState(false);
    const [emailSending, setEmailSending] = useState(false);
    const shareTokenRef = useRef<string | null>(null);

    const handleCopy = useCallback(() => {
        navigator.clipboard.writeText(content).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    }, [content]);

    // Create share link
    const handleShareClick = useCallback(async (event: React.MouseEvent<HTMLElement>) => {
        setShareAnchor(event.currentTarget);

        // Only create share once per message
        if (shareUrl) return;

        setShareLoading(true);
        try {
            const title = content.slice(0, 80).replace(/\n/g, ' ').trim() + (content.length > 80 ? '...' : '');
            const json = await api.post<{ data: { url: string; token: string } }>('/shares', { title, content, persona, sessionId });
            setShareUrl(json.data.url);
            shareTokenRef.current = json.data.token;
        } catch {
            // Share creation failed — popover will show without link
        } finally {
            setShareLoading(false);
        }
    }, [content, persona, sessionId, shareUrl]);

    const handleCopyLink = useCallback(() => {
        if (!shareUrl) return;
        navigator.clipboard.writeText(shareUrl).then(() => {
            setShareCopied(true);
            setTimeout(() => setShareCopied(false), 2000);
        });
    }, [shareUrl]);

    const handleEmailShare = useCallback(async () => {
        if (!shareTokenRef.current || !emailTo) return;
        setEmailSending(true);
        try {
            await api.post(`/shares/${shareTokenRef.current}/email`, { recipientEmail: emailTo });
            setEmailSent(true);
            setTimeout(() => setEmailSent(false), 3000);
            setEmailTo('');
        } catch {
            // Email send failed
        } finally {
            setEmailSending(false);
        }
    }, [emailTo]);

    const timeStr = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, mt: 0.5, opacity: 0.5, '&:hover': { opacity: 1 }, transition: 'opacity 0.15s' }}>
            <Tooltip title={copied ? 'Copied!' : 'Copy'}>
                <IconButton size="small" onClick={handleCopy} sx={{ width: 24, height: 24 }}>
                    {copied ? <CheckIcon sx={{ fontSize: 12 }} /> : <CopyIcon sx={{ fontSize: 12 }} />}
                </IconButton>
            </Tooltip>

            <Tooltip title="Share">
                <IconButton size="small" onClick={handleShareClick} sx={{ width: 24, height: 24 }}>
                    <ShareIcon sx={{ fontSize: 12 }} />
                </IconButton>
            </Tooltip>

            <Popover
                open={Boolean(shareAnchor)}
                anchorEl={shareAnchor}
                onClose={() => setShareAnchor(null)}
                anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
                transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                slotProps={{ paper: { sx: { p: 2, width: 300 } } }}
            >
                <Typography variant="subtitle2" gutterBottom>Share Analysis</Typography>

                {shareLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                        <CircularProgress size={20} />
                    </Box>
                ) : shareUrl ? (
                    <Stack spacing={1.5}>
                        <Button
                            size="small"
                            variant="outlined"
                            startIcon={shareCopied ? <CheckIcon /> : <LinkIcon />}
                            onClick={handleCopyLink}
                            fullWidth
                        >
                            {shareCopied ? 'Link Copied!' : 'Copy Link'}
                        </Button>

                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                            <TextField
                                size="small"
                                placeholder="email@example.com"
                                value={emailTo}
                                onChange={e => setEmailTo(e.target.value)}
                                fullWidth
                                inputProps={{ sx: { fontSize: '0.8rem', py: 0.5 } }}
                            />
                            <Button
                                size="small"
                                variant="contained"
                                onClick={handleEmailShare}
                                disabled={!emailTo || emailSending}
                                sx={{ minWidth: 36, px: 1 }}
                            >
                                {emailSent ? <CheckIcon fontSize="small" /> : <EmailIcon fontSize="small" />}
                            </Button>
                        </Box>

                        <Typography variant="caption" color="text.disabled">
                            Link expires in 7 days. No login required to view.
                        </Typography>
                    </Stack>
                ) : (
                    <Typography variant="body2" color="text.secondary">
                        Failed to create share link.
                    </Typography>
                )}
            </Popover>

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
