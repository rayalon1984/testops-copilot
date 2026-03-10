/**
 * Selection Accuracy Service
 *
 * Tracks the precision and recall of smart test selection after each CI run.
 * Compares the tests that were selected (predicted to be relevant) against
 * the tests that actually failed, computing classification metrics.
 *
 * Metrics:
 * - True Positives: Tests selected AND failed (correct selection)
 * - False Positives: Tests selected but PASSED (over-selection, wastes time)
 * - False Negatives: Tests NOT selected but FAILED (missed regression — critical)
 * - Precision: TP / (TP + FP) — how many selected tests were actually relevant
 * - Recall: TP / (TP + FN) — how many failing tests were correctly selected
 *
 * Recall > 95% is the primary target (never miss a regression).
 * Precision > 70% is the secondary target (avoid running too many tests).
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/utils/logger';

// ── Types ────────────────────────────────────────────────────────────────

export interface AccuracyInput {
  /** Tests that smart selection chose to run */
  selectedTests: string[];
  /** Tests that actually failed during the CI run */
  actualFailedTests: string[];
  /** All tests that ran in the suite (for FP calculation) */
  allExecutedTests?: string[];
  /** Strategy used for this selection */
  strategyUsed: string;
  /** Changed files that triggered the selection */
  changedFiles?: string[];
  /** Associated test run ID */
  testRunId?: string;
  /** Pipeline ID */
  pipelineId?: string;
}

export interface AccuracyResult {
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  precision: number;
  recall: number;
  f1Score: number;
  /** Tests we correctly identified as needing to run */
  correctSelections: string[];
  /** Tests we selected but didn't fail (over-selection) */
  overSelections: string[];
  /** Tests we missed — they failed but weren't selected (critical) */
  missedTests: string[];
}

export interface AccuracyTrend {
  period: string;
  avgPrecision: number;
  avgRecall: number;
  avgF1: number;
  totalSelections: number;
  missedRegressions: number;
}

export interface AccuracyStats {
  totalRecords: number;
  avgPrecision: number;
  avgRecall: number;
  avgF1: number;
  missedRegressionRate: number;
  byStrategy: Record<string, { count: number; avgPrecision: number; avgRecall: number }>;
  trend: AccuracyTrend[];
}

// ── Service ──────────────────────────────────────────────────────────────

export class SelectionAccuracyService {

