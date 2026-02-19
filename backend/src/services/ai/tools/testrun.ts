/**
 * TestRun Tools — Phase 3
 *
 * - testrun_cancel: Cancel a pending or running test run (requires confirmation)
 * - testrun_retry: Retry a failed/skipped/flaky test run (requires confirmation)
 *
 * Delegates to TestRunService.cancelTestRun() and TestRunService.retryTestRun().
 */

import { Tool, ToolResult, ToolContext } from './types';
import { TestRunService } from '@/services/testRun.service';
import { logger } from '@/utils/logger';

const testRunService = new TestRunService();

export const testrunCancelTool: Tool = {
    name: 'testrun_cancel',
    description: 'Cancel a pending or running test run. Only works on runs in PENDING or RUNNING status. REQUIRES USER CONFIRMATION.',
    category: 'jenkins',
    requiresConfirmation: true,
    requiredRole: 'EDITOR',
    parameters: [
        {
            name: 'testRunId',
            type: 'string',
            description: 'The ID of the test run to cancel.',
            required: true,
        },
    ],

    async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
        try {
            const testRunId = args.testRunId as string;
            const cancelled = await testRunService.cancelTestRun(testRunId, context.userId);

            return {
                success: true,
                data: {
                    testRunId: cancelled.id,
                    name: cancelled.name,
                    status: cancelled.status,
                    pipelineId: cancelled.pipelineId,
                },
                summary: `Cancelled test run "${cancelled.name}" (${cancelled.id}).`,
            };
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            logger.error(`[testrun_cancel] Failed:`, error);
            return { success: false, error: msg, summary: `Failed to cancel test run: ${msg}` };
        }
    },
};

export const testrunRetryTool: Tool = {
    name: 'testrun_retry',
    description: 'Retry a failed, skipped, or flaky test run. Creates a new test run with the same configuration. REQUIRES USER CONFIRMATION.',
    category: 'jenkins',
    requiresConfirmation: true,
    requiredRole: 'EDITOR',
    parameters: [
        {
            name: 'testRunId',
            type: 'string',
            description: 'The ID of the test run to retry.',
            required: true,
        },
    ],

    async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
        try {
            const testRunId = args.testRunId as string;
            const newRun = await testRunService.retryTestRun(testRunId, context.userId);

            return {
                success: true,
                data: {
                    originalTestRunId: testRunId,
                    newTestRunId: newRun.id,
                    name: newRun.name,
                    status: newRun.status,
                    branch: newRun.branch,
                    pipelineId: newRun.pipelineId,
                },
                summary: `Retried test run. New run: "${newRun.name}" (${newRun.id}) on branch "${newRun.branch}".`,
            };
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            logger.error(`[testrun_retry] Failed:`, error);
            return { success: false, error: msg, summary: `Failed to retry test run: ${msg}` };
        }
    },
};
