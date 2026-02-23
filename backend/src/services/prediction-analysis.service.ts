/**
 * Prediction Analysis Service
 *
 * Statistical engine for failure trend analysis, risk scoring, and anomaly detection.
 * Uses in-database aggregation + lightweight TypeScript statistics (no external ML libs).
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import {
  TimeSeriesPoint,
  TrendAnalysis,
  RiskScore,
  RiskFactor,
  AnomalyResult,
} from '../types/prediction';

/** Severity multiplier for risk scoring */
const SEVERITY_WEIGHTS: Record<string, number> = {
  CRITICAL: 25,
  HIGH: 18,
  MEDIUM: 12,
  LOW: 5,
};

export class PredictionAnalysisService {
  // ─── Time-series ──────────────────────────────────────────────

  /**
   * Aggregate failure counts by date bucket.
   * Uses raw SQL because Prisma doesn't support DATE() groupBy on SQLite.
   */
  static async getFailureTimeSeries(params: {
    days?: number;
    groupBy?: 'day' | 'week';
    testName?: string;
    category?: string;
  }): Promise<TimeSeriesPoint[]> {
    const days = params.days ?? 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Conditional WHERE fragments using Prisma.sql (no string interpolation)
    const testNameFilter = params.testName
      ? Prisma.sql`AND testName = ${params.testName}`
      : Prisma.empty;
    const categoryFilter = params.category
      ? Prisma.sql`AND category = ${params.category}`
      : Prisma.empty;

    // Two static queries — date function cannot be parameterized, so we branch
    const rows = params.groupBy === 'week'
      ? await prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
          SELECT strftime('%Y-W%W', lastOccurrence) as date, COUNT(*) as count
          FROM FailureArchive
          WHERE lastOccurrence >= ${since.toISOString()}
          ${testNameFilter}
          ${categoryFilter}
          GROUP BY date
          ORDER BY date ASC`
      : await prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
          SELECT DATE(lastOccurrence) as date, COUNT(*) as count
          FROM FailureArchive
          WHERE lastOccurrence >= ${since.toISOString()}
          ${testNameFilter}
          ${categoryFilter}
          GROUP BY date
          ORDER BY date ASC`;

    return rows.map(r => ({
      date: r.date,
      count: Number(r.count),
    }));
  }

  // ─── Trend calculation ────────────────────────────────────────

  /**
   * Compute trend from a time-series: moving averages, rate of change, direction.
   */
  static calculateTrend(timeSeries: TimeSeriesPoint[]): TrendAnalysis {
    const counts = timeSeries.map(p => p.count);

    const ma7 = this.movingAverage(counts, 7);
    const ma30 = this.movingAverage(counts, 30);

    // Rate of change: slope of last 14 points (linear regression)
    const recent = counts.slice(-14);
    const rateOfChange = this.linearSlope(recent);

    // Percent change: sum of last 7d vs previous 7d
    const last7 = counts.slice(-7).reduce((a, b) => a + b, 0);
    const prev7 = counts.slice(-14, -7).reduce((a, b) => a + b, 0);
    const percentChange7d = prev7 > 0
      ? ((last7 - prev7) / prev7) * 100
      : last7 > 0 ? 100 : 0;

    let direction: TrendAnalysis['direction'] = 'stable';
    if (rateOfChange > 0.1) direction = 'increasing';
    else if (rateOfChange < -0.1) direction = 'decreasing';

    return {
      direction,
      rateOfChange: Math.round(rateOfChange * 100) / 100,
      movingAverage7d: ma7,
      movingAverage30d: ma30,
      percentChange7d: Math.round(percentChange7d * 10) / 10,
      timeSeries,
    };
  }

  // ─── Risk scoring ─────────────────────────────────────────────

