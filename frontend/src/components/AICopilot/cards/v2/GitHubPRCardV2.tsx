/**
 * GitHubPRCardV2 — Redesigned PR card matching the README screenshot.
 *
 * Key differences from V1:
 * - Emoji + bold title header (no ServiceBadge, no left border)
 * - Inline diff shown by default (no toggle)
 * - Two prominent full-width buttons: Review Diff + Merge PR
 *
 * Feature-flagged: only renders when `copilot-cards-v2` is ON.
 * Reuses the existing InlineDiffViewer component.
 */

import { useState } from 'react';
import { Box, Paper, Typography, Button, Chip } from '@mui/material';
import {
    MergeType as MergeIcon,
    Code as DiffIcon,
    InsertDriveFileOutlined as FileIcon,
} from '@mui/icons-material';
import CardHeaderV2 from './CardHeaderV2';
import InlineDiffViewer from '../shared/InlineDiffViewer';
import { canAct } from '../shared/CardActions';
import type { CardState } from '../../../../hooks/useAICopilot';

interface DiffFile {
    filename: string;
    status: string;
    additions: number;
    deletions: number;
    patch?: string;
}

interface GitHubPRData {
    number: number;
    title: string;
    author: string;
    url: string;
    body?: string;
    state?: string;
    filesChanged?: number;
    totalAdditions?: number;
    totalDeletions?: number;
    files?: DiffFile[];
    mergeable?: boolean;
    owner?: string;
    repo?: string;
}

interface GitHubPRCardV2Props {
    data: Record<string, unknown>;
    userRole?: string;
    onAction?: (prompt: string) => void;
    cardState?: CardState;
}

const ADDITION_COLOR = '#3fb950';
const DELETION_COLOR = '#f85149';

export default function GitHubPRCardV2({ data, userRole, onAction, cardState }: GitHubPRCardV2Props) {
    const pr = data as unknown as GitHubPRData;
    const hasFiles = pr.files && pr.files.length > 0;
    const isPending = cardState === 'action_pending';

    // V2: diff shown by default (toggled open)
    const [showDiff, setShowDiff] = useState(true);

    const handleMerge = () => {
        if (!onAction) return;
        onAction(
            `Please merge PR #${pr.number} in ${pr.owner}/${pr.repo}. ` +
            `The user has reviewed and approved the changes.`
        );
    };

    return (
        <Paper
            elevation={1}
            sx={{
                borderRadius: 3,
                p: 2,
                /* Text-containment guards */
                overflow: 'hidden',
                overflowWrap: 'break-word',
                wordBreak: 'break-word',
                minWidth: 0,
            }}
        >
            {/* V2 header: wrench emoji + "Fix Proposed: PR #NNN" */}
            <CardHeaderV2
                emoji={'\uD83D\uDD27'}
                title={`Fix Proposed: PR #${pr.number}`}
            />

            {/* File change summary */}
            {hasFiles && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                    <Chip
                        icon={<FileIcon sx={{ fontSize: 14 }} />}
                        label={`${pr.filesChanged} file${pr.filesChanged !== 1 ? 's' : ''}`}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: '0.65rem', height: 22 }}
                    />
                    <Typography variant="caption" sx={{ color: ADDITION_COLOR, fontFamily: 'monospace', fontWeight: 600 }}>
                        +{pr.totalAdditions}
                    </Typography>
                    <Typography variant="caption" sx={{ color: DELETION_COLOR, fontFamily: 'monospace', fontWeight: 600 }}>
                        -{pr.totalDeletions}
                    </Typography>
                </Box>
            )}

            {/* Inline diff — shown by default in V2 */}
            {hasFiles && showDiff && (
                <InlineDiffViewer files={pr.files!} maxVisibleLines={25} />
            )}

            {/* Action buttons — full-width side by side */}
            <Box sx={{
                display: 'flex',
                gap: 1.5,
                mt: 1.5,
            }}>
                {/* Review Diff toggle */}
                {hasFiles && (
                    <Button
                        fullWidth
                        size="medium"
                        variant="outlined"
                        startIcon={<DiffIcon sx={{ fontSize: 16 }} />}
                        onClick={() => setShowDiff(prev => !prev)}
                        sx={{
                            textTransform: 'none',
                            fontWeight: 600,
                            borderRadius: 2,
                            py: 1,
                        }}
                    >
                        {showDiff ? 'Hide Diff' : 'Review Diff'}
                    </Button>
                )}

                {/* Merge PR — role-gated: hidden for VIEWER/BILLING */}
                {canAct(userRole || 'VIEWER') && onAction && pr.mergeable && pr.owner && pr.repo && (
                    <Button
                        fullWidth
                        size="medium"
                        variant="contained"
                        color="success"
                        startIcon={<MergeIcon sx={{ fontSize: 16 }} />}
                        onClick={handleMerge}
                        disabled={isPending}
                        sx={{
                            textTransform: 'none',
                            fontWeight: 600,
                            borderRadius: 2,
                            py: 1,
                        }}
                    >
                        {isPending ? 'Merging...' : 'Merge PR'}
                    </Button>
                )}
            </Box>
        </Paper>
    );
}
