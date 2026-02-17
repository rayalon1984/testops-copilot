/**
 * GitHub Write Tools — Phase 2
 *
 * - github_create_pr: Create a pull request (requires confirmation)
 */

import { Tool, ToolResult, ToolContext } from './types';
import { githubService } from '@/services/github.service';
import { logger } from '@/utils/logger';

export const githubCreatePRTool: Tool = {
    name: 'github_create_pr',
    description: 'Create a pull request on GitHub. Use after proposing a code fix to submit changes for review. REQUIRES USER CONFIRMATION before execution.',
    category: 'github',
    requiresConfirmation: true,
    parameters: [
        {
            name: 'owner',
            type: 'string',
            description: 'GitHub repository owner (org or username).',
            required: true,
        },
        {
            name: 'repo',
            type: 'string',
            description: 'GitHub repository name.',
            required: true,
        },
        {
            name: 'title',
            type: 'string',
            description: 'Pull request title.',
            required: true,
        },
        {
            name: 'body',
            type: 'string',
            description: 'Pull request description with context about the fix.',
            required: true,
        },
        {
            name: 'head',
            type: 'string',
            description: 'Source branch name containing the changes.',
            required: true,
        },
        {
            name: 'base',
            type: 'string',
            description: 'Target branch to merge into (e.g. "main").',
            required: true,
        },
    ],

    async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
        try {
            if (!githubService.isEnabled()) {
                return { success: false, error: 'GitHub integration is not configured.', summary: 'GitHub is not enabled.' };
            }

            const { owner, repo, title, body, head, base } = args as {
                owner: string; repo: string; title: string; body: string; head: string; base: string;
            };

            const pr = await githubService.createPullRequest(owner, repo, title, body, head, base);

            return {
                success: true,
                data: pr,
                summary: `Created PR #${pr.number}: "${pr.title}" → ${pr.url}`,
            };
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            logger.error(`[github_create_pr] Failed:`, error);
            return { success: false, error: msg, summary: `Failed to create PR: ${msg}` };
        }
    },
};
