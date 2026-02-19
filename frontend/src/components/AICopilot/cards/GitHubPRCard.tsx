/**
 * GitHubPRCard — Pull request status display.
 * For: github_get_pr result
 */

import { Box, Paper, Typography, Button } from '@mui/material';
import { OpenInNew as ExternalIcon } from '@mui/icons-material';
import ServiceBadge, { getServiceAccent } from './shared/ServiceBadge';
import StatusChip from './shared/StatusChip';

interface GitHubPRData {
    number: number;
    title: string;
    author: string;
    url: string;
    body?: string;
    state?: string;
}

interface GitHubPRCardProps {
    data: Record<string, unknown>;
}

export default function GitHubPRCard({ data }: GitHubPRCardProps) {
    const pr = data as unknown as GitHubPRData;

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

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                    <Typography variant="body2" fontWeight={600}>
                        #{pr.number} {pr.title}
                    </Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <StatusChip status={pr.state || 'open'} />
                    <Typography variant="caption" color="text.secondary">
                        by @{pr.author}
                    </Typography>
                </Box>

                {pr.url && (
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 0.5 }}>
                        <Button
                            size="small"
                            variant="text"
                            endIcon={<ExternalIcon sx={{ fontSize: 12 }} />}
                            href={pr.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{ fontSize: '0.7rem', textTransform: 'none' }}
                        >
                            Review
                        </Button>
                    </Box>
                )}
            </Box>
        </Paper>
    );
}
