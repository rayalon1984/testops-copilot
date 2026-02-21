/**
 * GitHubFileChangePreview — Confirmation preview for github_update_file.
 */

import { Box, Typography } from '@mui/material';
import ExpandableSection from './shared/ExpandableSection';

interface GitHubFileChangePreviewProps {
    args: Record<string, unknown>;
}

export default function GitHubFileChangePreview({ args }: GitHubFileChangePreviewProps) {
    const path = args.path as string;
    const branch = args.branch as string;
    const message = args.message as string;
    const content = args.content as string;

    return (
        <Box>
            <Typography variant="body2" fontWeight={600} fontFamily="monospace">
                {path}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                on branch: {branch}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
                Commit: &ldquo;{message}&rdquo;
            </Typography>

            {content && (
                <ExpandableSection label="Preview content">
                    <Box
                        component="pre"
                        sx={{
                            bgcolor: 'grey.900',
                            color: 'grey.100',
                            p: 1,
                            borderRadius: 1,
                            overflow: 'auto',
                            fontSize: '0.7rem',
                            fontFamily: 'monospace',
                            maxHeight: 150,
                            m: 0,
                        }}
                    >
                        {content.slice(0, 500)}{content.length > 500 ? '...' : ''}
                    </Box>
                </ExpandableSection>
            )}
        </Box>
    );
}
