/**
 * EmptyState — Quick action cards + branding for empty chat.
 */

import { Box, Paper, Typography } from '@mui/material';

interface EmptyStateProps {
    onSend: (message: string) => void;
}

const QUICK_ACTIONS = [
    { label: 'Analyze last failure', prompt: 'Analyze the most recent test failure and suggest a fix' },
    { label: 'Show test trends', prompt: 'Show me failure trends for the past 30 days' },
    { label: 'Check pipelines', prompt: 'What is the current status of all pipelines?' },
    { label: 'Find related issues', prompt: 'Search Jira for open issues related to recent failures' },
];

export default function EmptyState({ onSend }: EmptyStateProps) {
    return (
        <Box sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            p: 3,
        }}>
            {/* Diamond icon */}
            <Box sx={{
                width: 48,
                height: 48,
                mb: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                animation: 'diamondPulse 3s ease-in-out infinite',
                '@keyframes diamondPulse': {
                    '0%, 100%': { opacity: 0.6, transform: 'rotate(45deg) scale(1)' },
                    '50%': { opacity: 1, transform: 'rotate(45deg) scale(1.05)' },
                },
            }}>
                <Box sx={{
                    width: 28,
                    height: 28,
                    bgcolor: 'primary.main',
                    borderRadius: 1,
                    transform: 'rotate(45deg)',
                    opacity: 0.3,
                }} />
            </Box>

            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5 }}>
                TestOps Copilot
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 3 }}>
                Ask about failures, pipelines, or issues
            </Typography>

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, width: '100%', maxWidth: 280 }}>
                {QUICK_ACTIONS.map((action) => (
                    <Paper
                        key={action.label}
                        variant="outlined"
                        sx={{
                            p: 1.5,
                            cursor: 'pointer',
                            textAlign: 'center',
                            borderRadius: 2,
                            transition: 'all 0.15s ease',
                            '&:hover': {
                                borderColor: 'primary.main',
                                bgcolor: 'action.hover',
                            },
                        }}
                        onClick={() => onSend(action.prompt)}
                    >
                        <Typography variant="caption" fontWeight={500}>
                            {action.label}
                        </Typography>
                    </Paper>
                ))}
            </Box>
        </Box>
    );
}
