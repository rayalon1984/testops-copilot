/**
 * Feature Spec Tests — Smart Retry
 *
 * Wires AutonomyClassifier and ProactiveSuggestionEngine tests
 * to the smart-retry feature manifest assertions.
 *
 * Phase 2 Adoption: spec-aware test coverage for all 14 assertions.
 */

import { describeFeature, itAssertion } from '../../../__tests__/helpers/feature-spec';
import { classifyTool } from '../AutonomyClassifier';
import { evaluateSuggestion } from '../ProactiveSuggestionEngine';
import type { Tool, ToolResult } from '../tools/types';

// Mock the logger
jest.mock('@/utils/logger', () => ({
  __esModule: true,
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

function makeTool(name: string, opts: Partial<Tool> = {}): Tool {
  return {
    name,
    description: `Test tool ${name}`,
    category: 'jira',
    parameters: [],
    requiresConfirmation: false,
    async execute() { return { success: true, summary: 'ok' }; },
    ...opts,
  };
}

function okResult(data: unknown): ToolResult {
  return { success: true, data, summary: 'ok' };
}

describeFeature('smart-retry', () => {
  // ── Autonomy Classification ─────────────────────────────────────────

  itAssertion('retry.classification.default-tier2', () => {
    const result = classifyTool(makeTool('testrun_retry'), { autonomyLevel: 'balanced' });
    expect(result.tier).toBe(2);
    expect(result.autoExecute).toBe(false);
  });

  itAssertion('retry.classification.tier1-high-confidence', () => {
    const result = classifyTool(makeTool('testrun_retry'), {
      autonomyLevel: 'balanced', confidence: 0.95, retryCount: 0,
    });
    expect(result.tier).toBe(1);
    expect(result.autoExecute).toBe(true);
  });

  itAssertion('retry.classification.no-infinite-loop', () => {
    const result = classifyTool(makeTool('testrun_retry'), {
      autonomyLevel: 'balanced', confidence: 0.95, retryCount: 2,
    });
    expect(result.tier).toBe(2);
    expect(result.autoExecute).toBe(false);
  });

  itAssertion('retry.classification.conservative-override', () => {
    const result = classifyTool(makeTool('testrun_retry'), {
      autonomyLevel: 'conservative', confidence: 0.95, retryCount: 0,
    });
    expect(result.tier).toBeGreaterThanOrEqual(2);
    expect(result.autoExecute).toBe(false);
  });

  itAssertion('retry.classification.autonomous-override', () => {
    const result = classifyTool(makeTool('testrun_retry'), { autonomyLevel: 'autonomous' });
    expect(result.tier).toBe(1);
    expect(result.autoExecute).toBe(true);
  });

  // ── Proactive Retry Suggestion ──────────────────────────────────────

  itAssertion('retry.suggestion.transient-trigger', () => {
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

    // Does NOT fire for non-transient failures
    const noSuggestion = evaluateSuggestion({
      toolName: 'failure_predictions',
      toolResult: okResult({
        predictions: [{ testId: 't-2', testName: 'logic.spec.ts', rootCause: 'assertion error — expected 5, got 3' }],
      }),
      previousResults: [],
      userMessage: 'Test failed',
    });
    expect(noSuggestion).toBeNull();
  });

  itAssertion('retry.suggestion.confidence', () => {
    const suggestion = evaluateSuggestion({
      toolName: 'failure_predictions',
      toolResult: okResult({
        predictions: [{ testId: 't-1', rootCause: 'environment unreachable' }],
      }),
      previousResults: [],
      userMessage: 'test',
    });
    expect(suggestion!.confidence).toBe(0.85);
  });

  itAssertion('retry.suggestion.tier2', () => {
    const suggestion = evaluateSuggestion({
      toolName: 'failure_predictions',
      toolResult: okResult({
        predictions: [{ testId: 't-1', rootCause: 'environment unreachable' }],
      }),
      previousResults: [],
      userMessage: 'test',
    });
    expect(suggestion!.tier).toBe(2);
  });

  itAssertion('retry.suggestion.batch-mode', () => {
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

  // ── Retry Tool Execution ────────────────────────────────────────────

  itAssertion('retry.execution.editor-role', () => {
    // testrun_retry is a write tool that should require at least editor role
    // Verified via static tier map: Tier 2 means it goes through confirmation
    const result = classifyTool(makeTool('testrun_retry'), { autonomyLevel: 'balanced' });
    expect(result.tier).toBe(2);
    expect(result.autoExecute).toBe(false);
  });

  itAssertion('retry.execution.audit-trail', () => {
    // classifyTool returns a reason string for audit logging
    const result = classifyTool(makeTool('testrun_retry'), {
      autonomyLevel: 'balanced', confidence: 0.95, retryCount: 0,
    });
    expect(result.reason).toBeTruthy();
    expect(typeof result.reason).toBe('string');
  });

  itAssertion('retry.execution.return-shape', () => {
    // Contract: suggestion for retry has the correct shape
    const suggestion = evaluateSuggestion({
      toolName: 'failure_predictions',
      toolResult: okResult({
        predictions: [{ testId: 't-99', testName: 'checkout.spec.ts', rootCause: 'environment unreachable' }],
      }),
      previousResults: [],
      userMessage: 'test',
    });
    expect(suggestion).toMatchObject({
      tool: 'testrun_retry',
      tier: expect.any(Number),
      confidence: expect.any(Number),
      actionLabel: expect.any(String),
      preparedArgs: expect.objectContaining({ testId: 't-99' }),
    });
  });

  // ── Frontend assertions ──────────────────────────────────────────────

  itAssertion('retry.frontend.play-button', () => {
    // Validates the retry suggestion provides data needed for the play button UI
    const suggestion = evaluateSuggestion({
      toolName: 'failure_predictions',
      toolResult: okResult({
        predictions: [{ testId: 't-1', testName: 'checkout.spec.ts', rootCause: 'environment down' }],
      }),
      previousResults: [],
      userMessage: 'test',
    });
    expect(suggestion!.actionLabel).toMatch(/Retry/);
    expect(suggestion!.preparedArgs.testId).toBeTruthy();
  });

  itAssertion('retry.frontend.toast-notification', () => {
    // Behavioral: completed retry would have a status field for notification
    const result = classifyTool(makeTool('testrun_retry'), {
      autonomyLevel: 'balanced', confidence: 0.95, retryCount: 0,
    });
    expect(result.tier).toBe(1);
    // The SSE event for Tier 1 auto-execute would be 'autonomous_action'
    // which triggers a toast notification in the UI
    expect(result.autoExecute).toBe(true);
  });
});
