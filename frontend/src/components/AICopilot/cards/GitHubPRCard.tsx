/**
 * GitHubPRCard — Enhanced pull request card with inline diff viewer.
 *
 * Shows PR metadata, file change summary, collapsible inline diff,
 * and dual action buttons: [Approve & Merge] / [Review Diff].
 *
 * For: github_get_pr result (Sprint 6 — Autonomous AI)
 */

import { useState } from 'react';
import { Box, Paper, Typography, Button, Chip } from '@mui/material';
import {
    OpenInNew as ExternalIcon,
    MergeType as MergeIcon,
    Code as DiffIcon,
    InsertDriveFileOutlined as FileIcon,
} from '@mui/icons-material';
import ServiceBadge, { getServiceAccent } from './shared/ServiceBadge';
import StatusChip from './shared/StatusChip';
import InlineDiffViewer from './shared/InlineDiffViewer';
import type { CardState } from '../../../hooks/useAICopilot';

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
    // Diff data (Sprint 6.4)
    filesChanged?: number;
    totalAdditions?: number;
    totalDeletions?: number;
    files?: DiffFile[];
    // Merge context
    mergeable?: boolean;
    owner?: string;
    repo?: string;
}

interface GitHubPRCardProps {
    data: Record<string, unknown>;
    onAction?: (prompt: string) => void;
    cardState?: CardState;
}

const ADDITION_COLOR = '#3fb950';
const DELETION_COLOR = '#f85149';

export default function GitHubPRCard({ data, onAction, cardState }: GitHubPRCardProps) {
    const pr = data as unknown as GitHubPRData;
    const [showDiff, setShowDiff] = useState(false);
    const hasFiles = pr.files && pr.files.length > 0;
    const isPending = cardState === 'action_pending';

    const handleMerge = () => {
        if (!onAction) return;
        onAction(
            `Please merge PR #${pr.number} in ${pr.owner}/${pr.repo}. ` +
            `The user has reviewed and approved the changes.`
        );
    };

    return (
        <Paper sx={{
            mb: 2,
            borderRadius: 2,
            overflow: 'hidden',
            border: 1,
            borderColor: 'divider',
            borderLeft: 3,
            borderLeftColor: getServiceAccent('github'),
        }}>
            <Box sx={{ p: 1.5 }}>
                <ServiceBadge service="github" subtitle="Pull Request" />

                {/* PR title + number */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                    <Typography variant="body2" fontWeight={600} sx={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                        #{pr.number} {pr.title}
                    </Typography>
                </Box>

                {/* Status + author */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <StatusChip status={pr.state || 'open'} />
                    <Typography variant="caption" color="text.secondary">
                        by @{pr.author}
                    </Typography>
                </Box>

                {/* File change summary */}
                {hasFiles && (
                    <Box sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        mt: 0.5,
                        mb: 0.5,
                        flexWrap: 'wrap',
                    }}>
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

                {/* Inline diff (collapsible) */}
                {hasFiles && showDiff && (
                    <InlineDiffViewer files={pr.files!} maxVisibleLines={25} />
                )}

                {/* Action buttons */}
                <Box sx={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                    gap: 1,
                    mt: 1,
                }}>
                    {/* Review Diff toggle */}
                    {hasFiles && (
                        <Button
                            size="small"
                            variant="outlined"
                            startIcon={<DiffIcon sx={{ fontSize: 14 }} />}
                            onClick={() => setShowDiff(prev => !prev)}
                            sx={{ fontSize: '0.65rem', textTransform: 'none' }}
                        >
                            {showDiff ? 'Hide Diff' : 'Review Diff'}
                        </Button>
                    )}

                    {/* Approve & Merge (only when onAction is wired and PR is mergeable) */}
                    {onAction && pr.mergeable && pr.owner && pr.repo && (
                        <Button
                            size="small"
                            variant="contained"
                            color="success"
                            startIcon={<MergeIcon sx={{ fontSize: 14 }} />}
                            onClick={handleMerge}
                            disabled={isPending}
                            sx={{ fontSize: '0.65rem', textTransform: 'none' }}
                        >
                            {isPending ? 'Merging...' : 'Approve & Merge'}
                        </Button>
                    )}

                    {/* External review link */}
                    {pr.url && (
                        <Button
                            size="small"
                            variant="text"
                            endIcon={<ExternalIcon sx={{ fontSize: 12 }} />}
                            href={pr.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{ fontSize: '0.65rem', textTransform: 'none' }}
                        >
                            GitHub
                        </Button>
                    )}
                </Box>
            </Box>
        </Paper>
    );
}
