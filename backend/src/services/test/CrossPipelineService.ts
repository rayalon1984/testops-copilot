/**
 * Cross-Pipeline Impact Service
 *
 * Maps shared packages and dependencies across pipelines to propagate
 * test selection events when shared code changes.
 *
 * When a change affects a shared module (e.g., @shared/utils), this service
 * identifies which other pipelines also use that module and should trigger
 * their test suites.
 *
 * Key concepts:
 * - Shared packages: directories/packages used by multiple pipelines
 * - Impact propagation: change in pipeline A triggers tests in pipeline B
 * - Pipeline mapping: configured or auto-detected from project structure
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/utils/logger';

// ── Types ────────────────────────────────────────────────────────────────

export interface PipelineMapping {
  pipelineId: string;
  pipelineName: string;
  /** Root directories that belong to this pipeline */
  sourcePaths: string[];
  /** Shared dependencies this pipeline consumes */
  sharedDependencies: string[];
}

export interface CrossPipelineImpact {
  /** The pipeline where the change originated */
  sourcePipelineId: string;
  /** Pipelines impacted by the change */
  impactedPipelines: Array<{
    pipelineId: string;
    pipelineName: string;
    reason: string;
    sharedPackages: string[];
  }>;
  /** Changed files that triggered the cross-pipeline impact */
  triggerFiles: string[];
}

export interface SharedPackageInfo {
  packagePath: string;
  usedByPipelines: string[];
  lastChangeAt: Date | null;
}

// ── Constants ────────────────────────────────────────────────────────────

/** Common shared path patterns (auto-detected) */
const SHARED_PATH_PATTERNS = [
  'shared/',
  'packages/',
  'libs/',
  'common/',
  '@shared/',
  'lib/shared/',
];

// ── Service ──────────────────────────────────────────────────────────────

export class CrossPipelineService {
  /** Pipeline → source path mappings (configurable) */
  private pipelineMappings: Map<string, PipelineMapping> = new Map();

  /**
   * Configure pipeline mappings.
   * Can be called at startup or updated dynamically.
   */
  configureMappings(mappings: PipelineMapping[]): void {
    this.pipelineMappings.clear();
    for (const mapping of mappings) {
      this.pipelineMappings.set(mapping.pipelineId, mapping);
    }
    logger.info('[CrossPipeline] Configured pipeline mappings', {
      count: mappings.length,
      pipelines: mappings.map(m => m.pipelineName),
    });
  }

