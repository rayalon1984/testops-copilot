/**
 * Jenkins Tools — Read-only wrappers for Phase 1
 *
 * - jenkins_get_status: Get the status and test results of a Jenkins pipeline
 * 
 * NOTE: Compatible with both production schema (enabled, lastRunAt, testRuns)
 * and dev schema (status, no testRuns relation).
 */

import { Tool, ToolResult, ToolContext } from './types';
import { logger } from '@/utils/logger';
import { prisma } from '@/lib/prisma';

export const jenkinsGetStatusTool: Tool = {
    name: 'jenkins_get_status',
    description: 'Get the current status and recent build results for a pipeline. Returns build status, duration, pass/fail counts, and timing information.',
    category: 'jenkins',
    requiresConfirmation: false,
    parameters: [
        {
            name: 'pipelineName',
            type: 'string',
            description: 'Name of the pipeline to check status for.',
            required: true,
        },
        {
            name: 'limit',
            type: 'number',
            description: 'Number of recent builds to return.',
            required: false,
            default: 3,
        },
    ],

    async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
        try {
            const pipelineName = args.pipelineName as string;
            const limit = (args.limit as number) || 3;

            // Query pipeline — use raw query approach for schema compatibility
            const pipeline = await prisma.pipeline.findFirst({
                where: {
                    name: { contains: pipelineName },
                },
            });

            if (!pipeline) {
                return {
                    success: true,
                    data: null,
                    summary: `No pipeline found matching "${pipelineName}".`,
                };
            }

            // Fetch test runs separately for schema compatibility
            let runs: any[] = [];
            try {
                runs = await (prisma.testRun as any).findMany({
                    where: { pipelineId: pipeline.id },
                    orderBy: { createdAt: 'desc' },
                    take: limit,
                });
            } catch {
                // testRun might not exist in simpler schemas
                logger.warn('[jenkins_get_status] Could not query test runs');
            }

            const mappedRuns = runs.map((run: any) => ({
                id: run.id,
                name: run.name,
                status: run.status,
                branch: run.branch,
                passed: run.passed,
                failed: run.failed,
                skipped: run.skipped,
                duration: run.duration,
                totalTests: run.totalTests,
                startedAt: run.startedAt || run.createdAt,
                completedAt: run.completedAt,
            }));

            // Use whatever fields are available on the pipeline model
            const pipelineData: Record<string, unknown> = {
                id: pipeline.id,
                name: pipeline.name,
                type: (pipeline as any).type,
            };
            // Add optional fields if they exist
            if ('enabled' in pipeline) pipelineData.enabled = (pipeline as any).enabled;
            if ('status' in pipeline) pipelineData.status = (pipeline as any).status;
            if ('lastRunAt' in pipeline) pipelineData.lastRunAt = (pipeline as any).lastRunAt;

            return {
                success: true,
                data: {
                    pipeline: pipelineData,
                    recentRuns: mappedRuns,
                },
                summary: `Pipeline "${pipeline.name}": ${mappedRuns.length} recent run(s). Latest: ${mappedRuns[0]?.status || 'no runs'}.`,
            };
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            logger.error(`[jenkins_get_status] Failed:`, error);
            return { success: false, error: msg, summary: `Failed to get pipeline status: ${msg}` };
        }
    },
};
