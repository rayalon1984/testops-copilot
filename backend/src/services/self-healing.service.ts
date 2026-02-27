/**
 * Self-Healing Service — Intelligent pipeline auto-recovery.
 *
 * Evaluates failed test runs against healing rules (built-in transient
 * patterns + user-defined rules).  When a match is found, executes the
 * prescribed action (retry, quarantine, fix PR, notify) respecting the
 * user's autonomy preference and circuit-breaker limits.
 *
 * Phase 1: Auto-Retry for Transient Failures
 * Phase 2: Flaky Test Quarantine  (action = 'quarantine')
 * Phase 3: AI-Suggested Fix PRs   (action = 'fix_pr')
 *
 * CRUD operations live in ./healing-queries.service.ts
 * Built-in patterns live in ./healing-patterns.ts
 */

import { prisma } from '../lib/prisma';
import { normalizeErrorMessage, calculateSimilarity } from './failure-fingerprint';
import { getUserAutonomyLevel } from './ai/autonomy.service';
import { logger } from '../utils/logger';
import { BUILT_IN_PATTERNS, MAX_RETRIES_PER_PIPELINE_PER_HOUR } from './healing-patterns';
import { HealingQueriesService } from './healing-queries.service';
import type {
  HealingEvaluation,
  HealingAction,
  BuiltInPattern,
} from '../types/healing';

// ─── Service ────────────────────────────────────────────

export class SelfHealingService {
  // ── Evaluation ──────────────────────────────────────────

  /**
   * Evaluate a failed test run against all enabled healing rules.
   * Returns the best matching healing action, or null if no match.
   */
  static async evaluate(testRunId: string): Promise<HealingEvaluation | null> {
    const testRun = await prisma.testRun.findUnique({
      where: { id: testRunId },
      include: {
        results: {
          where: { status: 'FAILED' },
          take: 10,
        },
      },
    });

    if (!testRun || testRun.status !== 'FAILED') {
      return null;
    }

    // Collect all error messages from failed test results
    const errors = testRun.results
      .map(r => r.error || '')
      .filter(Boolean);

    if (errors.length === 0) {
      return null;
    }

    // Fetch all enabled rules, ordered by priority (lower = higher priority)
    const rules = await prisma.healingRule.findMany({
      where: { enabled: true },
      orderBy: { priority: 'asc' },
    });

    // Try each rule against each error message
    for (const rule of rules) {
      for (const error of errors) {
        const match = SelfHealingService.matchRule(rule, error);
        if (match && match.confidence >= rule.confidenceThreshold) {
          return {
            ruleId: rule.id,
            ruleName: rule.name,
            action: rule.action as HealingAction,
            confidence: match.confidence,
            matchReason: match.reason,
            testRunId,
            pipelineId: testRun.pipelineId,
            errorMessage: error.substring(0, 500),
          };
        }
      }
    }

    return null;
  }

  /**
   * Match a single rule against an error message.
   * Returns confidence + reason if matched, null otherwise.
   */
  static matchRule(
    rule: { pattern: string; patternType: string; name: string },
    errorMessage: string,
  ): { confidence: number; reason: string } | null {
    const normalized = normalizeErrorMessage(errorMessage);
    const lowerError = errorMessage.toLowerCase();

    switch (rule.patternType) {
      case 'regex': {
        try {
          const regex = new RegExp(rule.pattern, 'i');
          const directMatch = regex.test(errorMessage);
          const normalizedMatch = regex.test(normalized);

          if (directMatch) {
            return { confidence: 1.0, reason: `Regex match (${rule.name}): pattern matched raw error` };
          }
          if (normalizedMatch) {
            return { confidence: 0.9, reason: `Regex match (${rule.name}): pattern matched normalized error` };
          }
        } catch {
          logger.warn(`Invalid regex in healing rule "${rule.name}": ${rule.pattern}`);
        }
        return null;
      }

      case 'keyword': {
        const keywords = rule.pattern.toLowerCase().split(',').map(k => k.trim());
        const matchedKeywords = keywords.filter(k => lowerError.includes(k));

        if (matchedKeywords.length === keywords.length) {
          return { confidence: 1.0, reason: `All keywords matched (${rule.name})` };
        }
        if (matchedKeywords.length > 0) {
          const ratio = matchedKeywords.length / keywords.length;
          if (ratio >= 0.5) {
            return { confidence: ratio, reason: `${matchedKeywords.length}/${keywords.length} keywords matched (${rule.name})` };
          }
        }
        return null;
      }

      case 'signature': {
        const similarity = calculateSimilarity(normalized, rule.pattern.toLowerCase());
        if (similarity >= 0.6) {
          return { confidence: similarity, reason: `Signature similarity ${(similarity * 100).toFixed(0)}% (${rule.name})` };
        }
        return null;
      }

      default:
        return null;
    }
  }

