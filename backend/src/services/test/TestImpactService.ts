/**
 * Test Impact Service (Smart Test Selection)
 *
 * Maps changed source files to relevant tests to optimize CI execution.
 * Used by POST /api/v1/ci/smart-select.
 *
 * Strategies (in priority order):
 * 1. Direct Test File Change: If a test file itself changed, select it.
 * 2. Coverage Mapping: Use LCOV/Istanbul data for precise test-to-code mapping.
 * 3. Dependency Graph: Parse imports to find transitive dependents.
 * 4. Historical Correlation: Statistical analysis from past test runs.
 * 5. Convention Mapping: src/path/file.ts → src/path/__tests__/file.test.ts
 * 6. Global File Trigger: schema.prisma, package.json, etc. → run ALL tests.
 *
 * Post-selection filters:
 * - Quarantined test exclusion: Auto-exclude flaky tests under quarantine.
 * - Co-failure expansion: Add tests that historically co-fail with selected tests.
 */

import path from 'path';
import fs from 'fs/promises';
import { prisma } from '@/lib/prisma';
import { logger } from '@/utils/logger';
import { dependencyGraphService } from './DependencyGraphService';
import { coverageMapService } from './CoverageMapService';
import { testCorrelationService } from './TestCorrelationService';

export interface SmartSelectOptions {
  projectRoot?: string;
  testPatterns?: string[];
  globalFiles?: string[];
  validateFileExistence?: boolean;
  /** Enable dependency graph analysis (Phase 3) */
  useDependencyGraph?: boolean;
  /** Enable coverage-based selection (Phase 3) */
  useCoverageMap?: boolean;
  /** Enable historical correlation analysis (Phase 4) */
  useCorrelation?: boolean;
  /** Exclude quarantined (flaky) tests from selection (Phase 4) */
  excludeQuarantined?: boolean;
}

export type SelectionStrategyName = 'direct' | 'convention' | 'global' | 'mixed' | 'dependency' | 'coverage' | 'correlation';

export interface TestSelectionResult {
  selectedTests: string[];
  reason: string;
  totalTests: number;
  savedTests: number;
  selectionStrategy: SelectionStrategyName;
  confidence: number;
  details: SelectionDetail[];
  /** Phase 4: metadata about quarantine exclusions and correlation additions */
  metadata?: SelectionMetadata;
}

export interface SelectionDetail {
  changedFile: string;
  mappedTests: string[];
  strategy: 'direct' | 'convention' | 'directory' | 'global' | 'dependency' | 'coverage' | 'correlation';
}

export interface SelectionMetadata {
  /** Tests excluded because they are quarantined */
  quarantinedExclusions: string[];
  /** Tests added via co-failure correlation */
  correlationAdditions: string[];
}

/** Files whose change triggers a full test suite run */
const DEFAULT_GLOBAL_FILES = [
  'schema.prisma',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'tsconfig.build.json',
  '.env',
  '.env.example',
  'jest.config.ts',
  'jest.config.js',
  'vitest.config.ts',
  'docker-compose.yml',
  'docker-compose.override.yml',
  'Dockerfile',
];

/** Test file patterns */
const TEST_FILE_PATTERNS = ['.test.ts', '.test.tsx', '.spec.ts', '.spec.tsx'];

