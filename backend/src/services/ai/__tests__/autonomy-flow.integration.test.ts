/**
 * Integration Tests — Graduated Autonomy Flow
 *
 * End-to-end verification that the AutonomyClassifier and
 * ProactiveSuggestionEngine work together correctly inside
 * the AIChatService ReAct loop. Tests the full chain:
 *
 *   Tool invocation → classifyTool() → tier routing →
 *     SSE event type → evaluateSuggestion() → proactive card
 *
 * These tests use the real classifyTool + evaluateSuggestion
 * functions wired together as they are in AIChatService.
 */

import { classifyTool, type AutonomyLevel, type TierClassification } from '../AutonomyClassifier';
import { evaluateSuggestion } from '../ProactiveSuggestionEngine';
import type { Tool, ToolResult, SSEEventType } from '../tools/types';

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

// ─── Helpers ─────────────────────────────────────────────────────────

function makeTool(name: string, requiresConfirmation = false): Tool {
  return {
    name,
    description: `Test tool ${name}`,
    category: 'jira',
    parameters: [],
    requiresConfirmation,
    async execute() {
      return { success: true, summary: 'ok' };
    },
  };
}

function okResult(data: unknown): ToolResult {
  return { success: true, data, summary: 'ok' };
}

/**
 * Simulates the SSE event type selection logic from AIChatService
 * (lines 421–438 of the real code). Given a classification result
 * and the tool's requiresConfirmation flag, returns the SSE event
 * type that AIChatService would emit.
 */
function resolveSSEEvent(
  tool: Tool,
  classification: TierClassification,
): SSEEventType | 'confirmation_request' {
  if (tool.requiresConfirmation) {
    if (classification.tier === 3 || classification.tier === 2) {
      return 'confirmation_request';
    }
    if (classification.autoExecute) {
      return 'autonomous_action';
    }
  }
  return 'tool_result';
}

// ─── Scenario 1: Jira search → empty → create issue suggestion ──────