  /**
   * Auto-detect pipeline mappings from the database.
   * Uses pipeline names and test run metadata to infer source paths.
   */
  async autoDetectMappings(): Promise<PipelineMapping[]> {
    try {
      const pipelines = await prisma.pipeline.findMany({
        select: { id: true, name: true, repository: true },
      });

      const mappings: PipelineMapping[] = pipelines.map(p => ({
        pipelineId: p.id,
        pipelineName: p.name,
        sourcePaths: p.repository ? [p.repository] : [p.name.toLowerCase()],
        sharedDependencies: [],
      }));

      this.configureMappings(mappings);
      return mappings;
    } catch (error) {
      logger.warn('[CrossPipeline] Auto-detection failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Analyze changed files and determine cross-pipeline impact.
   *
   * If a changed file belongs to a shared package, identify all pipelines
   * that depend on that package and should re-run their tests.
   */
  analyzeImpact(
    changedFiles: string[],
    sourcePipelineId?: string
  ): CrossPipelineImpact {
    const impactedPipelines: CrossPipelineImpact['impactedPipelines'] = [];
    const triggerFiles: string[] = [];

    // Identify which changed files are in shared paths
    const sharedChanges = changedFiles.filter(f =>
      SHARED_PATH_PATTERNS.some(pattern => f.includes(pattern))
    );

    if (sharedChanges.length === 0) {
      return {
        sourcePipelineId: sourcePipelineId ?? 'unknown',
        impactedPipelines: [],
        triggerFiles: [],
      };
    }

    triggerFiles.push(...sharedChanges);

    // For each pipeline, check if it uses the changed shared packages
    for (const [pipelineId, mapping] of this.pipelineMappings) {
      if (pipelineId === sourcePipelineId) continue; // Skip source pipeline

      const matchedPackages: string[] = [];

      for (const sharedFile of sharedChanges) {
        // Check if this pipeline has any shared dependency that matches
        const sharedDir = this.getSharedPackageDir(sharedFile);

        if (sharedDir) {
          // Check if pipeline's shared dependencies include this package
          if (mapping.sharedDependencies.some(dep => sharedFile.includes(dep))) {
            matchedPackages.push(sharedDir);
          }

          // Also check by path overlap (any pipeline that references shared/ is affected)
          if (mapping.sourcePaths.some(sp => this.pathsOverlap(sp, sharedDir))) {
            matchedPackages.push(sharedDir);
          }
        }
      }

      // If no explicit match, check if it's a truly global shared change
      if (matchedPackages.length === 0 && sharedChanges.length > 0) {
        // Any pipeline touching the same repo is potentially impacted
        matchedPackages.push(...sharedChanges.map(f => this.getSharedPackageDir(f) ?? f));
      }

      if (matchedPackages.length > 0) {
        const uniquePackages = [...new Set(matchedPackages)];
        impactedPipelines.push({
          pipelineId,
          pipelineName: mapping.pipelineName,
          reason: `Shared package changed: ${uniquePackages.join(', ')}`,
          sharedPackages: uniquePackages,
        });
      }
    }

    if (impactedPipelines.length > 0) {
      logger.info('[CrossPipeline] Cross-pipeline impact detected', {
        sourcePipelineId,
        impactedCount: impactedPipelines.length,
        triggerFiles: triggerFiles.length,
        impactedPipelines: impactedPipelines.map(p => p.pipelineName),
      });
    }

    return {
      sourcePipelineId: sourcePipelineId ?? 'unknown',
      impactedPipelines,
      triggerFiles,
    };
  }

  /**
   * Get all shared packages and which pipelines use them.
   */
  getSharedPackages(): SharedPackageInfo[] {
    const packageMap = new Map<string, Set<string>>();

    for (const [, mapping] of this.pipelineMappings) {
      for (const dep of mapping.sharedDependencies) {
        if (!packageMap.has(dep)) {
          packageMap.set(dep, new Set());
        }
        packageMap.get(dep)!.add(mapping.pipelineId);
      }
    }

    return Array.from(packageMap.entries()).map(([packagePath, pipelines]) => ({
      packagePath,
      usedByPipelines: Array.from(pipelines),
      lastChangeAt: null, // Would need git log for this
    }));
  }

  /**
   * Check if pipeline mappings are configured.
   */
  isConfigured(): boolean {
    return this.pipelineMappings.size > 0;
  }

  // ── Private Methods ────────────────────────────────────────────────────

  /**
   * Extract the shared package directory from a file path.
   * e.g., "shared/utils/helpers.ts" → "shared/utils"
   */
  private getSharedPackageDir(filePath: string): string | null {
    for (const pattern of SHARED_PATH_PATTERNS) {
      const idx = filePath.indexOf(pattern);
      if (idx !== -1) {
        // Get the next directory level after the shared prefix
        const afterShared = filePath.substring(idx + pattern.length);
        const nextSlash = afterShared.indexOf('/');
        return nextSlash >= 0
          ? filePath.substring(0, idx + pattern.length + nextSlash)
          : filePath.substring(0, idx + pattern.length);
      }
    }
    return null;
  }

  /**
   * Check if two paths have a common prefix (i.e., they're in the same subtree).
   */
  private pathsOverlap(pathA: string, pathB: string): boolean {
    return pathA.startsWith(pathB) || pathB.startsWith(pathA);
  }
}

export const crossPipelineService = new CrossPipelineService();
