/**
 * Jira Write Tools — Phase 2
 *
 * - jira_create_issue: Create a new Jira issue (requires confirmation)
 * - jira_transition_issue: Transition issue status (requires confirmation)
 * - jira_comment: Add a comment to a Jira issue (requires confirmation)
 */

import { Tool, ToolResult, ToolContext } from './types';
import { jiraService } from '@/services/jira.service';
import { JiraIssueType, JiraIssueStatus } from '@/types/jira';
import { logger } from '@/utils/logger';

export const jiraCreateIssueTool: Tool = {
    name: 'jira_create_issue',
    description: 'Create a new Jira issue (Bug, Task, Story, or Epic). Use when you identify a bug or want to create a follow-up task. REQUIRES USER CONFIRMATION.',
    category: 'jira',
    requiresConfirmation: true,
    requiredRole: 'EDITOR',
    parameters: [
        {
            name: 'summary',
            type: 'string',
            description: 'Issue title/summary.',
            required: true,
        },
        {
            name: 'description',
            type: 'string',
            description: 'Detailed issue description with reproduction steps, expected vs actual behavior, etc.',
            required: true,
        },
        {
            name: 'type',
            type: 'string',
            description: 'Issue type.',
            required: true,
            enum: ['BUG', 'TASK', 'STORY', 'EPIC'],
        },
        {
            name: 'labels',
            type: 'array',
            description: 'Labels to tag the issue with (e.g. ["automated", "flaky-test"]).',
            required: false,
        },
    ],

    async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
        try {
            if (!jiraService.isEnabled()) {
                return { success: false, error: 'Jira integration is not configured.', summary: 'Jira is not enabled.' };
            }

            const issueKey = await jiraService.createIssue({
                summary: args.summary as string,
                description: args.description as string,
                type: args.type as JiraIssueType,
                labels: args.labels as string[] | undefined,
            });

            return {
                success: true,
                data: { issueKey },
                summary: `Created Jira issue ${issueKey}: "${args.summary}"`,
            };
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            logger.error(`[jira_create_issue] Failed:`, error);
            return { success: false, error: msg, summary: `Failed to create Jira issue: ${msg}` };
        }
    },
};

export const jiraTransitionIssueTool: Tool = {
    name: 'jira_transition_issue',
    description: 'Move a Jira issue to a new status (To Do, In Progress, Done). REQUIRES USER CONFIRMATION.',
    category: 'jira',
    requiresConfirmation: true,
    requiredRole: 'EDITOR',
    parameters: [
        {
            name: 'issueKey',
            type: 'string',
            description: 'The Jira issue key (e.g. "PROJ-123").',
            required: true,
        },
        {
            name: 'status',
            type: 'string',
            description: 'Target status to transition to.',
            required: true,
            enum: ['TODO', 'IN_PROGRESS', 'DONE'],
        },
    ],

    async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
        try {
            if (!jiraService.isEnabled()) {
                return { success: false, error: 'Jira integration is not configured.', summary: 'Jira is not enabled.' };
            }

            const issueKey = args.issueKey as string;
            const status = args.status as JiraIssueStatus;

            await jiraService.transitionIssue(issueKey, status);

            return {
                success: true,
                data: { issueKey, newStatus: status },
                summary: `Transitioned ${issueKey} to ${status}.`,
            };
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            logger.error(`[jira_transition_issue] Failed:`, error);
            return { success: false, error: msg, summary: `Failed to transition issue: ${msg}` };
        }
    },
};

export const jiraCommentTool: Tool = {
    name: 'jira_comment',
    description: 'Add a comment to an existing Jira issue. Use for adding analysis notes, test results, or status updates. REQUIRES USER CONFIRMATION.',
    category: 'jira',
    requiresConfirmation: true,
    requiredRole: 'EDITOR',
    parameters: [
        {
            name: 'issueKey',
            type: 'string',
            description: 'The Jira issue key (e.g. "PROJ-123").',
            required: true,
        },
        {
            name: 'body',
            type: 'string',
            description: 'The comment text to add. Supports Jira wiki markup.',
            required: true,
        },
    ],

    async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
        try {
            if (!jiraService.isEnabled()) {
                return { success: false, error: 'Jira integration is not configured.', summary: 'Jira is not enabled.' };
            }

            const issueKey = args.issueKey as string;
            const body = args.body as string;

            await jiraService.addComment(issueKey, body);

            return {
                success: true,
                data: { issueKey },
                summary: `Added comment to ${issueKey}.`,
            };
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            logger.error(`[jira_comment] Failed:`, error);
            return { success: false, error: msg, summary: `Failed to add comment: ${msg}` };
        }
    },
};
