/**
 * GitHub Merge PR Tool — Phase 3 (Tier 2: AI-in-the-Loop)
 *
 * Merges a pull request from within the AI copilot chat.
 * Team-visible action, so requires one-click approval (Tier 2).
 *
 * See specs/AUTONOMOUS_AI_SPEC.md § Tool-by-Tool Classification.
 */

import { Tool, ToolResult, ToolContext } from './types';
import { githubService } from '@/services/github.service';
import { logger } from '@/utils/logger';

export const githubMergePRTool: Tool = {
    name: 'github_merge_pr',
    description: 'Merge an open pull request. Team-visible — requires user approval. Use when CI is passing and the PR is ready.',
    category: 'github',
    requiresConfirmation: true,
    requiredRole: 'EDITOR',
    parameters: [
        {
            name: 'owner',
            type: 'string',
            description: 'GitHub repository owner.',
            required: true,
        },
        {
            name: 'repo',
            type: 'string',
            description: 'GitHub repository name.',
            required: true,
        },
        {
            name: 'prNumber',
            type: 'number',
            description: 'The pull request number to merge.',
            required: true,
        },
        {
            name: 'mergeMethod',
            type: 'string',
            description: 'The merge method to use.',
            required: false,
            enum: ['merge', 'squash', 'rebase'],
            default: 'squash',
        },
        {
            name: 'commitMessage',
            type: 'string',
            description: 'Custom merge commit message (optional).',
            required: false,
        },
    ],

    async execute(args: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
        try {
            if (!githubService.isEnabled()) {
                return { success: false, error: 'GitHub integration is not configured.', summary: 'GitHub is not enabled.' };
            }

            const owner = args.owner as string;
            const repo = args.repo as string;
            const prNumber = args.prNumber as number;
            const mergeMethod = (args.mergeMethod as string) || 'squash';
            const commitMessage = args.commitMessage as string | undefined;

            const result = await githubService.mergePR(owner, repo, prNumber, {
                method: mergeMethod,
                commitMessage,
            });

            logger.info(`[github_merge_pr] Merged PR #${prNumber} in ${owner}/${repo} via ${mergeMethod}`);

            return {
                success: true,
                data: {
                    prNumber,
                    owner,
                    repo,
                    merged: true,
                    sha: result.sha,
                    mergeMethod,
                    message: result.message || `PR #${prNumber} merged successfully`,
                },
                summary: `Merged PR #${prNumber} in ${owner}/${repo} (${mergeMethod}).`,
            };
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            logger.error(`[github_merge_pr] Failed:`, error);
            return { success: false, error: msg, summary: `Failed to merge PR #${args.prNumber}: ${msg}` };
        }
    },
};