export class TestImpactService {
  /**
   * Given a list of changed file paths, determine which tests to run.
   *
   * @param changedFiles - File paths relative to project root
   * @param options - Optional configuration overrides
   * @returns Selection result with selected tests and metadata
   */
  async getTestsForChanges(
    changedFiles: string[],
    options: SmartSelectOptions = {}
  ): Promise<TestSelectionResult> {
    const startTime = Date.now();
    const selectedTests = new Set<string>();
    const details: SelectionDetail[] = [];
    const globalFiles = options.globalFiles ?? DEFAULT_GLOBAL_FILES;
    let primaryStrategy: TestSelectionResult['selectionStrategy'] = 'convention';

    for (const file of changedFiles) {
      const normalized = file.replace(/\\/g, '/');

      // Strategy 1: Global file detection (early exit — run everything)
      if (this.isGlobalFile(normalized, globalFiles)) {
        const totalTests = await this.getTotalTestCount();

        logger.info('[TestImpactService] Global configuration change detected', {
          file: normalized,
          action: 'run_all_tests',
          totalTests,
          durationMs: Date.now() - startTime,
        });

        return {
          selectedTests: ['ALL'],
          reason: `Global configuration change: ${path.basename(normalized)}`,
          totalTests,
          savedTests: 0,
          selectionStrategy: 'global',
          confidence: 1.0,
          details: [{ changedFile: normalized, mappedTests: ['ALL'], strategy: 'global' }],
        };
      }

      // Strategy 2: Direct test file change
      if (this.isTestFile(normalized)) {
        const testName = normalized;
        selectedTests.add(testName);
        details.push({ changedFile: normalized, mappedTests: [testName], strategy: 'direct' });
        continue;
      }

      // Strategy 3: Coverage-based selection (Phase 3 — highest precision)
      if (options.useCoverageMap) {
        const coverageTests = await this.getCoverageBasedTests(normalized);
        if (coverageTests.length > 0) {
          for (const t of coverageTests) {
            selectedTests.add(t);
          }
          details.push({ changedFile: normalized, mappedTests: coverageTests, strategy: 'coverage' });
          continue; // Coverage is the most precise — skip lower-precision strategies
        }
      }

      // Strategy 4: Dependency graph analysis (Phase 3 — high precision)
      if (options.useDependencyGraph) {
        const depTests = await this.getDependencyBasedTests(normalized);
        if (depTests.length > 0) {
          for (const t of depTests) {
            selectedTests.add(t);
          }
          details.push({ changedFile: normalized, mappedTests: depTests, strategy: 'dependency' });
          continue; // Dependency graph found tests — skip convention
        }
      }

      // Strategy 5: Convention-based mapping (source → test) — fallback
      const mappedTests = await this.mapSourceToTests(normalized, options);
      if (mappedTests.length > 0) {
        for (const t of mappedTests) {
          selectedTests.add(t);
        }
        details.push({ changedFile: normalized, mappedTests, strategy: 'convention' });
      }
    }

    // Phase 4: Historical correlation analysis
    const correlationAdditions: string[] = [];
    if (options.useCorrelation) {
      const correlatedTests = await this.getCorrelationBasedTests(
        changedFiles,
        Array.from(selectedTests)
      );
      for (const ct of correlatedTests) {
        if (!selectedTests.has(ct)) {
          selectedTests.add(ct);
          correlationAdditions.push(ct);
        }
      }
      if (correlationAdditions.length > 0) {
        details.push({
          changedFile: '[correlation-expansion]',
          mappedTests: correlationAdditions,
          strategy: 'correlation',
        });
      }
    }

    // Phase 4: Exclude quarantined (flaky) tests
    const quarantinedExclusions: string[] = [];
    if (options.excludeQuarantined) {
      const quarantined = await this.getQuarantinedTestNames();
      for (const qTest of quarantined) {
        if (selectedTests.has(qTest)) {
          selectedTests.delete(qTest);
          quarantinedExclusions.push(qTest);
        }
      }
      if (quarantinedExclusions.length > 0) {
        logger.info('[TestImpactService] Excluded quarantined tests', {
          count: quarantinedExclusions.length,
          tests: quarantinedExclusions.slice(0, 5),
        });
      }
    }

    // Determine primary strategy used
    const strategies = new Set(details.map(d => d.strategy));
    if (strategies.size > 1) {
      primaryStrategy = 'mixed';
    } else if (strategies.has('direct')) {
      primaryStrategy = 'direct';
    } else if (strategies.has('correlation')) {
      primaryStrategy = 'correlation';
    }

    // Calculate confidence based on strategy
    const confidence = this.calculateConfidence(details);
    const totalTests = await this.getTotalTestCount();
    const savedTests = Math.max(0, totalTests - selectedTests.size);

    logger.info('[TestImpactService] Selection complete', {
      changedFiles: changedFiles.length,
      selectedTests: selectedTests.size,
      totalTests,
      savedTests,
      confidence,
      strategies: Array.from(strategies),
      correlationAdditions: correlationAdditions.length,
      quarantinedExclusions: quarantinedExclusions.length,
      durationMs: Date.now() - startTime,
    });

    return {
      selectedTests: Array.from(selectedTests),
      reason: selectedTests.size === 0
        ? 'No test-relevant changes detected'
        : `Impact Analysis (${selectedTests.size} tests selected)`,
      totalTests,
      savedTests,
      selectionStrategy: primaryStrategy,
      confidence,
      details,
      metadata: (correlationAdditions.length > 0 || quarantinedExclusions.length > 0)
        ? { correlationAdditions, quarantinedExclusions }
        : undefined,
    };
  }

