/**
 * Batch Analysis Tool - Analyze multiple failures from a CI run
 */

import { z } from 'zod';
import { query } from '../db.js';
import { analyzeTool, AnalyzeInput } from './analyze.js';
import type { TestFailure, BatchAnalysisResult } from '../types.js';

const BatchAnalyzeInputSchema = z.object({
  testRunId: z.string().optional().describe('TestOps test run ID to analyze'),
  failures: z.array(z.object({
    testName: z.string(),
    errorMessage: z.string(),
    stackTrace: z.string().optional(),
    logs: z.string().optional(),
  })).optional().describe('Array of failures to analyze'),
  maxFailures: z.number().optional().default(20).describe('Maximum failures to analyze (default: 20)'),
  priorityThreshold: z.number().optional().default(0.7).describe('Confidence threshold for high priority (default: 0.7)'),
});

export type BatchAnalyzeInput = z.infer<typeof BatchAnalyzeInputSchema>;

/**
 * Batch analyze multiple failures from a test run
 *
 * This tool is optimized for CI/CD scenarios where multiple tests fail.
 * It provides:
 * 1. Overall summary of all failures
 * 2. Pattern detection (common root causes)
 * 3. Priority ranking (which to fix first)
 * 4. Cost-optimized batching
 *
 * Cost: ~$0.05-0.30 depending on number and complexity of failures
 */
export async function batchAnalyzeTool(input: BatchAnalyzeInput): Promise<BatchAnalysisResult> {
  process.stderr.write('[batch] Starting batch analysis...\n');

  const validatedInput = BatchAnalyzeInputSchema.parse(input);

  let failures: TestFailure[] = [];

  // Option 1: Load from test run
  if (validatedInput.testRunId) {
    failures = await loadFailuresFromTestRun(validatedInput.testRunId);
  }
  // Option 2: Use provided failures
  else if (validatedInput.failures && validatedInput.failures.length > 0) {
    failures = validatedInput.failures.map(f => ({
      ...f,
      timestamp: new Date(),
    }));
  } else {
    throw new Error('Either testRunId or failures array must be provided');
  }

  // Limit number of failures
  if (failures.length > validatedInput.maxFailures!) {
    process.stderr.write(`[batch] Limiting analysis to ${validatedInput.maxFailures} failures (out of ${failures.length})\n`);
    failures = failures.slice(0, validatedInput.maxFailures);
  }

  // Analyze each failure
  process.stderr.write(`[batch] Analyzing ${failures.length} failures...\n`);

  const analyses = [];
  let totalCost = 0;

  for (const failure of failures) {
    try {
      // Skip logs for batch analysis to save cost
      const input: AnalyzeInput = {
        testName: failure.testName,
        errorMessage: failure.errorMessage,
        stackTrace: failure.stackTrace,
        // Don't include logs in batch analysis to save cost
      };

      const analysis = await analyzeTool(input);
      analyses.push({
        failure,
        analysis,
      });

      totalCost += analysis.estimatedCostUSD;
    } catch (error) {
      process.stderr.write(`[batch] Failed to analyze ${failure.testName}: ${error instanceof Error ? error.message : String(error)}\n`);
    }
  }

  // Detect patterns
  const patterns = detectPatterns(analyses);

  // Prioritize failures
  const priorities = prioritizeFailures(analyses, validatedInput.priorityThreshold!);

  // Generate summary
  const summary = generateSummary(analyses, patterns);

  return {
    totalFailures: failures.length,
    analyzedFailures: analyses.length,
    summary,
    patterns,
    priorities,
    estimatedTotalCostUSD: Math.round(totalCost * 1000) / 1000,
  };
}

/**
 * Load failures from a test run
 */
async function loadFailuresFromTestRun(testRunId: string): Promise<TestFailure[]> {
  try {
    interface TestRunFailureRow {
      testName: string;
      errorMessage: string;
      stackTrace: string | null;
      logs: string | null;
      branch: string;
      pipeline: string;
    }

    const results = await query<TestRunFailureRow>(`
      SELECT
        tr.name as "testName",
        tr.error_message as "errorMessage",
        tr.stack_trace as "stackTrace",
        tr.logs,
        run.branch,
        p.name as pipeline
      FROM test_results tr
      JOIN test_runs run ON tr.test_run_id = run.id
      JOIN pipelines p ON run.pipeline_id = p.id
      WHERE run.id = $1
        AND tr.status = 'FAILED'
      ORDER BY tr.created_at DESC
    `, [testRunId]);

    return results.map(row => ({
      testName: row.testName,
      errorMessage: row.errorMessage,
      stackTrace: row.stackTrace ?? undefined,
      logs: row.logs ?? undefined,
      pipeline: row.pipeline,
      branch: row.branch,
      timestamp: new Date(),
    }));
  } catch (error) {
    process.stderr.write(`[batch] Failed to load test run: ${error instanceof Error ? error.message : String(error)}\n`);
    throw new Error(`Failed to load test run ${testRunId}: ${error}`);
  }
}

