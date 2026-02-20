/**
 * GiphyEmbedCard — Inline GIF display for AI personality layer.
 *
 * Renders a contextual GIF inline in the chat. Max 200px wide.
 * Includes Giphy attribution (required by TOS).
 * Click to dismiss/collapse.
 *
 * For: giphy_search tool result (Sprint 7)
 */

import { useState } from 'react';
import { Box, Paper, Typography, IconButton } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

interface GiphyGif {
    id: string;
    title: string;
    url: string;
    thumbnailUrl: string;
    width: number;
    height: number;
    giphyUrl: string;
}

interface GiphyData {
    gifs: GiphyGif[];
    selected: GiphyGif | null;
    query: string;
    attribution: string;
    fallbackEmoji?: string;
    disabled?: boolean;
    noApiKey?: boolean;
}

interface GiphyEmbedCardProps {
    data: Record<string, unknown>;
}

export default function GiphyEmbedCard({ data }: GiphyEmbedCardProps) {
    const giphyData = data as unknown as GiphyData;
    const [dismissed, setDismissed] = useState(false);

    // If dismissed, show nothing
    if (dismissed) return null;

    // Fallback: no GIF available, show emoji
    if (!giphyData.selected || giphyData.disabled || giphyData.noApiKey) {
        if (!giphyData.fallbackEmoji) return null;
        return (
            <Box sx={{ display: 'inline-block', fontSize: '1.5rem', mb: 1 }} role="img" aria-label="status emoji">
                {giphyData.fallbackEmoji}
            </Box>
        );
    }

    const gif = giphyData.selected;
    const aspectRatio = gif.width / gif.height;
    const displayWidth = Math.min(200, gif.width);
    const displayHeight = displayWidth / aspectRatio;

    return (
        <Paper
            sx={{
                mb: 1.5,
                borderRadius: 2,
                overflow: 'hidden',
                display: 'inline-block',
                maxWidth: 220,
                border: 1,
                borderColor: 'divider',
            }}
        >
            <Box sx={{ position: 'relative' }}>
                {/* Dismiss button */}
                <IconButton
                    size="small"
                    onClick={() => setDismissed(true)}
                    aria-label="Dismiss GIF"
                    sx={{
                        position: 'absolute',
                        top: 2,
                        right: 2,
                        bgcolor: 'rgba(0,0,0,0.5)',
                        color: 'white',
                        width: 20,
                        height: 20,
                        '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
                    }}
                >
                    <CloseIcon sx={{ fontSize: 12 }} />
                </IconButton>

                {/* GIF image */}
                <Box
                    component="img"
                    src={gif.url}
                    alt={gif.title}
                    loading="lazy"
                    sx={{
                        display: 'block',
                        width: displayWidth,
                        height: displayHeight,
                        objectFit: 'cover',
                    }}
                />
            </Box>

            {/* Attribution (required by Giphy TOS) */}
            <Box sx={{ px: 1, py: 0.25, bgcolor: 'action.hover' }}>
                <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.55rem' }}>
                    {giphyData.attribution}
                </Typography>
            </Box>
        </Paper>
    );
}
