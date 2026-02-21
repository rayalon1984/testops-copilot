/**
 * Unit Tests — ProactiveSuggestionEngine
 *
 * Validates the 5 suggestion rules that fire after tool execution
 * in the ReAct loop. Each rule maps a specific post-condition to
 * a proactive suggestion card.
 */

import { evaluateSuggestion } from '../ProactiveSuggestionEngine';
import type { ToolResult } from '../tools/types';

// Mock the logger
jest.mock('@/utils/logger', () => ({
  __esModule: true,
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

/** Helper: build a successful ToolResult */
function okResult(data: unknown): ToolResult {
  return { success: true, data, summary: 'ok' };
}

/** Helper: build a failed ToolResult */
function failResult(error: string): ToolResult {
  return { success: false, error, summary: error };
}

// ─── Rule 1: Jira search empty → suggest create issue ────────────────

describe('ProactiveSuggestionEngine', () => {
  describe('Rule 1: Jira search returned empty → suggest creating an issue', () => {
    it('fires when jira_search returns zero issues', () => {
      const suggestion = evaluateSuggestion({
        toolName: 'jira_search',
        toolResult: okResult({ issues: [] }),
        previousResults: [],
        userMessage: 'Why is the checkout test failing?',
      });

      expect(suggestion).not.toBeNull();
      expect(suggestion!.tool).toBe('jira_create_issue');
      expect(suggestion!.tier).toBe(2);
      expect(suggestion!.actionLabel).toBe('Create Issue');
      expect(suggestion!.secondaryLabel).toBe('Edit First');
      expect(suggestion!.confidence).toBe(0.8);
      expect(suggestion!.reason).toContain('No existing Jira issue');
    });

    it('fires when issues array is missing (undefined)', () => {
      const suggestion = evaluateSuggestion({
        toolName: 'jira_search',
        toolResult: okResult({}),
        previousResults: [],
        userMessage: 'Check for related tickets',
      });

      expect(suggestion).not.toBeNull();
      expect(suggestion!.tool).toBe('jira_create_issue');
    });

    it('does NOT fire when jira_search returns results', () => {
      const suggestion = evaluateSuggestion({
        toolName: 'jira_search',
        toolResult: okResult({ issues: [{ key: 'PROJ-123', summary: 'Bug' }] }),
        previousResults: [],
        userMessage: 'Check tickets',
      });

      // With only 1 issue and no previous jira_get, Rule 4 also won't fire
      expect(suggestion).toBeNull();
    });

    it('does NOT fire when jira_search failed', () => {
      const suggestion = evaluateSuggestion({
        toolName: 'jira_search',
        toolResult: failResult('Jira API error'),
        previousResults: [],
        userMessage: 'Search for tickets',
      });

      expect(suggestion).toBeNull();
    });

    it('pre-fills issue fields from conversation context', () => {
      const suggestion = evaluateSuggestion({
        toolName: 'jira_search',
        toolResult: okResult({ issues: [] }),
        previousResults: [
          {
            name: 'failure_predictions',
            result: okResult({
              predictions: [{
                testName: 'checkout-flow.spec.ts',
                category: 'environment',
                riskScore: 0.87,
              }],
            }),
          },
        ],
        userMessage: 'Why is checkout failing?',
      });

      expect(suggestion).not.toBeNull();
      const args = suggestion!.preparedArgs;
      expect(args.issueType).toBe('Bug');
      expect(args.labels).toContain('ai-suggested');
      expect(args.labels).toContain('failure-analysis');
      expect(String(args.summary)).toContain('checkout-flow.spec.ts');
    });

    it('enriches with pipeline info from jenkins_get_status', () => {
      const suggestion = evaluateSuggestion({
        toolName: 'jira_search',
        toolResult: okResult({ issues: [] }),
        previousResults: [
          {
            name: 'jenkins_get_status',
            result: okResult({ jobName: 'main-pipeline', status: 'FAILURE' }),
          },
        ],
        userMessage: 'Pipeline broken?',
      });

      expect(suggestion).not.toBeNull();
      const args = suggestion!.preparedArgs;
      expect(args.labels).toContain('pipeline-failure');
      expect(String(args.description)).toContain('main-pipeline');
    });
  });

  // ─── Rule 2: Transient failure → suggest retry ─────────────────────

  describe('Rule 2: Transient failure detected → suggest retry', () => {
    it('fires for environment-caused failure', () => {
      const suggestion = evaluateSuggestion({
        toolName: 'failure_predictions',
        toolResult: okResult({
          predictions: [{
            testId: 'test-42',
            testName: 'checkout-flow.spec.ts',
            rootCause: 'environment unreachable',
          }],
        }),
        previousResults: [],
        userMessage: 'Why did checkout fail?',
      });

      expect(suggestion).not.toBeNull();
      expect(suggestion!.tool).toBe('testrun_retry');
      expect(suggestion!.tier).toBe(2);
      expect(suggestion!.confidence).toBe(0.85);
      expect(suggestion!.actionLabel).toBe('Retry Now');
      expect(suggestion!.preparedArgs.testId).toBe('test-42');
    });

    it('fires for timeout-related failures', () => {
      const suggestion = evaluateSuggestion({
        toolName: 'failure_predictions',
        toolResult: okResult({
          predictions: [{
            id: 'p-1',
            name: 'api-test',
            category: 'timeout',
          }],
        }),
        previousResults: [],
        userMessage: 'Why is this failing?',
      });

      expect(suggestion).not.toBeNull();
      expect(suggestion!.tool).toBe('testrun_retry');
    });

    it('fires for network failures', () => {
      const suggestion = evaluateSuggestion({
        toolName: 'failure_predictions',
        toolResult: okResult({
          predictions: [{ id: 'p-2', name: 'net-test', rootCause: 'network error' }],
        }),
        previousResults: [],
        userMessage: 'Tests failing',
      });

      expect(suggestion).not.toBeNull();
      expect(suggestion!.tool).toBe('testrun_retry');
    });

    it('fires for flaky tests', () => {
      const suggestion = evaluateSuggestion({
        toolName: 'failure_predictions',
        toolResult: okResult({
          predictions: [{ id: 'p-3', name: 'flaky-test', category: 'flaky' }],
        }),
        previousResults: [],
        userMessage: 'Test failures',
      });

      expect(suggestion).not.toBeNull();
      expect(suggestion!.tool).toBe('testrun_retry');
    });

    it('shows "Retry All N" when multiple transient failures', () => {
      const suggestion = evaluateSuggestion({
        toolName: 'failure_predictions',
        toolResult: okResult({
          predictions: [
            { testId: 'a', testName: 'test-a', rootCause: 'environment down' },
            { testId: 'b', testName: 'test-b', rootCause: 'transient timeout' },
            { testId: 'c', testName: 'test-c', rootCause: 'network flaky' },
          ],
        }),
        previousResults: [],
        userMessage: 'Failures',
      });

      expect(suggestion).not.toBeNull();
      expect(suggestion!.actionLabel).toBe('Retry All 3');
      expect(suggestion!.reason).toContain('3 tests affected');
    });

    it('does NOT fire for non-transient failures', () => {
      const suggestion = evaluateSuggestion({
        toolName: 'failure_predictions',
        toolResult: okResult({
          predictions: [{
            testId: 't-1',
            testName: 'logic-test',
            rootCause: 'assertion error — expected 5, got 3',
          }],
        }),
        previousResults: [],
        userMessage: 'Test failed',
      });

      expect(suggestion).toBeNull();
    });

    it('does NOT fire when predictions are empty', () => {
      const suggestion = evaluateSuggestion({
        toolName: 'failure_predictions',
        toolResult: okResult({ predictions: [] }),
        previousResults: [],
        userMessage: 'Any failures?',
      });

      expect(suggestion).toBeNull();
    });
  });

  // ─── Rule 3: Jenkins failure → suggest rebuild ─────────────────────

  describe('Rule 3: Jenkins shows failure → suggest rebuild', () => {
    it('fires when status is "failure"', () => {
      const suggestion = evaluateSuggestion({
        toolName: 'jenkins_get_status',
        toolResult: okResult({ status: 'failure', jobName: 'main-build' }),
        previousResults: [],
        userMessage: 'How is the pipeline?',
      });

      expect(suggestion).not.toBeNull();
      expect(suggestion!.tool).toBe('jenkins_trigger_build');
      expect(suggestion!.tier).toBe(2);
      expect(suggestion!.confidence).toBe(0.7);
      expect(suggestion!.actionLabel).toBe('Trigger Build');
      expect(suggestion!.preparedArgs.jobName).toBe('main-build');
    });

    it('fires when result is "FAILED" (case-insensitive)', () => {
      const suggestion = evaluateSuggestion({
        toolName: 'jenkins_get_status',
        toolResult: okResult({ result: 'FAILED', name: 'deploy-job' }),
        previousResults: [],
        userMessage: 'Pipeline status?',
      });

      expect(suggestion).not.toBeNull();
      expect(suggestion!.tool).toBe('jenkins_trigger_build');
    });

    it('does NOT fire when pipeline is passing', () => {
      const suggestion = evaluateSuggestion({
        toolName: 'jenkins_get_status',
        toolResult: okResult({ status: 'success', jobName: 'main-build' }),
        previousResults: [],
        userMessage: 'Pipeline status?',
      });

      expect(suggestion).toBeNull();
    });
  });

  // ─── Rule 4: Related Jira issues found → suggest linking ───────────

  describe('Rule 4: Found related Jira issues → suggest linking', () => {
    it('fires when 2+ issues found AND previous jira_get exists', () => {
      const suggestion = evaluateSuggestion({
        toolName: 'jira_search',
        toolResult: okResult({
          issues: [
            { key: 'PROJ-200', summary: 'Timeout in checkout' },
            { key: 'PROJ-201', summary: 'Checkout env issue' },
          ],
        }),
        previousResults: [
          {
            name: 'jira_get',
            result: okResult({ key: 'PROJ-100', summary: 'Main ticket' }),
          },
        ],
        userMessage: 'Find related issues',
      });

      expect(suggestion).not.toBeNull();
      expect(suggestion!.tool).toBe('jira_link_issues');
      expect(suggestion!.tier).toBe(1);
      expect(suggestion!.confidence).toBe(0.75);
      expect(suggestion!.actionLabel).toBe('Link Issues');
      expect(suggestion!.preparedArgs.sourceKey).toBe('PROJ-100');
      expect(suggestion!.preparedArgs.targetKeys).toEqual(['PROJ-200', 'PROJ-201']);
      expect(suggestion!.preparedArgs.linkType).toBe('relates to');
    });

    it('excludes sourceKey from targetKeys', () => {
      const suggestion = evaluateSuggestion({
        toolName: 'jira_search',
        toolResult: okResult({
          issues: [
            { key: 'PROJ-100', summary: 'Same as source' },
            { key: 'PROJ-200', summary: 'Different ticket' },
          ],
        }),
        previousResults: [
          {
            name: 'jira_get',
            result: okResult({ key: 'PROJ-100', summary: 'Source' }),
          },
        ],
        userMessage: 'Related tickets',
      });

      expect(suggestion).not.toBeNull();
      expect(suggestion!.preparedArgs.targetKeys).not.toContain('PROJ-100');
      expect(suggestion!.preparedArgs.targetKeys).toContain('PROJ-200');
    });

    it('caps targetKeys at 3', () => {
      const suggestion = evaluateSuggestion({
        toolName: 'jira_search',
        toolResult: okResult({
          issues: [
            { key: 'A-1' }, { key: 'A-2' }, { key: 'A-3' },
            { key: 'A-4' }, { key: 'A-5' },
          ],
        }),
        previousResults: [
          { name: 'jira_get', result: okResult({ key: 'SRC-1' }) },
        ],
        userMessage: 'Related?',
      });

      expect(suggestion).not.toBeNull();
      expect((suggestion!.preparedArgs.targetKeys as string[]).length).toBeLessThanOrEqual(3);
    });

    it('does NOT fire without a previous jira_get', () => {
      const suggestion = evaluateSuggestion({
        toolName: 'jira_search',
        toolResult: okResult({
          issues: [
            { key: 'PROJ-200' },
            { key: 'PROJ-201' },
          ],
        }),
        previousResults: [],
        userMessage: 'Find issues',
      });

      // Without jira_get, Rule 4 doesn't fire.
      // Rule 1 also doesn't fire because issues.length > 0
      expect(suggestion).toBeNull();
    });

    it('does NOT fire with only 1 issue found', () => {
      const suggestion = evaluateSuggestion({
        toolName: 'jira_search',
        toolResult: okResult({
          issues: [{ key: 'PROJ-200' }],
        }),
        previousResults: [
          { name: 'jira_get', result: okResult({ key: 'PROJ-100' }) },
        ],
        userMessage: 'Related?',
      });

      expect(suggestion).toBeNull();
    });
  });

  // ─── Rule 5: PR is open and mergeable → suggest merge ─────────────

  describe('Rule 5: GitHub PR open & mergeable → suggest merge', () => {
    it('fires when PR is open and mergeable', () => {
      const suggestion = evaluateSuggestion({
        toolName: 'github_get_pr',
        toolResult: okResult({
          state: 'open',
          mergeable: true,
          number: 312,
          repo: 'testops-companion',
        }),
        previousResults: [],
        userMessage: 'Check PR #312',
      });

      expect(suggestion).not.toBeNull();
      expect(suggestion!.tool).toBe('github_merge_pr');
      expect(suggestion!.tier).toBe(2);
      expect(suggestion!.confidence).toBe(0.7);
      expect(suggestion!.actionLabel).toBe('Merge PR');
      expect(suggestion!.preparedArgs.prNumber).toBe(312);
      expect(suggestion!.preparedArgs.repo).toBe('testops-companion');
    });

    it('does NOT fire when PR is closed', () => {
      const suggestion = evaluateSuggestion({
        toolName: 'github_get_pr',
        toolResult: okResult({ state: 'closed', mergeable: true, number: 100 }),
        previousResults: [],
        userMessage: 'PR status?',
      });

      expect(suggestion).toBeNull();
    });

    it('does NOT fire when PR is not mergeable', () => {
      const suggestion = evaluateSuggestion({
        toolName: 'github_get_pr',
        toolResult: okResult({ state: 'open', mergeable: false, number: 100 }),
        previousResults: [],
        userMessage: 'PR status?',
      });

      expect(suggestion).toBeNull();
    });
  });

  // ─── No-op cases ───────────────────────────────────────────────────

  describe('no suggestion emitted for unmatched tools', () => {
    it('returns null for dashboard_metrics', () => {
      const suggestion = evaluateSuggestion({
        toolName: 'dashboard_metrics',
        toolResult: okResult({ totalTests: 100, passRate: 0.95 }),
        previousResults: [],
        userMessage: 'Show metrics',
      });

      expect(suggestion).toBeNull();
    });

    it('returns null for confluence_search', () => {
      const suggestion = evaluateSuggestion({
        toolName: 'confluence_search',
        toolResult: okResult({ results: ['doc-1'] }),
        previousResults: [],
        userMessage: 'Find docs',
      });

      expect(suggestion).toBeNull();
    });
  });

  // ─── Suggestion IDs are unique ─────────────────────────────────────

  describe('suggestion IDs', () => {
    it('generates unique IDs across multiple suggestions', () => {
      const s1 = evaluateSuggestion({
        toolName: 'jira_search',
        toolResult: okResult({ issues: [] }),
        previousResults: [],
        userMessage: 'msg1',
      });

      const s2 = evaluateSuggestion({
        toolName: 'jira_search',
        toolResult: okResult({ issues: [] }),
        previousResults: [],
        userMessage: 'msg2',
      });

      expect(s1).not.toBeNull();
      expect(s2).not.toBeNull();
      expect(s1!.suggestionId).not.toBe(s2!.suggestionId);
    });

    it('IDs match expected format (suggestion-{timestamp}-{counter})', () => {
      const suggestion = evaluateSuggestion({
        toolName: 'jira_search',
        toolResult: okResult({ issues: [] }),
        previousResults: [],
        userMessage: 'test',
      });

      expect(suggestion!.suggestionId).toMatch(/^suggestion-\d+-\d+$/);
    });
  });

  // ─── Rule priority: Rule 1 fires before Rule 4 for empty results ──

  describe('rule priority', () => {
    it('Rule 1 (create issue) wins over Rule 4 (link) when no issues found', () => {
      const suggestion = evaluateSuggestion({
        toolName: 'jira_search',
        toolResult: okResult({ issues: [] }),
        previousResults: [
          { name: 'jira_get', result: okResult({ key: 'PROJ-100' }) },
        ],
        userMessage: 'Find related',
      });

      // Rule 1 fires first (empty results), Rule 4 never evaluates
      expect(suggestion).not.toBeNull();
      expect(suggestion!.tool).toBe('jira_create_issue');
    });
  });
});
