/**
 * GitHubBranchPreview — Confirmation preview for github_create_branch.
 */

import { Box, Typography } from '@mui/material';

interface GitHubBranchPreviewProps {
    args: Record<string, unknown>;
}

export default function GitHubBranchPreview({ args }: GitHubBranchPreviewProps) {
    const branchName = args.branchName as string;
    const baseBranch = (args.baseBranch as string) || 'main';

    return (
        <Box>
            <Typography variant="body2" fontWeight={600} fontFamily="monospace">
                {branchName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
                branching from: {baseBranch}
            </Typography>
        </Box>
    );
}
