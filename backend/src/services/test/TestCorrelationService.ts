/**
 * Test Correlation Service
 *
 * Builds statistical correlations between changed files and test failures
 * to improve smart test selection over time. Uses lightweight TypeScript
 * statistics — no external ML libraries.
 *
 * Analysis methods:
 * 1. Co-failure Matrix: Which tests fail together? (cluster-based selection)
 * 2. File-to-Failure Correlation: When file X changes, which tests fail?
 * 3. Recency Weighting: Recent correlations are weighted higher.
 * 4. Historical Hit Rate: Past selection accuracy per file/test pair.
 *
 * Data source: TestRun + TestResult tables (last 90 days by default).
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/utils/logger';

// ── Types ────────────────────────────────────────────────────────────────

export interface CoFailureEntry {
  testA: string;
  testB: string;
  coFailureCount: number;
  totalFailuresA: number;
  totalFailuresB: number;
  /** Jaccard similarity: coFailures / (failsA + failsB - coFailures) */
  similarity: number;
}

export interface FileCorrelation {
  sourceFile: string;
  testName: string;
  /** Number of times the test failed when this file was in the changeset */
  failureCount: number;
  /** Number of times this file appeared in a changeset */
  changeCount: number;
  /** failureCount / changeCount — probability of test failure given file change */
  correlation: number;
  /** Recency-weighted correlation (recent events contribute more) */
  weightedCorrelation: number;
  lastSeenAt: Date;
}

export interface CorrelationStats {
  totalFileCorrelations: number;
  totalCoFailurePairs: number;
  analysisWindowDays: number;
  lastAnalyzedAt: Date | null;
  topCorrelatedFiles: Array<{ file: string; correlatedTests: number }>;
}

export interface CorrelatedTestResult {
  testName: string;
  confidence: number;
  reason: string;
  sources: Array<{ type: 'co-failure' | 'file-correlation'; detail: string }>;
}

// ── Constants ────────────────────────────────────────────────────────────

/** Default analysis window */
const DEFAULT_WINDOW_DAYS = 90;

/** Minimum correlation threshold to consider a file-test pair relevant */
const MIN_CORRELATION_THRESHOLD = 0.15;

/** Minimum co-failure count to consider a pair related */
const MIN_CO_FAILURE_COUNT = 2;

/** Half-life for recency weighting (days). Events older than this get < 50% weight. */
const RECENCY_HALF_LIFE_DAYS = 30;

// ── Service ──────────────────────────────────────────────────────────────

export class TestCorrelationService {
  /** In-memory file-to-test correlation cache */
  private fileCorrelations: Map<string, FileCorrelation[]> = new Map();

  /** In-memory co-failure matrix */
  private coFailureMatrix: Map<string, CoFailureEntry[]> = new Map();

  private lastAnalyzedAt: Date | null = null;

