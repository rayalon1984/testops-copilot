/**
 * Feature Spec Tests — Jira Housekeeping
 *
 * Wires jira_link_issues and jira_add_label tool tests to the
 * jira-housekeeping feature manifest assertions.
 *
 * Phase 2 Adoption: spec-aware test coverage for all 15 assertions.
 */

import { describeFeature, itAssertion } from '../../../__tests__/helpers/feature-spec';
import { classifyTool } from '../AutonomyClassifier';
import { evaluateSuggestion } from '../ProactiveSuggestionEngine';
import { jiraLinkIssuesTool, jiraAddLabelTool } from '../tools/jira-housekeeping';
import type { Tool, ToolResult, ToolContext } from '../tools/types';

// Mock the logger
jest.mock('@/utils/logger', () => ({
  __esModule: true,
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// Mock jiraService
jest.mock('@/services/jira.service', () => ({
  jiraService: {
    isEnabled: jest.fn(),
    linkIssues: jest.fn(),
    addLabels: jest.fn(),
  },
}));

import { jiraService } from '@/services/jira.service';
const mockJiraService = jiraService as jest.Mocked<typeof jiraService>;

function makeTool(name: string): Tool {
  return {
    name,
    description: `Test tool ${name}`,
    category: 'jira',
    parameters: [],
    requiresConfirmation: false,
    async execute() { return { success: true, summary: 'ok' }; },
  };
}

function okResult(data: unknown): ToolResult {
  return { success: true, data, summary: 'ok' };
}

const mockContext: ToolContext = {
  userId: 'user-1',
  sessionId: 'session-1',
  userRole: 'EDITOR',
};

describeFeature('jira-housekeeping', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Auto-Link Related Issues (contract assertions) ──────────────────

  itAssertion('housekeeping.link.jira-enabled', async () => {
    mockJiraService.isEnabled.mockReturnValue(false);
    const result = await jiraLinkIssuesTool.execute(
      { sourceKey: 'PROJ-100', targetKeys: ['PROJ-200'] },
      mockContext,
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('not configured');
  });

  itAssertion('housekeeping.link.partial-success', async () => {
    mockJiraService.isEnabled.mockReturnValue(true);
    mockJiraService.linkIssues
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('API error'));

    const result = await jiraLinkIssuesTool.execute(
      { sourceKey: 'PROJ-100', targetKeys: ['PROJ-200', 'PROJ-201'], linkType: 'relates to' },
      mockContext,
    );
    expect(result.success).toBe(true);
    expect((result.data as Record<string, unknown>).linked).toEqual(['PROJ-200']);
    expect((result.data as Record<string, unknown>).errors).toBeDefined();
  });

  itAssertion('housekeeping.link.all-failed', async () => {
    mockJiraService.isEnabled.mockReturnValue(true);
    mockJiraService.linkIssues.mockRejectedValue(new Error('API error'));

    const result = await jiraLinkIssuesTool.execute(
      { sourceKey: 'PROJ-100', targetKeys: ['PROJ-200', 'PROJ-201'] },
      mockContext,
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to link');
  });

  itAssertion('housekeeping.link.continues-on-error', async () => {
    mockJiraService.isEnabled.mockReturnValue(true);
    mockJiraService.linkIssues
      .mockRejectedValueOnce(new Error('API error'))
      .mockResolvedValueOnce(undefined);

    const result = await jiraLinkIssuesTool.execute(
      { sourceKey: 'PROJ-100', targetKeys: ['PROJ-200', 'PROJ-201'] },
      mockContext,
    );
    // Should continue linking even after first failure
    expect(mockJiraService.linkIssues).toHaveBeenCalledTimes(2);
    expect(result.success).toBe(true);
    expect((result.data as Record<string, unknown>).linked).toEqual(['PROJ-201']);
  });

  // ── Auto-Label Issues ───────────────────────────────────────────────

  itAssertion('housekeeping.label.jira-enabled', async () => {
    mockJiraService.isEnabled.mockReturnValue(false);
    const result = await jiraAddLabelTool.execute(
      { issueKey: 'PROJ-100', labels: ['ai-suggested'] },
      mockContext,
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('not configured');
  });

  itAssertion('housekeeping.label.success-shape', async () => {
    mockJiraService.isEnabled.mockReturnValue(true);
    mockJiraService.addLabels.mockResolvedValue(undefined);

    const result = await jiraAddLabelTool.execute(
      { issueKey: 'PROJ-100', labels: ['investigated-by-ai', 'flaky'] },
      mockContext,
    );
    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect(data.issueKey).toBe('PROJ-100');
    expect(data.labels).toEqual(['investigated-by-ai', 'flaky']);
  });

  itAssertion('housekeeping.label.error-handling', async () => {
    mockJiraService.isEnabled.mockReturnValue(true);
    mockJiraService.addLabels.mockRejectedValue(new Error('Permission denied'));

    const result = await jiraAddLabelTool.execute(
      { issueKey: 'PROJ-100', labels: ['test'] },
      mockContext,
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('Permission denied');
  });

  // ── Tier Classification ─────────────────────────────────────────────

  itAssertion('housekeeping.autonomy.link-tier1', () => {
    const result = classifyTool(makeTool('jira_link_issues'), { autonomyLevel: 'balanced' });
    expect(result.tier).toBe(1);
    expect(result.autoExecute).toBe(true);
  });

  itAssertion('housekeeping.autonomy.label-tier1', () => {
    const result = classifyTool(makeTool('jira_add_label'), { autonomyLevel: 'balanced' });
    expect(result.tier).toBe(1);
    expect(result.autoExecute).toBe(true);
  });

  // ── Proactive Link Suggestion ───────────────────────────────────────

  itAssertion('housekeeping.suggestion.trigger', () => {
    const suggestion = evaluateSuggestion({
      toolName: 'jira_search',
      toolResult: okResult({
        issues: [{ key: 'PROJ-200' }, { key: 'PROJ-201' }],
      }),
      previousResults: [{ name: 'jira_get', result: okResult({ key: 'PROJ-100' }) }],
      userMessage: 'Related?',
    });
    expect(suggestion).not.toBeNull();
    expect(suggestion!.tool).toBe('jira_link_issues');
  });

  itAssertion('housekeeping.suggestion.tier1', () => {
    const suggestion = evaluateSuggestion({
      toolName: 'jira_search',
      toolResult: okResult({
        issues: [{ key: 'PROJ-200' }, { key: 'PROJ-201' }],
      }),
      previousResults: [{ name: 'jira_get', result: okResult({ key: 'PROJ-100' }) }],
      userMessage: 'Related?',
    });
    expect(suggestion!.tier).toBe(1);
  });

  itAssertion('housekeeping.suggestion.confidence', () => {
    const suggestion = evaluateSuggestion({
      toolName: 'jira_search',
      toolResult: okResult({
        issues: [{ key: 'PROJ-200' }, { key: 'PROJ-201' }],
      }),
      previousResults: [{ name: 'jira_get', result: okResult({ key: 'PROJ-100' }) }],
      userMessage: 'Related?',
    });
    expect(suggestion!.confidence).toBe(0.75);
  });

  itAssertion('housekeeping.suggestion.target-cap', () => {
    const suggestion = evaluateSuggestion({
      toolName: 'jira_search',
      toolResult: okResult({
        issues: [{ key: 'A-1' }, { key: 'A-2' }, { key: 'A-3' }, { key: 'A-4' }, { key: 'A-5' }],
      }),
      previousResults: [{ name: 'jira_get', result: okResult({ key: 'SRC-1' }) }],
      userMessage: 'Related?',
    });
    expect(suggestion).not.toBeNull();
    expect((suggestion!.preparedArgs.targetKeys as string[]).length).toBeLessThanOrEqual(3);
  });

  // ── Undo Support ────────────────────────────────────────────────────

  itAssertion('housekeeping.undo.one-click', async () => {
    // The tool returns data structured for undo: sourceKey + linked list
    mockJiraService.isEnabled.mockReturnValue(true);
    mockJiraService.linkIssues.mockResolvedValue(undefined);

    const result = await jiraLinkIssuesTool.execute(
      { sourceKey: 'PROJ-100', targetKeys: ['PROJ-200'], linkType: 'relates to' },
      mockContext,
    );
    const data = result.data as Record<string, unknown>;
    expect(data.sourceKey).toBe('PROJ-100');
    expect(data.linked).toEqual(['PROJ-200']);
    expect(data.linkType).toBe('relates to');
  });

  itAssertion('housekeeping.undo.summary-card', async () => {
    // The tool returns a human-readable summary for the card
    mockJiraService.isEnabled.mockReturnValue(true);
    mockJiraService.linkIssues.mockResolvedValue(undefined);

    const result = await jiraLinkIssuesTool.execute(
      { sourceKey: 'PROJ-100', targetKeys: ['PROJ-200'], linkType: 'relates to' },
      mockContext,
    );
    expect(result.summary).toContain('PROJ-100');
    expect(result.summary).toContain('PROJ-200');
  });
});
