/**
 * JiraTransitionPreview — Confirmation preview for jira_transition_issue.
 */

import { Box, Typography } from '@mui/material';
import StatusChip from './shared/StatusChip';

interface JiraTransitionPreviewProps {
    args: Record<string, unknown>;
}

export default function JiraTransitionPreview({ args }: JiraTransitionPreviewProps) {
    const issueKey = args.issueKey as string;
    const targetStatus = args.status as string;

    return (
        <Box>
            <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
                {issueKey}
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, justifyContent: 'center', py: 1 }}>
                <StatusChip status="In Progress" />
                <Typography variant="body2" color="text.secondary">&rarr;</Typography>
                <StatusChip status={targetStatus === 'DONE' ? 'Done' : targetStatus === 'TODO' ? 'To Do' : targetStatus} />
            </Box>
        </Box>
    );
}
