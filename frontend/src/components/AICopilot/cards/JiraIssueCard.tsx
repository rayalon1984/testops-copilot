/**
 * JiraIssueCard — Single Jira issue display with in-card actions.
 * For: jira_get result
 */

import { useState } from 'react';
import { Box, Paper, Typography, Chip, Button, TextField } from '@mui/material';
import { OpenInNew as ExternalIcon } from '@mui/icons-material';
import ServiceBadge, { getServiceAccent } from './shared/ServiceBadge';
import StatusChip from './shared/StatusChip';
import CardActions from './shared/CardActions';
import type { CardState } from '../../../hooks/useAICopilot';

interface JiraIssueData {
    key: string;
    summary: string;
    status: string;
    type: string;
    labels?: string[];
    assignee?: string;
    description?: string;
}

interface JiraIssueCardProps {
    data: Record<string, unknown>;
    userRole: string;
    onAction?: (prompt: string) => void;
    cardState?: CardState;
}

export default function JiraIssueCard({ data, userRole, onAction, cardState }: JiraIssueCardProps) {
    const issue = data as unknown as JiraIssueData;
    const [showComment, setShowComment] = useState(false);
    const [commentText, setCommentText] = useState('');

    const handleTransition = () => {
        onAction?.(`Transition ${issue.key} to Done`);
    };

    const handleComment = () => {
        if (commentText.trim()) {
            onAction?.(`Add comment to ${issue.key}: ${commentText}`);
            setCommentText('');
            setShowComment(false);
        }
    };

    const isPending = cardState === 'action_pending';

    return (
        <Paper sx={{
            mb: 2,
            borderRadius: 2,
            overflow: 'hidden',
            border: 1,
            borderColor: 'divider',
            borderLeft: 3,
            borderLeftColor: getServiceAccent('jira'),
            transition: 'all 0.3s ease',
        }}>
            <Box sx={{ p: 1.5 }}>
                <ServiceBadge service="jira" />

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Box>
                        <Typography variant="caption" fontWeight={700} color="text.secondary">
                            {issue.key}
                        </Typography>
                        <Typography variant="body2" fontWeight={600} sx={{ mt: 0.25 }}>
                            {issue.summary}
                        </Typography>
                    </Box>
                    <StatusChip status={issue.status} animated={cardState === 'updated'} />
                </Box>

                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 0.75 }}>
                    {issue.type && <Chip label={issue.type} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />}
                    {issue.labels?.map(label => (
                        <Chip key={label} label={label} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
                    ))}
                </Box>

                {issue.assignee && (
                    <Typography variant="caption" color="text.secondary">
                        Assignee: {issue.assignee}
                    </Typography>
                )}

                {/* Inline comment form */}
                {showComment && (
                    <Box sx={{ mt: 1 }}>
                        <TextField
                            fullWidth
                            multiline
                            rows={2}
                            size="small"
                            placeholder="Add comment..."
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            sx={{ mb: 0.5 }}
                        />
                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                            <Button size="small" onClick={() => setShowComment(false)}>Cancel</Button>
                            <Button size="small" variant="contained" onClick={handleComment} disabled={!commentText.trim()}>Send</Button>
                        </Box>
                    </Box>
                )}

                <CardActions userRole={userRole}>
                    <Button
                        size="small"
                        variant="outlined"
                        onClick={handleTransition}
                        disabled={isPending || issue.status === 'Done' || issue.status === 'DONE'}
                        sx={{ fontSize: '0.7rem', textTransform: 'none' }}
                    >
                        {isPending ? '\u25CC Moving...' : '\u2192 Move to Done'}
                    </Button>
                    <Button
                        size="small"
                        variant="outlined"
                        onClick={() => setShowComment(!showComment)}
                        sx={{ fontSize: '0.7rem', textTransform: 'none' }}
                    >
                        \uD83D\uDCAC Comment
                    </Button>
                    <Button
                        size="small"
                        variant="text"
                        endIcon={<ExternalIcon sx={{ fontSize: 12 }} />}
                        sx={{ fontSize: '0.7rem', textTransform: 'none', ml: 'auto' }}
                    >
                        Open
                    </Button>
                </CardActions>
            </Box>
        </Paper>
    );
}