/**
 * Detect common patterns across failures
 */
interface AnalysisEntry {
  failure: TestFailure;
  analysis: import('../types.js').AnalysisResult;
}

function detectPatterns(analyses: AnalysisEntry[]) {
  const categoryMap = new Map<string, { count: number; examples: string[] }>();

  for (const { failure, analysis } of analyses) {
    const category = analysis.categorization.category;

    if (!categoryMap.has(category)) {
      categoryMap.set(category, { count: 0, examples: [] });
    }

    const entry = categoryMap.get(category)!;
    entry.count++;

    if (entry.examples.length < 3) {
      entry.examples.push(failure.testName);
    }
  }

  return Array.from(categoryMap.entries())
    .map(([category, data]) => ({
      category,
      count: data.count,
      examples: data.examples,
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Prioritize failures based on severity and patterns
 */
function prioritizeFailures(analyses: AnalysisEntry[], threshold: number) {
  const high: TestFailure[] = [];
  const medium: TestFailure[] = [];
  const low: TestFailure[] = [];

  for (const { failure, analysis } of analyses) {
    const confidence = analysis.categorization.confidence;
    const category = analysis.categorization.category;

    // High priority: infrastructure issues, timeouts, high confidence bugs
    if (
      category === 'INFRASTRUCTURE_ISSUE' ||
      category === 'TIMEOUT' ||
      (category === 'APPLICATION_BUG' && confidence >= threshold)
    ) {
      high.push(failure);
    }
    // Low priority: flaky tests, low confidence issues
    else if (category === 'FLAKY_TEST' || confidence < 0.5) {
      low.push(failure);
    }
    // Medium: everything else
    else {
      medium.push(failure);
    }
  }

  return { high, medium, low };
}

/**
 * Generate human-readable summary
 */
function generateSummary(analyses: AnalysisEntry[], patterns: { category: string; count: number; examples: string[] }[]): string {
  const total = analyses.length;

  if (total === 0) {
    return 'No failures to analyze.';
  }

  const topPattern = patterns[0];
  const multiplePatterns = patterns.length > 1;

  let summary = `Analyzed ${total} test failure${total > 1 ? 's' : ''}. `;

  if (topPattern) {
    summary += `Most common issue: ${topPattern.category} (${topPattern.count} occurrence${topPattern.count > 1 ? 's' : ''}). `;
  }

  if (multiplePatterns) {
    summary += `Found ${patterns.length} distinct failure patterns. `;
  }

  // Check for infrastructure issues
  const infraFailures = patterns.find(p => p.category === 'INFRASTRUCTURE_ISSUE');
  if (infraFailures) {
    summary += `⚠️  Infrastructure issues detected affecting ${infraFailures.count} tests. `;
  }

  // Check for flaky tests
  const flakyTests = patterns.find(p => p.category === 'FLAKY_TEST');
  if (flakyTests) {
    summary += `${flakyTests.count} potential flaky test${flakyTests.count > 1 ? 's' : ''} identified. `;
  }

  return summary.trim();
}

export const batchAnalyzeToolDefinition = {
  name: 'testops_batch_analyze',
  description: `Analyze multiple test failures from a CI run in one go.

This tool is optimized for scenarios where multiple tests fail in a CI run.
It's more cost-effective than analyzing each failure individually because it:
- Skips detailed log analysis to save tokens
- Detects common patterns across failures
- Prioritizes which failures to investigate first
- Provides a high-level summary

Use cases:
- After a failed CI run, analyze all failures at once
- Detect if multiple failures share a common root cause
- Prioritize which failures to fix first
- Get quick overview of test health

You can either:
1. Provide a TestOps test run ID (it will load failures automatically)
2. Provide an array of failures directly

Cost: ~$0.05-0.30 depending on number of failures (much cheaper than individual analysis)`,
  inputSchema: {
    type: 'object',
    properties: {
      testRunId: {
        type: 'string',
        description: 'TestOps test run ID to analyze all failures from',
      },
      failures: {
        type: 'array',
        description: 'Array of failures to analyze (alternative to testRunId)',
        items: {
          type: 'object',
          properties: {
            testName: { type: 'string' },
            errorMessage: { type: 'string' },
            stackTrace: { type: 'string' },
            logs: { type: 'string' },
          },
          required: ['testName', 'errorMessage'],
        },
      },
      maxFailures: {
        type: 'number',
        description: 'Maximum number of failures to analyze (default: 20)',
        default: 20,
      },
      priorityThreshold: {
        type: 'number',
        description: 'Confidence threshold for high priority classification (default: 0.7)',
        default: 0.7,
      },
    },
  },
};
