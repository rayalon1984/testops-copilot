/**
 * JiraCreatePreview — Confirmation preview for jira_create_issue.
 */

import { Box, Typography, Chip } from '@mui/material';

interface JiraCreatePreviewProps {
    args: Record<string, unknown>;
}

export default function JiraCreatePreview({ args }: JiraCreatePreviewProps) {
    const summary = args.summary as string;
    const description = args.description as string;
    const type = args.type as string;
    const labels = args.labels as string[] | undefined;

    return (
        <Box>
            <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ minWidth: 70 }}>Type</Typography>
                <Chip label={type || 'BUG'} size="small" sx={{ height: 20, fontSize: '0.65rem' }} />
            </Box>

            <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ minWidth: 70 }}>Summary</Typography>
                <Typography variant="body2" fontWeight={600}>{summary}</Typography>
            </Box>

            {labels && labels.length > 0 && (
                <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ minWidth: 70 }}>Labels</Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {labels.map(l => <Chip key={l} label={l} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.6rem' }} />)}
                    </Box>
                </Box>
            )}

            {description && (
                <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>Description</Typography>
                    <Box sx={{
                        bgcolor: 'background.default',
                        p: 1,
                        borderRadius: 1,
                        maxHeight: 100,
                        overflow: 'auto',
                    }}>
                        <Typography variant="caption" fontFamily="monospace" sx={{ whiteSpace: 'pre-wrap' }}>
                            {description}
                        </Typography>
                    </Box>
                </Box>
            )}
        </Box>
    );
}
