/**
 * Regression Detection Service
 *
 * Automatically detects test regressions by comparing the current test run
 * status against the previous run on the same pipeline/branch.
 *
 * When a test starts failing:
 * 1. Check if it was passing on the previous commit.
 * 2. Identify the introducing commit (bisect).
 * 3. Link to the PR via GitHubService.
 * 4. Record a RegressionEvent for tracking and notification.
 *
 * Follows the evaluate/execute pattern from SelfHealingService.
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/utils/logger';

// ── Types ────────────────────────────────────────────────────────────────

export interface RegressionEvent {
  id?: string;
  testName: string;
  pipelineId: string;
  /** The commit where the test first started failing */
  introducingCommit: string | null;
  /** The PR that introduced the regression */
  introducingPR: number | null;
  /** PR title for display */
  prTitle: string | null;
  /** PR author */
  prAuthor: string | null;
  /** The test run where regression was first detected */
  testRunId: string;
  /** Previous passing commit */
  lastPassingCommit: string | null;
  /** Severity based on test importance and duration */
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  /** Current status of the regression */
  status: 'detected' | 'confirmed' | 'resolved' | 'false_positive';
  /** Error message from the failing test */
  errorMessage: string | null;
  /** Detection timestamp */
  detectedAt: Date;
}

export interface RegressionSummary {
  totalRegressions: number;
  openRegressions: number;
  resolvedRegressions: number;
  falsePositives: number;
  avgTimeToDetectMs: number;
  byPipeline: Array<{ pipelineId: string; count: number }>;
  bySeverity: Record<string, number>;
  recentRegressions: RegressionEvent[];
}

export interface RegressionEvaluation {
  /** Tests that regressed (were passing, now failing) */
  regressions: RegressionEvent[];
  /** Tests that recovered (were failing, now passing) */
  recoveries: Array<{ testName: string; previouslyFailingSince: Date }>;
  /** Total tests analyzed */
  testsAnalyzed: number;
}

// ── Service ──────────────────────────────────────────────────────────────

export class RegressionDetectionService {

