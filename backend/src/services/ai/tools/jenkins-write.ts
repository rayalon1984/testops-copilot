/**
 * Jenkins Write Tools — Phase 3
 *
 * - jenkins_trigger_build: Trigger a new pipeline build (requires confirmation)
 */

import { Tool, ToolResult, ToolContext } from './types';
import { prisma } from '@/lib/prisma';
import { logger } from '@/utils/logger';

export const jenkinsTriggerBuildTool: Tool = {
    name: 'jenkins_trigger_build',
    description: 'Trigger a new build for a Jenkins or GitHub Actions pipeline. Creates a new test run in PENDING state. REQUIRES USER CONFIRMATION.',
    category: 'jenkins',
    requiresConfirmation: true,
    requiredRole: 'EDITOR',
    parameters: [
        {
            name: 'pipelineName',
            type: 'string',
            description: 'Name of the pipeline to trigger.',
            required: true,
        },
        {
            name: 'branch',
            type: 'string',
            description: 'Branch to build. Defaults to "main".',
            required: false,
            default: 'main',
        },
    ],

    async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
        try {
            const pipelineName = args.pipelineName as string;
            const branch = (args.branch as string) || 'main';

            const pipeline = await prisma.pipeline.findFirst({
                where: { name: { contains: pipelineName } },
            });

            if (!pipeline) {
                return {
                    success: false,
                    error: `No pipeline found matching "${pipelineName}".`,
                    summary: `Pipeline "${pipelineName}" not found.`,
                };
            }

            // Create a new test run in PENDING state
            const testRun = await prisma.testRun.create({
                data: {
                    pipelineId: pipeline.id,
                    userId: context.userId,
                    name: `Build #${Date.now().toString(36)}`,
                    status: 'PENDING',
                    branch,
                    startedAt: new Date(),
                },
            });

            return {
                success: true,
                data: {
                    testRunId: testRun.id,
                    pipelineId: pipeline.id,
                    pipelineName: pipeline.name,
                    branch,
                    status: 'PENDING',
                },
                summary: `Triggered build for "${pipeline.name}" on branch "${branch}". Test run: ${testRun.id}`,
            };
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            logger.error(`[jenkins_trigger_build] Failed:`, error);
            return { success: false, error: msg, summary: `Failed to trigger build: ${msg}` };
        }
    },
};
