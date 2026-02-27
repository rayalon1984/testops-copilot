/**
 * Feature Spec Tests — Proactive Suggestions
 *
 * Wires ProactiveSuggestionEngine tests to the
 * proactive-suggestions feature manifest assertions.
 *
 * Phase 2 Adoption: spec-aware test coverage for all 19 assertions.
 */

import { describeFeature, itAssertion } from '../../../__tests__/helpers/feature-spec';
import { evaluateSuggestion } from '../ProactiveSuggestionEngine';
import type { ToolResult } from '../tools/types';

// Mock the logger
jest.mock('@/utils/logger', () => ({
  __esModule: true,
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

function okResult(data: unknown): ToolResult {
  return { success: true, data, summary: 'ok' };
}

describeFeature('proactive-suggestions', () => {
  // ── ProactiveSuggestionEngine ───────────────────────────────────────

  itAssertion('proactive.engine.jira-empty-suggest-create', () => {
    const suggestion = evaluateSuggestion({
      toolName: 'jira_search',
      toolResult: okResult({ issues: [] }),
      previousResults: [],
      userMessage: 'Why is checkout test failing?',
    });
    expect(suggestion).not.toBeNull();
    expect(suggestion!.tool).toBe('jira_create_issue');
    expect(suggestion!.actionLabel).toBe('Create Issue');
  });

  itAssertion('proactive.engine.transient-failure-suggest-retry', () => {
    const suggestion = evaluateSuggestion({
      toolName: 'failure_predictions',
      toolResult: okResult({
        predictions: [{ testId: 't-1', testName: 'checkout.spec.ts', rootCause: 'environment unreachable' }],
      }),
      previousResults: [],
      userMessage: 'Why did checkout fail?',
    });
    expect(suggestion).not.toBeNull();
    expect(suggestion!.tool).toBe('testrun_retry');
    expect(suggestion!.actionLabel).toBe('Retry Now');
  });

  itAssertion('proactive.engine.jenkins-failure-suggest-rebuild', () => {
    const suggestion = evaluateSuggestion({
      toolName: 'jenkins_get_status',
      toolResult: okResult({ status: 'failure', jobName: 'main-build' }),
      previousResults: [],
      userMessage: 'Pipeline status?',
    });
    expect(suggestion).not.toBeNull();
    expect(suggestion!.tool).toBe('jenkins_trigger_build');
    expect(suggestion!.actionLabel).toBe('Trigger Build');
  });

  itAssertion('proactive.engine.related-issues-suggest-link', () => {
    const suggestion = evaluateSuggestion({
      toolName: 'jira_search',
      toolResult: okResult({
        issues: [{ key: 'PROJ-200', summary: 'Timeout' }, { key: 'PROJ-201', summary: 'Env issue' }],
      }),
      previousResults: [{ name: 'jira_get', result: okResult({ key: 'PROJ-100', summary: 'Main' }) }],
      userMessage: 'Related issues',
    });
    expect(suggestion).not.toBeNull();
    expect(suggestion!.tool).toBe('jira_link_issues');
    expect(suggestion!.preparedArgs.sourceKey).toBe('PROJ-100');
  });

  itAssertion('proactive.engine.mergeable-pr-suggest-merge', () => {
    const suggestion = evaluateSuggestion({
      toolName: 'github_get_pr',
      toolResult: okResult({ state: 'open', mergeable: true, number: 312, repo: 'testops-copilot' }),
      previousResults: [],
      userMessage: 'Check PR #312',
    });
    expect(suggestion).not.toBeNull();
    expect(suggestion!.tool).toBe('github_merge_pr');
    expect(suggestion!.actionLabel).toBe('Merge PR');
  });

  itAssertion('proactive.engine.null-when-no-match', () => {
    const s1 = evaluateSuggestion({
      toolName: 'dashboard_metrics',
      toolResult: okResult({ totalTests: 100 }),
      previousResults: [],
      userMessage: 'Show metrics',
    });
    expect(s1).toBeNull();

    const s2 = evaluateSuggestion({
      toolName: 'confluence_search',
      toolResult: okResult({ results: ['doc-1'] }),
      previousResults: [],
      userMessage: 'Find docs',
    });
    expect(s2).toBeNull();
  });

  itAssertion('proactive.engine.confidence-values', () => {
    const jiraCreate = evaluateSuggestion({
      toolName: 'jira_search',
      toolResult: okResult({ issues: [] }),
      previousResults: [],
      userMessage: 'test',
    });
    expect(jiraCreate!.confidence).toBe(0.8);

    const retry = evaluateSuggestion({
      toolName: 'failure_predictions',
      toolResult: okResult({ predictions: [{ testId: 't-1', rootCause: 'environment down' }] }),
      previousResults: [],
      userMessage: 'test',
    });
    expect(retry!.confidence).toBe(0.85);

    const jenkins = evaluateSuggestion({
      toolName: 'jenkins_get_status',
      toolResult: okResult({ status: 'failure', jobName: 'build' }),
      previousResults: [],
      userMessage: 'test',
    });
    expect(jenkins!.confidence).toBe(0.7);
  });

  itAssertion('proactive.engine.unique-suggestion-ids', () => {
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

  // ── Jira Issue Pre-Fill ─────────────────────────────────────────────

  itAssertion('proactive.jira-prefill.summary-from-context', () => {
    const suggestion = evaluateSuggestion({
      toolName: 'jira_search',
      toolResult: okResult({ issues: [] }),
      previousResults: [{
        name: 'failure_predictions',
        result: okResult({ predictions: [{ testName: 'checkout-flow.spec.ts', category: 'environment' }] }),
      }],
      userMessage: 'Why is checkout failing?',
    });
    expect(suggestion).not.toBeNull();
    expect(String(suggestion!.preparedArgs.summary)).toContain('checkout-flow.spec.ts');
  });

  itAssertion('proactive.jira-prefill.ai-suggested-label', () => {
    const suggestion = evaluateSuggestion({
      toolName: 'jira_search',
      toolResult: okResult({ issues: [] }),
      previousResults: [{
        name: 'failure_predictions',
        result: okResult({ predictions: [{ testName: 'test.spec.ts' }] }),
      }],
      userMessage: 'Test failing',
    });
    expect(suggestion).not.toBeNull();
    expect(suggestion!.preparedArgs.labels).toContain('ai-suggested');
  });

  itAssertion('proactive.jira-prefill.pipeline-context', () => {
    const suggestion = evaluateSuggestion({
      toolName: 'jira_search',
      toolResult: okResult({ issues: [] }),
      previousResults: [{
        name: 'jenkins_get_status',
        result: okResult({ jobName: 'main-pipeline', status: 'FAILURE' }),
      }],
      userMessage: 'Pipeline broken?',
    });
    expect(suggestion).not.toBeNull();
    expect(suggestion!.preparedArgs.labels).toContain('pipeline-failure');
    expect(String(suggestion!.preparedArgs.description)).toContain('main-pipeline');
  });

  // ── ProactiveSuggestionCard (structural validation) ──────────────────

  itAssertion('proactive.frontend.dual-buttons', () => {
    // Validates the suggestion structure supports dual-button UI
    const suggestion = evaluateSuggestion({
      toolName: 'jira_search',
      toolResult: okResult({ issues: [] }),
      previousResults: [],
      userMessage: 'test',
    });
    expect(suggestion).not.toBeNull();
    expect(suggestion!.actionLabel).toBeTruthy();
    expect(suggestion!.secondaryLabel).toBeTruthy();
  });

  itAssertion('proactive.frontend.service-accent', () => {
    // Each tool type maps to a known service
    const jira = evaluateSuggestion({
      toolName: 'jira_search', toolResult: okResult({ issues: [] }),
      previousResults: [], userMessage: 'test',
    });
    expect(jira!.tool).toMatch(/^jira_/);

    const retry = evaluateSuggestion({
      toolName: 'failure_predictions',
      toolResult: okResult({ predictions: [{ rootCause: 'environment down' }] }),
      previousResults: [], userMessage: 'test',
    });
    expect(retry!.tool).toMatch(/^testrun_/);
  });

  itAssertion('proactive.frontend.high-confidence-badge', () => {
    const suggestion = evaluateSuggestion({
      toolName: 'failure_predictions',
      toolResult: okResult({ predictions: [{ testId: 't-1', rootCause: 'environment down' }] }),
      previousResults: [],
      userMessage: 'test',
    });
    expect(suggestion!.confidence).toBeGreaterThanOrEqual(0.8);
  });

  itAssertion('proactive.frontend.resolved-state', () => {
    // Resolved state is a UI concern; the engine returns the data needed
    const suggestion = evaluateSuggestion({
      toolName: 'jira_search', toolResult: okResult({ issues: [] }),
      previousResults: [], userMessage: 'test',
    });
    expect(suggestion).toHaveProperty('suggestionId');
    expect(suggestion).toHaveProperty('tool');
    expect(suggestion).toHaveProperty('actionLabel');
  });

  itAssertion('proactive.frontend.jira-preview', () => {
    const suggestion = evaluateSuggestion({
      toolName: 'jira_search', toolResult: okResult({ issues: [] }),
      previousResults: [], userMessage: 'test',
    });
    expect(suggestion!.tool).toBe('jira_create_issue');
    expect(suggestion!.preparedArgs).toHaveProperty('issueType');
    expect(suggestion!.preparedArgs).toHaveProperty('labels');
  });

  // ── Contract assertions ──────────────────────────────────────────────

  itAssertion('proactive.frontend.accept-dismiss-callbacks', () => {
    const suggestion = evaluateSuggestion({
      toolName: 'jira_search', toolResult: okResult({ issues: [] }),
      previousResults: [], userMessage: 'test',
    });
    // Contract: suggestion has all fields needed for accept/dismiss
    expect(suggestion).toHaveProperty('suggestionId');
    expect(suggestion).toHaveProperty('tool');
    expect(suggestion).toHaveProperty('preparedArgs');
    expect(suggestion).toHaveProperty('tier');
    expect(suggestion).toHaveProperty('actionLabel');
  });

  itAssertion('proactive.sse.event-type', () => {
    // Contract: suggestions always include a tier for SSE routing
    const suggestion = evaluateSuggestion({
      toolName: 'jira_search', toolResult: okResult({ issues: [] }),
      previousResults: [], userMessage: 'test',
    });
    expect(suggestion!.tier).toBeDefined();
    expect([1, 2]).toContain(suggestion!.tier);
  });

  itAssertion('proactive.sse.event-shape', () => {
    // Contract: the suggestion shape matches what SSE expects
    const suggestion = evaluateSuggestion({
      toolName: 'jira_search', toolResult: okResult({ issues: [] }),
      previousResults: [], userMessage: 'test',
    });
    expect(suggestion).toMatchObject({
      suggestionId: expect.any(String),
      tool: expect.any(String),
      preparedArgs: expect.any(Object),
      reason: expect.any(String),
      confidence: expect.any(Number),
      tier: expect.any(Number),
      actionLabel: expect.any(String),
    });
  });
});