  // ── Execution ───────────────────────────────────────────

  /**
   * Execute a healing action (retry, notify, etc.)
   * Respects autonomy preference and circuit-breaker limits.
   */
  static async execute(
    evaluation: HealingEvaluation,
    userId: string,
  ): Promise<{ eventId: string; executed: boolean; reason: string }> {
    const autonomy = await getUserAutonomyLevel(userId);

    // Create audit event
    const event = await prisma.healingEvent.create({
      data: {
        ruleId: evaluation.ruleId,
        testRunId: evaluation.testRunId,
        pipelineId: evaluation.pipelineId,
        action: evaluation.action,
        status: 'pending',
        matchConfidence: evaluation.confidence,
        matchReason: evaluation.matchReason,
        errorMessage: evaluation.errorMessage,
      },
    });

    // Check circuit breaker
    const canRetry = await SelfHealingService.canRetry(evaluation.pipelineId);
    if (!canRetry && evaluation.action === 'retry') {
      await prisma.healingEvent.update({
        where: { id: event.id },
        data: { status: 'skipped', completedAt: new Date(), metadata: JSON.stringify({ reason: 'Circuit breaker: max retries exceeded' }) },
      });

      logger.info(`Self-healing skipped (circuit breaker): pipeline=${evaluation.pipelineId}`);
      return { eventId: event.id, executed: false, reason: 'Circuit breaker: max retries per hour exceeded' };
    }

    // Autonomy check
    if (autonomy === 'conservative') {
      await prisma.healingEvent.update({
        where: { id: event.id },
        data: { status: 'skipped', completedAt: new Date(), metadata: JSON.stringify({ reason: 'User autonomy is conservative — suggested only' }) },
      });

      logger.info(`Self-healing suggested (conservative autonomy): rule=${evaluation.ruleName}`);
      return { eventId: event.id, executed: false, reason: `Suggested: ${evaluation.matchReason}` };
    }

    // Execute the action
    try {
      await prisma.healingEvent.update({
        where: { id: event.id },
        data: { status: 'executing' },
      });

      switch (evaluation.action) {
        case 'retry':
          return await SelfHealingService.executeRetry(event.id, evaluation, userId);
        case 'notify':
          return await SelfHealingService.executeNotify(event.id, evaluation);
        case 'quarantine':
          return await SelfHealingService.executeQuarantine(event.id, evaluation, userId);
        case 'fix_pr':
          return await SelfHealingService.executeFixPR(event.id, evaluation);
        default:
          return { eventId: event.id, executed: false, reason: `Unknown action: ${evaluation.action}` };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      await prisma.healingEvent.update({
        where: { id: event.id },
        data: { status: 'failed', completedAt: new Date(), metadata: JSON.stringify({ error: message }) },
      });

      logger.error(`Self-healing execution failed: ${message}`, { ruleId: evaluation.ruleId });
      return { eventId: event.id, executed: false, reason: `Execution failed: ${message}` };
    }
  }

  /** Execute retry: create a new test run. */
  private static async executeRetry(
    eventId: string,
    evaluation: HealingEvaluation,
    _userId: string,
  ): Promise<{ eventId: string; executed: boolean; reason: string }> {
    const originalRun = await prisma.testRun.findUnique({
      where: { id: evaluation.testRunId },
    });

    if (!originalRun) throw new Error('Original test run not found');

    const retriedRun = await prisma.testRun.create({
      data: {
        pipelineId: evaluation.pipelineId,
        userId: originalRun.userId,
        name: `${originalRun.name} (auto-retry)`,
        status: 'PENDING',
        branch: originalRun.branch,
        commit: originalRun.commit,
        metadata: JSON.stringify({
          autoRetry: true,
          originalRunId: evaluation.testRunId,
          healingEventId: eventId,
          healingRule: evaluation.ruleName,
        }),
      },
    });

    await prisma.healingEvent.update({
      where: { id: eventId },
      data: { status: 'succeeded', completedAt: new Date(), retriedRunId: retriedRun.id },
    });

    if (evaluation.ruleId) {
      await prisma.healingRule.update({
        where: { id: evaluation.ruleId },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma increment
        data: { updatedAt: new Date() } as any,
      });
    }

    logger.info(`Self-healing retry executed: pipeline=${evaluation.pipelineId}, newRun=${retriedRun.id}`, {
      rule: evaluation.ruleName, confidence: evaluation.confidence,
    });

    return { eventId, executed: true, reason: `Auto-retry triggered: ${evaluation.matchReason}. New run: ${retriedRun.id}` };
  }

  /** Execute notify: log the evaluation for user review. */
  private static async executeNotify(
    eventId: string,
    evaluation: HealingEvaluation,
  ): Promise<{ eventId: string; executed: boolean; reason: string }> {
    await prisma.healingEvent.update({
      where: { id: eventId },
      data: { status: 'succeeded', completedAt: new Date(), metadata: JSON.stringify({ notified: true }) },
    });

    logger.info(`Self-healing notification: ${evaluation.matchReason}`, {
      rule: evaluation.ruleName, pipeline: evaluation.pipelineId,
    });

    return { eventId, executed: true, reason: `Notification sent: ${evaluation.matchReason}` };
  }

  /** Execute quarantine: mark a flaky test for skip. */
  private static async executeQuarantine(
    eventId: string,
    evaluation: HealingEvaluation,
    userId: string,
  ): Promise<{ eventId: string; executed: boolean; reason: string }> {
    const testRun = await prisma.testRun.findUnique({
      where: { id: evaluation.testRunId },
      include: { results: { where: { status: 'FAILED' }, take: 1 } },
    });

    const testName = testRun?.results[0]?.name || testRun?.name || 'unknown-test';
    const existing = await prisma.quarantinedTest.findUnique({ where: { testName } });

    if (existing && existing.status === 'quarantined') {
      await prisma.quarantinedTest.update({
        where: { testName },
        data: { occurrenceCount: { increment: 1 } },
      });
    } else {
      await prisma.quarantinedTest.upsert({
        where: { testName },
        create: {
          testName,
          reason: evaluation.matchReason,
          severity: 'MEDIUM',
          quarantinedBy: userId === 'system' ? 'auto' : userId,
          healingEventId: eventId,
          flakinessScore: evaluation.confidence,
          status: 'quarantined',
        },
        update: {
          reason: evaluation.matchReason,
          status: 'quarantined',
          healingEventId: eventId,
          flakinessScore: evaluation.confidence,
          occurrenceCount: { increment: 1 },
        },
      });
    }

    await prisma.healingEvent.update({
      where: { id: eventId },
      data: { status: 'succeeded', completedAt: new Date(), metadata: JSON.stringify({ quarantinedTest: testName }) },
    });

    logger.info(`Self-healing quarantine: test="${testName}"`, {
      rule: evaluation.ruleName, confidence: evaluation.confidence,
    });

    return { eventId, executed: true, reason: `Test "${testName}" quarantined: ${evaluation.matchReason}` };
  }

  /** Execute fix_pr: look up known RCA, generate a suggested fix. */
  private static async executeFixPR(
    eventId: string,
    evaluation: HealingEvaluation,
  ): Promise<{ eventId: string; executed: boolean; reason: string }> {
    const similarFailures = await prisma.failureArchive.findMany({
      where: { rcaDocumented: true, resolved: true, solution: { not: null } },
      take: 20,
      orderBy: { lastOccurrence: 'desc' },
    });

    let bestMatch: { id: string; testName: string; rootCause: string | null; solution: string | null; prevention: string | null; similarity: number } | null = null;
    const normalizedError = normalizeErrorMessage(evaluation.errorMessage);

    for (const failure of similarFailures) {
      const similarity = calculateSimilarity(normalizedError, normalizeErrorMessage(failure.errorMessage));
      if (similarity >= 0.5 && (!bestMatch || similarity > bestMatch.similarity)) {
        bestMatch = { id: failure.id, testName: failure.testName, rootCause: failure.rootCause, solution: failure.solution, prevention: failure.prevention, similarity };
      }
    }

    const testRun = await prisma.testRun.findUnique({
      where: { id: evaluation.testRunId },
      include: { pipeline: true },
    });

    const repository = testRun?.pipeline?.repository;
    const fixSuggestion = {
      rcaMatch: bestMatch ? { failureArchiveId: bestMatch.id, testName: bestMatch.testName, rootCause: bestMatch.rootCause, solution: bestMatch.solution, prevention: bestMatch.prevention, similarity: bestMatch.similarity } : null,
      errorMessage: evaluation.errorMessage,
      matchReason: evaluation.matchReason,
      repository,
      branch: testRun?.branch,
      commit: testRun?.commit,
      suggestedAction: bestMatch?.solution ? `Apply known fix: ${bestMatch.solution.substring(0, 200)}` : 'No documented fix found — manual investigation recommended',
      canAutoFix: !!bestMatch?.solution && !!repository,
    };

    await prisma.healingEvent.update({
      where: { id: eventId },
      data: { status: bestMatch ? 'succeeded' : 'failed', completedAt: new Date(), metadata: JSON.stringify(fixSuggestion) },
    });

    if (bestMatch) {
      logger.info(`Self-healing fix suggestion: RCA match ${(bestMatch.similarity * 100).toFixed(0)}%`, {
        rule: evaluation.ruleName, failureArchiveId: bestMatch.id, repository,
      });
      return { eventId, executed: true, reason: `Fix suggested (${(bestMatch.similarity * 100).toFixed(0)}% RCA match): ${bestMatch.solution?.substring(0, 100) || 'See RCA'}` };
    }

    logger.info(`Self-healing fix: no matching RCA found`, { rule: evaluation.ruleName, pipeline: evaluation.pipelineId });
    return { eventId, executed: false, reason: 'No documented RCA match found — manual investigation recommended' };
  }

  // ── Circuit Breaker ─────────────────────────────────────

  static async canRetry(pipelineId: string): Promise<boolean> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentRetries = await prisma.healingEvent.count({
      where: { pipelineId, action: 'retry', status: 'succeeded', createdAt: { gte: oneHourAgo } },
    });
    return recentRetries < MAX_RETRIES_PER_PIPELINE_PER_HOUR;
  }

