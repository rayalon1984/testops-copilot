/**
 * GitHubCommitCard — Commit display with files changed.
 * For: github_get_commit result
 */

import { Box, Paper, Typography, Chip } from '@mui/material';
import ServiceBadge, { getServiceAccent } from './shared/ServiceBadge';

interface FileChange {
    filename: string;
    status: string;
    additions: number;
    deletions: number;
    patch?: string;
}

interface GitHubCommitData {
    message: string;
    filesChanged: number;
    files: FileChange[];
}

interface GitHubCommitCardProps {
    data: Record<string, unknown>;
}

export default function GitHubCommitCard({ data }: GitHubCommitCardProps) {
    const commit = data as unknown as GitHubCommitData;
    const totalAdditions = commit.files?.reduce((s, f) => s + (f.additions || 0), 0) ?? 0;
    const totalDeletions = commit.files?.reduce((s, f) => s + (f.deletions || 0), 0) ?? 0;

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
                <ServiceBadge service="github" />

                <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5, overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                    {commit.message}
                </Typography>

                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                        {commit.filesChanged} file{commit.filesChanged !== 1 ? 's' : ''} changed
                    </Typography>
                    {totalAdditions > 0 && (
                        <Chip label={`+${totalAdditions}`} size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: '#D1FAE5', color: '#065F46' }} />
                    )}
                    {totalDeletions > 0 && (
                        <Chip label={`-${totalDeletions}`} size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: '#FEE2E2', color: '#991B1B' }} />
                    )}
                </Box>

                {commit.files && commit.files.length > 0 && (
                    <Box sx={{ bgcolor: 'background.default', borderRadius: 1, overflow: 'hidden' }}>
                        {commit.files.map((file, idx) => (
                            <Box
                                key={idx}
                                sx={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    px: 1,
                                    py: 0.5,
                                    borderBottom: idx < commit.files.length - 1 ? 1 : 0,
                                    borderColor: 'divider',
                                    '&:hover': { bgcolor: 'action.hover' },
                                }}
                            >
                                <Typography variant="caption" fontFamily="monospace" noWrap sx={{ flex: 1 }}>
                                    {file.filename}
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 0.5, ml: 1 }}>
                                    {file.additions > 0 && (
                                        <Typography variant="caption" sx={{ color: '#065F46' }}>+{file.additions}</Typography>
                                    )}
                                    {file.deletions > 0 && (
                                        <Typography variant="caption" sx={{ color: '#991B1B' }}>-{file.deletions}</Typography>
                                    )}
                                </Box>
                            </Box>
                        ))}
                    </Box>
                )}
            </Box>
        </Paper>
    );
}
