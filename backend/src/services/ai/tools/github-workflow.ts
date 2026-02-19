/**
 * GitHub Workflow Tools — Phase 3
 *
 * - github_rerun_workflow: Re-run a GitHub Actions workflow (requires confirmation)
 */

import { Tool, ToolResult, ToolContext } from './types';
import { githubService } from '@/services/github.service';
import { logger } from '@/utils/logger';

export const githubRerunWorkflowTool: Tool = {
    name: 'github_rerun_workflow',
    description: 'Re-run a GitHub Actions workflow by dispatching a new workflow run. Use when a pipeline build failed and the user wants to retry it. REQUIRES USER CONFIRMATION.',
    category: 'github',
    requiresConfirmation: true,
    requiredRole: 'EDITOR',
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
            name: 'workflowId',
            type: 'string',
            description: 'Workflow filename (e.g. "ci.yml") or numeric workflow ID.',
            required: true,
        },
        {
            name: 'branch',
            type: 'string',
            description: 'Branch to run the workflow on. Defaults to "main".',
            required: false,
            default: 'main',
        },
    ],

    async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
        try {
            if (!githubService.isEnabled()) {
                return { success: false, error: 'GitHub integration is not configured.', summary: 'GitHub is not enabled.' };
            }

            const owner = args.owner as string;
            const repo = args.repo as string;
            const workflowId = args.workflowId as string;
            const branch = (args.branch as string) || 'main';

            await githubService.rerunWorkflow(owner, repo, workflowId, branch);

            return {
                success: true,
                data: {
                    owner,
                    repo,
                    workflowId,
                    branch,
                    status: 'dispatched',
                },
                summary: `Dispatched workflow "${workflowId}" on ${owner}/${repo} (branch: ${branch}).`,
            };
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            logger.error(`[github_rerun_workflow] Failed:`, error);
            return { success: false, error: msg, summary: `Failed to re-run workflow: ${msg}` };
        }
    },
};