  /**
   * Calculate risk scores for the top-N most failure-prone tests.
   */
  static async calculateRiskScores(params: {
    limit?: number;
    minOccurrences?: number;
  }): Promise<RiskScore[]> {
    const limit = params.limit ?? 20;
    const minOcc = params.minOccurrences ?? 2;

    const failures = await prisma.failureArchive.findMany({
      where: { occurrenceCount: { gte: minOcc } },
      orderBy: { occurrenceCount: 'desc' },
      take: limit * 2, // fetch extra for scoring
    });

    const now = Date.now();
    const scores: RiskScore[] = [];

    for (const f of failures) {
      const factors: RiskFactor[] = [];

      // 1. Recurrence (30%)
      const recurrenceVal = Math.min(f.occurrenceCount / 10, 1.0);
      factors.push({
        name: 'recurrence',
        weight: 30,
        value: recurrenceVal,
        description: `${f.occurrenceCount} occurrences`,
      });

      // 2. Severity (25%)
      const sevScore = SEVERITY_WEIGHTS[f.severity ?? 'MEDIUM'] ?? 12;
      factors.push({
        name: 'severity',
        weight: 25,
        value: sevScore / 25,
        description: `Severity: ${f.severity ?? 'MEDIUM'}`,
      });

      // 3. Recency (20%)
      const daysSinceLast = Math.max(
        (now - new Date(f.lastOccurrence).getTime()) / (24 * 60 * 60 * 1000),
        0.1,
      );
      const recencyVal = Math.exp(-daysSinceLast / 14); // 14-day half-life
      factors.push({
        name: 'recency',
        weight: 20,
        value: recencyVal,
        description: `Last seen ${Math.round(daysSinceLast)}d ago`,
      });

      // 4. Trend (25%) — use occurrence frequency
      const spanDays = Math.max(
        (new Date(f.lastOccurrence).getTime() - new Date(f.firstOccurrence).getTime()) / (24 * 60 * 60 * 1000),
        1,
      );
      const frequency = f.occurrenceCount / spanDays;
      const trendVal = Math.min(frequency, 1.0);
      factors.push({
        name: 'trend',
        weight: 25,
        value: trendVal,
        description: `${(frequency * 7).toFixed(1)} failures/week`,
      });

      // Composite score
      const score = Math.round(
        factors.reduce((sum, fac) => sum + fac.weight * fac.value, 0)
      );

      const level = score >= 75 ? 'critical'
        : score >= 50 ? 'high'
        : score >= 25 ? 'medium'
        : 'low';

      const prediction = score >= 75
        ? `High risk of recurrence within 7 days`
        : score >= 50
        ? `Moderate risk of recurrence within 14 days`
        : score >= 25
        ? `Low risk — monitor for trend changes`
        : `Minimal risk — stable or declining`;

      scores.push({
        testName: f.testName,
        score,
        level,
        factors,
        prediction,
        occurrenceCount: f.occurrenceCount,
        lastOccurrence: f.lastOccurrence,
        severity: f.severity ?? 'MEDIUM',
      });
    }

    // Sort by score descending, take limit
    return scores
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  // ─── Anomaly detection ────────────────────────────────────────

  /**
   * Detect anomalous days in the time-series using z-scores.
   */
  static detectAnomalies(
    timeSeries: TimeSeriesPoint[],
    sensitivity: number = 2.0,
  ): AnomalyResult[] {
    if (timeSeries.length < 7) return [];

    const counts = timeSeries.map(p => p.count);
    const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
    const variance = counts.reduce((sum, v) => sum + (v - mean) ** 2, 0) / counts.length;
    const stddev = Math.sqrt(variance);

    if (stddev === 0) return [];

    return timeSeries.map(point => {
      const z = (point.count - mean) / stddev;
      const isAnomaly = Math.abs(z) > sensitivity;
      return {
        date: point.date,
        isAnomaly,
        zScore: Math.round(z * 100) / 100,
        baseline: Math.round(mean * 10) / 10,
        actual: point.count,
        description: isAnomaly
          ? `Anomaly: ${point.count} failures (expected ~${Math.round(mean)}, z=${z.toFixed(1)})`
          : `Normal: ${point.count} failures`,
      };
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────

  /** Simple moving average of the last `window` values. */
  private static movingAverage(values: number[], window: number): number {
    if (values.length === 0) return 0;
    const slice = values.slice(-window);
    return Math.round((slice.reduce((a, b) => a + b, 0) / slice.length) * 10) / 10;
  }

  /** Least-squares linear slope. */
  private static linearSlope(values: number[]): number {
    const n = values.length;
    if (n < 2) return 0;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumX2 += i * i;
    }
    const denom = n * sumX2 - sumX * sumX;
    return denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
  }
}
