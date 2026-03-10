/**
 * Azure DevOps AI Tools — Write tools (Phase 2, require confirmation)
 *
 * - azdo_create_work_item: Create a new work item (Bug, Task, User Story)
 * - azdo_update_work_item: Update an existing work item's fields
 * - azdo_trigger_pipeline: Trigger a pipeline run
 * - azdo_create_wiki_page: Create or update a wiki page
 */

import { Tool, ToolResult, ToolContext } from './types';
import { azureDevOpsService } from '@/services/azuredevops.service';
import { logger } from '@/utils/logger';

// ── Create Work Item ─────────────────────────────────────────────────────

export const azdoCreateWorkItemTool: Tool = {
  name: 'azdo_create_work_item',
  description:
    'Create a new Azure DevOps work item (Bug, Task, User Story, Epic, etc.). Use when the user wants to file a bug, create a task, or add a backlog item in Azure DevOps.',
  category: 'azuredevops',
  requiresConfirmation: true,
  parameters: [
    {
      name: 'type',
      type: 'string',
      description: 'Work item type (e.g., "Bug", "Task", "User Story", "Epic").',
      required: true,
    },
    {
      name: 'title',
      type: 'string',
      description: 'Title of the work item.',
      required: true,
    },
    {
      name: 'description',
      type: 'string',
      description: 'HTML description of the work item.',
      required: false,
    },
    {
      name: 'assignedTo',
      type: 'string',
      description: 'Email or display name to assign the work item to.',
      required: false,
    },
    {
      name: 'priority',
      type: 'number',
      description: 'Priority (1=Critical, 2=High, 3=Medium, 4=Low).',
      required: false,
    },
    {
      name: 'tags',
      type: 'string',
      description: 'Semicolon-separated tags (e.g., "flaky-test;regression;P1").',
      required: false,
    },
    {
      name: 'areaPath',
      type: 'string',
      description: 'Area path for the work item.',
      required: false,
    },
    {
      name: 'iterationPath',
      type: 'string',
      description: 'Iteration path (sprint) for the work item.',
      required: false,
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

      const type = args.type as string;
      const title = args.title as string;

      const fields: Array<{ op: 'add'; path: string; value: unknown }> = [
        { op: 'add', path: '/fields/System.Title', value: title },
      ];

      if (args.description) {
        fields.push({ op: 'add', path: '/fields/System.Description', value: args.description });
      }
      if (args.assignedTo) {
        fields.push({ op: 'add', path: '/fields/System.AssignedTo', value: args.assignedTo });
      }
      if (args.priority) {
        fields.push({ op: 'add', path: '/fields/Microsoft.VSTS.Common.Priority', value: args.priority });
      }
      if (args.tags) {
        fields.push({ op: 'add', path: '/fields/System.Tags', value: args.tags });
      }
      if (args.areaPath) {
        fields.push({ op: 'add', path: '/fields/System.AreaPath', value: args.areaPath });
      }
      if (args.iterationPath) {
        fields.push({ op: 'add', path: '/fields/System.IterationPath', value: args.iterationPath });
      }

      const workItem = await azureDevOpsService.createWorkItem(type, fields);

      return {
        success: true,
        data: {
          id: workItem.id,
          title: workItem.fields['System.Title'],
          type: workItem.fields['System.WorkItemType'],
          state: workItem.fields['System.State'],
          url: workItem.url,
        },
        summary: `Created ${type} #${workItem.id}: "${title}"`,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[azdo_create_work_item] Failed:', error);
      return { success: false, error: msg, summary: `Failed to create work item: ${msg}` };
    }
  },
};

// ── Update Work Item ─────────────────────────────────────────────────────

export const azdoUpdateWorkItemTool: Tool = {
  name: 'azdo_update_work_item',
  description:
    'Update an existing Azure DevOps work item. Can change state, title, description, assignment, priority, or tags.',
  category: 'azuredevops',
  requiresConfirmation: true,
  parameters: [
    {
      name: 'id',
      type: 'number',
      description: 'Work item ID to update.',
      required: true,
    },
    {
      name: 'state',
      type: 'string',
      description: 'New state (e.g., "Active", "Resolved", "Closed").',
      required: false,
    },
    {
      name: 'title',
      type: 'string',
      description: 'New title.',
      required: false,
    },
    {
      name: 'assignedTo',
      type: 'string',
      description: 'New assignee (email or display name).',
      required: false,
    },
    {
      name: 'priority',
      type: 'number',
      description: 'New priority (1-4).',
      required: false,
    },
    {
      name: 'comment',
      type: 'string',
      description: 'Comment to add to the work item history.',
      required: false,
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
      const fields: Array<{ op: 'replace'; path: string; value: unknown }> = [];

      if (args.state) {
        fields.push({ op: 'replace', path: '/fields/System.State', value: args.state });
      }
      if (args.title) {
        fields.push({ op: 'replace', path: '/fields/System.Title', value: args.title });
      }
      if (args.assignedTo) {
        fields.push({ op: 'replace', path: '/fields/System.AssignedTo', value: args.assignedTo });
      }
      if (args.priority) {
        fields.push({ op: 'replace', path: '/fields/Microsoft.VSTS.Common.Priority', value: args.priority });
      }
      if (args.comment) {
        fields.push({ op: 'replace' as const, path: '/fields/System.History', value: args.comment });
      }

      if (fields.length === 0) {
        return {
          success: false,
          error: 'No fields to update.',
          summary: 'No update fields provided.',
        };
      }

      const workItem = await azureDevOpsService.updateWorkItem(id, fields);

      const updatedFields = fields.map(f => f.path.split('/').pop()).join(', ');

      return {
        success: true,
        data: {
          id: workItem.id,
          title: workItem.fields['System.Title'],
          state: workItem.fields['System.State'],
        },
        summary: `Updated work item #${id}: changed ${updatedFields}`,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[azdo_update_work_item] Failed:', error);
      return { success: false, error: msg, summary: `Failed to update work item: ${msg}` };
    }
  },
};

// ── Trigger Pipeline ─────────────────────────────────────────────────────

export const azdoTriggerPipelineTool: Tool = {
  name: 'azdo_trigger_pipeline',
  description:
    'Trigger an Azure DevOps pipeline run. Optionally specify a branch and template parameters.',
  category: 'azuredevops',
  requiresConfirmation: true,
  parameters: [
    {
      name: 'pipelineId',
      type: 'number',
      description: 'Pipeline ID to trigger.',
      required: true,
    },
    {
      name: 'branch',
      type: 'string',
      description: 'Branch to run the pipeline on (default: pipeline default).',
      required: false,
    },
    {
      name: 'parameters',
      type: 'object',
      description: 'Template parameters as key-value pairs.',
      required: false,
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

      const pipelineId = args.pipelineId as number;
      const branch = args.branch as string | undefined;
      const parameters = args.parameters as Record<string, string> | undefined;

      const run = await azureDevOpsService.triggerPipelineRun(pipelineId, branch, parameters);

      return {
        success: true,
        data: {
          runId: run.id,
          name: run.name,
          state: run.state,
          pipelineId: run.pipeline.id,
          pipelineName: run.pipeline.name,
          createdDate: run.createdDate,
        },
        summary: `Triggered pipeline "${run.pipeline.name}" run #${run.id} (${run.state})${branch ? ` on branch ${branch}` : ''}.`,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[azdo_trigger_pipeline] Failed:', error);
      return { success: false, error: msg, summary: `Failed to trigger pipeline: ${msg}` };
    }
  },
};

// ── Create/Update Wiki Page ──────────────────────────────────────────────

export const azdoCreateWikiPageTool: Tool = {
  name: 'azdo_create_wiki_page',
  description:
    'Create or update an Azure DevOps wiki page with Markdown content. Use when the user wants to publish documentation, test reports, or RCA documents to the Azure DevOps wiki.',
  category: 'azuredevops',
  requiresConfirmation: true,
  parameters: [
    {
      name: 'wikiId',
      type: 'string',
      description: 'Wiki ID (from azdo_list_wikis).',
      required: true,
    },
    {
      name: 'pagePath',
      type: 'string',
      description: 'Path for the wiki page (e.g., "/Test Reports/Sprint 12").',
      required: true,
    },
    {
      name: 'content',
      type: 'string',
      description: 'Markdown content for the page.',
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

      const wikiId = args.wikiId as string;
      const pagePath = args.pagePath as string;
      const content = args.content as string;

      const page = await azureDevOpsService.createOrUpdateWikiPage(wikiId, pagePath, content);

      return {
        success: true,
        data: {
          path: page.path,
          url: page.remoteUrl,
        },
        summary: `Wiki page "${pagePath}" created/updated successfully.`,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[azdo_create_wiki_page] Failed:', error);
      return { success: false, error: msg, summary: `Failed to create/update wiki page: ${msg}` };
    }
  },
};
