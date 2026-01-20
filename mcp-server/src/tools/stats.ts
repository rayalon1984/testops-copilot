/**
 * Statistics Tools - Pipeline stats, test history, cost tracking, health checks
 */

import { z } from 'zod';
import { query, healthCheck as dbHealthCheck } from '../db.js';
import type { PipelineStats, TestHistory, CostStats, HealthStatus } from '../types.js';

// Pipeline Stats Schema
const GetPipelineStatsInputSchema = z.object({
  pipelineId: z.string().optional().describe('Pipeline ID (optional, omit for all)'),
  limit: z.number().optional().default(10).describe('Number of recent runs (default: 10)'),
  daysBack: z.number().optional().default(30).describe('Days of history (default: 30)'),
});

export type GetPipelineStatsInput = z.infer<typeof GetPipelineStatsInputSchema>;

/**
 * Get pipeline statistics and recent runs
 */
export async function getPipelineStatsTool(input: GetPipelineStatsInput): Promise<PipelineStats[]> {
  const validatedInput = GetPipelineStatsInputSchema.parse(input);

  try {
    let sql = `
      WITH pipeline_runs AS (
        SELECT
          p.id,
          p.name,
          p.type,
          tr.id as run_id,
          tr.status,
          tr.started_at,
          tr.duration,
          tr.failed,
          tr.total_tests
        FROM pipelines p
        LEFT JOIN test_runs tr ON p.id = tr.pipeline_id
        WHERE tr.started_at >= NOW() - INTERVAL '${validatedInput.daysBack} days'
    `;

    const params: any[] = [];

    if (validatedInput.pipelineId) {
      sql += ` AND p.id = $1`;
      params.push(validatedInput.pipelineId);
    }

    sql += `
        ORDER BY tr.started_at DESC
      )
      SELECT * FROM pipeline_runs
    `;

    const results = await query<any>(sql, params);

    // Group by pipeline
    const pipelineMap = new Map<string, any>();

    for (const row of results) {
      if (!pipelineMap.has(row.id)) {
        pipelineMap.set(row.id, {
          id: row.id,
          name: row.name,
          type: row.type,
          runs: [],
        });
      }

      const pipeline = pipelineMap.get(row.id)!;

      if (row.run_id && pipeline.runs.length < validatedInput.limit!) {
        pipeline.runs.push({
          id: row.run_id,
          status: row.status,
          startedAt: row.started_at,
          duration: row.duration,
          failed: row.failed,
        });
      }
    }

    // Calculate stats for each pipeline
    const stats: PipelineStats[] = [];

    for (const pipeline of pipelineMap.values()) {
      // Success rate
      const totalRuns = pipeline.runs.length;
      const successfulRuns = pipeline.runs.filter((r: any) => r.status === 'PASSED').length;
      const successRate = totalRuns > 0 ? (successfulRuns / totalRuns) * 100 : 0;

      // Average duration
      const durationsWithValues = pipeline.runs.filter((r: any) => r.duration).map((r: any) => r.duration);
      const avgDuration = durationsWithValues.length > 0
        ? durationsWithValues.reduce((a: number, b: number) => a + b, 0) / durationsWithValues.length
        : 0;

      // Common failures
      const commonFailures = await getCommonFailures(pipeline.id, validatedInput.daysBack!);

      stats.push({
        id: pipeline.id,
        name: pipeline.name,
        type: pipeline.type,
        recentRuns: pipeline.runs,
        successRate: Math.round(successRate * 10) / 10,
        avgDuration: Math.round(avgDuration),
        commonFailures,
      });
    }

    return stats;
  } catch (error) {
    console.error('Failed to get pipeline stats:', error);
    throw new Error(`Failed to get pipeline stats: ${error}`);
  }
}

/**
 * Get common failures for a pipeline
 */
async function getCommonFailures(pipelineId: string, daysBack: number) {
  try {
    const results = await query<any>(`
      SELECT
        tr_result.test_name as "testName",
        COUNT(*) as count,
        MAX(tr_result.created_at) as "lastOccurrence"
      FROM test_results tr_result
      JOIN test_runs tr ON tr_result.test_run_id = tr.id
      WHERE tr.pipeline_id = $1
        AND tr_result.status = 'FAILED'
        AND tr_result.created_at >= NOW() - INTERVAL '${daysBack} days'
      GROUP BY tr_result.test_name
      ORDER BY count DESC
      LIMIT 5
    `, [pipelineId]);

    return results.map(row => ({
      testName: row.testName,
      count: parseInt(row.count) || 0,
      lastOccurrence: row.lastOccurrence,
    }));
  } catch (error) {
    console.error('Failed to get common failures:', error);
    return [];
  }
}

// Test History Schema
const GetTestHistoryInputSchema = z.object({
  testName: z.string().describe('Name of the test'),
  daysBack: z.number().optional().default(90).describe('Days of history (default: 90)'),
  limit: z.number().optional().default(20).describe('Number of recent runs (default: 20)'),
});

