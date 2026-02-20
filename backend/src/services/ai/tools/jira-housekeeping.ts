/**
 * Jira Housekeeping Tools — Phase 3 (Tier 1 auto-execute)
 *
 * Internal metadata operations that the AI performs autonomously during
 * investigation. All are reversible and not visible to the wider team.
 *
 * - jira_link_issues: Link related Jira issues (relates to, blocks, etc.)
 * - jira_add_label: Add labels to Jira issues (e.g. "investigated-by-ai")
 *
 * See specs/AUTONOMOUS_AI_SPEC.md § Feature 4.
 */

import { Tool, ToolResult, ToolContext } from './types';
import { jiraService } from '@/services/jira.service';
import { logger } from '@/utils/logger';

export const jiraLinkIssuesTool: Tool = {
    name: 'jira_link_issues',
    description: 'Link related Jira issues discovered during investigation. Internal metadata — reversible, not team-visible. Tier 1: auto-execute.',
    category: 'jira',
    requiresConfirmation: false,
    parameters: [
        {
            name: 'sourceKey',
            type: 'string',
            description: 'The primary issue key (e.g. "PROJ-100").',
            required: true,
        },
        {
            name: 'targetKeys',
            type: 'array',
            description: 'Array of issue keys to link to the source (e.g. ["PROJ-200", "PROJ-201"]).',
            required: true,
        },
        {
            name: 'linkType',
            type: 'string',
            description: 'The relationship type between issues.',
            required: false,
            enum: ['relates to', 'blocks', 'is blocked by', 'duplicates', 'is duplicated by'],
            default: 'relates to',
        },
    ],

    async execute(args: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
        try {
            if (!jiraService.isEnabled()) {
                return { success: false, error: 'Jira integration is not configured.', summary: 'Jira is not enabled.' };
            }

            const sourceKey = args.sourceKey as string;
            const targetKeys = args.targetKeys as string[];
            const linkType = (args.linkType as string) || 'relates to';

            const linked: string[] = [];
            const errors: string[] = [];

            for (const targetKey of targetKeys) {
                try {
                    await jiraService.linkIssues(sourceKey, targetKey, linkType);
                    linked.push(targetKey);
                } catch (error) {
                    const msg = error instanceof Error ? error.message : 'Unknown error';
                    errors.push(`${targetKey}: ${msg}`);
                }
            }

            if (linked.length === 0 && errors.length > 0) {
                return {
                    success: false,
                    error: `Failed to link any issues: ${errors.join('; ')}`,
                    summary: `Failed to link issues to ${sourceKey}.`,
                };
            }

            logger.info(`[jira_link_issues] Linked ${sourceKey} → [${linked.join(', ')}] (${linkType})`);

            return {
                success: true,
                data: {
                    sourceKey,
                    linked,
                    linkType,
                    errors: errors.length > 0 ? errors : undefined,
                },
                summary: `Linked ${sourceKey} to ${linked.join(', ')} (${linkType}).${errors.length > 0 ? ` ${errors.length} link(s) failed.` : ''}`,
            };
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            logger.error(`[jira_link_issues] Failed:`, error);
            return { success: false, error: msg, summary: `Failed to link issues: ${msg}` };
        }
    },
};

export const jiraAddLabelTool: Tool = {
    name: 'jira_add_label',
    description: 'Add labels to a Jira issue (e.g. "investigated-by-ai", "flaky"). Internal metadata — reversible. Tier 1: auto-execute.',
    category: 'jira',
    requiresConfirmation: false,
    parameters: [
        {
            name: 'issueKey',
            type: 'string',
            description: 'The Jira issue key (e.g. "PROJ-123").',
            required: true,
        },
        {
            name: 'labels',
            type: 'array',
            description: 'Labels to add (e.g. ["investigated-by-ai", "auto-linked"]).',
            required: true,
        },
    ],

    async execute(args: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
        try {
            if (!jiraService.isEnabled()) {
                return { success: false, error: 'Jira integration is not configured.', summary: 'Jira is not enabled.' };
            }

            const issueKey = args.issueKey as string;
            const labels = args.labels as string[];

            await jiraService.addLabels(issueKey, labels);

            logger.info(`[jira_add_label] Added labels [${labels.join(', ')}] to ${issueKey}`);

            return {
                success: true,
                data: { issueKey, labels },
                summary: `Added label(s) ${labels.map(l => `"${l}"`).join(', ')} to ${issueKey}.`,
            };
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            logger.error(`[jira_add_label] Failed:`, error);
            return { success: false, error: msg, summary: `Failed to add labels: ${msg}` };
        }
    },
};
