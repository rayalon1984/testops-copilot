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
 */

import { prisma } from '../lib/prisma';
import { normalizeErrorMessage, calculateSimilarity } from './failure-fingerprint';
import { getUserAutonomyLevel } from './ai/autonomy.service';
import { logger } from '../utils/logger';
import type {
  CreateHealingRuleInput,
  UpdateHealingRuleInput,
  HealingEvaluation,
  HealingEventFilters,
  BuiltInPattern,
  HealingAction,
} from '../types/healing';

// ─── Built-in transient failure patterns ────────────────

const BUILT_IN_PATTERNS: BuiltInPattern[] = [
  {
    name: 'Network Timeout',
    description: 'Transient network connectivity failures (ETIMEDOUT, ECONNRESET, socket hang up)',
    pattern: '(ETIMEDOUT|ECONNRESET|ECONNREFUSED|socket hang up|network timeout|connection timed out)',
    patternType: 'regex',
    category: 'transient',
    action: 'retry',
    confidenceThreshold: 0.9,
    priority: 10,
  },
  {
    name: 'Docker Rate Limit',
    description: 'Docker Hub pull rate limiting (429 Too Many Requests)',
    pattern: '(too many requests|rate limit.*docker|docker\\.io.*429|pull rate limit)',
    patternType: 'regex',
    category: 'infrastructure',
    action: 'retry',
    confidenceThreshold: 0.95,
    priority: 20,
  },
  {
    name: 'npm Registry Error',
    description: 'npm registry transient failures (503, fetch errors)',
    pattern: '(npm ERR!.*50[0-9]|FETCH_ERROR|registry\\.npmjs\\.org.*error|ERESOLVE)',
    patternType: 'regex',
    category: 'transient',
    action: 'retry',
    confidenceThreshold: 0.9,
    priority: 15,
  },
  {
    name: 'Selenium Stale Element',
    description: 'Browser automation stale element or detached DOM errors',
    pattern: '(StaleElementReferenceException|element is not attached|element click intercepted|no such element)',
    patternType: 'regex',
    category: 'flaky',
    action: 'retry',
    confidenceThreshold: 0.85,
    priority: 30,
  },
  {
    name: 'DNS Resolution Failure',
    description: 'Transient DNS lookup failures',
    pattern: '(ENOTFOUND|getaddrinfo.*failed|DNS.*timeout|name resolution)',
    patternType: 'regex',
    category: 'transient',
    action: 'retry',
    confidenceThreshold: 0.9,
    priority: 10,
  },
  {
    name: 'Out of Memory',
    description: 'Process killed due to memory pressure',
    pattern: '(JavaScript heap out of memory|ENOMEM|OOMKilled|allocation failed)',
    patternType: 'regex',
    category: 'infrastructure',
    action: 'notify',
    confidenceThreshold: 0.95,
    priority: 5,
  },
  {
    name: 'Disk Space Exhausted',
    description: 'No disk space left on device',
    pattern: '(ENOSPC|No space left on device|disk space|disk quota exceeded)',
    patternType: 'regex',
    category: 'infrastructure',
    action: 'notify',
    confidenceThreshold: 0.95,
    priority: 5,
  },
  {
    name: 'Flaky Assertion Timeout',
    description: 'Test timeout waiting for async condition',
    pattern: '(Timeout.*waiting|exceeded timeout|waitFor.*timed out|async callback.*not.*invoked)',
    patternType: 'regex',
    category: 'flaky',
    action: 'retry',
    confidenceThreshold: 0.8,
    priority: 40,
  },
];

// ─── Circuit-breaker constants ──────────────────────────

