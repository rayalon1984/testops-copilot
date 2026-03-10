/**
 * Coverage Map Service
 *
 * Parses and stores test coverage data (LCOV, Istanbul JSON, Cobertura XML).
 * Maps: "test T covers source file S at lines L1-L2."
 * When source file S changes, test T is selected.
 *
 * Supported formats:
 * - LCOV (lcov.info) — line-level coverage per file
 * - Istanbul/NYC (coverage-final.json) — statement/branch/function coverage
 * - Cobertura (cobertura.xml) — XML-based coverage
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/utils/logger';

export interface CoverageEntry {
  testName: string;
  sourceFile: string;
  coveredLines: number[][]; // [[startLine, endLine], ...]
}

export interface CoverageStats {
  totalMappings: number;
  sourceFiles: number;
  testFiles: number;
  lastUpdated: Date | null;
}

export class CoverageMapService {

  /**
   * Get all test names that cover a given source file.
   */
  async getTestsForSourceFile(sourceFile: string): Promise<string[]> {
    try {
      const mappings = await prisma.testCoverageMap.findMany({
        where: { sourceFile },
        select: { testName: true },
        distinct: ['testName'],
      });

      return mappings.map(m => m.testName);
    } catch (error) {
      logger.warn('[CoverageMap] Failed to query tests for file', {
        sourceFile,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Get all test names that cover specific lines in a source file.
   * This is the most precise form of test selection.
   */
  async getTestsForFileLines(sourceFile: string, changedLines: number[]): Promise<string[]> {
    try {
      const mappings = await prisma.testCoverageMap.findMany({
        where: { sourceFile },
      });

      const matchingTests = new Set<string>();

      for (const mapping of mappings) {
        const coveredRanges: number[][] = JSON.parse(mapping.coveredLines);

        for (const changedLine of changedLines) {
          for (const [start, end] of coveredRanges) {
            if (changedLine >= start && changedLine <= end) {
              matchingTests.add(mapping.testName);
              break;
            }
          }
        }
      }

      return Array.from(matchingTests);
    } catch (error) {
      logger.warn('[CoverageMap] Failed to query tests for file lines', {
        sourceFile,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Store coverage data from parsed coverage reports.
   */
  async storeCoverage(
    entries: CoverageEntry[],
    pipelineId?: string,
    branch?: string
  ): Promise<number> {
    try {
      let stored = 0;

      // Upsert in batches
      for (const entry of entries) {
        await prisma.testCoverageMap.upsert({
          where: {
            testName_sourceFile: {
              testName: entry.testName,
              sourceFile: entry.sourceFile,
            },
          },
          update: {
            coveredLines: JSON.stringify(entry.coveredLines),
            pipelineId,
            branch,
            collectedAt: new Date(),
          },
          create: {
            testName: entry.testName,
            sourceFile: entry.sourceFile,
            coveredLines: JSON.stringify(entry.coveredLines),
            pipelineId,
            branch,
          },
        });
        stored++;
      }

      logger.info('[CoverageMap] Stored coverage data', {
        entries: stored,
        pipelineId,
        branch,
      });

      return stored;
    } catch (error) {
      logger.error('[CoverageMap] Failed to store coverage', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Parse LCOV format coverage data.
   *
   * LCOV format:
   * SF:<source_file>
   * DA:<line_number>,<execution_count>
   * end_of_record
   */
  parseLcov(lcovContent: string, testNamePrefix: string = 'test'): CoverageEntry[] {
    const entries: CoverageEntry[] = [];
    const records = lcovContent.split('end_of_record');

    for (const record of records) {
      const lines = record.trim().split('\n');
      let sourceFile = '';
      const coveredLines: number[] = [];

      for (const line of lines) {
        if (line.startsWith('SF:')) {
          sourceFile = line.substring(3).trim();
        } else if (line.startsWith('DA:')) {
          const [lineNum, count] = line.substring(3).split(',').map(Number);
          if (count > 0) {
            coveredLines.push(lineNum);
          }
        }
      }

      if (sourceFile && coveredLines.length > 0) {
        // Convert individual lines to ranges
        const ranges = this.linesToRanges(coveredLines);
        entries.push({
          testName: `${testNamePrefix}:${sourceFile}`,
          sourceFile,
          coveredLines: ranges,
        });
      }
    }

    return entries;
  }

  /**
   * Parse Istanbul/NYC JSON coverage format.
   */
  parseIstanbul(jsonContent: string): CoverageEntry[] {
    const entries: CoverageEntry[] = [];

    try {
      const coverage = JSON.parse(jsonContent) as Record<string, {
        path: string;
        s: Record<string, number>;
        statementMap: Record<string, { start: { line: number }; end: { line: number } }>;
      }>;

      for (const [, fileCoverage] of Object.entries(coverage)) {
        const coveredLines: number[] = [];

        for (const [stmtId, count] of Object.entries(fileCoverage.s)) {
          if (count > 0 && fileCoverage.statementMap[stmtId]) {
            const { start, end } = fileCoverage.statementMap[stmtId];
            for (let line = start.line; line <= end.line; line++) {
              coveredLines.push(line);
            }
          }
        }

        if (coveredLines.length > 0) {
          const ranges = this.linesToRanges([...new Set(coveredLines)].sort((a, b) => a - b));
          entries.push({
            testName: `istanbul:${fileCoverage.path}`,
            sourceFile: fileCoverage.path,
            coveredLines: ranges,
          });
        }
      }
    } catch (error) {
      logger.error('[CoverageMap] Failed to parse Istanbul JSON', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return entries;
  }

  /**
   * Get coverage statistics.
   */
  async getStats(): Promise<CoverageStats> {
    try {
      const totalMappings = await prisma.testCoverageMap.count();

      const sourceFiles = await prisma.testCoverageMap.findMany({
        distinct: ['sourceFile'],
        select: { sourceFile: true },
      });

      const testFiles = await prisma.testCoverageMap.findMany({
        distinct: ['testName'],
        select: { testName: true },
      });

      const latest = await prisma.testCoverageMap.findFirst({
        orderBy: { collectedAt: 'desc' },
        select: { collectedAt: true },
      });

      return {
        totalMappings,
        sourceFiles: sourceFiles.length,
        testFiles: testFiles.length,
        lastUpdated: latest?.collectedAt ?? null,
      };
    } catch (error) {
      logger.warn('[CoverageMap] Failed to get stats', {
        error: error instanceof Error ? error.message : String(error),
      });
      return { totalMappings: 0, sourceFiles: 0, testFiles: 0, lastUpdated: null };
    }
  }

  /**
   * Check if coverage data exists and is fresh (within TTL).
   */
  async isFresh(maxAgeDays: number = 7): Promise<boolean> {
    try {
      const latest = await prisma.testCoverageMap.findFirst({
        orderBy: { collectedAt: 'desc' },
        select: { collectedAt: true },
      });

      if (!latest) return false;

      const ageMs = Date.now() - latest.collectedAt.getTime();
      return ageMs < maxAgeDays * 24 * 60 * 60 * 1000;
    } catch {
      return false;
    }
  }

  /**
   * Convert an array of individual line numbers to contiguous ranges.
   * e.g., [1,2,3,5,6,10] → [[1,3],[5,6],[10,10]]
   */
  private linesToRanges(lines: number[]): number[][] {
    if (lines.length === 0) return [];

    const sorted = [...new Set(lines)].sort((a, b) => a - b);
    const ranges: number[][] = [];
    let start = sorted[0];
    let end = sorted[0];

    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === end + 1) {
        end = sorted[i];
      } else {
        ranges.push([start, end]);
        start = sorted[i];
        end = sorted[i];
      }
    }
    ranges.push([start, end]);

    return ranges;
  }
}

export const coverageMapService = new CoverageMapService();
