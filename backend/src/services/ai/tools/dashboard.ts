/**
 * Dashboard Tools — Read-only wrappers for Phase 1
 *
 * - dashboard_metrics: Get current dashboard metrics (test counts, failures, AI costs)
 */

import { Tool, ToolResult, ToolContext } from './types';
import { prisma } from '@/lib/prisma';
import { logger } from '@/utils/logger';

export const dashboardMetricsTool: Tool = {
    name: 'dashboard_metrics',
    description: 'Get current dashboard metrics including total tests analyzed, failures categorized, top failure categories, and pipeline status. Useful for answering questions about overall system health.',
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

    async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
        try {
            const timeRange = (args.timeRange as string) || '30d';
            const days = timeRange === '7d' ? 7 : timeRange === '90d' ? 90 : 30;
            const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

            // Fetch aggregate metrics from the database
            // Pipeline uses 'enabled' field (boolean), not 'status'
            const [testRunStats, failureCount, pipelineCount] = await Promise.all([
                prisma.testRun.aggregate({
                    where: { createdAt: { gte: since } },
                    _sum: { passed: true, failed: true, skipped: true },
                    _count: true,
                }),
                prisma.failureArchive.count({
                    where: { createdAt: { gte: since } },
                }),
                prisma.pipeline.count({
                    where: { enabled: true },
                }),
            ]);

            const totalTests = (testRunStats._sum.passed || 0) + (testRunStats._sum.failed || 0) + (testRunStats._sum.skipped || 0);
            const totalFailed = testRunStats._sum.failed || 0;
            const totalPassed = testRunStats._sum.passed || 0;

            return {
                success: true,
                data: {
                    timeRange: `Last ${days} days`,
                    totalTestRuns: testRunStats._count,
                    totalTests,
                    totalPassed,
                    totalFailed,
                    totalSkipped: testRunStats._sum.skipped || 0,
                    passRate: totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) + '%' : 'N/A',
                    failuresArchived: failureCount,
                    activePipelines: pipelineCount,
                },
                summary: `Last ${days}d: ${testRunStats._count} runs, ${totalTests} tests (${totalPassed} passed, ${totalFailed} failed). ${pipelineCount} active pipelines.`,
            };
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            logger.error(`[dashboard_metrics] Failed:`, error);
            return { success: false, error: msg, summary: `Failed to get dashboard metrics: ${msg}` };
        }
    },
};
