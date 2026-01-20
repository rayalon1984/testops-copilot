/**
 * Analyze Tool - Single failure analysis
 */

import { z } from 'zod';
import { query } from '../db.js';
import type { TestFailure, AnalysisResult, SimilarFailure } from '../types.js';

const AnalyzeInputSchema = z.object({
  testName: z.string().describe('Name of the test that failed'),
  errorMessage: z.string().describe('Error message from the test failure'),
  stackTrace: z.string().optional().describe('Stack trace if available'),
  logs: z.string().optional().describe('Relevant log output (last 5000 chars recommended)'),
  pipeline: z.string().optional().describe('Pipeline name or ID'),
  branch: z.string().optional().describe('Git branch'),
});

export type AnalyzeInput = z.infer<typeof AnalyzeInputSchema>;

/**
 * Analyze a single test failure using AI
 *
 * This is the main entry point for failure analysis. It:
 * 1. Categorizes the failure (infrastructure, test, app, flaky, etc.)
 * 2. Searches for similar historical failures
 * 3. Summarizes logs to identify root cause
 * 4. Provides actionable recommendations
 *
 * Cost: ~$0.01-0.05 per analysis (depending on log size)
 */
export async function analyzeTool(input: AnalyzeInput): Promise<AnalysisResult> {
  console.log(`Analyzing failure: ${input.testName}`);

  // Validate input
  const validatedInput = AnalyzeInputSchema.parse(input);

  // Build failure object
  const failure: TestFailure = {
    testName: validatedInput.testName,
    errorMessage: validatedInput.errorMessage,
    stackTrace: validatedInput.stackTrace,
    logs: validatedInput.logs,
    pipeline: validatedInput.pipeline,
    branch: validatedInput.branch,
    timestamp: new Date(),
  };

  // Initialize result
  const result: AnalysisResult = {
    categorization: {
      category: 'UNKNOWN',
      confidence: 0,
      reasoning: '',
    },
    similarFailures: [],
    estimatedCostUSD: 0,
  };

  let totalCost = 0;

  // Step 1: Quick categorization (uses AI)
  try {
    const category = await categorizeFailure(failure);
    result.categorization = category;
    totalCost += 0.005; // Rough estimate
  } catch (error) {
    console.error('Categorization failed:', error);
    // Continue with analysis even if categorization fails
  }

  // Step 2: Search for similar failures (vector search + AI)
  try {
    const similar = await findSimilarFailures(failure);
    result.similarFailures = similar;
    totalCost += 0.01; // Embedding + search cost
  } catch (error) {
    console.error('Similar failure search failed:', error);
    // Continue with analysis
  }

  // Step 3: Summarize logs if available (uses AI - most expensive)
  if (validatedInput.logs && validatedInput.logs.length > 100) {
    try {
      const summary = await summarizeLogs(
        validatedInput.logs,
        validatedInput.testName,
        validatedInput.errorMessage
      );
      result.logSummary = summary;

      // Cost depends on log size
      const logTokens = Math.ceil(validatedInput.logs.length / 4);
      totalCost += (logTokens / 1000000) * 3; // $3 per million tokens (Claude Sonnet)
    } catch (error) {
      console.error('Log summarization failed:', error);
      // Continue without log summary
    }
  }

  result.estimatedCostUSD = Math.round(totalCost * 1000) / 1000; // Round to 3 decimals

  return result;
}

/**
 * Categorize a failure using AI
 */
