/**
 * HousekeepingCard — Autonomous Jira Housekeeping Summary.
 *
 * Displays a summary of Tier 1 actions the AI took autonomously
 * during investigation (linking issues, adding labels, etc.).
 * Includes an "Undo All" button for reversal.
 *
 * For: jira_link_issues and jira_add_label tool results (Sprint 7)
 */

import { Box, Paper, Typography, Button, Chip } from '@mui/material';
import { Undo as UndoIcon } from '@mui/icons-material';
import ServiceBadge, { getServiceAccent } from './shared/ServiceBadge';
import CardActions from './shared/CardActions';
import type { CardState } from '../../../hooks/useAICopilot';

interface LinkData {
    sourceKey: string;
    linked: string[];
    linkType: string;
    errors?: string[];
}

interface LabelData {
    issueKey: string;
    labels: string[];
}

interface HousekeepingCardProps {
    data: Record<string, unknown>;
    toolName: string;
    userRole?: string;
    onAction?: (prompt: string) => void;
    cardState?: CardState;
}

const housekeepingPaperSx = {
    mb: 2, borderRadius: 2, overflow: 'hidden',
    border: 1, borderColor: 'divider', borderLeft: 3, borderLeftColor: getServiceAccent('jira'),
} as const;

const autoChipSx = { fontSize: '0.5rem', height: 16, bgcolor: '#e8f5e9', color: '#2e7d32', fontWeight: 600 } as const;

export default function HousekeepingCard({ data, toolName, userRole, onAction, cardState }: HousekeepingCardProps) {
    const isPending = cardState === 'action_pending';

    // Render link-issues variant
    if (toolName === 'jira_link_issues') {
        const linkData = data as unknown as LinkData;
        return (
            <Paper sx={housekeepingPaperSx}>
                <Box sx={{ p: 1.5 }}>
                    {/* Header */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
                        <Typography sx={{ fontSize: '1rem', lineHeight: 1 }} aria-hidden="true">
                            {'\uD83D\uDD17'}
                        </Typography>
                        <Typography variant="caption" fontWeight={600} sx={{ color: getServiceAccent('jira') }}>
                            Jira Housekeeping
                        </Typography>
                        <Chip label="Auto" size="small" sx={autoChipSx} />
                    </Box>

                    {/* Linked issues */}
                    {linkData.linked && linkData.linked.length > 0 && (
                        <Box sx={{ mb: 0.75 }}>
                            {linkData.linked.map((targetKey) => (
                                <Typography key={targetKey} variant="caption" sx={{ display: 'block', fontSize: '0.75rem', mb: 0.25 }}>
                                    {'\uD83D\uDD17'} Linked <strong>{linkData.sourceKey}</strong> {'\u2194'} <strong>{targetKey}</strong>
                                    <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5, fontSize: '0.65rem' }}>
                                        ({linkData.linkType})
                                    </Typography>
                                </Typography>
                            ))}
                        </Box>
                    )}

                    {/* Errors (partial failures) */}
                    {linkData.errors && linkData.errors.length > 0 && (
                        <Typography variant="caption" color="error" sx={{ display: 'block', fontSize: '0.65rem', mb: 0.5 }}>
                            {linkData.errors.length} link(s) failed
                        </Typography>
                    )}

                    <CardActions userRole={userRole || 'VIEWER'}>
                        <Button
                            size="small"
                            variant="outlined"
                            startIcon={<UndoIcon sx={{ fontSize: 12 }} />}
                            disabled={isPending}
                            onClick={() => onAction?.(`Undo link between ${linkData.sourceKey} and ${linkData.linked.join(', ')}`)}
                            sx={{ fontSize: '0.65rem', textTransform: 'none', ml: 'auto' }}
                        >
                            {isPending ? 'Undoing...' : 'Undo'}
                        </Button>
                    </CardActions>
                </Box>
            </Paper>
        );
    }

    // Render add-label variant
    if (toolName === 'jira_add_label') {
        const labelData = data as unknown as LabelData;
        return (
            <Paper sx={housekeepingPaperSx}>
                <Box sx={{ p: 1.5 }}>
                    {/* Header */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
                        <Typography sx={{ fontSize: '1rem', lineHeight: 1 }} aria-hidden="true">
                            {'\uD83C\uDFF7\uFE0F'}
                        </Typography>
                        <Typography variant="caption" fontWeight={600} sx={{ color: getServiceAccent('jira') }}>
                            Jira Housekeeping
                        </Typography>
                        <Chip label="Auto" size="small" sx={autoChipSx} />
                    </Box>

                    {/* Label actions */}
                    <Typography variant="caption" sx={{ display: 'block', fontSize: '0.75rem', mb: 0.5 }}>
                        Added label(s) to <strong>{labelData.issueKey}</strong>:
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 0.75 }}>
                        {labelData.labels.map((label) => (
                            <Chip
                                key={label}
                                label={label}
                                size="small"
                                sx={{ fontSize: '0.6rem', height: 20 }}
                            />
                        ))}
                    </Box>

                    <CardActions userRole={userRole || 'VIEWER'}>
                        <Button
                            size="small"
                            variant="outlined"
                            startIcon={<UndoIcon sx={{ fontSize: 12 }} />}
                            disabled={isPending}
                            onClick={() => onAction?.(`Remove labels ${labelData.labels.join(', ')} from ${labelData.issueKey}`)}
                            sx={{ fontSize: '0.65rem', textTransform: 'none', ml: 'auto' }}
                        >
                            {isPending ? 'Undoing...' : 'Undo'}
                        </Button>
                    </CardActions>
                </Box>
            </Paper>
        );
    }

    // Fallback for unknown housekeeping tool
    return (
        <Paper sx={{ mb: 2, p: 1.5, borderRadius: 2, border: 1, borderColor: 'divider' }}>
            <ServiceBadge service="jira" subtitle="Housekeeping" />
            <Typography variant="caption" color="text.secondary">
                Action completed automatically.
            </Typography>
        </Paper>
    );
}
