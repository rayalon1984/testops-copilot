/**
 * Xray Tools — Read-only wrappers for Phase 1
 *
 * - xray_search: Search Xray test cases and test plans from the copilot
 */

import { Tool, ToolResult, ToolContext } from './types';
import { xrayService } from '@/services/xray.service';
import { logger } from '@/utils/logger';

export const xraySearchTool: Tool = {
    name: 'xray_search',
    description: 'Search Xray test cases and test plans in the configured Jira project. Returns test case keys, summaries, statuses, and last execution dates.',
    category: 'xray',
    requiresConfirmation: false,
    parameters: [
        {
            name: 'query',
            type: 'string',
            description: 'Search text for test case summary or key (e.g., "checkout", "login flow").',
            required: true,
        },
        {
            name: 'type',
            type: 'string',
            description: 'Type of Xray entity to search: "test_case" or "test_plan". Defaults to test_case.',
            required: false,
            default: 'test_case',
        },
        {
            name: 'limit',
            type: 'number',
            description: 'Maximum results to return (capped at 25).',
            required: false,
            default: 10,
        },
    ],

    async execute(args: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
        try {
            if (!xrayService.isEnabled()) {
                return {
                    success: false,
                    error: 'Xray integration is not configured. Ask your admin to set XRAY_CLIENT_ID, XRAY_CLIENT_SECRET, and XRAY_PROJECT_KEY.',
                    summary: 'Xray is not enabled.',
                };
            }

            const query = args.query as string;
            const type = (args.type as string) || 'test_case';
            const limit = Math.min((args.limit as number) || 10, 25);

            if (type === 'test_plan') {
                const plans = await xrayService.getTestPlans();
                if (plans.length === 0) {
                    return {
                        success: true,
                        data: [],
                        summary: `No Xray test plans found.`,
                    };
                }
                return {
                    success: true,
                    data: plans,
                    summary: `Found ${plans.length} Xray test plan(s).`,
                };
            }

            // Default: test_case
            const testCases = await xrayService.getTestCases(query, limit);

            if (testCases.length === 0) {
                return {
                    success: true,
                    data: [],
                    summary: `No Xray test cases found for "${query}".`,
                };
            }

            return {
                success: true,
                data: testCases,
                summary: `Found ${testCases.length} Xray test case(s) matching "${query}".`,
            };
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            logger.error(`[xray_search] Failed:`, error);
            return { success: false, error: msg, summary: `Xray search failed: ${msg}` };
        }
    },
};
