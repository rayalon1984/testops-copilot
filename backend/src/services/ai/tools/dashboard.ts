/**
 * Dashboard Tools — Read-only wrappers for Phase 1
 *
 * - dashboard_metrics: Get current dashboard metrics (test counts, failures, pipelines)
 *
 * NOTE: Compatible with both production schema and dev schema.
 * Uses only universally-available fields (count, duration).
 */

import { Tool, ToolResult, ToolContext } from './types';
import { prisma } from '@/lib/prisma';
import { logger } from '@/utils/logger';

export const dashboardMetricsTool: Tool = {
    name: 'dashboard_metrics',
    description: 'Get current dashboard metrics including total test runs, failure counts, pipeline counts, and time ranges. Useful for answering questions about overall system health.',
    category: 'dashboard',
    requiresConfirmation: false,
    parameters: [
        {
            name: 'timeRange',
            type: 'string',
            description: 'Time range for metrics.',
            required: false,
            default: '30d',
            enum: ['7d', '30d', '90d'],
        },
    ],

    async execute(args: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
        try {
            const timeRange = (args.timeRange as string) || '30d';
            const days = timeRange === '7d' ? 7 : timeRange === '90d' ? 90 : 30;
            const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

            // Use only universally-available queries (no schema-specific fields)
            const [totalRuns, failedRuns, passedRuns, pipelineCount, failureCount] = await Promise.all([
                prisma.testRun.count({ where: { createdAt: { gte: since } } }),
                prisma.testRun.count({ where: { createdAt: { gte: since }, status: 'FAILED' } }),
                prisma.testRun.count({ where: { createdAt: { gte: since }, status: 'PASSED' } }),
                prisma.pipeline.count(),
                prisma.failureArchive.count({ where: { createdAt: { gte: since } } }),
            ]);

            return {
                success: true,
                data: {
                    timeRange: `Last ${days} days`,
                    totalTestRuns: totalRuns,
                    passedRuns,
                    failedRuns,
                    passRate: totalRuns > 0 ? ((passedRuns / totalRuns) * 100).toFixed(1) + '%' : 'N/A',
                    failuresArchived: failureCount,
                    activePipelines: pipelineCount,
                },
                summary: `Last ${days}d: ${totalRuns} test runs (${passedRuns} passed, ${failedRuns} failed). ${failureCount} failures archived. ${pipelineCount} pipelines.`,
            };
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            logger.error(`[dashboard_metrics] Failed:`, error);
            return { success: false, error: msg, summary: `Failed to get dashboard metrics: ${msg}` };
        }
    },
};
