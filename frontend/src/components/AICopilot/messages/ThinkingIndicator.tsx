/**
 * ThinkingIndicator — Animated "Analyzing..." with dot pulse.
 */

import { Box, Typography } from '@mui/material';

interface ThinkingIndicatorProps {
    text?: string;
}

export default function ThinkingIndicator({ text = 'TOCing' }: ThinkingIndicatorProps) {
    return (
        <Box sx={{ alignSelf: 'flex-start', mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                {[0, 1, 2].map(i => (
                    <Box
                        key={i}
                        sx={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            bgcolor: 'primary.main',
                            opacity: 0.4,
                            animation: 'dotPulse 1.4s ease-in-out infinite',
                            animationDelay: `${i * 0.2}s`,
                            '@keyframes dotPulse': {
                                '0%, 80%, 100%': { opacity: 0.4, transform: 'scale(1)' },
                                '40%': { opacity: 1, transform: 'scale(1.2)' },
                            },
                        }}
                    />
                ))}
            </Box>
            <Typography variant="caption" color="text.secondary">
                {text}
            </Typography>
        </Box>
    );
}
