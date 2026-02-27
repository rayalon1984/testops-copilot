/**
 * Self-Healing Pipeline Types
 *
 * Type definitions for the auto-retry, quarantine, and fix-PR features.
 */

// ─── Enums ───────────────────────────────────────────────

export type HealingAction = 'retry' | 'quarantine' | 'fix_pr' | 'notify';
export type PatternType = 'regex' | 'keyword' | 'signature';
export type HealingCategory = 'transient' | 'infrastructure' | 'flaky' | 'custom';
export type HealingEventStatus = 'pending' | 'executing' | 'succeeded' | 'failed' | 'skipped';

// ─── Rule CRUD ───────────────────────────────────────────

export interface CreateHealingRuleInput {
  name: string;
  description: string;
  pattern: string;
  patternType?: PatternType;
  category?: HealingCategory;
  action?: HealingAction;
  maxRetries?: number;
  cooldownMinutes?: number;
  confidenceThreshold?: number;
  priority?: number;
}

export interface UpdateHealingRuleInput {
  name?: string;
  description?: string;
  pattern?: string;
  patternType?: PatternType;
  category?: HealingCategory;
  action?: HealingAction;
  maxRetries?: number;
  cooldownMinutes?: number;
  confidenceThreshold?: number;
  enabled?: boolean;
  priority?: number;
}

// ─── Evaluation result ──────────────────────────────────

export interface HealingEvaluation {
  ruleId: string;
  ruleName: string;
  action: HealingAction;
  confidence: number;
  matchReason: string;
  testRunId: string;
  pipelineId: string;
  errorMessage: string;
}

// ─── Event filters ──────────────────────────────────────

export interface HealingEventFilters {
  pipelineId?: string;
  testRunId?: string;
  action?: HealingAction;
  status?: HealingEventStatus;
  limit?: number;
}

// ─── Built-in patterns ──────────────────────────────────

export interface BuiltInPattern {
  name: string;
  description: string;
  pattern: string;
  patternType: PatternType;
  category: HealingCategory;
  action: HealingAction;
  confidenceThreshold: number;
  priority: number;
}