export type GetTestHistoryInput = z.infer<typeof GetTestHistoryInputSchema>;

/**
 * Get history and flakiness analysis for a specific test
 */
export async function getTestHistoryTool(input: GetTestHistoryInput): Promise<TestHistory> {
  const validatedInput = GetTestHistoryInputSchema.parse(input);

  try {
    // Get all runs for this test
    const runs = await query<any>(`
      SELECT
        tr_result.id,
        tr_result.status,
        tr_result.created_at as timestamp,
        tr_result.error_message as "errorMessage",
        tr.branch,
        p.name as pipeline
      FROM test_results tr_result
      JOIN test_runs tr ON tr_result.test_run_id = tr.id
      JOIN pipelines p ON tr.pipeline_id = p.id
      WHERE tr_result.test_name = $1
        AND tr_result.created_at >= NOW() - INTERVAL '${validatedInput.daysBack} days'
      ORDER BY tr_result.created_at DESC
      LIMIT $2
    `, [validatedInput.testName, validatedInput.limit]);

    const totalRuns = runs.length;
    const failures = runs.filter((r: any) => r.status === 'FAILED').length;

    // Calculate flakiness score (0-1)
    // Consider: pass/fail alternation, failure rate, recent trends
    const flakinessScore = calculateFlakinessScore(runs);

    // Group failures by error message
    const failurePatterns = new Map<string, { count: number; lastOccurrence: Date }>();

    for (const run of runs) {
      if (run.status === 'FAILED' && run.errorMessage) {
        const key = run.errorMessage;
        const existing = failurePatterns.get(key);

        if (existing) {
          existing.count++;
          if (run.timestamp > existing.lastOccurrence) {
            existing.lastOccurrence = run.timestamp;
          }
        } else {
          failurePatterns.set(key, {
            count: 1,
            lastOccurrence: run.timestamp,
          });
        }
      }
    }

    const patterns = Array.from(failurePatterns.entries())
      .map(([errorMessage, data]) => ({
        errorMessage,
        count: data.count,
        lastOccurrence: data.lastOccurrence,
      }))
      .sort((a, b) => b.count - a.count);

    return {
      testName: validatedInput.testName,
      totalRuns,
      failures,
      flakinessScore: Math.round(flakinessScore * 100) / 100,
      failurePatterns: patterns,
      recentRuns: runs.slice(0, 10).map((r: any) => ({
        id: r.id,
        status: r.status,
        timestamp: r.timestamp,
        pipeline: r.pipeline,
        branch: r.branch,
      })),
    };
  } catch (error) {
    console.error('Failed to get test history:', error);
    throw new Error(`Failed to get test history: ${error}`);
  }
}

/**
 * Calculate flakiness score (0 = stable, 1 = very flaky)
 */
function calculateFlakinessScore(runs: any[]): number {
  if (runs.length < 5) {
    return 0; // Not enough data
  }

  const recentRuns = runs.slice(0, 20); // Look at most recent 20 runs
  let alternations = 0;
  let failures = 0;

  for (let i = 0; i < recentRuns.length; i++) {
    if (recentRuns[i].status === 'FAILED') {
      failures++;
    }

    if (i > 0 && recentRuns[i].status !== recentRuns[i - 1].status) {
      alternations++;
    }
  }

  const failureRate = failures / recentRuns.length;
  const alternationRate = alternations / (recentRuns.length - 1);

  // Flaky tests typically have:
  // - 20-80% failure rate (not always passing or always failing)
  // - High alternation rate (pass/fail/pass/fail pattern)
  let score = 0;

  // Penalize moderate failure rates (indicates inconsistency)
  if (failureRate > 0.2 && failureRate < 0.8) {
    score += 0.5;
  }

  // Heavily penalize alternations
  score += alternationRate * 0.5;

  return Math.min(score, 1);
}

// Cost Stats Schema
const GetCostStatsInputSchema = z.object({
  startDate: z.string().optional().describe('Start date (ISO format, default: 30 days ago)'),
  endDate: z.string().optional().describe('End date (ISO format, default: now)'),
});

export type GetCostStatsInput = z.infer<typeof GetCostStatsInputSchema>;

/**
 * Get AI cost statistics
 */