  /**
   * Maps a source file to its expected test file(s).
   *
   * Convention: src/path/file.ts → src/path/__tests__/file.test.ts
   * Also checks: src/path/file.ts → src/path/file.test.ts (co-located)
   */
  private async mapSourceToTests(
    filePath: string,
    options: SmartSelectOptions = {}
  ): Promise<string[]> {
    const parts = filePath.split('/');
    const fileName = parts.pop();

    if (!fileName || !filePath.includes('src/')) return [];

    // Skip non-TypeScript/JavaScript files
    if (!fileName.match(/\.(ts|tsx|js|jsx)$/)) return [];

    const dir = parts.join('/');
    const baseName = fileName.replace(/\.(ts|tsx|js|jsx)$/, '');

    // Generate candidate test paths
    const candidates = [
      // Convention: sibling __tests__ folder
      `${dir}/__tests__/${baseName}.test.ts`,
      `${dir}/__tests__/${baseName}.test.tsx`,
      `${dir}/__tests__/${baseName}.spec.ts`,
      // Co-located test file
      `${dir}/${baseName}.test.ts`,
      `${dir}/${baseName}.test.tsx`,
      `${dir}/${baseName}.spec.ts`,
    ];

    // If file existence validation is enabled, check which candidates actually exist
    if (options.validateFileExistence && options.projectRoot) {
      const existing: string[] = [];
      for (const candidate of candidates) {
        const fullPath = path.join(options.projectRoot, candidate);
        try {
          await fs.access(fullPath);
          existing.push(candidate);
        } catch {
          // File doesn't exist — skip
        }
      }
      return existing;
    }

    // Without validation, return the primary convention candidate
    // (most likely path based on project conventions)
    return [`${dir}/__tests__/${baseName}.test.ts`];
  }

  /**
   * Checks if a file is a test file.
   */
  private isTestFile(filePath: string): boolean {
    return TEST_FILE_PATTERNS.some(pattern => filePath.includes(pattern));
  }

  /**
   * Checks if a file is a global configuration file that should trigger all tests.
   */
  private isGlobalFile(filePath: string, globalFiles: string[]): boolean {
    const basename = path.basename(filePath);
    return globalFiles.some(gf => basename === gf || filePath.endsWith(gf));
  }

  /**
   * Gets the total number of distinct tests from the database.
   * Falls back to 0 if the database is unavailable.
   */
  private async getTotalTestCount(): Promise<number> {
    try {
      const testNames = await prisma.testResult.findMany({
        distinct: ['name'],
        select: { name: true },
      });
      return testNames.length;
    } catch (error) {
      logger.warn('[TestImpactService] Failed to query total test count, using fallback', {
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  /**
   * Calculates selection confidence based on strategies used.
   *
   * Direct test file changes = highest confidence (1.0)
   * Convention-based mapping = medium confidence (0.7)
   * Mixed = weighted average
   */
  private calculateConfidence(details: SelectionDetail[]): number {
    if (details.length === 0) return 1.0; // No changes = full confidence

    const weights: Record<string, number> = {
      direct: 1.0,
      global: 1.0,
      coverage: 0.95,
      dependency: 0.85,
      correlation: 0.8,
      convention: 0.7,
      directory: 0.6,
    };

    const totalWeight = details.reduce((sum, d) => sum + (weights[d.strategy] ?? 0.5), 0);
    return parseFloat((totalWeight / details.length).toFixed(2));
  }

  /**
   * Get tests using coverage map data (Phase 3).
   * Returns tests that cover the given source file.
   */
  private async getCoverageBasedTests(filePath: string): Promise<string[]> {
    try {
      const isFresh = await coverageMapService.isFresh();
      if (!isFresh) return [];

      return await coverageMapService.getTestsForSourceFile(filePath);
    } catch (error) {
      logger.warn('[TestImpactService] Coverage lookup failed, skipping', {
        file: filePath,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Get tests using dependency graph analysis (Phase 3).
   * Returns test files that transitively depend on the given source file.
   */
  private async getDependencyBasedTests(filePath: string): Promise<string[]> {
    try {
      return await dependencyGraphService.getTestsForFile(filePath);
    } catch (error) {
      logger.warn('[TestImpactService] Dependency graph lookup failed, skipping', {
        file: filePath,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Get tests using historical correlation analysis (Phase 4).
   * Returns tests that historically fail when the given files change.
   */
  private async getCorrelationBasedTests(
    changedFiles: string[],
    alreadySelected: string[]
  ): Promise<string[]> {
    try {
      const correlatedResults = await testCorrelationService.getCorrelatedTests(
        changedFiles,
        alreadySelected
      );

      // Only include tests with meaningful confidence
      return correlatedResults
        .filter(r => r.confidence >= 0.2)
        .map(r => r.testName);
    } catch (error) {
      logger.warn('[TestImpactService] Correlation lookup failed, skipping', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Get names of currently quarantined tests (Phase 4).
   * These tests are known to be flaky and should be excluded from selection.
   */
  private async getQuarantinedTestNames(): Promise<string[]> {
    try {
      const quarantined = await prisma.quarantinedTest.findMany({
        where: { status: 'quarantined' },
        select: { testName: true },
      });
      return quarantined.map(q => q.testName);
    } catch (error) {
      logger.warn('[TestImpactService] Failed to query quarantined tests', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }
}

export const testImpactService = new TestImpactService();