  /**
   * Build file-to-failure correlations by analyzing TestRun history.
   *
   * For each TestRun that has a commit, we look at changed files (stored in
   * the changeset) and correlate with failed TestResults.
   */
  async buildFileCorrelations(windowDays: number = DEFAULT_WINDOW_DAYS): Promise<number> {
    const startTime = Date.now();
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

    logger.info('[TestCorrelation] Building file-to-failure correlations...', {
      windowDays,
      since: since.toISOString(),
    });

    try {
      // Get test runs with failed results and known commits
      const testRuns = await prisma.testRun.findMany({
        where: {
          createdAt: { gte: since },
          commit: { not: null },
        },
        include: {
          results: {
            where: { status: 'FAILED' },
            select: { name: true, createdAt: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Temporary accumulator: file → test → { failCount, changeCount, lastSeen }
      const correlationMap = new Map<string, Map<string, {
        failureCount: number;
        changeCount: number;
        timestamps: Date[];
      }>>();

      for (const run of testRuns) {
        // Parse changedFiles from the run (stored as JSON in metadata or commit)
        const changedFiles = this.extractChangedFiles(run);
        if (changedFiles.length === 0) continue;

        const failedTests = run.results.map(r => r.name);

        for (const file of changedFiles) {
          if (!correlationMap.has(file)) {
            correlationMap.set(file, new Map());
          }
          const fileMap = correlationMap.get(file)!;

          // Track that this file appeared in a changeset
          for (const testName of failedTests) {
            if (!fileMap.has(testName)) {
              fileMap.set(testName, { failureCount: 0, changeCount: 0, timestamps: [] });
            }
            const entry = fileMap.get(testName)!;
            entry.failureCount++;
            entry.timestamps.push(run.createdAt);
          }

          // Also track total change appearances (even when no failures)
          // We use a sentinel key to track total changes per file
          const TOTAL_KEY = '__total_changes__';
          if (!fileMap.has(TOTAL_KEY)) {
            fileMap.set(TOTAL_KEY, { failureCount: 0, changeCount: 0, timestamps: [] });
          }
          fileMap.get(TOTAL_KEY)!.changeCount++;
        }
      }

      // Build final correlation entries
      this.fileCorrelations.clear();
      let totalCorrelations = 0;

      for (const [file, testMap] of correlationMap) {
        const totalChanges = testMap.get('__total_changes__')?.changeCount ?? 1;
        const correlations: FileCorrelation[] = [];

        for (const [testName, data] of testMap) {
          if (testName === '__total_changes__') continue;

          const correlation = data.failureCount / Math.max(totalChanges, 1);
          const weightedCorrelation = this.calculateWeightedCorrelation(
            data.timestamps,
            totalChanges
          );

          if (correlation >= MIN_CORRELATION_THRESHOLD || data.failureCount >= MIN_CO_FAILURE_COUNT) {
            correlations.push({
              sourceFile: file,
              testName,
              failureCount: data.failureCount,
              changeCount: totalChanges,
              correlation: parseFloat(correlation.toFixed(4)),
              weightedCorrelation: parseFloat(weightedCorrelation.toFixed(4)),
              lastSeenAt: data.timestamps[0] ?? new Date(),
            });
            totalCorrelations++;
          }
        }

        if (correlations.length > 0) {
          // Sort by weighted correlation descending
          correlations.sort((a, b) => b.weightedCorrelation - a.weightedCorrelation);
          this.fileCorrelations.set(file, correlations);
        }
      }

      this.lastAnalyzedAt = new Date();

      logger.info('[TestCorrelation] File correlations built', {
        totalCorrelations,
        uniqueFiles: this.fileCorrelations.size,
        testRuns: testRuns.length,
        durationMs: Date.now() - startTime,
      });

      return totalCorrelations;
    } catch (error) {
      logger.error('[TestCorrelation] Failed to build file correlations', {
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  /**
   * Build co-failure matrix: which tests tend to fail together.
   *
   * This helps select related tests even when direct file mapping is unavailable.
   * e.g., If test A fails and test B always fails with A, we should run B too.
   */
  async buildCoFailureMatrix(windowDays: number = DEFAULT_WINDOW_DAYS): Promise<number> {
    const startTime = Date.now();
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

    logger.info('[TestCorrelation] Building co-failure matrix...', { windowDays });

    try {
      // Get test runs with multiple failures
      const testRuns = await prisma.testRun.findMany({
        where: {
          createdAt: { gte: since },
          failed: { gt: 1 }, // Only runs with multiple failures
        },
        include: {
          results: {
            where: { status: 'FAILED' },
            select: { name: true },
          },
        },
      });

      // Count individual failure occurrences
      const failureCounts = new Map<string, number>();
      // Count co-failure pairs
      const coFailureCounts = new Map<string, number>();

      for (const run of testRuns) {
        const failedTests = run.results.map(r => r.name);

        // Count individual failures
        for (const test of failedTests) {
          failureCounts.set(test, (failureCounts.get(test) ?? 0) + 1);
        }

        // Count co-failure pairs (combinations, not permutations)
        for (let i = 0; i < failedTests.length; i++) {
          for (let j = i + 1; j < failedTests.length; j++) {
            const key = [failedTests[i], failedTests[j]].sort().join('|||');
            coFailureCounts.set(key, (coFailureCounts.get(key) ?? 0) + 1);
          }
        }
      }

      // Build co-failure entries with Jaccard similarity
      this.coFailureMatrix.clear();
      let totalPairs = 0;

      for (const [pairKey, count] of coFailureCounts) {
        if (count < MIN_CO_FAILURE_COUNT) continue;

        const [testA, testB] = pairKey.split('|||');
        const failsA = failureCounts.get(testA) ?? 0;
        const failsB = failureCounts.get(testB) ?? 0;

        // Jaccard similarity: intersection / union
        const similarity = count / (failsA + failsB - count);

        const entry: CoFailureEntry = {
          testA,
          testB,
          coFailureCount: count,
          totalFailuresA: failsA,
          totalFailuresB: failsB,
          similarity: parseFloat(similarity.toFixed(4)),
        };

        // Store bidirectionally
        if (!this.coFailureMatrix.has(testA)) {
          this.coFailureMatrix.set(testA, []);
        }
        this.coFailureMatrix.get(testA)!.push(entry);

        if (!this.coFailureMatrix.has(testB)) {
          this.coFailureMatrix.set(testB, []);
        }
        this.coFailureMatrix.get(testB)!.push({ ...entry, testA: testB, testB: testA });

        totalPairs++;
      }

      logger.info('[TestCorrelation] Co-failure matrix built', {
        totalPairs,
        uniqueTests: this.coFailureMatrix.size,
        runsAnalyzed: testRuns.length,
        durationMs: Date.now() - startTime,
      });

      return totalPairs;
    } catch (error) {
      logger.error('[TestCorrelation] Failed to build co-failure matrix', {
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  /**
   * Get correlated tests for a list of changed files.
   *
   * Uses both file-to-failure correlations and co-failure matrix.
   */
  async getCorrelatedTests(
    changedFiles: string[],
    alreadySelectedTests: string[] = []
  ): Promise<CorrelatedTestResult[]> {
    // Ensure correlations are built
    if (this.fileCorrelations.size === 0) {
      await this.buildFileCorrelations();
    }

    const results = new Map<string, CorrelatedTestResult>();

    // 1. File-to-failure correlations
    for (const file of changedFiles) {
      const correlations = this.fileCorrelations.get(file) ?? [];

      for (const corr of correlations) {
        const existing = results.get(corr.testName);
        const confidence = corr.weightedCorrelation;

        if (!existing || existing.confidence < confidence) {
          results.set(corr.testName, {
            testName: corr.testName,
            confidence,
            reason: `Historically fails ${Math.round(corr.correlation * 100)}% of the time when ${corr.sourceFile} changes`,
            sources: [{
              type: 'file-correlation',
              detail: `${corr.failureCount}/${corr.changeCount} changes → failure (weighted: ${corr.weightedCorrelation})`,
            }],
          });
        } else {
          existing.sources.push({
            type: 'file-correlation',
            detail: `${file}: ${corr.failureCount}/${corr.changeCount} changes → failure`,
          });
        }
      }
    }

    // 2. Co-failure expansion: if we already have selected tests, find their co-failure partners
    if (this.coFailureMatrix.size === 0 && alreadySelectedTests.length > 0) {
      await this.buildCoFailureMatrix();
    }

    for (const selectedTest of alreadySelectedTests) {
      const coFailures = this.coFailureMatrix.get(selectedTest) ?? [];

      for (const cf of coFailures) {
        if (cf.similarity < 0.3) continue; // Only high-similarity pairs
        if (results.has(cf.testB)) continue; // Already selected via file correlation

        results.set(cf.testB, {
          testName: cf.testB,
          confidence: cf.similarity * 0.8, // Slightly discount co-failure vs direct correlation
          reason: `Co-fails with ${cf.testA} (${Math.round(cf.similarity * 100)}% similarity)`,
          sources: [{
            type: 'co-failure',
            detail: `${cf.coFailureCount} co-failures, Jaccard=${cf.similarity}`,
          }],
        });
      }
    }

    // Sort by confidence descending
    return Array.from(results.values())
      .sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Get correlation statistics.
   */
  getStats(): CorrelationStats {
    const topFiles: Array<{ file: string; correlatedTests: number }> = [];

    for (const [file, correlations] of this.fileCorrelations) {
      topFiles.push({ file, correlatedTests: correlations.length });
    }
    topFiles.sort((a, b) => b.correlatedTests - a.correlatedTests);

    return {
      totalFileCorrelations: Array.from(this.fileCorrelations.values())
        .reduce((sum, c) => sum + c.length, 0),
      totalCoFailurePairs: Array.from(this.coFailureMatrix.values())
        .reduce((sum, c) => sum + c.length, 0) / 2, // Bidirectional, so halve
      analysisWindowDays: DEFAULT_WINDOW_DAYS,
      lastAnalyzedAt: this.lastAnalyzedAt,
      topCorrelatedFiles: topFiles.slice(0, 10),
    };
  }

  /**
   * Check if correlations have been built.
   */
  isReady(): boolean {
    return this.fileCorrelations.size > 0;
  }

  /**
   * Clear all cached correlations.
   */
  reset(): void {
    this.fileCorrelations.clear();
    this.coFailureMatrix.clear();
    this.lastAnalyzedAt = null;
  }

  // ── Private Methods ────────────────────────────────────────────────────

  /**
   * Extract changed files from a TestRun record.
   * Attempts to parse from the commit metadata or any stored changeset.
   */
  private extractChangedFiles(testRun: {
    commit: string | null;
    branch: string | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  }): string[] {
    try {
      // Check if the run has a changedFiles field (stored as JSON)
      if (testRun.changedFiles) {
        const parsed = JSON.parse(testRun.changedFiles as string);
        if (Array.isArray(parsed)) return parsed;
      }

      // Check metadata field for changed files
      if (testRun.metadata) {
        const meta = typeof testRun.metadata === 'string'
          ? JSON.parse(testRun.metadata)
          : testRun.metadata;
        if (meta?.changedFiles && Array.isArray(meta.changedFiles)) {
          return meta.changedFiles;
        }
      }
    } catch {
      // JSON parse failed — no changed files available
    }

    return [];
  }

  /**
   * Calculate recency-weighted correlation.
   * Uses exponential decay: weight = 2^(-age/halfLife)
   */
  private calculateWeightedCorrelation(
    timestamps: Date[],
    totalChanges: number
  ): number {
    if (timestamps.length === 0 || totalChanges === 0) return 0;

    const now = Date.now();
    let weightedSum = 0;

    for (const ts of timestamps) {
      const ageDays = (now - ts.getTime()) / (24 * 60 * 60 * 1000);
      const weight = Math.pow(2, -ageDays / RECENCY_HALF_LIFE_DAYS);
      weightedSum += weight;
    }

    // Normalize by total changes
    return weightedSum / Math.max(totalChanges, 1);
  }
}

export const testCorrelationService = new TestCorrelationService();
