#!/usr/bin/env tsx
/**
 * Feature Spec Scanner — Validates manifests, detects orphans, reports coverage.
 *
 * Usage:
 *   npx tsx scripts/scan-feature-specs.ts          # Human-readable output
 *   npx tsx scripts/scan-feature-specs.ts --json    # JSON output for tooling
 *   npm run validate:specs                          # Advisory mode (thresholds enforced)
 *
 * Checks:
 *   - Schema validation (ERROR)
 *   - Unique assertion IDs (ERROR)
 *   - File existence for capability source files (ERROR)
 *   - AC mapping completeness (WARNING)
 *   - Orphaned assertions — in manifest but no test (WARNING)
 *   - Orphaned tests — itAssertion() calls referencing unknown IDs (WARNING)
 *   - Version drift (WARNING)
 *
 * Phase 3 additions:
 *   - Behavioral coverage threshold enforcement (SPEC_BEHAVIORAL_THRESHOLD, default 80%)
 *   - Contract coverage threshold enforcement (SPEC_CONTRACT_THRESHOLD, default 80%)
 *   - --json flag for structured output (consumed by health report generator)
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

// --- CLI flags ---

const args = process.argv.slice(2);
const JSON_OUTPUT = args.includes('--json');

// --- Coverage thresholds (env-configurable) ---

const INVARIANT_THRESHOLD = 100; // Always 100% — non-negotiable
const BEHAVIORAL_THRESHOLD = parseInt(process.env.SPEC_BEHAVIORAL_THRESHOLD || '80', 10);
const CONTRACT_THRESHOLD = parseInt(process.env.SPEC_CONTRACT_THRESHOLD || '80', 10);

// --- Types ---

interface ScanResult {
  featureId: string;
  fileName: string;
  version: string;
  status: string;
  owner: string;
  category: string;
  assertionCount: number;
  testedCount: number;
  untestedCount: number;
  untestedIds: string[];
  driftWarnings: string[];
  errors: string[];
  warnings: string[];
  lastTested: string | null;
  capabilities: CapabilitySummary[];
}

interface CapabilitySummary {
  id: string;
  version: string;
  assertionCount: number;
  testedCount: number;
  hasDrift: boolean;
}

interface CoverageReport {
  total: number;
  tested: number;
  invariants: { total: number; tested: number };
  behavioral: { total: number; tested: number };
  contracts: { total: number; tested: number };
}

interface ThresholdResult {
  type: string;
  threshold: number;
  actual: number;
  passed: boolean;
  untested: string[];
}

/** Full structured output for --json mode and health report consumption */
export interface ScanReport {
  timestamp: string;
  features: ScanResult[];
  coverage: CoverageReport;
  thresholds: ThresholdResult[];
  orphanedTests: string[];
  warnings: string[];
  errors: string[];
  passed: boolean;
}

// --- Helpers ---

