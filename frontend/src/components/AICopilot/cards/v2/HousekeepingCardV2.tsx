/**
 * HousekeepingCardV2 — Redesigned Jira Housekeeping card matching README screenshot.
 *
 * Key differences from V1:
 * - Emoji + bold title header with "IN PROGRESS" status chip (no ServiceBadge, no left border)
 * - Clean description text
 * - Retains Undo button via CardActions
 *
 * Feature-flagged: only renders when `copilot-cards-v2` is ON.
 */

import { Box, Paper, Typography, Button } from '@mui/material';
import { Undo as UndoIcon } from '@mui/icons-material';
import CardHeaderV2 from './CardHeaderV2';
import CardActions from '../shared/CardActions';
import type { CardState } from '../../../../hooks/useAICopilot';

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

interface HousekeepingCardV2Props {
    data: Record<string, unknown>;
    toolName: string;
    userRole?: string;
    onAction?: (prompt: string) => void;
    cardState?: CardState;
}

export default function HousekeepingCardV2({ data, toolName, userRole, onAction, cardState }: HousekeepingCardV2Props) {
    const isPending = cardState === 'action_pending';

    if (toolName === 'jira_link_issues') {
        const linkData = data as unknown as LinkData;
        const targetList = linkData.linked?.join(', ') || '';

        return (
            <Paper
                elevation={1}
                sx={{
                    borderRadius: 3,
                    p: 2,
                    overflow: 'hidden',
                    overflowWrap: 'break-word',
                    wordBreak: 'break-word',
                    minWidth: 0,
                }}
            >
                <CardHeaderV2
                    emoji={'\uD83D\uDD17'}
                    title="Jira Housekeeping"
                    chip={{ label: 'IN PROGRESS', status: 'In Progress' }}
                />

                <Typography variant="body2" color="text.primary" sx={{ mb: 1, lineHeight: 1.6 }}>
                    Linked related tickets to main issue <strong>{linkData.sourceKey}</strong>.
                </Typography>

                {linkData.linked && linkData.linked.length > 0 && (
                    <Box sx={{ mb: 1 }}>
                        {linkData.linked.map((targetKey) => (
                            <Typography key={targetKey} variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
                                {linkData.sourceKey} ↔ {targetKey} ({linkData.linkType})
                            </Typography>
                        ))}
                    </Box>
                )}

                <CardActions userRole={userRole || 'VIEWER'}>
                    <Button
                        size="small"
                        variant="outlined"
                        startIcon={<UndoIcon sx={{ fontSize: 14 }} />}
                        disabled={isPending}
                        onClick={() => onAction?.(`Undo link between ${linkData.sourceKey} and ${targetList}`)}
                        sx={{ textTransform: 'none', borderRadius: 2, ml: 'auto' }}
                    >
                        {isPending ? 'Undoing...' : 'Undo'}
                    </Button>
                </CardActions>
            </Paper>
        );
    }

    if (toolName === 'jira_add_label') {
        const labelData = data as unknown as LabelData;

        return (
            <Paper
                elevation={1}
                sx={{
                    borderRadius: 3,
                    p: 2,
                    overflow: 'hidden',
                    overflowWrap: 'break-word',
                    wordBreak: 'break-word',
                    minWidth: 0,
                }}
            >
                <CardHeaderV2
                    emoji={'\uD83C\uDFF7\uFE0F'}
                    title="Jira Housekeeping"
                    chip={{ label: 'IN PROGRESS', status: 'In Progress' }}
                />

                <Typography variant="body2" color="text.primary" sx={{ mb: 1, lineHeight: 1.6 }}>
                    Added label(s) to <strong>{labelData.issueKey}</strong>: {labelData.labels.join(', ')}
                </Typography>

                <CardActions userRole={userRole || 'VIEWER'}>
                    <Button
                        size="small"
                        variant="outlined"
                        startIcon={<UndoIcon sx={{ fontSize: 14 }} />}
                        disabled={isPending}
                        onClick={() => onAction?.(`Remove labels ${labelData.labels.join(', ')} from ${labelData.issueKey}`)}
                        sx={{ textTransform: 'none', borderRadius: 2, ml: 'auto' }}
                    >
                        {isPending ? 'Undoing...' : 'Undo'}
                    </Button>
                </CardActions>
            </Paper>
        );
    }

    // Fallback
    return (
        <Paper elevation={1} sx={{ p: 2, borderRadius: 3 }}>
            <CardHeaderV2 emoji={'\u26A1'} title="Jira Housekeeping" />
            <Typography variant="caption" color="text.secondary">
                Action completed automatically.
            </Typography>
        </Paper>
    );
}
