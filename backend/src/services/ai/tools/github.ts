/**
 * GitHub Tools — Read-only wrappers for Phase 1
 *
 * - github_get_commit: Get files changed in a specific commit
 * - github_get_pr: Find the PR associated with a commit
 */

import { Tool, ToolResult, ToolContext } from './types';
import { githubService } from '@/services/github.service';
import { logger } from '@/utils/logger';

export const githubGetCommitTool: Tool = {
    name: 'github_get_commit',
    description: 'Get the files changed in a specific Git commit. Returns filenames, diffs, and change statistics.',
    category: 'github',
    requiresConfirmation: false,
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
            name: 'commitSha',
            type: 'string',
            description: 'The full or short commit SHA.',
            required: true,
        },
    ],

    async execute(args: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
        try {
            if (!githubService.isEnabled()) {
                return { success: false, error: 'GitHub integration is not configured.', summary: 'GitHub is not enabled.' };
            }

            const { owner, repo, commitSha } = args as { owner: string; repo: string; commitSha: string };
            const result = await githubService.getCommitChanges(owner, repo, commitSha);

            const _fileSummary = result.files.map(f => `${f.status} ${f.filename} (+${f.additions}/-${f.deletions})`);

            return {
                success: true,
                data: {
                    message: result.message,
                    filesChanged: result.files.length,
                    files: result.files.map(f => ({
                        filename: f.filename,
                        status: f.status,
                        additions: f.additions,
                        deletions: f.deletions,
                        // Truncate patches to avoid token bloat
                        patch: f.patch?.substring(0, 500) || '',
                    })),
                },
                summary: `Commit "${result.message.substring(0, 60)}": ${result.files.length} file(s) changed.`,
            };
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            logger.error(`[github_get_commit] Failed:`, error);
            return { success: false, error: msg, summary: `Failed to get commit: ${msg}` };
        }
    },
};

export const githubGetPRTool: Tool = {
    name: 'github_get_pr',
    description: 'Find the pull request associated with a commit SHA. Returns PR number, title, author, and URL.',
    category: 'github',
    requiresConfirmation: false,
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
            name: 'commitSha',
            type: 'string',
            description: 'The commit SHA to look up.',
            required: true,
        },
    ],

    async execute(args: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
        try {
            if (!githubService.isEnabled()) {
                return { success: false, error: 'GitHub integration is not configured.', summary: 'GitHub is not enabled.' };
            }

            const { owner, repo, commitSha } = args as { owner: string; repo: string; commitSha: string };
            const pr = await githubService.getPullRequestForCommit(owner, repo, commitSha);

            if (!pr) {
                return {
                    success: true,
                    data: null,
                    summary: `No pull request found for commit ${commitSha.substring(0, 7)}.`,
                };
            }

            return {
                success: true,
                data: {
                    number: pr.number,
                    title: pr.title,
                    author: pr.author,
                    url: pr.url,
                    body: pr.body?.substring(0, 300) || '',
                },
                summary: `Found PR #${pr.number}: "${pr.title}" by ${pr.author}.`,
            };
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            logger.error(`[github_get_pr] Failed:`, error);
            return { success: false, error: msg, summary: `Failed to find PR: ${msg}` };
        }
    },
};