const MAX_RETRIES_PER_PIPELINE_PER_HOUR = 2;

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

    // Autonomy check: only auto-execute retries for 'autonomous' users
    // 'balanced' users get retries auto-executed, 'conservative' gets notification only
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
          return await SelfHealingService.executeNotify(event.id, evaluation, userId);

        case 'quarantine':
          return await SelfHealingService.executeQuarantine(event.id, evaluation, userId);

        case 'fix_pr':
          return await SelfHealingService.executeFixPR(event.id, evaluation, userId);

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

  /**
   * Execute a retry action: create a new test run and trigger the pipeline.
   */
  private static async executeRetry(
    eventId: string,
    evaluation: HealingEvaluation,
    _userId: string,
  ): Promise<{ eventId: string; executed: boolean; reason: string }> {
    // Create a new test run record for the retry
    const originalRun = await prisma.testRun.findUnique({
      where: { id: evaluation.testRunId },
    });

    if (!originalRun) {
      throw new Error('Original test run not found');
    }

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

    // Update the healing event with the retried run ID
    await prisma.healingEvent.update({
      where: { id: eventId },
      data: {
        status: 'succeeded',
        completedAt: new Date(),
        retriedRunId: retriedRun.id,
      },
    });

    // Increment the rule's match count
    if (evaluation.ruleId) {
      await prisma.healingRule.update({
        where: { id: evaluation.ruleId },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma increment
        data: { updatedAt: new Date() } as any,
      });
    }

    logger.info(`Self-healing retry executed: pipeline=${evaluation.pipelineId}, newRun=${retriedRun.id}`, {
      rule: evaluation.ruleName,
      confidence: evaluation.confidence,
    });

    return {
      eventId,
      executed: true,
      reason: `Auto-retry triggered: ${evaluation.matchReason}. New run: ${retriedRun.id}`,
    };
  }

  /**
   * Execute a notify action: log the evaluation for user review.
   */
  private static async executeNotify(
    eventId: string,
    evaluation: HealingEvaluation,
    _userId: string,
  ): Promise<{ eventId: string; executed: boolean; reason: string }> {
    await prisma.healingEvent.update({
      where: { id: eventId },
      data: {
        status: 'succeeded',
        completedAt: new Date(),
        metadata: JSON.stringify({ notified: true }),
      },
    });

    logger.info(`Self-healing notification: ${evaluation.matchReason}`, {
      rule: evaluation.ruleName,
      pipeline: evaluation.pipelineId,
    });

    return {
      eventId,
      executed: true,
      reason: `Notification sent: ${evaluation.matchReason}`,
    };
  }

  /**
   * Execute a quarantine action: mark a flaky test for skip.
   */
  private static async executeQuarantine(
    eventId: string,
    evaluation: HealingEvaluation,
    userId: string,
  ): Promise<{ eventId: string; executed: boolean; reason: string }> {
    // Extract test name from the failed test run results
    const testRun = await prisma.testRun.findUnique({
      where: { id: evaluation.testRunId },
      include: { results: { where: { status: 'FAILED' }, take: 1 } },
    });

    const testName = testRun?.results[0]?.name || testRun?.name || 'unknown-test';

    // Upsert quarantine record (unique on testName)
    const existing = await prisma.quarantinedTest.findUnique({ where: { testName } });

    if (existing && existing.status === 'quarantined') {
      // Already quarantined — increment occurrence count
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
      data: {
        status: 'succeeded',
        completedAt: new Date(),
        metadata: JSON.stringify({ quarantinedTest: testName }),
      },
    });

    logger.info(`Self-healing quarantine: test="${testName}"`, {
      rule: evaluation.ruleName,
      confidence: evaluation.confidence,
    });

    return {
      eventId,
      executed: true,
      reason: `Test "${testName}" quarantined: ${evaluation.matchReason}`,
    };
  }

  /**
   * Execute a fix_pr action: look up known RCA, generate a suggested fix,
   * and create a record for the user to review / open a PR.
   *
   * Phase 3 — AI-Suggested Fix PRs
   * The actual PR creation is deferred to user approval (Tier 2).
   * This method prepares the fix suggestion with RCA context.
   */
  private static async executeFixPR(
    eventId: string,
    evaluation: HealingEvaluation,
    _userId: string,
  ): Promise<{ eventId: string; executed: boolean; reason: string }> {
    // Look up similar failures with documented RCA
    const similarFailures = await prisma.failureArchive.findMany({
      where: {
        rcaDocumented: true,
        resolved: true,
        solution: { not: null },
      },
      take: 20,
      orderBy: { lastOccurrence: 'desc' },
    });

    // Find the best matching RCA by comparing normalized error messages
    let bestMatch: { id: string; testName: string; rootCause: string | null; solution: string | null; prevention: string | null; similarity: number } | null = null;
    const normalizedError = normalizeErrorMessage(evaluation.errorMessage);

    for (const failure of similarFailures) {
      const normalizedCandidate = normalizeErrorMessage(failure.errorMessage);
      const similarity = calculateSimilarity(normalizedError, normalizedCandidate);

      if (similarity >= 0.5 && (!bestMatch || similarity > bestMatch.similarity)) {
        bestMatch = {
          id: failure.id,
          testName: failure.testName,
          rootCause: failure.rootCause,
          solution: failure.solution,
          prevention: failure.prevention,
          similarity,
        };
      }
    }

    // Also check the test run for the pipeline's repository info
    const testRun = await prisma.testRun.findUnique({
      where: { id: evaluation.testRunId },
      include: { pipeline: true },
    });

    const repository = testRun?.pipeline?.repository;

    const fixSuggestion = {
      rcaMatch: bestMatch ? {
        failureArchiveId: bestMatch.id,
        testName: bestMatch.testName,
        rootCause: bestMatch.rootCause,
        solution: bestMatch.solution,
        prevention: bestMatch.prevention,
        similarity: bestMatch.similarity,
      } : null,
      errorMessage: evaluation.errorMessage,
      matchReason: evaluation.matchReason,
      repository,
      branch: testRun?.branch,
      commit: testRun?.commit,
      suggestedAction: bestMatch?.solution
        ? `Apply known fix: ${bestMatch.solution.substring(0, 200)}`
        : 'No documented fix found — manual investigation recommended',
      canAutoFix: !!bestMatch?.solution && !!repository,
    };

    await prisma.healingEvent.update({
      where: { id: eventId },
      data: {
        status: bestMatch ? 'succeeded' : 'failed',
        completedAt: new Date(),
        metadata: JSON.stringify(fixSuggestion),
      },
    });

    if (bestMatch) {
      logger.info(`Self-healing fix suggestion: RCA match ${(bestMatch.similarity * 100).toFixed(0)}%`, {
        rule: evaluation.ruleName,
        failureArchiveId: bestMatch.id,
        repository,
      });

      return {
        eventId,
        executed: true,
        reason: `Fix suggested (${(bestMatch.similarity * 100).toFixed(0)}% RCA match): ${bestMatch.solution?.substring(0, 100) || 'See RCA'}`,
      };
    }

    logger.info(`Self-healing fix: no matching RCA found for error`, {
      rule: evaluation.ruleName,
      pipeline: evaluation.pipelineId,
    });

    return {
      eventId,
      executed: false,
      reason: 'No documented RCA match found — manual investigation recommended',
    };
  }

  // ── Fix PR Suggestions ──────────────────────────────────

  static async getFixSuggestions(limit = 20): Promise<unknown[]> {
    return prisma.healingEvent.findMany({
      where: {
        action: 'fix_pr',
        status: { in: ['succeeded', 'failed'] },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { rule: { select: { name: true, category: true } } },
    });
  }

  // ── Quarantine CRUD ─────────────────────────────────────

  static async getQuarantinedTests(): Promise<unknown[]> {
    return prisma.quarantinedTest.findMany({
      where: { status: 'quarantined' },
      orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
    });
  }

  static async getAllQuarantinedTests(): Promise<unknown[]> {
    return prisma.quarantinedTest.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  static async quarantineTest(
    testName: string,
    reason: string,
    severity: string,
    userId: string,
    flakinessScore?: number,
  ): Promise<unknown> {
    return prisma.quarantinedTest.upsert({
      where: { testName },
      create: {
        testName,
        reason,
        severity,
        quarantinedBy: userId,
        flakinessScore: flakinessScore ?? 0,
        status: 'quarantined',
      },
      update: {
        reason,
        severity,
        status: 'quarantined',
        flakinessScore: flakinessScore ?? undefined,
        occurrenceCount: { increment: 1 },
      },
    });
  }

  static async reinstateTest(id: string): Promise<unknown> {
    const existing = await prisma.quarantinedTest.findUnique({ where: { id } });
    if (!existing) throw new Error('Quarantined test not found');

    return prisma.quarantinedTest.update({
      where: { id },
      data: { status: 'reinstated' },
    });
  }

  static async deleteQuarantinedTest(id: string): Promise<void> {
    const existing = await prisma.quarantinedTest.findUnique({ where: { id } });
    if (!existing) throw new Error('Quarantined test not found');

    await prisma.quarantinedTest.delete({ where: { id } });
  }

  static async getQuarantineStats(): Promise<{
    quarantined: number;
    reinstated: number;
    totalQuarantined: number;
  }> {
    const [quarantined, reinstated, totalQuarantined] = await Promise.all([
      prisma.quarantinedTest.count({ where: { status: 'quarantined' } }),
      prisma.quarantinedTest.count({ where: { status: 'reinstated' } }),
      prisma.quarantinedTest.count(),
    ]);

    return { quarantined, reinstated, totalQuarantined };
  }

  // ── Circuit Breaker ─────────────────────────────────────

  /**
   * Check if a pipeline can be retried (max 2 retries per hour).
   */
  static async canRetry(pipelineId: string): Promise<boolean> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const recentRetries = await prisma.healingEvent.count({
      where: {
        pipelineId,
        action: 'retry',
        status: 'succeeded',
        createdAt: { gte: oneHourAgo },
      },
    });

    return recentRetries < MAX_RETRIES_PER_PIPELINE_PER_HOUR;
  }

  // ── Rule CRUD ───────────────────────────────────────────

  static async getRules(): Promise<unknown[]> {
    return prisma.healingRule.findMany({
      orderBy: [{ priority: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { events: true } } },
    });
  }

  static async getRuleById(id: string): Promise<unknown> {
    const rule = await prisma.healingRule.findUnique({
      where: { id },
      include: { _count: { select: { events: true } } },
    });
    if (!rule) throw new Error('Healing rule not found');
    return rule;
  }

  static async createRule(input: CreateHealingRuleInput): Promise<unknown> {
    // Validate regex if patternType is regex
    if (input.patternType === 'regex' || !input.patternType) {
      try {
        new RegExp(input.pattern, 'i');
      } catch {
        throw new Error(`Invalid regex pattern: ${input.pattern}`);
      }
    }

    return prisma.healingRule.create({
      data: {
        name: input.name,
        description: input.description,
        pattern: input.pattern,
        patternType: input.patternType || 'regex',
        category: input.category || 'custom',
        action: input.action || 'retry',
        maxRetries: input.maxRetries ?? 2,
        cooldownMinutes: input.cooldownMinutes ?? 60,
        confidenceThreshold: input.confidenceThreshold ?? 0.9,
        priority: input.priority ?? 50,
        isBuiltIn: false,
      },
    });
  }

  static async updateRule(id: string, input: UpdateHealingRuleInput): Promise<unknown> {
    const existing = await prisma.healingRule.findUnique({ where: { id } });
    if (!existing) throw new Error('Healing rule not found');
    if (existing.isBuiltIn && input.pattern !== undefined) {
      throw new Error('Cannot modify pattern of built-in rules');
    }

    if (input.pattern && (input.patternType === 'regex' || existing.patternType === 'regex')) {
      try {
        new RegExp(input.pattern, 'i');
      } catch {
        throw new Error(`Invalid regex pattern: ${input.pattern}`);
      }
    }

    return prisma.healingRule.update({ where: { id }, data: input });
  }

  static async toggleRule(id: string, enabled: boolean): Promise<unknown> {
    return prisma.healingRule.update({ where: { id }, data: { enabled } });
  }

  static async deleteRule(id: string): Promise<void> {
    const existing = await prisma.healingRule.findUnique({ where: { id } });
    if (!existing) throw new Error('Healing rule not found');
    if (existing.isBuiltIn) throw new Error('Cannot delete built-in rules — disable them instead');

    await prisma.healingRule.delete({ where: { id } });
  }

  // ── Events (audit log) ─────────────────────────────────

  static async getEvents(filters?: HealingEventFilters): Promise<unknown[]> {
    const limit = filters?.limit ?? 50;

    return prisma.healingEvent.findMany({
      where: {
        ...(filters?.pipelineId && { pipelineId: filters.pipelineId }),
        ...(filters?.testRunId && { testRunId: filters.testRunId }),
        ...(filters?.action && { action: filters.action }),
        ...(filters?.status && { status: filters.status }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { rule: { select: { name: true, category: true } } },
    });
  }

  static async getStats(): Promise<{
    totalEvents: number;
    successfulRetries: number;
    failedRetries: number;
    skippedEvents: number;
    activeRules: number;
    retriesSavedToday: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalEvents, successfulRetries, failedRetries, skippedEvents, activeRules, retriesSavedToday] =
      await Promise.all([
        prisma.healingEvent.count(),
        prisma.healingEvent.count({ where: { action: 'retry', status: 'succeeded' } }),
        prisma.healingEvent.count({ where: { action: 'retry', status: 'failed' } }),
        prisma.healingEvent.count({ where: { status: 'skipped' } }),
        prisma.healingRule.count({ where: { enabled: true } }),
        prisma.healingEvent.count({
          where: { action: 'retry', status: 'succeeded', createdAt: { gte: today } },
        }),
      ]);

    return { totalEvents, successfulRetries, failedRetries, skippedEvents, activeRules, retriesSavedToday };
  }

  // ── Seed built-in rules ─────────────────────────────────

  static async seedBuiltInRules(): Promise<number> {
    let seeded = 0;

    for (const pattern of BUILT_IN_PATTERNS) {
      const existing = await prisma.healingRule.findFirst({
        where: { name: pattern.name, isBuiltIn: true },
      });

      if (!existing) {
        await prisma.healingRule.create({
          data: {
            ...pattern,
            isBuiltIn: true,
            enabled: true,
          },
        });
        seeded++;
      }
    }

    if (seeded > 0) {
      logger.info(`Self-healing: seeded ${seeded} built-in rules`);
    }

    return seeded;
  }

  /** Expose built-in patterns for testing */
  static getBuiltInPatterns(): BuiltInPattern[] {
    return [...BUILT_IN_PATTERNS];
  }
}
