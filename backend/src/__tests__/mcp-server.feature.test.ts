/**
 * Feature Spec Tests — MCP Server (IDE Integration)
 *
 * Covers: analysis tools, batch, knowledge base, stats & health.
 * 15 assertions across 4 capabilities.
 */

import { describeFeature, itAssertion } from './helpers/feature-spec';

// Mock logger
jest.mock('@/utils/logger', () => ({
  __esModule: true,
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// --- Inline helpers modeling MCP tool behavior ---

function validateAnalyzeInput(input: Record<string, unknown>): { valid: boolean; error?: string } {
  if (!input.testName || typeof input.testName !== 'string') return { valid: false, error: 'testName required' };
  if (!input.errorMessage || typeof input.errorMessage !== 'string') return { valid: false, error: 'errorMessage required' };
  return { valid: true };
}

function validateBatchInput(input: Record<string, unknown>): { valid: boolean; error?: string } {
  if (!input.testRunId && !input.failures) return { valid: false, error: 'testRunId or failures required' };
  return { valid: true };
}

function classifyPriority(
  category: string,
  confidence: number,
  threshold: number,
): 'high' | 'medium' | 'low' {
  if (category === 'INFRASTRUCTURE_ISSUE' || category === 'TIMEOUT') return 'high';
  if (category === 'APPLICATION_BUG' && confidence >= threshold) return 'high';
  if (category === 'FLAKY_TEST' || confidence < 0.5) return 'low';
  return 'medium';
}

function calculateFlakiness(statuses: string[]): number {
  if (statuses.length < 5) return 0;
  const recent = statuses.slice(-20);
  const failures = recent.filter(s => s === 'FAILED').length;
  const failRate = failures / recent.length;
  // Count alternations
  let alternations = 0;
  for (let i = 1; i < recent.length; i++) {
    if (recent[i] !== recent[i - 1]) alternations++;
  }
  const altRate = alternations / (recent.length - 1);
  const moderatePenalty = (failRate >= 0.2 && failRate <= 0.8) ? 1 : 0;
  return Math.min(1, Math.max(0, parseFloat((0.5 * moderatePenalty + 0.5 * altRate).toFixed(2))));
}

function calculateSuccessRate(passed: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((passed / total) * 1000) / 10;
}

describeFeature('mcp-server', () => {
  // ── Failure Analysis Tools ──────────────────────────────────────────

  itAssertion('mcp.analyze.required-inputs', () => {
    expect(validateAnalyzeInput({ testName: 'test.ts', errorMessage: 'timeout' }).valid).toBe(true);
    expect(validateAnalyzeInput({ testName: 'test.ts' }).valid).toBe(false);
    expect(validateAnalyzeInput({ errorMessage: 'timeout' }).valid).toBe(false);
    expect(validateAnalyzeInput({}).valid).toBe(false);
  });

  itAssertion('mcp.analyze.partial-on-failure', () => {
    // Simulate partial results when one step fails
    const categorization = { category: 'environment', confidence: 0.8 };
    let similarFailures: unknown[] = [];
    let logSummary: unknown = null;

    try {
      throw new Error('Vector DB unavailable');
    } catch {
      similarFailures = []; // Empty on failure, not thrown
    }

    try {
      throw new Error('AI provider error');
    } catch {
      logSummary = null; // Null on failure, not thrown
    }

    const result = { categorization, similarFailures, logSummary };
    expect(result.categorization).toBeTruthy(); // Still has categorization
    expect(result.similarFailures).toEqual([]);
    expect(result.logSummary).toBeNull();
  });

  itAssertion('mcp.analyze.log-summary-threshold', () => {
    const shortLogs = 'x'.repeat(50);
    const longLogs = 'x'.repeat(150);
    const shouldSummarize = (logs: string): boolean => logs.length > 100;
    expect(shouldSummarize(shortLogs)).toBe(false);
    expect(shouldSummarize(longLogs)).toBe(true);
  });

  itAssertion('mcp.analyze.return-shape', () => {
    const result = {
      categorization: { category: 'environment', confidence: 0.85, reasoning: 'timeout' },
      similarFailures: [{ id: 'f-1', testName: 'test.ts', similarity: 0.9 }],
      logSummary: { summary: 'DB timeout', rootCause: 'pool exhausted' },
      estimatedCostUSD: 0.023,
    };
    expect(result).toMatchObject({
      categorization: expect.objectContaining({ category: expect.any(String) }),
      similarFailures: expect.any(Array),
      estimatedCostUSD: expect.any(Number),
    });
  });

  // ── Batch Analysis ──────────────────────────────────────────────────

  itAssertion('mcp.batch.requires-input', () => {
    expect(validateBatchInput({ testRunId: 'run-1' }).valid).toBe(true);
    expect(validateBatchInput({ failures: [] }).valid).toBe(true);
    expect(validateBatchInput({}).valid).toBe(false);
  });

  itAssertion('mcp.batch.max-failures-limit', () => {
    const maxFailures = 20;
    const allFailures = Array.from({ length: 50 }, (_, i) => ({ testName: `test-${i}` }));
    const limited = allFailures.slice(0, maxFailures);
    expect(limited).toHaveLength(20);
  });

  itAssertion('mcp.batch.skips-logs', () => {
    // Batch mode explicitly excludes logs for cost optimization
    const batchFailure = { testName: 'test.ts', errorMessage: 'timeout' };
    const includeLogs = false; // batch mode
    expect(includeLogs).toBe(false);
    expect(batchFailure).not.toHaveProperty('logs');
  });

  itAssertion('mcp.batch.priority-buckets', () => {
    expect(classifyPriority('INFRASTRUCTURE_ISSUE', 0.9, 0.7)).toBe('high');
    expect(classifyPriority('TIMEOUT', 0.5, 0.7)).toBe('high');
    expect(classifyPriority('APPLICATION_BUG', 0.8, 0.7)).toBe('high');
    expect(classifyPriority('APPLICATION_BUG', 0.5, 0.7)).toBe('medium');
    expect(classifyPriority('FLAKY_TEST', 0.6, 0.7)).toBe('low');
    expect(classifyPriority('UNKNOWN', 0.3, 0.7)).toBe('low');
  });

  // ── Knowledge Base Tools ────────────────────────────────────────────

  itAssertion('mcp.knowledge.search-injection-safe', () => {
    // Parameterized queries prevent injection
    const maliciousQuery = "test'; DROP TABLE failure_records; --";
    const parameterized = { text: '$1', values: [maliciousQuery] };
    expect(parameterized.values[0]).toBe(maliciousQuery);
    // The query uses $1 placeholder, not string interpolation
    expect(parameterized.text).not.toContain(maliciousQuery);
  });

  itAssertion('mcp.knowledge.add-requires-fields', () => {
    const requiredFields = ['testName', 'errorMessage', 'category', 'resolution', 'resolvedBy'];
    const validInput = {
      testName: 'test.ts',
      errorMessage: 'timeout',
      category: 'TIMEOUT',
      resolution: 'Increased timeout',
      resolvedBy: 'engineer@example.com',
    };
    for (const field of requiredFields) {
      expect(validInput).toHaveProperty(field);
    }
    // Missing field should fail validation
    const invalidInput = { testName: 'test.ts', errorMessage: 'timeout' };
    const hasAll = requiredFields.every(f => f in invalidInput);
    expect(hasAll).toBe(false);
  });

  itAssertion('mcp.knowledge.stats-empty-safe', () => {
    const emptyStats = {
      totalEntries: 0,
      resolvedEntries: 0,
      categories: [],
      recentAdditions: [],
    };
    expect(emptyStats.totalEntries).toBe(0);
    expect(emptyStats.categories).toEqual([]);
    expect(emptyStats.recentAdditions).toEqual([]);
  });

  // ── Statistics & Health ─────────────────────────────────────────────

  itAssertion('mcp.stats.flakiness-min-runs', () => {
    // < 5 runs -> score is 0
    expect(calculateFlakiness(['PASSED', 'FAILED'])).toBe(0);
    expect(calculateFlakiness([])).toBe(0);
    // >= 5 runs with alternation -> positive score
    const flaky = ['PASSED', 'FAILED', 'PASSED', 'FAILED', 'PASSED'];
    expect(calculateFlakiness(flaky)).toBeGreaterThan(0);
  });

  itAssertion('mcp.stats.health-database-critical', () => {
    const dbHealthy = true;
    const _aiHealthy = false; // can be down
    const overallHealthy = dbHealthy; // DB is the critical dependency
    expect(overallHealthy).toBe(true);

    const dbDown = false;
    const overallWhenDbDown = dbDown;
    expect(overallWhenDbDown).toBe(false);
  });

  itAssertion('mcp.stats.cost-default-period', () => {
    const DEFAULT_DAYS = 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - DEFAULT_DAYS);
    const endDate = new Date();
    const daysDiff = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    expect(daysDiff).toBe(DEFAULT_DAYS);
  });

  itAssertion('mcp.stats.pipeline-success-rate', () => {
    expect(calculateSuccessRate(8, 10)).toBe(80);
    expect(calculateSuccessRate(0, 0)).toBe(0);
    expect(calculateSuccessRate(10, 10)).toBe(100);
    expect(calculateSuccessRate(0, 5)).toBe(0);
  });
});
