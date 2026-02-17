/**
 * Confluence Tools — Read-only wrappers for Phase 1
 *
 * - confluence_search: Search Confluence for pages by keyword or CQL
 */

import { Tool, ToolResult, ToolContext } from './types';
import { confluenceService } from '@/services/confluence.service';
import { logger } from '@/utils/logger';

export const confluenceSearchTool: Tool = {
    name: 'confluence_search',
    description: 'Search Confluence for documentation, RCA pages, runbooks, or architecture docs related to a query. Returns page titles, excerpts, and URLs.',
    category: 'confluence',
    requiresConfirmation: false,
    parameters: [
        {
            name: 'query',
            type: 'string',
            description: 'Search query — keywords, error messages, or topic to find related Confluence pages.',
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
            name: 'labels',
            type: 'array',
            description: 'Filter results by page labels (e.g. ["rca", "runbook"]).',
            required: false,
        },
    ],

    async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
        try {
            if (!confluenceService.isEnabled()) {
                return { success: false, error: 'Confluence integration is not configured.', summary: 'Confluence is not enabled.' };
            }

            const query = args.query as string;
            const maxResults = (args.maxResults as number) || 5;
            const labels = args.labels as string[] | undefined;

            const results = await confluenceService.searchContent(query, {
                maxResults,
                labels,
            });

            if (results.length === 0) {
                return {
                    success: true,
                    data: [],
                    summary: `No Confluence pages found for "${query}".`,
                };
            }

            return {
                success: true,
                data: results.map(page => ({
                    id: page.id,
                    title: page.title,
                    url: page.url,
                    excerpt: page.excerpt?.substring(0, 200) || '',
                    labels: page.labels,
                })),
                summary: `Found ${results.length} Confluence page(s) matching "${query}".`,
            };
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            logger.error(`[confluence_search] Failed:`, error);
            return { success: false, error: msg, summary: `Confluence search failed: ${msg}` };
        }
    },
};
