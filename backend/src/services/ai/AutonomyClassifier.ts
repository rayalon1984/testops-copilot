/**
 * AutonomyClassifier — Graduated Autonomy Tier Assignment
 *
 * Classifies every tool invocation into one of three tiers:
 *   Tier 1: Full Autonomy — AI acts, notifies after (reversible, internal)
 *   Tier 2: AI-in-the-Loop — AI prepares card, user one-clicks (team-visible)
 *   Tier 3: Human-in-the-Loop — Full confirmation with TTL (destructive/irreversible)
 *
 * The bright-line rule:
 *   Visible to the team = user decides. Internal/reversible = AI acts.
 *
 * See specs/AUTONOMOUS_AI_SPEC.md for the full decision framework.
 */

import { Tool } from './tools/types';
import { logger } from '@/utils/logger';

export type AutonomyTier = 1 | 2 | 3;

export type AutonomyLevel = 'conservative' | 'balanced' | 'autonomous';

export interface TierClassification {
    tier: AutonomyTier;
    reason: string;
    /** Whether the tool should auto-execute (Tier 1) or show a card */
    autoExecute: boolean;
}

interface ClassificationContext {
    /** User's autonomy preference from settings */
    autonomyLevel: AutonomyLevel;
    /** Confidence score from the AI's analysis (0.0–1.0), if available */
    confidence?: number;
    /** Whether the target environment is production */
    isProduction?: boolean;
    /** Number of times this action has been auto-retried in this session */
    retryCount?: number;
    /** The tool arguments (for context-dependent classification) */
    toolArgs?: Record<string, unknown>;
}

/**
 * Static tier overrides per tool name.
 * These define the DEFAULT tier for each tool. Context can promote
 * (move to a higher/safer tier) but never demote.
 */
const TOOL_TIER_MAP: Record<string, AutonomyTier> = {
    // Phase 1: Read-only tools — always auto-execute (not gated at all)
    jira_search: 1,
    jira_get: 1,
    github_get_commit: 1,
    github_get_pr: 1,
    confluence_search: 1,
    jenkins_get_status: 1,
    dashboard_metrics: 1,
    failure_predictions: 1,

    // Phase 2: Write tools — context-dependent
    jira_create_issue: 2,        // Team-visible: appears in backlog
    jira_transition_issue: 3,    // Triggers workflow automations
    jira_comment: 2,             // Visible to team (default; AI notes can be Tier 1)
    github_create_pr: 2,         // Team-visible: appears in repo
    github_create_branch: 1,     // Reversible, low-risk
    github_update_file: 3,       // Direct code mutation
    github_rerun_workflow: 2,    // Reversible, but costs CI minutes

    // Phase 3: Action-gap tools
    jenkins_trigger_build: 2,    // Context-dependent: prod=3, non-prod=2
    testrun_cancel: 3,           // Destructive
    testrun_retry: 2,            // Context-dependent: transient failure=1

    // New tools (Phase 3 spec)
    jira_link_issues: 1,         // Internal metadata, reversible
    jira_add_label: 1,           // Internal metadata, reversible
    github_merge_pr: 2,          // Team-visible, significant action
    giphy_search: 1,             // Read-only, personality layer
};

/**
 * Context-dependent tier adjustments.
 * These override the static map when specific conditions are met.
 */
function applyContextOverrides(
    tool: Tool,
    baseTier: AutonomyTier,
    ctx: ClassificationContext
): { tier: AutonomyTier; reason: string } {
    const toolName = tool.name;

    // testrun_retry: Tier 1 if transient failure with high confidence
    if (toolName === 'testrun_retry') {
        if (ctx.confidence && ctx.confidence > 0.9 && (!ctx.retryCount || ctx.retryCount < 2)) {
            return { tier: 1, reason: 'Transient failure with high confidence (>0.9), retry count < 2' };
        }
    }

    // github_rerun_workflow: Tier 1 if transient failure
    if (toolName === 'github_rerun_workflow') {
        if (ctx.confidence && ctx.confidence > 0.9) {
            return { tier: 1, reason: 'Transient CI failure with high confidence (>0.9)' };
        }
    }

    // jenkins_trigger_build: Tier 3 if production environment
    if (toolName === 'jenkins_trigger_build') {
        if (ctx.isProduction) {
            return { tier: 3, reason: 'Production build trigger requires explicit confirmation' };
        }
    }

    // jira_comment: Tier 1 for AI investigation notes (internal)
    if (toolName === 'jira_comment') {
        const body = String(ctx.toolArgs?.body || ctx.toolArgs?.comment || '');
        if (body.startsWith('[AI Investigation]') || body.startsWith('[Auto]')) {
            return { tier: 1, reason: 'AI investigation note — internal metadata' };
        }
    }

    return { tier: baseTier, reason: 'Default classification' };
}

/**
 * Apply user preference overrides.
 * Conservative: everything is Tier 2+
 * Balanced: respect the classification as-is
 * Autonomous: Tier 2 actions also auto-execute (only Tier 3 requires confirmation)
 */
function applyUserPreference(tier: AutonomyTier, level: AutonomyLevel): AutonomyTier {
    switch (level) {
        case 'conservative':
            // All write tools require at least a card (Tier 2)
            return Math.max(tier, 2) as AutonomyTier;
        case 'autonomous':
            // Only Tier 3 requires confirmation; Tier 2 auto-executes
            return tier === 2 ? 1 : tier;
        case 'balanced':
        default:
            return tier;
    }
}

/**
 * Classify a tool invocation into an autonomy tier.
 *
 * @param tool - The tool being invoked
 * @param ctx - Classification context (user prefs, confidence, environment)
 * @returns TierClassification with tier, reason, and autoExecute flag
 */
export function classifyTool(tool: Tool, ctx: ClassificationContext): TierClassification {
    // 1. Start with the static tier map (read-only tools are always Tier 1)
    const baseTier = TOOL_TIER_MAP[tool.name] ?? 2;

    // 2. Apply context-dependent overrides (can promote, never demote)
    const { tier: contextTier, reason } = applyContextOverrides(tool, baseTier, ctx);

    // 3. Apply user preference
    const finalTier = applyUserPreference(contextTier, ctx.autonomyLevel);

    const autoExecute = finalTier === 1;

    logger.info(
        `[AutonomyClassifier] ${tool.name}: base=${baseTier} → context=${contextTier} → final=${finalTier} (${ctx.autonomyLevel}) | autoExec=${autoExecute} | ${reason}`
    );

    return {
        tier: finalTier,
        reason,
        autoExecute,
    };
}

/**
 * Quick check: does a tool ever require any kind of gating?
 * Read-only tools return false. Write tools return true.
 * Used by the ReAct loop to skip classification for read-only tools.
 */
export function isGatedTool(toolName: string): boolean {
    const tier = TOOL_TIER_MAP[toolName];
    return tier !== undefined && tier > 1;
}
