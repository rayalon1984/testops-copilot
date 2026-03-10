/**
 * Dependency Graph Service
 *
 * Builds and queries a project dependency graph by parsing TypeScript/JavaScript
 * import statements. Used by TestImpactService to find tests affected by
 * transitive dependencies.
 *
 * Strategies:
 * 1. Parse import/require statements from source files
 * 2. Build an adjacency list (file → dependents)
 * 3. For a changed file, traverse the graph to find all test dependents
 * 4. Cache the graph in the database for persistence
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/utils/logger';
import fs from 'fs/promises';
import path from 'path';

/** Regex patterns for extracting imports from TypeScript/JavaScript files */
const IMPORT_PATTERNS = [
  // ES module imports: import { x } from './path'
  /import\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g,
  // Dynamic imports: import('./path')
  /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  // Require: require('./path')
  /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  // Re-exports: export { x } from './path'
  /export\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g,
];

/** Test file patterns */
const TEST_PATTERNS = ['.test.ts', '.test.tsx', '.spec.ts', '.spec.tsx'];

export interface DependencyNode {
  file: string;
  dependents: string[]; // Files that import this file
}

export interface GraphStats {
  totalFiles: number;
  totalEdges: number;
  buildTimeMs: number;
  lastBuiltAt: Date;
}

export class DependencyGraphService {
  /** In-memory adjacency list: targetFile → Set<sourceFiles that import it> */
  private reverseGraph: Map<string, Set<string>> = new Map();

  /** Forward graph: sourceFile → Set<targetFiles it imports> */
  private forwardGraph: Map<string, Set<string>> = new Map();

  private lastBuildTime: Date | null = null;