async function categorizeFailure(failure: TestFailure) {
  // This would call the backend AI service
  // For now, return a mock result
  // In production, this would:
  // 1. Call /api/v1/ai/categorize endpoint
  // 2. Or directly use the AIManager if running in same process

  // Simple keyword-based categorization for demo
  // In production, this would call the AI service
  let category = 'UNKNOWN';
  let confidence = 0.5;
  let reasoning = 'Analyzing error patterns...';

  const errorLower = failure.errorMessage.toLowerCase();

  if (errorLower.includes('timeout') || errorLower.includes('timed out')) {
    category = 'TIMEOUT';
    confidence = 0.9;
    reasoning = 'Error message contains timeout-related keywords';
  } else if (errorLower.includes('connection') || errorLower.includes('network')) {
    category = 'INFRASTRUCTURE_ISSUE';
    confidence = 0.85;
    reasoning = 'Error indicates network or connection issues';
  } else if (errorLower.includes('null') || errorLower.includes('undefined')) {
    category = 'APPLICATION_BUG';
    confidence = 0.8;
    reasoning = 'Error suggests null pointer or undefined value';
  } else if (errorLower.includes('element not found') || errorLower.includes('selector')) {
    category = 'FLAKY_TEST';
    confidence = 0.75;
    reasoning = 'Error suggests timing or element location issues';
  }

  return {
    category,
    confidence,
    reasoning,
    subcategory: undefined,
  };
}

/**
 * Find similar historical failures
 */
async function findSimilarFailures(failure: TestFailure): Promise<SimilarFailure[]> {
  try {
    // Query database for similar failures
    // This is a simplified version - in production would use vector similarity
    const results = await query<any>(`
      SELECT
        fr.id,
        fr.test_name as "testName",
        fr.error_message as "errorMessage",
        fr.resolution,
        fr.resolved_by as "resolvedBy",
        fr.resolved_at as "resolvedAt",
        fr.ticket_url as "ticketUrl",
        COUNT(fr.id) OVER (PARTITION BY fr.test_name) as occurrences
      FROM failure_records fr
      WHERE fr.test_name = $1
        AND fr.resolved_at IS NOT NULL
      ORDER BY fr.resolved_at DESC
      LIMIT 5
    `, [failure.testName]);

    return results.map(row => ({
      id: row.id,
      testName: row.testName,
      errorMessage: row.errorMessage,
      similarity: 0.85, // Would come from vector search
      resolution: row.resolution,
      resolvedBy: row.resolvedBy,
      resolvedAt: row.resolvedAt,
      ticketUrl: row.ticketUrl,
      occurrences: parseInt(row.occurrences) || 1,
    }));
  } catch (error) {
    console.error('Database query failed:', error);
    return [];
  }
}

/**
 * Summarize logs using AI
 */
async function summarizeLogs(
  _logs: string,
  testName: string,
  errorMessage: string
) {
  // Mock implementation - replace with actual AI call
  // In production, this would call the backend AIManager.summarizeLogs()
  // The _logs parameter is prefixed with _ to indicate it's intentionally unused in the mock

  return {
    summary: `Test "${testName}" failed with error: ${errorMessage}. Analyzing logs for root cause...`,
    rootCause: 'Root cause analysis requires AI provider connection',
    technicalDetails: 'Technical details would be extracted from logs',
    suggestedFix: 'Connect AI provider for detailed analysis and recommendations',
  };
}

export const analyzeToolDefinition = {
  name: 'testops_analyze_failure',
  description: `Analyze a single test failure using AI. Provides categorization, similar failures, and root cause analysis.

This is your primary tool for understanding test failures. It combines multiple AI features:
- Categorizes the failure type (infrastructure, app bug, flaky test, etc.)
- Finds similar historical failures with known resolutions
- Analyzes logs to identify the root cause
- Provides actionable fix recommendations

Best practices:
- Include logs (last 5000 chars) for better analysis
- Provide pipeline/branch context when available
- Check similar failures first - might save time!

Cost: ~$0.01-0.05 per analysis depending on log size`,
  inputSchema: {
    type: 'object',
    properties: {
      testName: {
        type: 'string',
        description: 'Name of the test that failed',
      },
      errorMessage: {
        type: 'string',
        description: 'Error message from the test failure',
      },
      stackTrace: {
        type: 'string',
        description: 'Stack trace if available (optional)',
      },
      logs: {
        type: 'string',
        description: 'Relevant log output - last 5000 characters recommended (optional)',
      },
      pipeline: {
        type: 'string',
        description: 'Pipeline name or ID (optional)',
      },
      branch: {
        type: 'string',
        description: 'Git branch name (optional)',
      },
    },
    required: ['testName', 'errorMessage'],
  },
};