  // ── Delegated CRUD (backward-compatible API) ───────────

  static getRules = HealingQueriesService.getRules;
  static getRuleById = HealingQueriesService.getRuleById;
  static createRule = HealingQueriesService.createRule;
  static updateRule = HealingQueriesService.updateRule;
  static toggleRule = HealingQueriesService.toggleRule;
  static deleteRule = HealingQueriesService.deleteRule;
  static getQuarantinedTests = HealingQueriesService.getQuarantinedTests;
  static getAllQuarantinedTests = HealingQueriesService.getAllQuarantinedTests;
  static quarantineTest = HealingQueriesService.quarantineTest;
  static reinstateTest = HealingQueriesService.reinstateTest;
  static deleteQuarantinedTest = HealingQueriesService.deleteQuarantinedTest;
  static getQuarantineStats = HealingQueriesService.getQuarantineStats;
  static getEvents = HealingQueriesService.getEvents;
  static getStats = HealingQueriesService.getStats;
  static getFixSuggestions = HealingQueriesService.getFixSuggestions;
  static seedBuiltInRules = HealingQueriesService.seedBuiltInRules;

  /** Expose built-in patterns for testing */
  static getBuiltInPatterns(): BuiltInPattern[] {
    return [...BUILT_IN_PATTERNS];
  }
}
