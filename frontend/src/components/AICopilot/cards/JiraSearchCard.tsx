/**
 * JiraSearchCard — Stacked Jira search results with individually-expandable sub-cards.
 * For: jira_search result
 */

import { Box, Paper, Typography, Chip } from '@mui/material';
import ServiceBadge, { getServiceAccent } from './shared/ServiceBadge';
import StatusChip from './shared/StatusChip';

interface JiraSearchResult {
    key: string;
    summary: string;
    status: string;
    type: string;
    labels?: string[];
    assignee?: string;
}

interface JiraSearchCardProps {
    results: Record<string, unknown>[];
    userRole: string;
    onAction?: (prompt: string) => void;
}

export default function JiraSearchCard({ results, userRole, onAction }: JiraSearchCardProps) {
    const issues = (Array.isArray(results) ? results : []) as unknown as JiraSearchResult[];

    if (issues.length === 0) {
        return (
            <Paper sx={{ mb: 2, p: 1.5, borderRadius: 2, borderLeft: 3, borderLeftColor: getServiceAccent('jira') }}>
                <ServiceBadge service="jira" subtitle="Search" />
                <Typography variant="body2" color="text.secondary">No issues found.</Typography>
            </Paper>
        );
    }

    return (
        <Paper sx={{
            mb: 2,
            borderRadius: 2,
            overflow: 'hidden',
            border: 1,
            borderColor: 'divider',
            borderLeft: 3,
            borderLeftColor: getServiceAccent('jira'),
        }}>
            <Box sx={{ p: 1.5 }}>
                <ServiceBadge service="jira" subtitle={`Search: ${issues.length} result${issues.length !== 1 ? 's' : ''}`} />

                {issues.map((issue) => (
                    <Paper
                        key={issue.key}
                        variant="outlined"
                        sx={{ p: 1, mb: 0.75, borderRadius: 1, '&:last-child': { mb: 0 } }}
                    >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                    <Typography variant="caption" fontWeight={700} color="text.secondary">
                                        {issue.key}
                                    </Typography>
                                    <Typography variant="caption" noWrap sx={{ flex: 1 }}>
                                        {issue.summary}
                                    </Typography>
                                </Box>
                                <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
                                    {issue.type && (
                                        <Chip label={issue.type} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.6rem' }} />
                                    )}
                                    <Typography variant="caption" color="text.disabled">
                                        {issue.assignee || 'Unassigned'}
                                    </Typography>
                                </Box>
                            </Box>
                            <StatusChip status={issue.status} />
                        </Box>
                    </Paper>
                ))}
            </Box>
        </Paper>
    );
}
