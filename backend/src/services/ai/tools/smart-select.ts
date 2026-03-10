/**
 * Smart Test Selection AI Tool — Read-only tool for ReAct loop
 *
 * Enables the AI Copilot to determine which tests should run
 * based on changed files. Users can ask questions like:
 * - "Which tests should I run for my current PR?"
 * - "What tests are affected by changes to auth.service.ts?"
 * - "Should I run all tests or just specific ones?"
 */

import { Tool, ToolResult, ToolContext } from './types';
import { testImpactService } from '@/services/test/TestImpactService';
import { logger } from '@/utils/logger';

export const smartTestSelectTool: Tool = {
  name: 'smart_test_select',
  description:
    'Determine which tests to run based on a list of changed files. Returns selected tests, selection strategy, confidence score, and estimated time savings. Use when the user asks about which tests to run for their changes, PR, or commit.',
  category: 'dashboard',
  requiresConfirmation: false,
  parameters: [
    {
      name: 'files',
      type: 'array',
      description:
        'List of changed file paths relative to project root (e.g., ["backend/src/services/auth.service.ts", "frontend/src/pages/Login.tsx"])',
      required: true,
    },
    {
      name: 'validateFileExistence',
      type: 'boolean',
      description:
        'If true, verify that mapped test files actually exist on disk. Default: false.',
      required: false,
      default: false,
    },
    {
      name: 'useCorrelation',
      type: 'boolean',
      description:
        'If true, use historical correlation analysis to find additional tests that tend to fail when these files change. Default: false.',
      required: false,
      default: false,
    },
    {
      name: 'excludeQuarantined',
      type: 'boolean',
      description:
        'If true, exclude quarantined (flaky) tests from the selection. Default: false.',
      required: false,
      default: false,
    },
  ],

  async execute(
    args: Record<string, unknown>,
    _context: ToolContext
  ): Promise<ToolResult> {
    try {
      const files = args.files as string[];

      if (!files || !Array.isArray(files) || files.length === 0) {
        return {
          success: false,
          error: 'No files provided. Please provide an array of changed file paths.',
          summary: 'No files provided for test selection.',
        };
      }

      const result = await testImpactService.getTestsForChanges(files, {
        validateFileExistence: (args.validateFileExistence as boolean) || false,
        useCorrelation: (args.useCorrelation as boolean) || false,
        excludeQuarantined: (args.excludeQuarantined as boolean) || false,
      });

      // Build a human-readable summary
      const isRunAll = result.selectedTests.includes('ALL');
      let summary: string;

      if (isRunAll) {
        summary = `Global configuration change detected — all ${result.totalTests} tests should run. ${result.reason}.`;
      } else if (result.selectedTests.length === 0) {
        summary = `No test-relevant changes detected in ${files.length} file(s). No tests need to run.`;
      } else {
        const testList = result.selectedTests.slice(0, 10).join(', ');
        const overflow =
          result.selectedTests.length > 10
            ? ` (and ${result.selectedTests.length - 10} more)`
            : '';
        summary = `${result.selectedTests.length} test(s) selected from ${files.length} changed file(s) (${result.selectionStrategy} strategy, ${Math.round(result.confidence * 100)}% confidence). Saving ~${result.savedTests} tests. Selected: ${testList}${overflow}`;
      }

      return {
        success: true,
        data: {
          selectedTests: result.selectedTests,
          totalTests: result.totalTests,
          savedTests: result.savedTests,
          selectionStrategy: result.selectionStrategy,
          confidence: result.confidence,
          reason: result.reason,
          details: result.details,
          metadata: result.metadata,
          // CI-friendly command suggestion
          ciCommand: isRunAll
            ? 'npm test'
            : result.selectedTests.length > 0
              ? `npx jest --testPathPatterns="${result.selectedTests.join('|')}"`
              : '# No tests to run',
        },
        summary,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[smart_test_select] Failed:', error);
      return {
        success: false,
        error: msg,
        summary: `Smart test selection failed: ${msg}`,
      };
    }
  },
};
