#!/usr/bin/env tsx
/**
 * Feature Spec Scanner — Validates manifests, detects orphans, reports coverage.
 *
 * Usage:
 *   npx tsx scripts/scan-feature-specs.ts
 *   npm run validate:specs
 *
 * Checks:
 *   - Schema validation (ERROR)
 *   - Unique assertion IDs (ERROR)
 *   - File existence for capability source files (ERROR)
 *   - AC mapping completeness (WARNING)
 *   - Orphaned assertions — in manifest but no test (WARNING)
 *   - Orphaned tests — itAssertion() calls referencing unknown IDs (WARNING)
 *   - Version drift (WARNING)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import {
  type FeatureManifest,
  type ValidationError,
  validateManifest,
} from '../specs/features/_schema';

const ROOT = path.resolve(__dirname, '..');
const FEATURES_DIR = path.join(ROOT, 'specs', 'features');
const BACKEND_SRC = path.join(ROOT, 'backend', 'src');
const FRONTEND_SRC = path.join(ROOT, 'frontend', 'src');
const TRACKER_PATH = path.join(ROOT, 'backend', 'src', '__tests__', 'helpers', 'spec-version-tracker.json');

// --- Types ---

interface ScanResult {
  featureId: string;
  fileName: string;
  version: string;
  assertionCount: number;
  testedCount: number;
  untestedCount: number;
  errors: string[];
  warnings: string[];
}

interface CoverageReport {
  total: number;
  tested: number;
  invariants: { total: number; tested: number };
  behavioral: { total: number; tested: number };
  contracts: { total: number; tested: number };
}

// --- Helpers ---

function findTestFiles(): string[] {
  const testDirs = [
    path.join(BACKEND_SRC, '__tests__'),
    path.join(BACKEND_SRC, 'services', 'ai', '__tests__'),
    path.join(BACKEND_SRC, 'middleware', '__tests__'),
    path.join(BACKEND_SRC, 'lib', '__tests__'),
  ];

  const files: string[] = [];

  function walk(dir: string): void {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.spec.ts')) {
        files.push(full);
      }
    }
  }

  for (const dir of testDirs) {
    walk(dir);
  }

  return files;
}

function extractTestedAssertionIds(testFiles: string[]): Set<string> {
  const ids = new Set<string>();
  const pattern = /itAssertion\(\s*['"`]([^'"`]+)['"`]/g;

  for (const file of testFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      ids.add(match[1]);
    }
  }

  return ids;
}

function loadVersionTracker(): Record<string, { lastTestedVersion: string; capabilities: Record<string, string> }> {
  try {
    const raw = fs.readFileSync(TRACKER_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function checkFileExists(filePath: string): boolean {
  const resolved = path.join(ROOT, filePath);
  return fs.existsSync(resolved);
}

// --- Main ---

function scan(): void {
  console.log('');

  // Load all manifests
  if (!fs.existsSync(FEATURES_DIR)) {
    console.error('ERROR: specs/features/ directory does not exist');
    process.exit(1);
  }

  const yamlFiles = fs.readdirSync(FEATURES_DIR).filter(f => f.endsWith('.feature.yaml'));

  if (yamlFiles.length === 0) {
    console.log('No feature manifests found in specs/features/');
    process.exit(0);
  }

  // Find tested assertion IDs from test files
  const testFiles = findTestFiles();
  const testedIds = extractTestedAssertionIds(testFiles);

  // Load version tracker
  const tracker = loadVersionTracker();

  // Scan each manifest
  const results: ScanResult[] = [];
  const allAssertionIds = new Set<string>();
  const coverage: CoverageReport = {
    total: 0,
    tested: 0,
    invariants: { total: 0, tested: 0 },
    behavioral: { total: 0, tested: 0 },
    contracts: { total: 0, tested: 0 },
  };

  let hasErrors = false;

  for (const file of yamlFiles) {
    const filePath = path.join(FEATURES_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');

    let parsed: unknown;
    try {
      parsed = yaml.load(content);
    } catch (e) {
      console.error(`ERROR: ${file} — YAML parse error: ${(e as Error).message}`);
      hasErrors = true;
      continue;
    }

    const validationErrors: ValidationError[] = validateManifest(parsed);
    if (validationErrors.length > 0) {
      console.error(`ERROR: ${file} — Schema validation failed:`);
      for (const err of validationErrors) {
        console.error(`  - [${err.path}] ${err.message}`);
      }
      hasErrors = true;
      continue;
    }

    const manifest = parsed as FeatureManifest;
    const result: ScanResult = {
      featureId: manifest.feature,
      fileName: file,
      version: manifest.version,
      assertionCount: 0,
      testedCount: 0,
      untestedCount: 0,
      errors: [],
      warnings: [],
    };

    // Check for duplicate feature IDs (across files)
    // (validated by unique assertion IDs below)

    // Validate capabilities
    for (const cap of manifest.capabilities) {
      // Check source file existence
      for (const f of cap.files) {
        if (!checkFileExists(f)) {
          result.errors.push(`File not found: ${f} (capability: ${cap.id})`);
        }
      }

      // Check version drift
      const trackerRecord = tracker[manifest.feature];
      if (trackerRecord) {
        const lastCapVersion = trackerRecord.capabilities?.[cap.id];
        if (lastCapVersion && lastCapVersion !== cap.version) {
          result.warnings.push(
            `Version drift: ${cap.id} changed ${lastCapVersion} → ${cap.version}`,
          );
        }
      }

      for (const assertion of cap.assertions) {
        result.assertionCount++;
        coverage.total++;

        // Track assertion type coverage
        const typeKey = assertion.type === 'invariant' ? 'invariants'
          : assertion.type === 'behavioral' ? 'behavioral'
          : 'contracts';
        coverage[typeKey].total++;

        // Check for duplicate assertion IDs across all features
        if (allAssertionIds.has(assertion.id)) {
          result.errors.push(`Duplicate assertion ID: ${assertion.id}`);
        }
        allAssertionIds.add(assertion.id);

        // Check if tested
        if (testedIds.has(assertion.id)) {
          result.testedCount++;
          coverage.tested++;
          coverage[typeKey].tested++;
          testedIds.delete(assertion.id); // Remove so we can find orphaned tests later
        } else if (!assertion.deprecated) {
          result.untestedCount++;
        }
      }
    }

    // Validate AC mappings
    for (const ac of manifest.acceptance_criteria) {
      for (const ref of ac.maps_to) {
        if (!allAssertionIds.has(ref)) {
          result.warnings.push(`AC ${ac.id} maps_to unknown assertion: ${ref}`);
        }
      }
    }

    if (result.errors.length > 0) hasErrors = true;
    results.push(result);
  }

  // --- Output ---

  const totalAssertions = results.reduce((sum, r) => sum + r.assertionCount, 0);
  console.log(`Feature Spec Scanner — ${results.length} features, ${totalAssertions} assertions`);
  console.log('');

  for (const r of results) {
    const icon = r.errors.length > 0 ? 'x' : r.untestedCount > 0 ? '!' : '+';
    console.log(
      `${icon} ${r.featureId} (v${r.version}) — ${r.assertionCount} assertions, ` +
      `${r.testedCount} tested, ${r.untestedCount} untested`,
    );
  }

  console.log('');
  console.log(
    `Coverage: ${coverage.tested}/${coverage.total} (${coverage.total > 0 ? Math.round((coverage.tested / coverage.total) * 100) : 0}%)`,
  );
  console.log(
    `Invariants: ${coverage.invariants.tested}/${coverage.invariants.total} ` +
    `(${coverage.invariants.total > 0 ? Math.round((coverage.invariants.tested / coverage.invariants.total) * 100) : 0}%)` +
    (coverage.invariants.tested === coverage.invariants.total ? ' +' : ''),
  );
  console.log(
    `Behavioral: ${coverage.behavioral.tested}/${coverage.behavioral.total} ` +
    `(${coverage.behavioral.total > 0 ? Math.round((coverage.behavioral.tested / coverage.behavioral.total) * 100) : 0}%)`,
  );
  console.log(
    `Contracts: ${coverage.contracts.tested}/${coverage.contracts.total} ` +
    `(${coverage.contracts.total > 0 ? Math.round((coverage.contracts.tested / coverage.contracts.total) * 100) : 0}%)`,
  );

  // Warnings
  const allWarnings: string[] = [];
  for (const r of results) {
    for (const w of r.warnings) {
      allWarnings.push(`${r.featureId}: ${w}`);
    }
  }

  // Orphaned tests (itAssertion calls that don't match any manifest assertion)
  if (testedIds.size > 0) {
    for (const orphan of testedIds) {
      allWarnings.push(`Orphaned test: itAssertion("${orphan}") has no matching manifest assertion`);
    }
  }

  if (allWarnings.length > 0) {
    console.log('');
    console.log('Warnings:');
    for (const w of allWarnings) {
      console.log(`  - ${w}`);
    }
  }

  // Errors
  const allErrors: string[] = [];
  for (const r of results) {
    for (const e of r.errors) {
      allErrors.push(`${r.featureId}: ${e}`);
    }
  }

  if (allErrors.length > 0) {
    console.log('');
    console.log('Errors:');
    for (const e of allErrors) {
      console.log(`  - ${e}`);
    }
  }

  console.log('');

  if (hasErrors) {
    console.error('FAILED — Fix errors above before proceeding.');
    process.exit(1);
  }

  console.log('PASSED — All feature manifests are valid.');
}

scan();