describe('Autonomy Flow Integration', () => {
  describe('Scenario: Jira search finds nothing → proactive create issue card', () => {
    it('classifies jira_search as Tier 1 + emits create issue suggestion', () => {
      const tool = makeTool('jira_search');
      const classification = classifyTool(tool, { autonomyLevel: 'balanced' });

      // Step 1: jira_search is read-only → Tier 1, auto-execute
      expect(classification.tier).toBe(1);
      expect(classification.autoExecute).toBe(true);

      // Step 2: After tool returns empty results → ProactiveSuggestionEngine fires
      const toolResult = okResult({ issues: [] });
      const suggestion = evaluateSuggestion({
        toolName: 'jira_search',
        toolResult,
        previousResults: [],
        userMessage: 'Why is checkout-flow.spec.ts failing?',
      });

      // Step 3: Suggestion is a Tier 2 "create issue" card
      expect(suggestion).not.toBeNull();
      expect(suggestion!.tool).toBe('jira_create_issue');
      expect(suggestion!.tier).toBe(2);
      expect(suggestion!.actionLabel).toBe('Create Issue');
    });
  });

  // ─── Scenario 2: Transient failure → auto-retry (Tier 1) ──────────

  describe('Scenario: Transient failure → auto-retry with high confidence', () => {
    it('classifies testrun_retry as Tier 1 when confidence > 0.9', () => {
      const retryTool = makeTool('testrun_retry', true);
      const classification = classifyTool(retryTool, {
        autonomyLevel: 'balanced',
        confidence: 0.94,
        retryCount: 0,
      });

      expect(classification.tier).toBe(1);
      expect(classification.autoExecute).toBe(true);

      // SSE event should be 'autonomous_action' (auto-executed write tool)
      const sseType = resolveSSEEvent(retryTool, classification);
      expect(sseType).toBe('autonomous_action');
    });

    it('suggestion engine also fires retry suggestion from failure_predictions', () => {
      const suggestion = evaluateSuggestion({
        toolName: 'failure_predictions',
        toolResult: okResult({
          predictions: [{
            testId: 'test-99',
            testName: 'checkout-flow.spec.ts',
            rootCause: 'environment unreachable',
          }],
        }),
        previousResults: [],
        userMessage: 'What failed?',
      });

      expect(suggestion).not.toBeNull();
      expect(suggestion!.tool).toBe('testrun_retry');
      expect(suggestion!.preparedArgs.testId).toBe('test-99');
    });
  });

  // ─── Scenario 3: Write tool with confirmation (Tier 2 → card) ─────

  describe('Scenario: Write tool (Tier 2) → confirmation card', () => {
    it('jira_create_issue shows confirmation_request SSE event', () => {
      const tool = makeTool('jira_create_issue', true);
      const classification = classifyTool(tool, { autonomyLevel: 'balanced' });

      expect(classification.tier).toBe(2);
      expect(classification.autoExecute).toBe(false);

      const sseType = resolveSSEEvent(tool, classification);
      expect(sseType).toBe('confirmation_request');
    });
  });

  // ─── Scenario 4: Destructive action (Tier 3) always requires confirmation ─

  describe('Scenario: Destructive action (Tier 3) → full confirmation', () => {
    it('testrun_cancel always gets full confirmation regardless of preference', () => {
      for (const level of ['conservative', 'balanced', 'autonomous'] as AutonomyLevel[]) {
        const tool = makeTool('testrun_cancel', true);
        const classification = classifyTool(tool, { autonomyLevel: level });

        expect(classification.tier).toBe(3);
        expect(classification.autoExecute).toBe(false);

        const sseType = resolveSSEEvent(tool, classification);
        expect(sseType).toBe('confirmation_request');
      }
    });
  });

  // ─── Scenario 5: Conservative user never auto-executes writes ──────

  describe('Scenario: Conservative user → all writes require approval', () => {
    const writeTools = [
      'jira_create_issue',
      'jira_comment',
      'github_create_pr',
      'github_create_branch',
      'github_rerun_workflow',
      'jenkins_trigger_build',
      'testrun_retry',
    ];

    it.each(writeTools)('%s never auto-executes in conservative mode', (toolName) => {
      const tool = makeTool(toolName, true);
      const classification = classifyTool(tool, { autonomyLevel: 'conservative' });

      expect(classification.autoExecute).toBe(false);
      expect(classification.tier).toBeGreaterThanOrEqual(2);
    });
  });

  // ─── Scenario 6: Autonomous user → Tier 2 auto-executes ───────────

  describe('Scenario: Autonomous user → Tier 2 actions auto-execute', () => {
    it('jira_create_issue auto-executes in autonomous mode', () => {
      const tool = makeTool('jira_create_issue', true);
      const classification = classifyTool(tool, { autonomyLevel: 'autonomous' });

      expect(classification.tier).toBe(1);
      expect(classification.autoExecute).toBe(true);

      const sseType = resolveSSEEvent(tool, classification);
      expect(sseType).toBe('autonomous_action');
    });

    it('Tier 3 tools still require confirmation in autonomous mode', () => {
      const tool = makeTool('github_update_file', true);
      const classification = classifyTool(tool, { autonomyLevel: 'autonomous' });

      expect(classification.tier).toBe(3);
      expect(classification.autoExecute).toBe(false);
    });
  });

  // ─── Scenario 7: Jenkins prod build → Tier 3 even for autonomous ──

  describe('Scenario: Production safety override', () => {
    it('jenkins production build is Tier 3 regardless of user preference', () => {
      for (const level of ['conservative', 'balanced', 'autonomous'] as AutonomyLevel[]) {
        const tool = makeTool('jenkins_trigger_build', true);
        const classification = classifyTool(tool, {
          autonomyLevel: level,
          isProduction: true,
        });

        expect(classification.tier).toBe(3);
        expect(classification.autoExecute).toBe(false);
      }
    });
  });

  // ─── Scenario 8: Full chain — investigate → find related → link ────

  describe('Scenario: Investigation chain → find related issues → suggest linking', () => {
    it('full investigation chain produces link suggestion', () => {
      // Step 1: User asks about a failure → jira_get executes (Tier 1)
      const getResult = okResult({ key: 'PROJ-100', summary: 'Checkout timeout' });

      // Step 2: AI searches for related issues → jira_search executes (Tier 1)
      const searchResult = okResult({
        issues: [
          { key: 'PROJ-200', summary: 'Similar timeout' },
          { key: 'PROJ-201', summary: 'Related checkout issue' },
        ],
      });

      // Step 3: ProactiveSuggestionEngine evaluates
      const suggestion = evaluateSuggestion({
        toolName: 'jira_search',
        toolResult: searchResult,
        previousResults: [
          { name: 'jira_get', result: getResult },
        ],
        userMessage: 'Investigate PROJ-100',
      });

      // Step 4: Should suggest linking
      expect(suggestion).not.toBeNull();
      expect(suggestion!.tool).toBe('jira_link_issues');
      expect(suggestion!.preparedArgs.sourceKey).toBe('PROJ-100');
      expect(suggestion!.preparedArgs.targetKeys).toEqual(['PROJ-200', 'PROJ-201']);

      // Step 5: If user accepts, jira_link_issues is Tier 1 → auto-execute
      const linkTool = makeTool('jira_link_issues', false);
      const linkClassification = classifyTool(linkTool, { autonomyLevel: 'balanced' });
      expect(linkClassification.tier).toBe(1);
      expect(linkClassification.autoExecute).toBe(true);
    });
  });

  // ─── Scenario 9: PR review → suggest merge ────────────────────────

  describe('Scenario: PR review → suggest merge', () => {
    it('github_get_pr (Tier 1) → suggestion to merge (Tier 2)', () => {
      // Step 1: Read PR data
      const prTool = makeTool('github_get_pr');
      const prClassification = classifyTool(prTool, { autonomyLevel: 'balanced' });
      expect(prClassification.tier).toBe(1);

      // Step 2: PR is mergeable → suggest merge
      const prResult = okResult({
        state: 'open',
        mergeable: true,
        number: 402,
        repo: 'testops-copilot',
      });

      const suggestion = evaluateSuggestion({
        toolName: 'github_get_pr',
        toolResult: prResult,
        previousResults: [],
        userMessage: 'Check PR #402',
      });

      expect(suggestion).not.toBeNull();
      expect(suggestion!.tool).toBe('github_merge_pr');
      expect(suggestion!.tier).toBe(2);

      // Step 3: If user clicks merge, github_merge_pr is Tier 2 in balanced mode
      const mergeTool = makeTool('github_merge_pr', true);
      const mergeClassification = classifyTool(mergeTool, { autonomyLevel: 'balanced' });
      expect(mergeClassification.tier).toBe(2);
      expect(mergeClassification.autoExecute).toBe(false);
    });
  });

  // ─── Scenario 10: AI investigation notes auto-execute ──────────────

  describe('Scenario: AI investigation notes are Tier 1 (silent)', () => {
    it('jira_comment with [AI Investigation] prefix auto-executes and produces autonomous_action SSE', () => {
      const tool = makeTool('jira_comment', true);
      const classification = classifyTool(tool, {
        autonomyLevel: 'balanced',
        toolArgs: { body: '[AI Investigation] Root cause: Redis connection pool exhausted' },
      });

      expect(classification.tier).toBe(1);
      expect(classification.autoExecute).toBe(true);

      const sseType = resolveSSEEvent(tool, classification);
      expect(sseType).toBe('autonomous_action');
    });
  });
});