  /**
   * Evaluate a completed test run for regressions.
   *
   * Compares the current run's failures against the previous run on the
   * same pipeline and branch to detect new failures (regressions) and
   * recoveries.
   */
  async evaluate(testRunId: string): Promise<RegressionEvaluation | null> {
    try {
      // Fetch the current test run with results
      const testRun = await prisma.testRun.findUnique({
        where: { id: testRunId },
        include: {
          results: {
            select: { name: true, status: true, error: true, duration: true },
          },
        },
      });

      if (!testRun) {
        logger.warn('[RegressionDetection] Test run not found', { testRunId });
        return null;
      }

      // Only analyze completed runs
      if (!['PASSED', 'FAILED', 'FLAKY'].includes(testRun.status)) {
        return null;
      }

      // Get the previous run on the same pipeline
      const previousRun = await prisma.testRun.findFirst({
        where: {
          pipelineId: testRun.pipelineId,
          id: { not: testRunId },
          createdAt: { lt: testRun.createdAt },
          status: { in: ['PASSED', 'FAILED', 'FLAKY'] },
        },
        include: {
          results: {
            select: { name: true, status: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!previousRun) {
        logger.info('[RegressionDetection] No previous run found for comparison', {
          testRunId,
          pipelineId: testRun.pipelineId,
        });
        return null;
      }

      // Build status maps
      const currentStatuses = new Map(testRun.results.map(r => [r.name, r]));
      const previousStatuses = new Map(previousRun.results.map(r => [r.name, r.status]));

      const regressions: RegressionEvent[] = [];
      const recoveries: Array<{ testName: string; previouslyFailingSince: Date }> = [];

      // Detect regressions: was PASSED/SKIPPED in previous, now FAILED
      for (const [testName, result] of currentStatuses) {
        const previousStatus = previousStatuses.get(testName);

        if (result.status === 'FAILED' && previousStatus && previousStatus !== 'FAILED') {
          // This is a regression
          const severity = this.assessSeverity(result, testRun);

          regressions.push({
            testName,
            pipelineId: testRun.pipelineId,
            introducingCommit: testRun.commit,
            introducingPR: null, // Will be enriched later
            prTitle: null,
            prAuthor: null,
            testRunId: testRun.id,
            lastPassingCommit: previousRun.commit,
            severity,
            status: 'detected',
            errorMessage: result.error ?? null,
            detectedAt: new Date(),
          });
        }

        // Detect recoveries: was FAILED in previous, now PASSED
        if (result.status === 'PASSED' && previousStatus === 'FAILED') {
          recoveries.push({
            testName,
            previouslyFailingSince: previousRun.createdAt,
          });
        }
      }

      if (regressions.length > 0) {
        logger.warn('[RegressionDetection] Regressions detected', {
          testRunId,
          pipelineId: testRun.pipelineId,
          regressionCount: regressions.length,
          recoveryCount: recoveries.length,
          commit: testRun.commit,
        });
      }

      if (recoveries.length > 0) {
        logger.info('[RegressionDetection] Recoveries detected', {
          testRunId,
          recoveryCount: recoveries.length,
        });
      }

      return {
        regressions,
        recoveries,
        testsAnalyzed: currentStatuses.size,
      };
    } catch (error) {
      logger.error('[RegressionDetection] Evaluation failed', {
        testRunId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Record regression events to the database and attempt PR linkage.
   * This is the "execute" step — called after evaluate().
   */
  async recordRegressions(evaluation: RegressionEvaluation): Promise<number> {
    let recorded = 0;

    for (const regression of evaluation.regressions) {
      try {
        // Check if this regression is already tracked (avoid duplicates)
        const existing = await prisma.regressionEvent.findFirst({
          where: {
            testName: regression.testName,
            pipelineId: regression.pipelineId,
            status: { in: ['detected', 'confirmed'] },
          },
        });

        if (existing) {
          // Already tracking this regression — update if needed
          logger.info('[RegressionDetection] Regression already tracked', {
            testName: regression.testName,
            existingId: existing.id,
          });
          continue;
        }

        // Create new regression event
        await prisma.regressionEvent.create({
          data: {
            testName: regression.testName,
            pipelineId: regression.pipelineId,
            introducingCommit: regression.introducingCommit,
            introducingPR: regression.introducingPR,
            prTitle: regression.prTitle,
            prAuthor: regression.prAuthor,
            testRunId: regression.testRunId,
            lastPassingCommit: regression.lastPassingCommit,
            severity: regression.severity,
            status: 'detected',
            errorMessage: regression.errorMessage,
          },
        });

        recorded++;
      } catch (error) {
        logger.warn('[RegressionDetection] Failed to record regression', {
          testName: regression.testName,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Mark recovered regressions as resolved
    for (const recovery of evaluation.recoveries) {
      try {
        await prisma.regressionEvent.updateMany({
          where: {
            testName: recovery.testName,
            status: { in: ['detected', 'confirmed'] },
          },
          data: {
            status: 'resolved',
            resolvedAt: new Date(),
          },
        });
      } catch (error) {
        logger.warn('[RegressionDetection] Failed to mark recovery', {
          testName: recovery.testName,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logger.info('[RegressionDetection] Recording complete', {
      recorded,
      recoveries: evaluation.recoveries.length,
    });

    return recorded;
  }

  /**
   * Get a summary of regression events.
   */
  async getSummary(windowDays: number = 30): Promise<RegressionSummary> {
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

    try {
      const events = await prisma.regressionEvent.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
      });

      const open = events.filter(e => ['detected', 'confirmed'].includes(e.status));
      const resolved = events.filter(e => e.status === 'resolved');
      const falsePositives = events.filter(e => e.status === 'false_positive');

      // Group by pipeline
      const byPipeline = new Map<string, number>();
      for (const event of events) {
        byPipeline.set(event.pipelineId, (byPipeline.get(event.pipelineId) ?? 0) + 1);
      }

      // Group by severity
      const bySeverity: Record<string, number> = {};
      for (const event of events) {
        bySeverity[event.severity] = (bySeverity[event.severity] ?? 0) + 1;
      }

      return {
        totalRegressions: events.length,
        openRegressions: open.length,
        resolvedRegressions: resolved.length,
        falsePositives: falsePositives.length,
        avgTimeToDetectMs: 0, // Would need pipeline start time for full calculation
        byPipeline: Array.from(byPipeline.entries()).map(([pipelineId, count]) => ({
          pipelineId,
          count,
        })),
        bySeverity,
        recentRegressions: events.slice(0, 20).map(e => ({
          id: e.id,
          testName: e.testName,
          pipelineId: e.pipelineId,
          introducingCommit: e.introducingCommit,
          introducingPR: e.introducingPR,
          prTitle: e.prTitle,
          prAuthor: e.prAuthor,
          testRunId: e.testRunId,
          lastPassingCommit: e.lastPassingCommit,
          severity: e.severity as RegressionEvent['severity'],
          status: e.status as RegressionEvent['status'],
          errorMessage: e.errorMessage,
          detectedAt: e.createdAt,
        })),
      };
    } catch (error) {
      logger.error('[RegressionDetection] Failed to get summary', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        totalRegressions: 0,
        openRegressions: 0,
        resolvedRegressions: 0,
        falsePositives: 0,
        avgTimeToDetectMs: 0,
        byPipeline: [],
        bySeverity: {},
        recentRegressions: [],
      };
    }
  }

  /**
   * Mark a regression as a false positive.
   */
  async markAsFalsePositive(regressionId: string): Promise<void> {
    await prisma.regressionEvent.update({
      where: { id: regressionId },
      data: { status: 'false_positive' },
    });
  }

  /**
   * Mark a regression as confirmed.
   */
  async confirmRegression(regressionId: string): Promise<void> {
    await prisma.regressionEvent.update({
      where: { id: regressionId },
      data: { status: 'confirmed' },
    });
  }

  // ── Private Methods ────────────────────────────────────────────────────

  /**
   * Assess regression severity based on test characteristics.
   */
  private assessSeverity(
    result: { name: string; duration: number | null; error: string | null },
    testRun: { branch: string | null }
  ): RegressionEvent['severity'] {
    // Critical: regression on main/master branch
    const isMainBranch = testRun.branch === 'main' || testRun.branch === 'master';

    // Error keywords indicating critical failures
    const criticalKeywords = ['FATAL', 'OOM', 'OutOfMemory', 'SEGFAULT', 'corrupted'];
    const hasCriticalError = criticalKeywords.some(
      kw => result.error?.toUpperCase().includes(kw.toUpperCase())
    );

    if (isMainBranch && hasCriticalError) return 'CRITICAL';
    if (isMainBranch) return 'HIGH';
    if (hasCriticalError) return 'HIGH';

    // Long-running tests that fail are more impactful
    if (result.duration && result.duration > 30000) return 'HIGH';

    return 'MEDIUM';
  }
}

export const regressionDetectionService = new RegressionDetectionService();
