/**
 * Jira Tools — Read-only wrappers for Phase 1
 *
 * - jira_search: Search for Jira issues by error message or keywords
 * - jira_get: Get details of a specific Jira issue by key
 */

import { Tool, ToolResult, ToolContext } from './types';
import { jiraService } from '@/services/jira.service';
import { logger } from '@/utils/logger';

export const jiraSearchTool: Tool = {
    name: 'jira_search',
    description: 'Search Jira for issues related to a test failure or keyword. Returns matching issues with summary, status, and assignee.',
    category: 'jira',
    requiresConfirmation: false,
    parameters: [
        {
            name: 'query',
            type: 'string',
            description: 'Search query — an error message, test name, or keywords to find related Jira issues.',
            required: true,
        },
        {
            name: 'maxResults',
            type: 'number',
            description: 'Maximum number of results to return.',
            required: false,
            default: 5,
        },
        {
            name: 'statusFilter',
            type: 'array',
            description: 'Filter by issue status (e.g. ["Open", "In Progress"]).',
            required: false,
        },
    ],

    async execute(args: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
        try {
            if (!jiraService.isEnabled()) {
                return { success: false, error: 'Jira integration is not configured.', summary: 'Jira is not enabled.' };
            }

            const query = args.query as string;
            const maxResults = (args.maxResults as number) || 5;
            const statusFilter = args.statusFilter as string[] | undefined;

            const issues = await jiraService.searchSimilarIssues(query, undefined, {
                maxResults,
                statusFilter,
            });

            if (issues.length === 0) {
                return {
                    success: true,
                    data: [],
                    summary: `No Jira issues found for "${query}".`,
                };
            }

            // JiraIssueResponse has data nested under .fields
            const formatted = issues.map(issue => {
                const assignee = issue.fields.assignee as { displayName?: string } | null | undefined;
                return {
                    key: issue.key,
                    summary: issue.fields.summary,
                    status: issue.fields.status?.name || 'Unknown',
                    type: issue.fields.issuetype?.name || 'Unknown',
                    labels: issue.fields.labels || [],
                    assignee: assignee?.displayName || 'Unassigned',
                };
            });

            return {
                success: true,
                data: formatted,
                summary: `Found ${issues.length} Jira issue(s) matching "${query}".`,
            };
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            logger.error(`[jira_search] Failed:`, error);
            return { success: false, error: msg, summary: `Jira search failed: ${msg}` };
        }
    },
};

export const jiraGetTool: Tool = {
    name: 'jira_get',
    description: 'Get full details of a specific Jira issue by its key (e.g. "TEST-123"). Returns summary, status, description, assignee, and labels.',
    category: 'jira',
    requiresConfirmation: false,
    parameters: [
        {
            name: 'issueKey',
            type: 'string',
            description: 'The Jira issue key, e.g. "PROJ-123".',
            required: true,
        },
    ],

    async execute(args: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
        try {
            if (!jiraService.isEnabled()) {
                return { success: false, error: 'Jira integration is not configured.', summary: 'Jira is not enabled.' };
            }

            const issueKey = args.issueKey as string;
            const issue = await jiraService.getIssue(issueKey);

            return {
                success: true,
                data: {
                    key: issue.key,
                    summary: issue.fields.summary,
                    status: issue.fields.status?.name || 'Unknown',
                    type: issue.fields.issuetype?.name || 'Unknown',
                    description: issue.fields.description || '',
                    labels: issue.fields.labels || [],
                    assignee: (issue.fields.assignee as { displayName?: string } | null)?.displayName || 'Unassigned',
                },
                summary: `Retrieved Jira issue ${issueKey}: "${issue.fields.summary}" (${issue.fields.status?.name || 'Unknown'}).`,
            };
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            logger.error(`[jira_get] Failed for ${args.issueKey}:`, error);
            return { success: false, error: msg, summary: `Failed to get Jira issue: ${msg}` };
        }
    },
};
