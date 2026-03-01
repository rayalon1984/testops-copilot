/**
 * RCA Identify Tool — Root Cause Analysis for test failures.
 *
 * Read-only tool (no confirmation). In demo/mock mode, returns
 * structured root cause data that renders as a RootCauseCard.
 */

import { Tool, ToolResult, ToolContext } from './types';
import { logger } from '@/utils/logger';

export const rcaIdentifyTool: Tool = {
    name: 'rca_identify',
    description: 'Identify the root cause of a test failure. Returns structured analysis with root cause, confidence, and related issues. Use when the user asks to analyze, investigate, or explain a failure.',
    category: 'dashboard',
    requiresConfirmation: false,
    parameters: [
        {
            name: 'testName',
            type: 'string',
            description: 'Name of the failing test to analyze',
            required: false,
        },
        {
            name: 'runId',
            type: 'string',
            description: 'Specific test run ID to analyze',
            required: false,
        },
    ],

    async execute(args: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
        try {
            const testName = (args.testName as string) || 'Unknown test';

            // In production, this would call the real analysis service.
            // Mock mode is handled by getMockToolResult() in mock-tool-results.ts.
            return {
                success: true,
                summary: 'Root Cause Identified',
                data: {
                    title: 'Root Cause Identified',
                    rootCause: `Analysis pending for ${testName}. Connect a real AI provider for live analysis.`,
                    testName,
                    confidence: 0,
                    category: 'unknown',
                },
            };
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            logger.error('[rca_identify] Failed:', error);
            return { success: false, error: msg, summary: `Root cause analysis failed: ${msg}` };
        }
    },
};
