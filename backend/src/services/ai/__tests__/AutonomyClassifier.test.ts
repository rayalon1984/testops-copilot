/**
 * Unit Tests — AutonomyClassifier
 *
 * Validates the three-tier graduated autonomy model:
 *   Tier 1: Full Autonomy (auto-execute)
 *   Tier 2: AI-in-the-Loop (one-click card)
 *   Tier 3: Human-in-the-Loop (full confirmation)
 */

import { classifyTool, isGatedTool } from '../AutonomyClassifier';
import type { Tool } from '../tools/types';

// Mock the logger to keep test output clean
jest.mock('@/utils/logger', () => ({
  __esModule: true,
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

/** Helper to build a minimal Tool stub for testing */
function makeTool(name: string, opts: Partial<Tool> = {}): Tool {
  return {
    name,
    description: `Test tool ${name}`,
    category: 'jira',
    parameters: [],
    requiresConfirmation: false,
    async execute() {
      return { success: true, summary: 'ok' };
    },
    ...opts,
  };
}

// ─── Static Tier Map (defaults) ────────────────────────────────────────

describe('AutonomyClassifier', () => {
  describe('static tier map — read-only tools are always Tier 1', () => {
    const readOnlyTools = [
      'jira_search',
      'jira_get',
      'github_get_commit',
      'github_get_pr',
      'confluence_search',
      'jenkins_get_status',
      'dashboard_metrics',
      'failure_predictions',
    ];

    it.each(readOnlyTools)('%s → Tier 1, autoExecute=true', (toolName) => {
      const result = classifyTool(makeTool(toolName), { autonomyLevel: 'balanced' });
      expect(result.tier).toBe(1);
      expect(result.autoExecute).toBe(true);
    });
  });

  describe('static tier map — write tools default tiers', () => {
    const writeTierCases: [string, 1 | 2 | 3][] = [
      ['jira_create_issue', 2],
      ['jira_transition_issue', 3],
      ['jira_comment', 2],
      ['github_create_pr', 2],
      ['github_create_branch', 1],
      ['github_update_file', 3],
      ['github_rerun_workflow', 2],
      ['jenkins_trigger_build', 2],
      ['testrun_cancel', 3],
      ['testrun_retry', 2],
      ['jira_link_issues', 1],
      ['jira_add_label', 1],
      ['github_merge_pr', 2],
      ['giphy_search', 1],
    ];

    it.each(writeTierCases)('%s → default Tier %i (balanced)', (toolName, expectedTier) => {
      const result = classifyTool(makeTool(toolName), { autonomyLevel: 'balanced' });
      expect(result.tier).toBe(expectedTier);
    });
  });

  describe('unknown tool defaults to Tier 2', () => {
    it('should classify an unregistered tool as Tier 2', () => {
      const result = classifyTool(makeTool('unknown_tool'), { autonomyLevel: 'balanced' });
      expect(result.tier).toBe(2);
      expect(result.autoExecute).toBe(false);
    });
  });

  // ─── Context-Dependent Overrides ───────────────────────────────────────

  describe('context overrides — testrun_retry', () => {
    it('promotes to Tier 1 when confidence > 0.9 and retryCount < 2', () => {
      const result = classifyTool(makeTool('testrun_retry'), {
        autonomyLevel: 'balanced',
        confidence: 0.95,
        retryCount: 0,
      });
      expect(result.tier).toBe(1);
      expect(result.autoExecute).toBe(true);
      expect(result.reason).toContain('Transient failure');
    });

    it('stays at Tier 2 when confidence is below threshold', () => {
      const result = classifyTool(makeTool('testrun_retry'), {
        autonomyLevel: 'balanced',
        confidence: 0.85,
        retryCount: 0,
      });
      expect(result.tier).toBe(2);
    });

    it('stays at Tier 2 when retryCount >= 2 (prevent infinite loops)', () => {
      const result = classifyTool(makeTool('testrun_retry'), {
        autonomyLevel: 'balanced',
        confidence: 0.95,
        retryCount: 2,
      });
      expect(result.tier).toBe(2);
    });
  });

  describe('context overrides — github_rerun_workflow', () => {
    it('promotes to Tier 1 when confidence > 0.9 (transient CI failure)', () => {
      const result = classifyTool(makeTool('github_rerun_workflow'), {
        autonomyLevel: 'balanced',
        confidence: 0.95,
      });
      expect(result.tier).toBe(1);
      expect(result.autoExecute).toBe(true);
    });

    it('stays at Tier 2 when confidence is low', () => {
      const result = classifyTool(makeTool('github_rerun_workflow'), {
        autonomyLevel: 'balanced',
        confidence: 0.7,
      });
      expect(result.tier).toBe(2);
    });
  });

  describe('context overrides — jenkins_trigger_build', () => {
    it('escalates to Tier 3 in production', () => {
      const result = classifyTool(makeTool('jenkins_trigger_build'), {
        autonomyLevel: 'balanced',
        isProduction: true,
      });
      expect(result.tier).toBe(3);
      expect(result.autoExecute).toBe(false);
      expect(result.reason).toContain('Production');
    });

    it('stays at Tier 2 in non-production', () => {
      const result = classifyTool(makeTool('jenkins_trigger_build'), {
        autonomyLevel: 'balanced',
        isProduction: false,
      });
      expect(result.tier).toBe(2);
    });
  });

  describe('context overrides — jira_comment', () => {
    it('promotes to Tier 1 for AI investigation notes ([AI Investigation] prefix)', () => {
      const result = classifyTool(makeTool('jira_comment'), {
        autonomyLevel: 'balanced',
        toolArgs: { body: '[AI Investigation] Found root cause: timeout in EU region' },
      });
      expect(result.tier).toBe(1);
      expect(result.autoExecute).toBe(true);
      expect(result.reason).toContain('investigation note');
    });

    it('promotes to Tier 1 for auto-notes ([Auto] prefix)', () => {
      const result = classifyTool(makeTool('jira_comment'), {
        autonomyLevel: 'balanced',
        toolArgs: { comment: '[Auto] Linked related issues' },
      });
      expect(result.tier).toBe(1);
    });

    it('stays at Tier 2 for regular comments', () => {
      const result = classifyTool(makeTool('jira_comment'), {
        autonomyLevel: 'balanced',
        toolArgs: { body: 'Looks like a flaky test' },
      });
      expect(result.tier).toBe(2);
    });
  });

  // ─── User Preference Overrides ─────────────────────────────────────────

  describe('user preference — conservative', () => {
    it('escalates Tier 1 write tools to Tier 2', () => {
      // github_create_branch is Tier 1 by default
      const result = classifyTool(makeTool('github_create_branch'), {
        autonomyLevel: 'conservative',
      });
      expect(result.tier).toBe(2);
      expect(result.autoExecute).toBe(false);
    });

    it('keeps Tier 3 as Tier 3', () => {
      const result = classifyTool(makeTool('jira_transition_issue'), {
        autonomyLevel: 'conservative',
      });
      expect(result.tier).toBe(3);
    });

    it('keeps read-only Tier 1 tools at Tier 2 (conservative treats everything as gated)', () => {
      const result = classifyTool(makeTool('jira_search'), {
        autonomyLevel: 'conservative',
      });
      // Read-only tools start at Tier 1, conservative pushes to Tier 2
      expect(result.tier).toBe(2);
      expect(result.autoExecute).toBe(false);
    });
  });

  describe('user preference — autonomous', () => {
    it('demotes Tier 2 to Tier 1 (auto-execute)', () => {
      const result = classifyTool(makeTool('jira_create_issue'), {
        autonomyLevel: 'autonomous',
      });
      expect(result.tier).toBe(1);
      expect(result.autoExecute).toBe(true);
    });

    it('keeps Tier 3 as Tier 3 (never auto-executes destructive actions)', () => {
      const result = classifyTool(makeTool('jira_transition_issue'), {
        autonomyLevel: 'autonomous',
      });
      expect(result.tier).toBe(3);
      expect(result.autoExecute).toBe(false);
    });

    it('keeps Tier 1 as Tier 1', () => {
      const result = classifyTool(makeTool('jira_search'), {
        autonomyLevel: 'autonomous',
      });
      expect(result.tier).toBe(1);
      expect(result.autoExecute).toBe(true);
    });
  });

  describe('user preference — balanced (default)', () => {
    it('respects classification as-is', () => {
      const tier1 = classifyTool(makeTool('jira_search'), { autonomyLevel: 'balanced' });
      const tier2 = classifyTool(makeTool('jira_create_issue'), { autonomyLevel: 'balanced' });
      const tier3 = classifyTool(makeTool('testrun_cancel'), { autonomyLevel: 'balanced' });

      expect(tier1.tier).toBe(1);
      expect(tier2.tier).toBe(2);
      expect(tier3.tier).toBe(3);
    });
  });

  // ─── Combined Context + Preference ─────────────────────────────────────

  describe('combined: context override + user preference', () => {
    it('conservative overrides context promotion (testrun_retry with high confidence)', () => {
      // Context would promote to Tier 1, but conservative pushes back to Tier 2
      const result = classifyTool(makeTool('testrun_retry'), {
        autonomyLevel: 'conservative',
        confidence: 0.95,
        retryCount: 0,
      });
      expect(result.tier).toBe(2);
      expect(result.autoExecute).toBe(false);
    });

    it('autonomous demotes jenkins_trigger_build from Tier 2 to Tier 1 in non-prod', () => {
      const result = classifyTool(makeTool('jenkins_trigger_build'), {
        autonomyLevel: 'autonomous',
        isProduction: false,
      });
      expect(result.tier).toBe(1);
      expect(result.autoExecute).toBe(true);
    });

    it('autonomous still respects Tier 3 for production jenkins builds', () => {
      const result = classifyTool(makeTool('jenkins_trigger_build'), {
        autonomyLevel: 'autonomous',
        isProduction: true,
      });
      expect(result.tier).toBe(3);
      expect(result.autoExecute).toBe(false);
    });
  });

  // ─── autoExecute flag ──────────────────────────────────────────────────

  describe('autoExecute flag', () => {
    it('is true only when final tier is 1', () => {
      const tier1 = classifyTool(makeTool('jira_search'), { autonomyLevel: 'balanced' });
      const tier2 = classifyTool(makeTool('jira_create_issue'), { autonomyLevel: 'balanced' });
      const tier3 = classifyTool(makeTool('testrun_cancel'), { autonomyLevel: 'balanced' });

      expect(tier1.autoExecute).toBe(true);
      expect(tier2.autoExecute).toBe(false);
      expect(tier3.autoExecute).toBe(false);
    });
  });

  // ─── isGatedTool ───────────────────────────────────────────────────────

  describe('isGatedTool', () => {
    it('returns false for read-only Tier 1 tools', () => {
      expect(isGatedTool('jira_search')).toBe(false);
      expect(isGatedTool('github_get_pr')).toBe(false);
      expect(isGatedTool('dashboard_metrics')).toBe(false);
    });

    it('returns true for Tier 2+ tools', () => {
      expect(isGatedTool('jira_create_issue')).toBe(true);
      expect(isGatedTool('jira_transition_issue')).toBe(true);
      expect(isGatedTool('github_update_file')).toBe(true);
    });

    it('returns false for Tier 1 write tools', () => {
      expect(isGatedTool('github_create_branch')).toBe(false);
      expect(isGatedTool('jira_link_issues')).toBe(false);
      expect(isGatedTool('jira_add_label')).toBe(false);
    });

    it('returns false for unknown tools (not in map)', () => {
      expect(isGatedTool('nonexistent_tool')).toBe(false);
    });
  });
});
