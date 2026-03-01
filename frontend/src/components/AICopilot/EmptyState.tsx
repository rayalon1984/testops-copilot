/**
 * EmptyState — Smart starter prompt cards + branding for empty chat.
 *
 * v2: Dynamic prompts fetched from API (role-based + context-aware).
 *     Shows skeleton during load, pin indicators, and settings access.
 */

import { useState } from 'react';
import { Box, Paper, Typography, Skeleton, Chip, IconButton, Tooltip } from '@mui/material';
import PushPinIcon from '@mui/icons-material/PushPin';
import TuneIcon from '@mui/icons-material/Tune';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import ShieldIcon from '@mui/icons-material/Shield';
import ErrorIcon from '@mui/icons-material/Error';
import { useStarterPrompts, type StarterPrompt } from '../../hooks/api/useStarterPrompts';
import StarterPromptSettings from './StarterPromptSettings';

// ─── Fallback prompts (shown while loading or on error) ────────

const FALLBACK_PROMPTS: StarterPrompt[] = [
    { id: 'gen-analyze-failure', label: 'Analyze last failure', prompt: 'Analyze the most recent test failure and suggest a fix', pinned: false, source: 'role' },
    { id: 'gen-test-trends', label: 'Show test trends', prompt: 'Show me failure trends for the past 30 days', pinned: false, source: 'role' },
    { id: 'gen-pipelines', label: 'Check pipelines', prompt: 'What is the current status of all pipelines?', pinned: false, source: 'role' },
    { id: 'gen-related-issues', label: 'Find related issues', prompt: 'Search Jira for open issues related to recent failures', pinned: false, source: 'role' },
];

// ─── Source indicator icons ────────────────────────────────────

const SOURCE_ICONS: Record<string, React.ReactNode> = {
    context: <NotificationsActiveIcon sx={{ fontSize: 12 }} />,
};

const CONTEXT_ICON_MAP: Record<string, React.ReactNode> = {
    'ctx-recent-failures': <NotificationsActiveIcon sx={{ fontSize: 12, color: 'error.main' }} />,
    'ctx-quarantine-review': <ShieldIcon sx={{ fontSize: 12, color: 'warning.main' }} />,
    'ctx-pipeline-failed': <ErrorIcon sx={{ fontSize: 12, color: 'error.main' }} />,
};

// ─── Component ─────────────────────────────────────────────────

interface EmptyStateProps {
    onSend: (message: string) => void;
}

export default function EmptyState({ onSend }: EmptyStateProps) {
    const { data: prompts, isLoading, isError } = useStarterPrompts();
    const [settingsOpen, setSettingsOpen] = useState(false);

    const displayPrompts = prompts ?? (isError ? FALLBACK_PROMPTS : []);

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
                Let&apos;s TOC
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 3 }}>
                Your TestOps Copilot &mdash; ask about failures, pipelines, or issues
            </Typography>

            {/* Prompt cards grid */}
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, width: '100%', maxWidth: 280 }}>
                {isLoading ? (
                    // Skeleton loading state
                    Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton
                            key={i}
                            variant="rounded"
                            height={48}
                            sx={{ borderRadius: 2 }}
                        />
                    ))
                ) : (
                    displayPrompts.map((action) => (
                        <Paper
                            key={action.id}
                            variant="outlined"
                            sx={{
                                p: 1.5,
                                cursor: 'pointer',
                                textAlign: 'center',
                                borderRadius: 2,
                                position: 'relative',
                                transition: 'all 0.15s ease',
                                // Context signals get a subtle colored left border
                                ...(action.source === 'context' ? {
                                    borderLeftWidth: 3,
                                    borderLeftColor: 'warning.main',
                                } : {}),
                                '&:hover': {
                                    borderColor: 'primary.main',
                                    bgcolor: 'action.hover',
                                },
                            }}
                            onClick={() => onSend(action.prompt)}
                        >
                            {/* Pin / context indicator */}
                            {(action.pinned || action.source === 'context') && (
                                <Box sx={{
                                    position: 'absolute',
                                    top: 2,
                                    right: 3,
                                    display: 'flex',
                                    alignItems: 'center',
                                }}>
                                    {action.pinned && (
                                        <PushPinIcon sx={{ fontSize: 10, color: 'text.disabled', transform: 'rotate(45deg)' }} />
                                    )}
                                    {action.source === 'context' && (
                                        CONTEXT_ICON_MAP[action.id] ?? SOURCE_ICONS.context
                                    )}
                                </Box>
                            )}

                            <Typography variant="caption" fontWeight={500}>
                                {action.label}
                            </Typography>

                            {/* Context badge */}
                            {action.source === 'context' && (
                                <Chip
                                    label="Live"
                                    size="small"
                                    color="warning"
                                    variant="outlined"
                                    sx={{ mt: 0.5, height: 16, fontSize: '0.6rem', '& .MuiChip-label': { px: 0.5 } }}
                                />
                            )}
                        </Paper>
                    ))
                )}
            </Box>

            {/* Customize button */}
            {!isLoading && (
                <Tooltip title="Customize prompts">
                    <IconButton
                        size="small"
                        sx={{ mt: 1.5, color: 'text.disabled', '&:hover': { color: 'primary.main' } }}
                        onClick={() => setSettingsOpen(true)}
                    >
                        <TuneIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                </Tooltip>
            )}

            {/* Settings dialog */}
            <StarterPromptSettings
                open={settingsOpen}
                onClose={() => setSettingsOpen(false)}
            />
        </Box>
    );
}