  /**
   * Evaluate the accuracy of a test selection against actual results.
   * Should be called after each CI run that used smart test selection.
   */
  async evaluate(input: AccuracyInput): Promise<AccuracyResult> {
    const {
      selectedTests,
      actualFailedTests,
      strategyUsed,
      changedFiles,
      testRunId,
      pipelineId,
    } = input;

    // Handle "ALL" selection — if we selected everything, recall is 100%
    const isRunAll = selectedTests.includes('ALL');
    const selectedSet = new Set(isRunAll ? [] : selectedTests);
    const failedSet = new Set(actualFailedTests);

    let truePositives: string[];
    let falseNegatives: string[];
    let falsePositives: string[];

    if (isRunAll) {
      // If we ran everything, there are no false negatives
      truePositives = actualFailedTests;
      falseNegatives = [];
      falsePositives = []; // Can't determine FP without knowing what passed
    } else {
      // True Positives: selected AND failed
      truePositives = actualFailedTests.filter(t => selectedSet.has(t));

      // False Negatives: failed but NOT selected (missed regressions)
      falseNegatives = actualFailedTests.filter(t => !selectedSet.has(t));

      // False Positives: selected but did NOT fail
      falsePositives = selectedTests.filter(t => !failedSet.has(t));
    }

    const tp = truePositives.length;
    const fp = falsePositives.length;
    const fn = falseNegatives.length;

    // Precision: of the tests we selected, how many actually failed
    const precision = tp + fp > 0 ? tp / (tp + fp) : 1.0;

    // Recall: of the tests that failed, how many did we select
    const recall = tp + fn > 0 ? tp / (tp + fn) : 1.0;

    // F1 Score: harmonic mean of precision and recall
    const f1Score = precision + recall > 0
      ? 2 * (precision * recall) / (precision + recall)
      : 0;

    // Persist to database
    try {
      await prisma.selectionAccuracy.create({
        data: {
          testRunId: testRunId ?? null,
          pipelineId: pipelineId ?? null,
          totalSelected: selectedTests.length,
          truePositives: tp,
          falseNegatives: fn,
          falsePositives: fp,
          precision: parseFloat(precision.toFixed(4)),
          recall: parseFloat(recall.toFixed(4)),
          strategyUsed,
          changedFiles: changedFiles ? JSON.stringify(changedFiles) : null,
        },
      });
    } catch (error) {
      logger.warn('[SelectionAccuracy] Failed to persist accuracy record', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Alert on missed regressions
    if (fn > 0) {
      logger.warn('[SelectionAccuracy] Missed regressions detected!', {
        missedCount: fn,
        missedTests: falseNegatives.slice(0, 10),
        strategy: strategyUsed,
        recall: parseFloat(recall.toFixed(4)),
      });
    }

    logger.info('[SelectionAccuracy] Evaluation complete', {
      truePositives: tp,
      falsePositives: fp,
      falseNegatives: fn,
      precision: parseFloat(precision.toFixed(4)),
      recall: parseFloat(recall.toFixed(4)),
      f1Score: parseFloat(f1Score.toFixed(4)),
      strategy: strategyUsed,
    });

    return {
      truePositives: tp,
      falsePositives: fp,
      falseNegatives: fn,
      precision: parseFloat(precision.toFixed(4)),
      recall: parseFloat(recall.toFixed(4)),
      f1Score: parseFloat(f1Score.toFixed(4)),
      correctSelections: truePositives,
      overSelections: falsePositives,
      missedTests: falseNegatives,
    };
  }

  /**
   * Get aggregate accuracy statistics over a time window.
   */
  async getStats(windowDays: number = 30): Promise<AccuracyStats> {
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

    try {
      const records = await prisma.selectionAccuracy.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
      });

      if (records.length === 0) {
        return {
          totalRecords: 0,
          avgPrecision: 0,
          avgRecall: 0,
          avgF1: 0,
          missedRegressionRate: 0,
          byStrategy: {},
          trend: [],
        };
      }

      // Aggregate metrics
      let totalPrecision = 0;
      let totalRecall = 0;
      let totalF1 = 0;
      let totalMissed = 0;

      // Per-strategy aggregation
      const strategyStats = new Map<string, {
        count: number;
        sumPrecision: number;
        sumRecall: number;
      }>();

      // Weekly trend buckets
      const weeklyBuckets = new Map<string, {
        sumPrecision: number;
        sumRecall: number;
        count: number;
        missedRegressions: number;
      }>();

      for (const record of records) {
        const precision = record.precision;
        const recall = record.recall;
        const f1 = precision + recall > 0
          ? 2 * (precision * recall) / (precision + recall)
          : 0;

        totalPrecision += precision;
        totalRecall += recall;
        totalF1 += f1;

        if (record.falseNegatives > 0) totalMissed++;

        // Strategy aggregation
        const strategy = record.strategyUsed;
        if (!strategyStats.has(strategy)) {
          strategyStats.set(strategy, { count: 0, sumPrecision: 0, sumRecall: 0 });
        }
        const ss = strategyStats.get(strategy)!;
        ss.count++;
        ss.sumPrecision += precision;
        ss.sumRecall += recall;

        // Weekly buckets
        const weekKey = this.getWeekKey(record.createdAt);
        if (!weeklyBuckets.has(weekKey)) {
          weeklyBuckets.set(weekKey, {
            sumPrecision: 0, sumRecall: 0, count: 0, missedRegressions: 0,
          });
        }
        const wb = weeklyBuckets.get(weekKey)!;
        wb.sumPrecision += precision;
        wb.sumRecall += recall;
        wb.count++;
        if (record.falseNegatives > 0) wb.missedRegressions++;
      }

      // Build per-strategy stats
      const byStrategy: AccuracyStats['byStrategy'] = {};
      for (const [strategy, stats] of strategyStats) {
        byStrategy[strategy] = {
          count: stats.count,
          avgPrecision: parseFloat((stats.sumPrecision / stats.count).toFixed(4)),
          avgRecall: parseFloat((stats.sumRecall / stats.count).toFixed(4)),
        };
      }

      // Build trend data
      const trend: AccuracyTrend[] = [];
      for (const [period, bucket] of Array.from(weeklyBuckets.entries()).sort()) {
        const avgP = bucket.sumPrecision / bucket.count;
        const avgR = bucket.sumRecall / bucket.count;
        trend.push({
          period,
          avgPrecision: parseFloat(avgP.toFixed(4)),
          avgRecall: parseFloat(avgR.toFixed(4)),
          avgF1: parseFloat(
            (avgP + avgR > 0 ? 2 * (avgP * avgR) / (avgP + avgR) : 0).toFixed(4)
          ),
          totalSelections: bucket.count,
          missedRegressions: bucket.missedRegressions,
        });
      }

      return {
        totalRecords: records.length,
        avgPrecision: parseFloat((totalPrecision / records.length).toFixed(4)),
        avgRecall: parseFloat((totalRecall / records.length).toFixed(4)),
        avgF1: parseFloat((totalF1 / records.length).toFixed(4)),
        missedRegressionRate: parseFloat(
          (totalMissed / records.length).toFixed(4)
        ),
        byStrategy,
        trend,
      };
    } catch (error) {
      logger.error('[SelectionAccuracy] Failed to compute stats', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        totalRecords: 0,
        avgPrecision: 0,
        avgRecall: 0,
        avgF1: 0,
        missedRegressionRate: 0,
        byStrategy: {},
        trend: [],
      };
    }
  }

