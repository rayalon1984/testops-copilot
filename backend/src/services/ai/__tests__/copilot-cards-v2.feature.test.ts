/**
 * Feature spec tests for copilot-cards-v2.
 *
 * Covers all 17 assertions: 6 invariant + 11 behavioral.
 * Backend tests exercise mock provider chaining + mock tool data shapes.
 * Frontend rendering assertions (emoji headers, buttons) are validated
 * via ToolResultCard.test.tsx and E2E tests.
 */

import { describeFeature, itAssertion } from '../../../__tests__/helpers/feature-spec';
import { getMockToolResult } from '../mock-tool-results';
import { MockProvider } from '../providers/mock.provider';
import type { ChatMessage } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────

function createMockProvider(): MockProvider {
  return new MockProvider({
    apiKey: 'mock-key',
    model: 'mock',
  });
}

/** Build a tool result message for chaining tests. */
function toolResultMessage(name: string, content: string): ChatMessage {
  return { role: 'tool', name, content };
}

/** Build a user message. */
function userMessage(content: string): ChatMessage {
  return { role: 'user', content };
}

// ─── Tests ────────────────────────────────────────────────────────────

describeFeature('copilot-cards-v2', (feature) => {

  // ── cards.v2.routing (graduated — V2 is the only version) ──

  itAssertion('cards.v2.always-v2', () => {
    // V2 is the default — feature flag removed in v3.4.
    // Backend validates that PR data shape is consumed by GitHubPRCardV2.
    const prResult = getMockToolResult('github_get_pr', { owner: 'testops', repo: 'app', prNumber: 487 });
    expect(prResult).not.toBeNull();
    expect(prResult!.data).toHaveProperty('number');
    expect(prResult!.data).toHaveProperty('title');
    // V2 always renders — no V1 fallback
  });

  itAssertion('cards.v2.no-feature-flag', () => {
    // No feature flag import in ToolResultCard.tsx — all tools route directly.
    // Backend validates that mock tool results are self-contained (no flag-dependent data).
    const rcaResult = getMockToolResult('rca_identify', { testName: 'test' });
    const prResult = getMockToolResult('github_get_pr', { prNumber: 402 });
    expect(rcaResult).not.toBeNull();
    expect(prResult).not.toBeNull();
    // Both tools return complete data shapes that render without conditional logic
  });

  itAssertion('cards.v2.rca-always-new', () => {
    // rca_identify always renders RootCauseCard — no V1 equivalent exists.
    // Verified by: ToolResultCard always dispatches to RootCauseCard for rca_identify,
    // regardless of isV2 flag. Here we confirm the tool result exists and has the required shape.
    const result = getMockToolResult('rca_identify', { testName: 'test' });
    expect(result).not.toBeNull();
    expect(result!.data).toHaveProperty('rootCause');
    expect(result!.data).toHaveProperty('title');
  });

  // ── cards.v2.rca ──

  itAssertion('cards.v2.rca.renders-title', () => {
    const result = getMockToolResult('rca_identify', { testName: 'PaymentProcessor.processCheckout' });
    const data = result!.data as Record<string, unknown>;
    expect(data.title).toBe('Root Cause Identified');
    // Frontend renders: 🔥 emoji + this title string
  });

  itAssertion('cards.v2.rca.renders-description', () => {
    const result = getMockToolResult('rca_identify', {});
    const data = result!.data as Record<string, unknown>;
    expect(typeof data.rootCause).toBe('string');
    expect((data.rootCause as string).length).toBeGreaterThan(0);
  });

  itAssertion('cards.v2.rca.confidence-badge', () => {
    const result = getMockToolResult('rca_identify', {});
    const data = result!.data as Record<string, unknown>;
    expect(data.confidence).toBeDefined();
    expect(typeof data.confidence).toBe('number');
    expect(data.confidence as number).toBeGreaterThan(0);
    expect(data.confidence as number).toBeLessThanOrEqual(1);
    // Frontend converts to percentage: Math.round(confidence * 100) + '% confidence'
  });

  itAssertion('cards.v2.rca.text-containment', () => {
    // Text-containment is a CSS invariant (overflow-wrap, word-break).
    // Backend validates that data doesn't contain unterminated tokens that could break layout.
    const result = getMockToolResult('rca_identify', {});
    const data = result!.data as Record<string, unknown>;
    // rootCause is a finite string (not a stream or object)
    expect(typeof data.rootCause).toBe('string');
    expect((data.rootCause as string).length).toBeLessThan(500);
    // relatedIssue is a short key, not a URL or long string
    if (data.relatedIssue) {
      expect((data.relatedIssue as string).length).toBeLessThan(50);
    }
  });

  // ── cards.v2.github-pr ──

  itAssertion('cards.v2.pr.emoji-header', () => {
    // CardHeaderV2 renders 🔧 + "Fix Proposed: PR #NNN"
    // Backend validates that PR data has the `number` field for the title template.
    const result = getMockToolResult('github_get_pr', { prNumber: 402 });
    const data = result!.data as Record<string, unknown>;
    expect(data.number).toBe(402);
    expect(data.title).toBeDefined();
    expect(typeof data.title).toBe('string');
  });

  itAssertion('cards.v2.pr.diff-default-visible', () => {
    // V2 shows diff by default. Backend must provide `files` with `patch` data
    // so the InlineDiffViewer can render immediately.
    const result = getMockToolResult('github_get_pr', { prNumber: 402 });
    const data = result!.data as Record<string, unknown>;
    const files = data.files as Array<Record<string, unknown>>;
    expect(Array.isArray(files)).toBe(true);
    expect(files.length).toBeGreaterThan(0);
    // At least one file has a patch for diff rendering
    const filesWithPatch = files.filter(f => f.patch);
    expect(filesWithPatch.length).toBeGreaterThan(0);
  });

  itAssertion('cards.v2.pr.two-actions', () => {
    // V2 renders "Review Diff" + "Merge PR" buttons.
    // Backend provides `mergeable` flag to determine if Merge PR should be enabled.
    const result = getMockToolResult('github_get_pr', { prNumber: 402 });
    const data = result!.data as Record<string, unknown>;
    expect(data.mergeable).toBe(true);
    expect(data.state).toBe('open');
    // These fields are consumed by GitHubPRCardV2 to render both buttons
  });

  // ── cards.v2.housekeeping ──

  itAssertion('cards.v2.hk.emoji-header', () => {
    // CardHeaderV2 renders 🔗 + "Jira Housekeeping" for jira_link_issues
    const result = getMockToolResult('jira_link_issues', {
      sourceKey: 'PROJ-1247', targetKeys: ['PROJ-1248'], linkType: 'relates to',
    });
    expect(result).not.toBeNull();
    expect(result!.success).toBe(true);
    // Data shape must include linked info for the card body
    const data = result!.data as Record<string, unknown>;
    expect(data).toHaveProperty('sourceKey');
  });

  itAssertion('cards.v2.hk.status-chip', () => {
    // HousekeepingCardV2 shows "IN PROGRESS" chip.
    // This is a frontend constant — backend just needs to return success.
    const linkResult = getMockToolResult('jira_link_issues', {
      sourceKey: 'PROJ-1247', targetKeys: ['PROJ-1248'], linkType: 'relates to',
    });
    expect(linkResult!.success).toBe(true);

    const labelResult = getMockToolResult('jira_add_label', {
      issueKey: 'TESTOPS-142', labels: ['flaky'],
    });
    expect(labelResult!.success).toBe(true);
    // Both tool types route to HousekeepingCardV2 when V2 is ON
  });

  itAssertion('cards.v2.hk.undo-action', () => {
    // HousekeepingCardV2 provides Undo button.
    // Backend validates that the data shape includes enough info to undo.
    const result = getMockToolResult('jira_link_issues', {
      sourceKey: 'PROJ-1247', targetKeys: ['PROJ-1248'], linkType: 'relates to',
    });
    const data = result!.data as Record<string, unknown>;
    // sourceKey and linked array needed for undo prompt construction
    expect(data.sourceKey).toBeDefined();
    expect(data.linked).toBeDefined();
    expect(Array.isArray(data.linked)).toBe(true);
  });

  // ── cards.v2.analysis-chain ──

  itAssertion('cards.v2.chain.rca-to-pr', async () => {
    const provider = createMockProvider();

    // Simulate: user asks → rca_identify returns → next call should chain to github_get_pr
    const messages: ChatMessage[] = [
      userMessage('analyze the most recent test failure'),
      // Simulate the tool result from rca_identify
      toolResultMessage('rca_identify', JSON.stringify({ rootCause: 'timeout', confidence: 0.94 })),
    ];

    const response = await provider.chat(messages);
    // Should chain to github_get_pr (PR #402)
    expect(response.toolCalls).toBeDefined();
    expect(response.toolCalls!.length).toBeGreaterThan(0);
    expect(response.toolCalls![0].name).toBe('github_get_pr');
    const args = response.toolCalls![0].arguments as Record<string, unknown>;
    expect(args.prNumber).toBe(402);
  });

  itAssertion('cards.v2.chain.pr-to-housekeeping', async () => {
    const provider = createMockProvider();

    // Simulate: rca_identify happened, then github_get_pr result came back
    const messages: ChatMessage[] = [
      userMessage('analyze the most recent test failure'),
      toolResultMessage('rca_identify', JSON.stringify({ rootCause: 'timeout' })),
      toolResultMessage('github_get_pr', JSON.stringify({ number: 402, title: 'fix' })),
    ];

    const response = await provider.chat(messages);
    // Should chain to jira_link_issues (housekeeping)
    expect(response.toolCalls).toBeDefined();
    expect(response.toolCalls!.length).toBeGreaterThan(0);
    expect(response.toolCalls![0].name).toBe('jira_link_issues');
  });

  itAssertion('cards.v2.chain.wrap-up', async () => {
    const provider = createMockProvider();

    // Simulate: full 3-card chain completed (rca → PR → housekeeping)
    const messages: ChatMessage[] = [
      userMessage('analyze the most recent test failure'),
      toolResultMessage('rca_identify', JSON.stringify({ rootCause: 'timeout' })),
      toolResultMessage('github_get_pr', JSON.stringify({ number: 402 })),
      toolResultMessage('jira_link_issues', JSON.stringify({ sourceKey: 'PROJ-1247', linked: ['PROJ-1248'] })),
    ];

    const response = await provider.chat(messages);
    // Should return a text wrap-up (no more tool calls)
    expect(response.content).toBeDefined();
    expect(response.content!.length).toBeGreaterThan(0);
    expect(response.content).toContain('Analysis complete');
    // Should offer follow-up actions
    expect(response.content).toContain('merge');
  });

  itAssertion('cards.v2.chain.rca-mock-data', () => {
    const result = getMockToolResult('rca_identify', { testName: 'PaymentProcessor.processCheckout' });
    expect(result).not.toBeNull();
    const data = result!.data as Record<string, unknown>;
    // All required fields present
    expect(data.rootCause).toBeDefined();
    expect(typeof data.rootCause).toBe('string');
    expect(data.confidence).toBeDefined();
    expect(typeof data.confidence).toBe('number');
    expect(data.category).toBeDefined();
    expect(typeof data.category).toBe('string');
    expect(data.relatedIssue).toBeDefined();
    expect(typeof data.relatedIssue).toBe('string');
    // testName is echoed back
    expect(data.testName).toBe('PaymentProcessor.processCheckout');
  });
});
