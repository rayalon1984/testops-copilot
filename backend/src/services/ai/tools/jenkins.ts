/**
 * Jenkins Tools — Read-only wrappers for Phase 1
 *
 * - jenkins_get_status: Get the status and test results of a Jenkins pipeline
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

            // Query the database for pipeline and its recent test runs
            const pipeline = await prisma.pipeline.findFirst({
                where: {
                    name: { contains: pipelineName, mode: 'insensitive' },
                },
                include: {
                    testRuns: {
                        orderBy: { createdAt: 'desc' },
                        take: limit,
                    },
                },
            });

            if (!pipeline) {
                return {
                    success: true,
                    data: null,
                    summary: `No pipeline found matching "${pipelineName}".`,
                };
            }

            // Map fields from Prisma schema: startedAt, completedAt, no error field
            const runs = pipeline.testRuns.map(run => ({
                id: run.id,
                name: run.name,
                status: run.status,
                branch: run.branch,
                passed: run.passed,
                failed: run.failed,
                skipped: run.skipped,
                flaky: run.flaky,
                duration: run.duration,
                totalTests: run.totalTests,
                startedAt: run.startedAt,
                completedAt: run.completedAt,
            }));

            return {
                success: true,
                data: {
                    pipeline: {
                        id: pipeline.id,
                        name: pipeline.name,
                        type: pipeline.type,
                        enabled: pipeline.enabled,
                        lastRunAt: pipeline.lastRunAt,
                    },
                    recentRuns: runs,
                },
                summary: `Pipeline "${pipeline.name}": ${runs.length} recent run(s). Latest: ${runs[0]?.status || 'no runs'}.`,
            };
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            logger.error(`[jenkins_get_status] Failed:`, error);
            return { success: false, error: msg, summary: `Failed to get pipeline status: ${msg}` };
        }
    },
};