  /**
   * Check if recall has dropped below threshold and alert.
   * Returns true if recall is acceptable (>= threshold).
   */
  async checkRecallHealth(
    threshold: number = 0.95,
    windowDays: number = 7
  ): Promise<{ healthy: boolean; currentRecall: number; message: string }> {
    const stats = await this.getStats(windowDays);

    if (stats.totalRecords === 0) {
      return {
        healthy: true,
        currentRecall: 1.0,
        message: 'No selection accuracy data available yet.',
      };
    }

    const healthy = stats.avgRecall >= threshold;

    if (!healthy) {
      logger.warn('[SelectionAccuracy] Recall below threshold!', {
        currentRecall: stats.avgRecall,
        threshold,
        missedRegressionRate: stats.missedRegressionRate,
        windowDays,
      });
    }

    return {
      healthy,
      currentRecall: stats.avgRecall,
      message: healthy
        ? `Recall is healthy at ${(stats.avgRecall * 100).toFixed(1)}% (threshold: ${threshold * 100}%)`
        : `⚠️ Recall has dropped to ${(stats.avgRecall * 100).toFixed(1)}% — below ${threshold * 100}% threshold. ${stats.missedRegressionRate * 100}% of selections missed regressions.`,
    };
  }

  /**
   * Cleanup old accuracy records beyond retention period.
   */
  async cleanup(retentionDays: number = 90): Promise<number> {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    try {
      const result = await prisma.selectionAccuracy.deleteMany({
        where: { createdAt: { lt: cutoff } },
      });

      logger.info('[SelectionAccuracy] Cleaned up old records', {
        deleted: result.count,
        retentionDays,
      });

      return result.count;
    } catch (error) {
      logger.warn('[SelectionAccuracy] Cleanup failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  // ── Private Methods ────────────────────────────────────────────────────

  /**
   * Get a week key for trend bucketing (e.g., "2026-W10").
   */
  private getWeekKey(date: Date): string {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    // Get ISO week number
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
  }
}

export const selectionAccuracyService = new SelectionAccuracyService();
