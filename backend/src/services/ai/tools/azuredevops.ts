/**
 * Azure DevOps AI Tools — Read-only tools for Phase 1
 *
 * Read-only tools that enable the AI Copilot to query Azure DevOps data:
 * - azdo_get_pipeline: Get pipeline status and recent runs
 * - azdo_search_work_items: Search work items by text
 * - azdo_get_work_item: Get a specific work item
 * - azdo_get_build: Get build details with timeline
 * - azdo_get_pull_request: Get PR details and threads
 *
 * Wiki tools and test results tool are in azuredevops-read2.ts.
 */

import { Tool, ToolResult, ToolContext } from './types';
import { azureDevOpsService } from '@/services/azuredevops.service';
import { logger } from '@/utils/logger';

// ── Pipeline Tool ────────────────────────────────────────────────────────

export const azdoGetPipelineTool: Tool = {
  name: 'azdo_get_pipeline',
  description:
    'Get an Azure DevOps pipeline status and its recent runs. Returns pipeline details and the latest run results. Use when the user asks about Azure DevOps pipelines, builds, or CI status.',
  category: 'azuredevops',
  requiresConfirmation: false,
  parameters: [
    {
      name: 'pipelineName',
      type: 'string',
      description: 'Name or partial name of the pipeline to look up.',
      required: false,
    },
    {
      name: 'pipelineId',
      type: 'number',
      description: 'Pipeline ID (if known). Takes precedence over name search.',
      required: false,
    },
    {
      name: 'limit',
      type: 'number',
      description: 'Number of recent runs to return (default: 5).',
      required: false,
      default: 5,
    },
  ],

  async execute(args: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
    try {
      if (!azureDevOpsService.isEnabled()) {
        return {
          success: false,
          error: 'Azure DevOps integration is not configured.',
          summary: 'Azure DevOps is not configured. Set AZDO_ORG_URL, AZDO_PAT, and AZDO_PROJECT environment variables.',
        };
      }

      const pipelineId = args.pipelineId as number | undefined;
      const pipelineName = args.pipelineName as string | undefined;
      const limit = (args.limit as number) || 5;

      // Find pipeline by ID or name
      let targetPipeline: { id: number; name: string } | null = null;

      if (pipelineId) {
        const p = await azureDevOpsService.getPipeline(pipelineId);
        targetPipeline = { id: p.id, name: p.name };
      } else if (pipelineName) {
        const pipelines = await azureDevOpsService.listPipelines();
        const match = pipelines.find(
          p => p.name.toLowerCase().includes(pipelineName.toLowerCase())
        );
        if (!match) {
          const available = pipelines.slice(0, 10).map(p => p.name).join(', ');
          return {
            success: true,
            data: { pipelines: pipelines.slice(0, 10) },
            summary: `No pipeline matching "${pipelineName}". Available: ${available}`,
          };
        }
        targetPipeline = { id: match.id, name: match.name };
      } else {
        // List all pipelines
        const pipelines = await azureDevOpsService.listPipelines();
        return {
          success: true,
          data: { pipelines },
          summary: `Found ${pipelines.length} pipeline(s): ${pipelines.slice(0, 10).map(p => p.name).join(', ')}`,
        };
      }

      // Get recent runs
      const runs = await azureDevOpsService.listPipelineRuns(targetPipeline.id, limit);

      const latestRun = runs[0];
      const latestStatus = latestRun
        ? `${latestRun.state} (${latestRun.result})`
        : 'no runs';

      return {
        success: true,
        data: {
          pipeline: targetPipeline,
          recentRuns: runs.map(r => ({
            id: r.id,
            name: r.name,
            state: r.state,
            result: r.result,
            createdDate: r.createdDate,
            finishedDate: r.finishedDate,
          })),
        },
        summary: `Pipeline "${targetPipeline.name}" (ID: ${targetPipeline.id}): ${runs.length} recent run(s). Latest: ${latestStatus}.`,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[azdo_get_pipeline] Failed:', error);
      return { success: false, error: msg, summary: `Failed to get Azure DevOps pipeline: ${msg}` };
    }
  },
};

// ── Work Item Search Tool ────────────────────────────────────────────────

export const azdoSearchWorkItemsTool: Tool = {
  name: 'azdo_search_work_items',
  description:
    'Search Azure DevOps work items (bugs, tasks, user stories, etc.) by text, type, or state. Use when the user asks about bugs, tasks, backlogs, sprints, or work items in Azure DevOps.',
  category: 'azuredevops',
  requiresConfirmation: false,
  parameters: [
    {
      name: 'searchText',
      type: 'string',
      description: 'Text to search for in work item titles.',
      required: false,
    },
    {
      name: 'type',
      type: 'string',
      description: 'Work item type filter (e.g., "Bug", "Task", "User Story", "Epic").',
      required: false,
    },
    {
      name: 'state',
      type: 'string',
      description: 'State filter (e.g., "New", "Active", "Resolved", "Closed").',
      required: false,
    },
    {
      name: 'top',
      type: 'number',
      description: 'Max results (default: 10).',
      required: false,
      default: 10,
    },
  ],

  async execute(args: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
    try {
      if (!azureDevOpsService.isEnabled()) {
        return {
          success: false,
          error: 'Azure DevOps integration is not configured.',
          summary: 'Azure DevOps is not configured.',
        };
      }

      const searchText = (args.searchText as string) || '';
      const type = args.type as string | undefined;
      const state = args.state as string | undefined;
      const top = (args.top as number) || 10;

      const workItems = await azureDevOpsService.searchWorkItems(searchText, type, state, top);

      const mapped = workItems.map(wi => ({
        id: wi.id,
        title: wi.fields['System.Title'],
        type: wi.fields['System.WorkItemType'],
        state: wi.fields['System.State'],
        assignedTo: wi.fields['System.AssignedTo']?.displayName || 'Unassigned',
        priority: wi.fields['Microsoft.VSTS.Common.Priority'],
        tags: wi.fields['System.Tags'],
      }));

      const filterDesc = [
        searchText && `text="${searchText}"`,
        type && `type=${type}`,
        state && `state=${state}`,
      ].filter(Boolean).join(', ') || 'all';

      return {
        success: true,
        data: { workItems: mapped },
        summary: `Found ${mapped.length} work item(s) matching ${filterDesc}. ${mapped.slice(0, 3).map(wi => `#${wi.id} "${wi.title}" (${wi.state})`).join('; ')}`,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[azdo_search_work_items] Failed:', error);
      return { success: false, error: msg, summary: `Failed to search work items: ${msg}` };
    }
  },
};

// ── Get Work Item Tool ───────────────────────────────────────────────────

export const azdoGetWorkItemTool: Tool = {
  name: 'azdo_get_work_item',
  description:
    'Get detailed information about a specific Azure DevOps work item by ID. Returns all fields including description, comments, and relations.',
  category: 'azuredevops',
  requiresConfirmation: false,
  parameters: [
    {
      name: 'id',
      type: 'number',
      description: 'Work item ID.',
      required: true,
    },
  ],

  async execute(args: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
    try {
      if (!azureDevOpsService.isEnabled()) {
        return {
          success: false,
          error: 'Azure DevOps integration is not configured.',
          summary: 'Azure DevOps is not configured.',
        };
      }

      const id = args.id as number;
      const workItem = await azureDevOpsService.getWorkItem(id, 'all');

      return {
        success: true,
        data: {
          id: workItem.id,
          title: workItem.fields['System.Title'],
          type: workItem.fields['System.WorkItemType'],
          state: workItem.fields['System.State'],
          assignedTo: workItem.fields['System.AssignedTo']?.displayName || 'Unassigned',
          description: workItem.fields['System.Description'],
          tags: workItem.fields['System.Tags'],
          priority: workItem.fields['Microsoft.VSTS.Common.Priority'],
          areaPath: workItem.fields['System.AreaPath'],
          iterationPath: workItem.fields['System.IterationPath'],
          createdDate: workItem.fields['System.CreatedDate'],
          changedDate: workItem.fields['System.ChangedDate'],
        },
        summary: `Work item #${workItem.id}: "${workItem.fields['System.Title']}" (${workItem.fields['System.WorkItemType']}, ${workItem.fields['System.State']})`,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[azdo_get_work_item] Failed:', error);
      return { success: false, error: msg, summary: `Failed to get work item: ${msg}` };
    }
  },
};

// ── Get Build Tool ───────────────────────────────────────────────────────

export const azdoGetBuildTool: Tool = {
  name: 'azdo_get_build',
  description:
    'Get Azure DevOps build details including status, timeline, and failed stages/tasks. Use when the user asks about a specific build, failed jobs, or build logs.',
  category: 'azuredevops',
  requiresConfirmation: false,
  parameters: [
    {
      name: 'buildId',
      type: 'number',
      description: 'Build ID to look up.',
      required: true,
    },
    {
      name: 'includeTimeline',
      type: 'boolean',
      description: 'Include stage/job/task breakdown (default: true).',
      required: false,
      default: true,
    },
  ],

  async execute(args: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
    try {
      if (!azureDevOpsService.isEnabled()) {
        return {
          success: false,
          error: 'Azure DevOps integration is not configured.',
          summary: 'Azure DevOps is not configured.',
        };
      }

      const buildId = args.buildId as number;
      const includeTimeline = args.includeTimeline !== false;

      const build = await azureDevOpsService.getBuild(buildId);

      let timeline: Array<{ name: string; type: string; state: string; result: string | null; errorCount: number; warningCount: number }> | null = null;
      let failedTasks: Array<{ name: string; result: string | null; issues?: Array<{ type: string; message: string }> }> = [];

      if (includeTimeline) {
        const tl = await azureDevOpsService.getBuildTimeline(buildId);
        timeline = tl.records.map(r => ({
          name: r.name,
          type: r.type,
          state: r.state as string,
          result: r.result as string | null,
          errorCount: r.errorCount,
          warningCount: r.warningCount,
        }));

        failedTasks = tl.records
          .filter(r => r.result === 'failed' || r.result === 'canceled')
          .map(r => ({
            name: r.name,
            result: r.result,
            issues: r.issues?.map(i => ({ type: i.type, message: i.message })),
          }));
      }

      return {
        success: true,
        data: {
          build: {
            id: build.id,
            buildNumber: build.buildNumber,
            status: build.status,
            result: build.result,
            sourceBranch: build.sourceBranch,
            sourceVersion: build.sourceVersion,
            requestedFor: build.requestedFor?.displayName,
            startTime: build.startTime,
            finishTime: build.finishTime,
            definition: build.definition?.name,
          },
          timeline,
          failedTasks,
        },
        summary: `Build #${build.buildNumber} (${build.status}/${build.result}): branch=${build.sourceBranch}. ${failedTasks.length > 0 ? `${failedTasks.length} failed task(s): ${failedTasks.map(t => t.name).join(', ')}` : 'All tasks succeeded.'}`,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[azdo_get_build] Failed:', error);
      return { success: false, error: msg, summary: `Failed to get build: ${msg}` };
    }
  },
};

// ── Get Pull Request Tool ────────────────────────────────────────────────

export const azdoGetPullRequestTool: Tool = {
  name: 'azdo_get_pull_request',
  description:
    'Get Azure DevOps pull request details including reviewers and comments. Use when the user asks about a specific PR in Azure DevOps.',
  category: 'azuredevops',
  requiresConfirmation: false,
  parameters: [
    {
      name: 'repoName',
      type: 'string',
      description: 'Repository name or ID.',
      required: true,
    },
    {
      name: 'pullRequestId',
      type: 'number',
      description: 'Pull request ID.',
      required: true,
    },
    {
      name: 'includeThreads',
      type: 'boolean',
      description: 'Include comment threads (default: true).',
      required: false,
      default: true,
    },
  ],

  async execute(args: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
    try {
      if (!azureDevOpsService.isEnabled()) {
        return {
          success: false,
          error: 'Azure DevOps integration is not configured.',
          summary: 'Azure DevOps is not configured.',
        };
      }

      const repoName = args.repoName as string;
      const pullRequestId = args.pullRequestId as number;
      const includeThreads = args.includeThreads !== false;

      // Find repo by name
      const repos = await azureDevOpsService.listRepositories();
      const repo = repos.find(
        r => r.name.toLowerCase() === repoName.toLowerCase() || r.id === repoName
      );

      if (!repo) {
        return {
          success: true,
          data: { repositories: repos.map(r => ({ id: r.id, name: r.name })) },
          summary: `Repository "${repoName}" not found. Available: ${repos.map(r => r.name).join(', ')}`,
        };
      }

      const pr = await azureDevOpsService.getPullRequest(repo.id, pullRequestId);

      let threads: Array<{
        id: number;
        status: string;
        commentCount: number;
        filePath?: string;
      }> = [];

      if (includeThreads) {
        const prThreads = await azureDevOpsService.getPullRequestThreads(repo.id, pullRequestId);
        threads = prThreads.map(t => ({
          id: t.id,
          status: t.status,
          commentCount: t.comments.length,
          filePath: t.threadContext?.filePath,
        }));
      }

      const reviewerSummary = pr.reviewers
        .map(r => `${r.displayName} (${r.vote > 0 ? 'approved' : r.vote < 0 ? 'rejected' : 'no vote'})`)
        .join(', ');

      return {
        success: true,
        data: {
          pullRequest: {
            id: pr.pullRequestId,
            title: pr.title,
            description: pr.description,
            status: pr.status,
            sourceRefName: pr.sourceRefName,
            targetRefName: pr.targetRefName,
            createdBy: pr.createdBy?.displayName,
            creationDate: pr.creationDate,
            mergeStatus: pr.mergeStatus,
            reviewers: pr.reviewers.map(r => ({
              name: r.displayName,
              vote: r.vote,
            })),
            labels: pr.labels?.map(l => l.name),
          },
          threads,
        },
        summary: `PR #${pr.pullRequestId}: "${pr.title}" (${pr.status}). ${pr.sourceRefName} → ${pr.targetRefName}. Reviewers: ${reviewerSummary || 'none'}. ${threads.length} thread(s).`,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[azdo_get_pull_request] Failed:', error);
      return { success: false, error: msg, summary: `Failed to get pull request: ${msg}` };
    }
  },
};

