/**
 * GitHubPRPreview — Confirmation preview for github_create_pr.
 */

import { Box, Typography } from '@mui/material';
import ExpandableSection from './shared/ExpandableSection';

interface GitHubPRPreviewProps {
    args: Record<string, unknown>;
}

export default function GitHubPRPreview({ args }: GitHubPRPreviewProps) {
    const title = args.title as string;
    const body = args.body as string;
    const head = args.head as string;
    const base = args.base as string;
    const repo = args.repo as string;

    return (
        <Box>
            <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
                {title}
            </Typography>

            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                {base} &larr; {head}
                {repo && <span> &middot; {repo}</span>}
            </Typography>

            {body && (
                <ExpandableSection label="Show description" defaultExpanded>
                    <Box sx={{
                        bgcolor: 'background.default',
                        p: 1,
                        borderRadius: 1,
                        maxHeight: 100,
                        overflow: 'auto',
                    }}>
                        <Typography variant="caption" sx={{ whiteSpace: 'pre-wrap' }}>
                            {body}
                        </Typography>
                    </Box>
                </ExpandableSection>
            )}
        </Box>
    );
}