  /**
   * Build the dependency graph by scanning source files.
   * Uses the database for persistence — subsequent calls can load from DB.
   */
  async buildGraph(projectRoot: string, patterns: string[] = ['src/**/*.ts', 'src/**/*.tsx']): Promise<GraphStats> {
    const startTime = Date.now();

    logger.info('[DependencyGraph] Building graph...', { projectRoot });

    try {
      // Scan files and extract imports
      const files = await this.findSourceFiles(projectRoot, patterns);
      let edgeCount = 0;

      for (const filePath of files) {
        const imports = await this.extractImports(filePath, projectRoot);

        for (const imp of imports) {
          this.addEdge(filePath, imp.resolvedPath, imp.type);
          edgeCount++;
        }
      }

      // Persist to database
      await this.persistGraph();

      this.lastBuildTime = new Date();
      const buildTimeMs = Date.now() - startTime;

      logger.info('[DependencyGraph] Build complete', {
        totalFiles: files.length,
        totalEdges: edgeCount,
        buildTimeMs,
      });

      return {
        totalFiles: files.length,
        totalEdges: edgeCount,
        buildTimeMs,
        lastBuiltAt: this.lastBuildTime,
      };
    } catch (error) {
      logger.error('[DependencyGraph] Build failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Load the dependency graph from the database.
   */
  async loadFromDatabase(): Promise<void> {
    try {
      const edges = await prisma.dependencyEdge.findMany();

      this.reverseGraph.clear();
      this.forwardGraph.clear();

      for (const edge of edges) {
        // Forward: sourceFile imports targetFile
        if (!this.forwardGraph.has(edge.sourceFile)) {
          this.forwardGraph.set(edge.sourceFile, new Set());
        }
        this.forwardGraph.get(edge.sourceFile)!.add(edge.targetFile);

        // Reverse: targetFile is imported by sourceFile
        if (!this.reverseGraph.has(edge.targetFile)) {
          this.reverseGraph.set(edge.targetFile, new Set());
        }
        this.reverseGraph.get(edge.targetFile)!.add(edge.sourceFile);
      }

      this.lastBuildTime = new Date();
      logger.info('[DependencyGraph] Loaded from database', {
        files: this.forwardGraph.size,
        edges: edges.length,
      });
    } catch (error) {
      logger.warn('[DependencyGraph] Failed to load from database', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Find all test files that depend (directly or transitively) on a given source file.
   */
  async getTestsForFile(filePath: string): Promise<string[]> {
    if (this.reverseGraph.size === 0) {
      await this.loadFromDatabase();
    }

    const allDependents = this.getTransitiveDependents(filePath);
    return allDependents.filter(f => this.isTestFile(f));
  }

  /**
   * Get all files that transitively depend on the given file.
   * Uses BFS to avoid stack overflow on deep graphs.
   */
  getTransitiveDependents(filePath: string): string[] {
    const visited = new Set<string>();
    const queue: string[] = [filePath];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      const dependents = this.reverseGraph.get(current);
      if (dependents) {
        for (const dep of dependents) {
          if (!visited.has(dep)) {
            queue.push(dep);
          }
        }
      }
    }

    // Remove the original file from the result
    visited.delete(filePath);
    return Array.from(visited);
  }

  /**
   * Check if the graph is loaded and has data.
   */
  isLoaded(): boolean {
    return this.reverseGraph.size > 0;
  }

  /**
   * Get graph statistics.
   */
  getStats(): GraphStats | null {
    if (!this.lastBuildTime) return null;

    let totalEdges = 0;
    for (const deps of this.reverseGraph.values()) {
      totalEdges += deps.size;
    }

    return {
      totalFiles: this.forwardGraph.size,
      totalEdges,
      buildTimeMs: 0,
      lastBuiltAt: this.lastBuildTime,
    };
  }

  // ─── Private Methods ───

  private addEdge(sourceFile: string, targetFile: string, _importType: string): void {
    // Forward: source imports target
    if (!this.forwardGraph.has(sourceFile)) {
      this.forwardGraph.set(sourceFile, new Set());
    }
    this.forwardGraph.get(sourceFile)!.add(targetFile);

    // Reverse: target is imported by source
    if (!this.reverseGraph.has(targetFile)) {
      this.reverseGraph.set(targetFile, new Set());
    }
    this.reverseGraph.get(targetFile)!.add(sourceFile);
  }

  /**
   * Extract import paths from a source file.
   */
  private async extractImports(
    filePath: string,
    projectRoot: string
  ): Promise<Array<{ rawPath: string; resolvedPath: string; type: string }>> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const imports: Array<{ rawPath: string; resolvedPath: string; type: string }> = [];
      const relativePath = path.relative(projectRoot, filePath);

      for (const pattern of IMPORT_PATTERNS) {
        // Reset regex lastIndex
        pattern.lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = pattern.exec(content)) !== null) {
          const rawImportPath = match[1];

          // Skip node_modules / external packages
          if (!rawImportPath.startsWith('.') && !rawImportPath.startsWith('@/')) {
            continue;
          }

          const resolved = this.resolveImportPath(rawImportPath, relativePath, projectRoot);
          if (resolved) {
            const importType = pattern.source.includes('require') ? 'require'
              : pattern.source.includes('export') ? 're-export'
                : pattern.source.includes('import\\s*\\(') ? 'dynamic'
                  : 'static';

            imports.push({
              rawPath: rawImportPath,
              resolvedPath: resolved,
              type: importType,
            });
          }
        }
      }

      return imports;
    } catch {
      return [];
    }
  }

  /**
   * Resolve a relative import path to a project-relative path.
   */
  private resolveImportPath(
    importPath: string,
    fromFile: string,
    _projectRoot: string
  ): string | null {
    try {
      // Handle @/ alias (common in this project)
      if (importPath.startsWith('@/')) {
        const aliasPath = importPath.replace('@/', 'src/');
        return this.addExtension(aliasPath);
      }

      // Handle relative imports
      const fromDir = path.dirname(fromFile);
      const resolved = path.normalize(path.join(fromDir, importPath));
      return this.addExtension(resolved);
    } catch {
      return null;
    }
  }

  /**
   * Add .ts extension if not already present.
   */
  private addExtension(filePath: string): string {
    if (filePath.match(/\.(ts|tsx|js|jsx)$/)) {
      return filePath;
    }
    // Default to .ts extension
    return filePath + '.ts';
  }

  private isTestFile(filePath: string): boolean {
    return TEST_PATTERNS.some(pattern => filePath.includes(pattern));
  }

  /**
   * Find TypeScript/JavaScript source files in the project.
   */
  private async findSourceFiles(projectRoot: string, _patterns: string[]): Promise<string[]> {
    const files: string[] = [];
    await this.walkDir(path.join(projectRoot, 'src'), files);
    return files;
  }

  /**
   * Recursively walk a directory and collect .ts/.tsx/.js/.jsx files.
   */
  private async walkDir(dir: string, files: string[]): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          // Skip node_modules and hidden directories
          if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
          await this.walkDir(fullPath, files);
        } else if (entry.isFile() && entry.name.match(/\.(ts|tsx|js|jsx)$/)) {
          files.push(fullPath);
        }
      }
    } catch {
      // Directory might not exist
    }
  }

  /**
   * Persist the in-memory graph to the database.
   */
  private async persistGraph(): Promise<void> {
    try {
      // Clear existing edges
      await prisma.dependencyEdge.deleteMany();

      // Batch insert new edges
      const edges: Array<{
        sourceFile: string;
        targetFile: string;
        importType: string;
      }> = [];

      for (const [sourceFile, targets] of this.forwardGraph) {
        for (const targetFile of targets) {
          edges.push({ sourceFile, targetFile, importType: 'static' });
        }
      }

      if (edges.length > 0) {
        // Insert in batches of 500
        const batchSize = 500;
        for (let i = 0; i < edges.length; i += batchSize) {
          const batch = edges.slice(i, i + batchSize);
          await prisma.dependencyEdge.createMany({ data: batch });
        }
      }

      logger.info('[DependencyGraph] Persisted to database', { edges: edges.length });
    } catch (error) {
      logger.warn('[DependencyGraph] Failed to persist', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export const dependencyGraphService = new DependencyGraphService();