function findTestFiles(): string[] {
  const testDirs = [
    path.join(BACKEND_SRC, '__tests__'),
    path.join(BACKEND_SRC, 'services', '__tests__'),
    path.join(BACKEND_SRC, 'services', 'ai', '__tests__'),
    path.join(BACKEND_SRC, 'middleware', '__tests__'),
    path.join(BACKEND_SRC, 'lib', '__tests__'),
    path.join(FRONTEND_SRC, 'components'),
    path.join(FRONTEND_SRC, 'contexts'),
    path.join(FRONTEND_SRC, 'hooks'),
  ];

  const files: string[] = [];

  function walk(dir: string): void {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.spec.ts') || entry.name.endsWith('.test.tsx') || entry.name.endsWith('.spec.tsx')) {
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

function loadVersionTracker(): Record<string, { lastTestedVersion: string; lastRun?: string; capabilities: Record<string, string> }> {
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

function collectUntestedByType(
  results: ScanResult[],
  type: string,
): string[] {
  const freshTestedIds = extractTestedAssertionIds(findTestFiles());
  const untested: string[] = [];
  for (const r of results) {
    const filePath = path.join(FEATURES_DIR, r.fileName);
    const content = fs.readFileSync(filePath, 'utf-8');
    const manifest = yaml.load(content) as FeatureManifest;
    // Skip draft features — they don't count toward thresholds
    if (manifest.status === 'draft') continue;
    for (const cap of manifest.capabilities) {
      for (const assertion of cap.assertions) {
        if (assertion.type === type && !assertion.deprecated && !freshTestedIds.has(assertion.id)) {
          untested.push(`${r.featureId}: ${assertion.id}`);
        }
      }
    }
  }
  return untested;
}

function pct(tested: number, total: number): number {
  return total > 0 ? Math.round((tested / total) * 100) : 100;
}

function scan(): ScanReport {
  // Load all manifests
  if (!fs.existsSync(FEATURES_DIR)) {
    if (!JSON_OUTPUT) console.error('ERROR: specs/features/ directory does not exist');
    process.exit(1);
  }

  const yamlFiles = fs.readdirSync(FEATURES_DIR).filter(f => f.endsWith('.feature.yaml'));

  if (yamlFiles.length === 0) {
    if (!JSON_OUTPUT) console.log('No feature manifests found in specs/features/');
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
      if (!JSON_OUTPUT) console.error(`ERROR: ${file} — YAML parse error: ${(e as Error).message}`);
      hasErrors = true;
      continue;
    }

    const validationErrors: ValidationError[] = validateManifest(parsed);
    if (validationErrors.length > 0) {
      if (!JSON_OUTPUT) {
        console.error(`ERROR: ${file} — Schema validation failed:`);
        for (const err of validationErrors) {
          console.error(`  - [${err.path}] ${err.message}`);
        }
      }
      hasErrors = true;
      continue;
    }

    const manifest = parsed as FeatureManifest;
    const trackerRecord = tracker[manifest.feature];
    const result: ScanResult = {
      featureId: manifest.feature,
      fileName: file,
      version: manifest.version,
      status: manifest.status,
      owner: manifest.owner,
      category: manifest.category,
      assertionCount: 0,
      testedCount: 0,
      untestedCount: 0,
      untestedIds: [],
      driftWarnings: [],
      errors: [],
      warnings: [],
      lastTested: trackerRecord?.lastRun ?? null,
      capabilities: [],
    };

    const isDraft = manifest.status === 'draft';

    // Validate capabilities
    for (const cap of manifest.capabilities) {
      const capSummary: CapabilitySummary = {
        id: cap.id,
        version: cap.version,
        assertionCount: cap.assertions.length,
        testedCount: 0,
        hasDrift: false,
      };

      // Check source file existence (skip for draft features — files haven't been created yet)
      if (!isDraft) {
        for (const f of cap.files) {
          if (!checkFileExists(f)) {
            result.errors.push(`File not found: ${f} (capability: ${cap.id})`);
          }
        }
      }

      // Check version drift
      if (trackerRecord) {
        const lastCapVersion = trackerRecord.capabilities?.[cap.id];
        if (lastCapVersion && lastCapVersion !== cap.version) {
          capSummary.hasDrift = true;
          const msg = `Version drift: ${cap.id} changed ${lastCapVersion} → ${cap.version}`;
          result.warnings.push(msg);
          result.driftWarnings.push(msg);
        }
      }

      for (const assertion of cap.assertions) {
        result.assertionCount++;

        // Draft features are tracked but excluded from coverage thresholds
        if (!isDraft) {
          coverage.total++;
          const typeKey = assertion.type === 'invariant' ? 'invariants'
            : assertion.type === 'behavioral' ? 'behavioral'
            : 'contracts';
          coverage[typeKey].total++;
        }

        // Track assertion type coverage
        const typeKey = assertion.type === 'invariant' ? 'invariants'
          : assertion.type === 'behavioral' ? 'behavioral'
          : 'contracts';

        // Check for duplicate assertion IDs across all features
        if (allAssertionIds.has(assertion.id)) {
          result.errors.push(`Duplicate assertion ID: ${assertion.id}`);
        }
        allAssertionIds.add(assertion.id);

        // Check if tested
        if (testedIds.has(assertion.id)) {
          result.testedCount++;
          capSummary.testedCount++;
          if (!isDraft) {
            coverage.tested++;
            coverage[typeKey].tested++;
          }
          testedIds.delete(assertion.id); // Remove so we can find orphaned tests later
        } else if (!assertion.deprecated) {
          result.untestedCount++;
          result.untestedIds.push(assertion.id);
        }
      }

      result.capabilities.push(capSummary);
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

  // Collect orphaned tests
  const orphanedTests = [...testedIds];

  // Collect all warnings
  const allWarnings: string[] = [];
  for (const r of results) {
    for (const w of r.warnings) {
      allWarnings.push(`${r.featureId}: ${w}`);
    }
  }
  for (const orphan of orphanedTests) {
    allWarnings.push(`Orphaned test: itAssertion("${orphan}") has no matching manifest assertion`);
  }

  // Collect all errors
  const allErrors: string[] = [];
  for (const r of results) {
    for (const e of r.errors) {
      allErrors.push(`${r.featureId}: ${e}`);
    }
  }

  // --- Phase 3: Coverage threshold enforcement ---

  const thresholds: ThresholdResult[] = [];

  // Invariants — always 100%
  const untestedInvariants = coverage.invariants.tested < coverage.invariants.total
    ? collectUntestedByType(results, 'invariant')
    : [];
  thresholds.push({
    type: 'invariant',
    threshold: INVARIANT_THRESHOLD,
    actual: pct(coverage.invariants.tested, coverage.invariants.total),
    passed: coverage.invariants.tested === coverage.invariants.total,
    untested: untestedInvariants,
  });

  // Behavioral — configurable threshold (default 80%)
  const behavioralPct = pct(coverage.behavioral.tested, coverage.behavioral.total);
  const untestedBehavioral = behavioralPct < BEHAVIORAL_THRESHOLD
    ? collectUntestedByType(results, 'behavioral')
    : [];
  thresholds.push({
    type: 'behavioral',
    threshold: BEHAVIORAL_THRESHOLD,
    actual: behavioralPct,
    passed: behavioralPct >= BEHAVIORAL_THRESHOLD,
    untested: untestedBehavioral,
  });

  // Contracts — configurable threshold (default 80%)
  const contractPct = pct(coverage.contracts.tested, coverage.contracts.total);
  const untestedContracts = contractPct < CONTRACT_THRESHOLD
    ? collectUntestedByType(results, 'contract')
    : [];
  thresholds.push({
    type: 'contract',
    threshold: CONTRACT_THRESHOLD,
    actual: contractPct,
    passed: contractPct >= CONTRACT_THRESHOLD,
    untested: untestedContracts,
  });

  const allThresholdsPassed = thresholds.every(t => t.passed);
  const passed = !hasErrors && allThresholdsPassed;

  const report: ScanReport = {
    timestamp: new Date().toISOString(),
    features: results,
    coverage,
    thresholds,
    orphanedTests,
    warnings: allWarnings,
    errors: allErrors,
    passed,
  };

  // --- Output ---

  if (JSON_OUTPUT) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log('');
    const totalAssertions = results.reduce((sum, r) => sum + r.assertionCount, 0);
    console.log(`Feature Spec Scanner — ${results.length} features, ${totalAssertions} assertions`);
    console.log('');

    for (const r of results) {
      const icon = r.errors.length > 0 ? 'x' : r.untestedCount > 0 ? '!' : '+';
      const draftTag = r.status === 'draft' ? ' [DRAFT]' : '';
      console.log(
        `${icon} ${r.featureId} (v${r.version})${draftTag} — ${r.assertionCount} assertions, ` +
        `${r.testedCount} tested, ${r.untestedCount} untested`,
      );
    }

    console.log('');
    console.log(`Coverage: ${coverage.tested}/${coverage.total} (${pct(coverage.tested, coverage.total)}%)`);
    console.log(
      `Invariants: ${coverage.invariants.tested}/${coverage.invariants.total} ` +
      `(${pct(coverage.invariants.tested, coverage.invariants.total)}%)` +
      (coverage.invariants.tested === coverage.invariants.total ? ' +' : ''),
    );
    console.log(
      `Behavioral: ${coverage.behavioral.tested}/${coverage.behavioral.total} ` +
      `(${behavioralPct}%)` +
      (behavioralPct >= BEHAVIORAL_THRESHOLD ? ' +' : ` [threshold: ${BEHAVIORAL_THRESHOLD}%]`),
    );
    console.log(
      `Contracts: ${coverage.contracts.tested}/${coverage.contracts.total} ` +
      `(${contractPct}%)` +
      (contractPct >= CONTRACT_THRESHOLD ? ' +' : ` [threshold: ${CONTRACT_THRESHOLD}%]`),
    );

    // Thresholds summary
    console.log('');
    console.log('Thresholds:');
    for (const t of thresholds) {
      const icon = t.passed ? '+' : 'x';
      console.log(`  ${icon} ${t.type}: ${t.actual}% (min ${t.threshold}%)`);
    }

    if (allWarnings.length > 0) {
      console.log('');
      console.log('Warnings:');
      for (const w of allWarnings) {
        console.log(`  - ${w}`);
      }
    }

    if (allErrors.length > 0) {
      console.log('');
      console.log('Errors:');
      for (const e of allErrors) {
        console.log(`  - ${e}`);
      }
    }

    // Threshold failures
    for (const t of thresholds) {
      if (!t.passed && t.untested.length > 0) {
        console.log('');
        console.log(`Untested ${t.type}s (BLOCKING — threshold ${t.threshold}%, actual ${t.actual}%):`);
        for (const id of t.untested) {
          console.log(`  - ${id}`);
        }
      }
    }

    console.log('');
  }

  if (hasErrors) {
    if (!JSON_OUTPUT) console.error('FAILED — Fix errors above before proceeding.');
    process.exit(1);
  }

  if (!allThresholdsPassed) {
    const failedTypes = thresholds.filter(t => !t.passed).map(t => `${t.type} (${t.actual}% < ${t.threshold}%)`);
    if (!JSON_OUTPUT) {
      console.error(`FAILED — Coverage thresholds not met: ${failedTypes.join(', ')}`);
    }
    process.exit(1);
  }

  if (!JSON_OUTPUT) {
    console.log('PASSED — All feature manifests valid. All coverage thresholds met.');
  }

  return report;
}

scan();