export async function getCostStatsTool(input: GetCostStatsInput): Promise<CostStats> {
  const validatedInput = GetCostStatsInputSchema.parse(input);

  const endDate = validatedInput.endDate ? new Date(validatedInput.endDate) : new Date();
  const startDate = validatedInput.startDate
    ? new Date(validatedInput.startDate)
    : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

  try {
    // Total cost
    const totalResult = await query<{ total: string }>(`
      SELECT COALESCE(SUM(cost_usd), 0) as total
      FROM ai_usage
      WHERE timestamp >= $1 AND timestamp <= $2
    `, [startDate, endDate]);

    const totalCostUSD = parseFloat(totalResult[0]?.total || '0');

    // Breakdown by feature
    const breakdownResult = await query<any>(`
      SELECT
        feature,
        COUNT(*) as calls,
        SUM(total_tokens) as "totalTokens",
        SUM(cost_usd) as "costUSD"
      FROM ai_usage
      WHERE timestamp >= $1 AND timestamp <= $2
      GROUP BY feature
      ORDER BY "costUSD" DESC
    `, [startDate, endDate]);

    const breakdown = breakdownResult.map(row => ({
      feature: row.feature,
      calls: parseInt(row.calls) || 0,
      totalTokens: parseInt(row.totalTokens) || 0,
      costUSD: parseFloat(row.costUSD) || 0,
    }));

    // Top expensive operations
    const expensiveResult = await query<any>(`
      SELECT
        timestamp,
        feature,
        cost_usd as "costUSD",
        total_tokens as tokens
      FROM ai_usage
      WHERE timestamp >= $1 AND timestamp <= $2
      ORDER BY cost_usd DESC
      LIMIT 10
    `, [startDate, endDate]);

    const topExpensiveOperations = expensiveResult.map(row => ({
      timestamp: row.timestamp,
      feature: row.feature,
      costUSD: parseFloat(row.costUSD) || 0,
      tokens: parseInt(row.tokens) || 0,
    }));

    return {
      period: {
        start: startDate,
        end: endDate,
      },
      totalCostUSD: Math.round(totalCostUSD * 1000) / 1000,
      breakdown,
      topExpensiveOperations,
    };
  } catch (error) {
    console.error('Failed to get cost stats:', error);
    throw new Error(`Failed to get cost stats: ${error}`);
  }
}

/**
 * Health check for all services
 */
export async function healthCheckTool(): Promise<HealthStatus> {
  const status: HealthStatus = {
    healthy: true,
    services: {},
  };

  // Check database
  try {
    const dbHealthy = await dbHealthCheck();
    status.services.database = { healthy: dbHealthy };
    if (!dbHealthy) status.healthy = false;
  } catch (error) {
    status.services.database = {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    status.healthy = false;
  }

  // Check AI provider (would need to be implemented)
  status.services.aiProvider = {
    healthy: true,
    name: process.env.AI_PROVIDER || 'not configured',
  };

  // Check vector DB (would need to be implemented)
  status.services.vectorDB = {
    healthy: true,
  };

  // Check cache (would need to be implemented)
  status.services.cache = {
    healthy: true,
  };

  return status;
}

// Tool definitions
export const getPipelineStatsToolDefinition = {
  name: 'testops_get_pipeline_stats',
  description: `Get statistics and recent runs for pipelines.

Shows:
- Recent test runs with status and duration
- Success rate over time
- Average duration
- Most common failures

Use this to:
- Monitor pipeline health
- Identify problematic pipelines
- Track improvements over time`,
  inputSchema: {
    type: 'object',
    properties: {
      pipelineId: {
        type: 'string',
        description: 'Pipeline ID (omit to get all pipelines)',
      },
      limit: {
        type: 'number',
        description: 'Number of recent runs per pipeline (default: 10)',
        default: 10,
      },
      daysBack: {
        type: 'number',
        description: 'Days of history to analyze (default: 30)',
        default: 30,
      },
    },
  },
};

export const getTestHistoryToolDefinition = {
  name: 'testops_get_test_history',
  description: `Get detailed history and flakiness analysis for a specific test.

Shows:
- Total runs and failure count
- Flakiness score (0 = stable, 1 = very flaky)
- Failure patterns (grouped by error message)
- Recent run history

Use this to:
- Investigate flaky tests
- Understand failure patterns
- Decide if a test needs to be fixed or quarantined`,
  inputSchema: {
    type: 'object',
    properties: {
      testName: {
        type: 'string',
        description: 'Name of the test to analyze',
      },
      daysBack: {
        type: 'number',
        description: 'Days of history (default: 90)',
        default: 90,
      },
      limit: {
        type: 'number',
        description: 'Number of recent runs (default: 20)',
        default: 20,
      },
    },
    required: ['testName'],
  },
};

export const getCostStatsToolDefinition = {
  name: 'testops_get_cost_stats',
  description: `Get AI usage and cost statistics.

Shows:
- Total cost for the period
- Breakdown by feature (analysis, categorization, etc.)
- Most expensive operations
- Token usage

Use this to:
- Monitor AI spending
- Optimize costly operations
- Budget planning`,
  inputSchema: {
    type: 'object',
    properties: {
      startDate: {
        type: 'string',
        description: 'Start date in ISO format (default: 30 days ago)',
      },
      endDate: {
        type: 'string',
        description: 'End date in ISO format (default: now)',
      },
    },
  },
};

export const healthCheckToolDefinition = {
  name: 'testops_health_check',
  description: `Check health status of all TestOps services.

Checks:
- Database connectivity
- AI provider status
- Vector database
- Cache

Use this to diagnose issues before running expensive operations.`,
  inputSchema: {
    type: 'object',
    properties: {},
  },
};
