/**
 * GitHub Advanced Write Tools — Phase 2
 *
 * - github_create_branch: Create a feature branch
 * - github_update_file: Commit changes to a file
 */

import { Tool, ToolResult, ToolContext } from './types';
import { githubService } from '@/services/github.service';
import { logger } from '@/utils/logger';

export const githubCreateBranchTool: Tool = {
    name: 'github_create_branch',
    description: 'Create a new feature branch from the main branch. Use before making code changes.',
    category: 'github',
    requiresConfirmation: true,
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
            name: 'branchName',
            type: 'string',
            description: 'Name of the new branch (e.g. "fix/auth-error").',
            required: true,
        },
        {
            name: 'baseBranch',
            type: 'string',
            description: 'Base branch to branch from (default: "main").',
            required: false,
            default: 'main',
        },
    ],

    async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
        try {
            if (!githubService.isEnabled()) {
                return { success: false, error: 'GitHub integration is not configured.', summary: 'GitHub is not enabled.' };
            }

            const { owner, repo, branchName } = args as { owner: string; repo: string; branchName: string };
            const baseBranch = (args.baseBranch as string) || 'main';

            await githubService.createBranch(owner, repo, branchName, baseBranch);

            return {
                success: true,
                data: { branchName, baseBranch },
                summary: `Created branch '${branchName}' from '${baseBranch}'.`,
            };
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            logger.error(`[github_create_branch] Failed:`, error);
            return { success: false, error: msg, summary: `Failed to create branch: ${msg}` };
        }
    },
};

export const githubUpdateFileTool: Tool = {
    name: 'github_update_file',
    description: 'Commit changes to a specific file in the repository. Use to apply code fixes.',
    category: 'github',
    requiresConfirmation: true,
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
            name: 'path',
            type: 'string',
            description: 'Path of the file to update (e.g. "src/utils/auth.ts").',
            required: true,
        },
        {
            name: 'content',
            type: 'string',
            description: 'The full new content of the file.',
            required: true,
        },
        {
            name: 'message',
            type: 'string',
            description: 'Commit message describing the change.',
            required: true,
        },
        {
            name: 'branch',
            type: 'string',
            description: 'Branch to commit to.',
            required: true,
        },
    ],

    async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
        try {
            if (!githubService.isEnabled()) {
                return { success: false, error: 'GitHub integration is not configured.', summary: 'GitHub is not enabled.' };
            }

            const { owner, repo, path, content, message, branch } = args as {
                owner: string; repo: string; path: string; content: string; message: string; branch: string;
            };

            const result = await githubService.updateFile(owner, repo, path, content, message, branch);

            return {
                success: true,
                data: result,
                summary: `Updated ${path} on branch ${branch}. Commit: ${result.sha.substring(0, 7)}`,
            };
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            logger.error(`[github_update_file] Failed:`, error);
            return { success: false, error: msg, summary: `Failed to update file: ${msg}` };
        }
    },
};
