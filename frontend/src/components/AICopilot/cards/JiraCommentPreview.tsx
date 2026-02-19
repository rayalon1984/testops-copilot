/**
 * JiraCommentPreview — Confirmation preview for jira_comment.
 */

import { Box, Typography } from '@mui/material';

interface JiraCommentPreviewProps {
    args: Record<string, unknown>;
}

export default function JiraCommentPreview({ args }: JiraCommentPreviewProps) {
    const issueKey = args.issueKey as string;
    const body = args.body as string;

    return (
        <Box>
            <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
                {issueKey}
            </Typography>

            <Box sx={{
                bgcolor: 'background.default',
                p: 1,
                borderRadius: 1,
                borderLeft: 3,
                borderColor: 'primary.light',
            }}>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                    Comment
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {body}
                </Typography>
            </Box>
        </Box>
    );
}
