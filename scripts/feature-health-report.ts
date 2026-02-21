#!/usr/bin/env tsx
/**
 * Feature Health Report Generator — Phase 3 Maturity
 *
 * Generates markdown reports from the feature spec scanner's structured data.
 * Two output modes:
 *   --pr       GitHub PR comment (concise, table-based)
 *   --dashboard  Full health dashboard (detailed, per-capability breakdown)
 *
 * Usage:
 *   npx tsx scripts/feature-health-report.ts --pr         # PR comment markdown
 *   npx tsx scripts/feature-health-report.ts --dashboard  # Full health dashboard
 *   npm run report:specs                                   # Default: PR comment
 *   npm run report:specs:dashboard                         # Health dashboard
 *
 * Input: Runs the scanner internally (no piping needed).
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import {
  type FeatureManifest,
  type ValidationError,
  validateManifest,
} from '../specs/features/_schema';

// --- Re-use scanner types and logic ---

const ROOT = path.resolve(__dirname, '..');
const FEATURES_DIR = path.join(ROOT, 'specs', 'features');
const BACKEND_SRC = path.join(ROOT, 'backend', 'src');
const FRONTEND_SRC = path.join(ROOT, 'frontend', 'src');
const TRACKER_PATH = path.join(ROOT, 'backend', 'src', '__tests__', 'helpers', 'spec-version-tracker.json');

const args = process.argv.slice(2);
const MODE = args.includes('--dashboard') ? 'dashboard' : 'pr';

// --- Types ---

interface FeatureHealth {
  featureId: string;
  name: string;
  version: string;
  status: string;
  owner: string;
  total: number;
  tested: number;
  coverage: number;
  invariantTotal: number;
  invariantTested: number;
  behavioralTotal: number;
  behavioralTested: number;
  contractTotal: number;
  contractTested: number;
  driftCount: number;
  untestedIds: string[];
  lastTested: string | null;
  capabilities: CapHealth[];
}

interface CapHealth {
  id: string;
  version: string;
  total: number;
  tested: number;
  hasDrift: boolean;
}

interface HealthSummary {
  timestamp: string;
  featureCount: number;
  totalAssertions: number;
  totalTested: number;
  overallCoverage: number;
  invariantCoverage: number;
  behavioralCoverage: number;
  contractCoverage: number;
  featuresWithDrift: number;
  featuresAt100: number;
  features: FeatureHealth[];
}

// --- Helpers (copied from scanner to avoid import issues) ---

function findTestFiles(): string[] {
  const testDirs = [
    path.join(BACKEND_SRC, '__tests__'),
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

function loadVersionTracker(): Record<string, { lastTestedVersion: string; capabilities: Record<string, string>; lastRun: string }> {
  try {
    const raw = fs.readFileSync(TRACKER_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function pct(tested: number, total: number): number {
  return total > 0 ? Math.round((tested / total) * 100) : 100;
}

// --- Data collection ---

function collectHealthData(): HealthSummary {
  const yamlFiles = fs.readdirSync(FEATURES_DIR).filter(f => f.endsWith('.feature.yaml'));
  const testFiles = findTestFiles();
  const testedIds = extractTestedAssertionIds(testFiles);
  const tracker = loadVersionTracker();

  let totalAssertions = 0;
  let totalTested = 0;
  let invariantTotal = 0;
  let invariantTested = 0;
  let behavioralTotal = 0;
  let behavioralTested = 0;
  let contractTotal = 0;
  let contractTested = 0;
  let featuresWithDrift = 0;
  let featuresAt100 = 0;

  const features: FeatureHealth[] = [];

  for (const file of yamlFiles) {
    const filePath = path.join(FEATURES_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = yaml.load(content);
    const errors = validateManifest(parsed);
    if (errors.length > 0) continue;

    const manifest = parsed as FeatureManifest;
    const trackerRecord = tracker[manifest.feature];

    const fh: FeatureHealth = {
      featureId: manifest.feature,
      name: manifest.name,
      version: manifest.version,
      status: manifest.status,
      owner: manifest.owner,
      total: 0,
      tested: 0,
      coverage: 0,
      invariantTotal: 0,
      invariantTested: 0,
      behavioralTotal: 0,
      behavioralTested: 0,
      contractTotal: 0,
      contractTested: 0,
      driftCount: 0,
      untestedIds: [],
      lastTested: trackerRecord?.lastRun ?? null,
      capabilities: [],
    };

    for (const cap of manifest.capabilities) {
      const ch: CapHealth = {
        id: cap.id,
        version: cap.version,
        total: cap.assertions.length,
        tested: 0,
        hasDrift: false,
      };

      // Check drift
      if (trackerRecord) {
        const lastVer = trackerRecord.capabilities?.[cap.id];
        if (lastVer && lastVer !== cap.version) {
          ch.hasDrift = true;
          fh.driftCount++;
        }
      }

      for (const assertion of cap.assertions) {
        fh.total++;
        totalAssertions++;

        if (assertion.type === 'invariant') { fh.invariantTotal++; invariantTotal++; }
        else if (assertion.type === 'behavioral') { fh.behavioralTotal++; behavioralTotal++; }
        else { fh.contractTotal++; contractTotal++; }

        if (testedIds.has(assertion.id)) {
          fh.tested++;
          ch.tested++;
          totalTested++;
          if (assertion.type === 'invariant') { fh.invariantTested++; invariantTested++; }
          else if (assertion.type === 'behavioral') { fh.behavioralTested++; behavioralTested++; }
          else { fh.contractTested++; contractTested++; }
        } else if (!assertion.deprecated) {
          fh.untestedIds.push(assertion.id);
        }
      }

      fh.capabilities.push(ch);
    }

    fh.coverage = pct(fh.tested, fh.total);
    if (fh.driftCount > 0) featuresWithDrift++;
    if (fh.coverage === 100) featuresAt100++;
    features.push(fh);
  }

  return {
    timestamp: new Date().toISOString(),
    featureCount: features.length,
    totalAssertions,
    totalTested,
    overallCoverage: pct(totalTested, totalAssertions),
    invariantCoverage: pct(invariantTested, invariantTotal),
    behavioralCoverage: pct(behavioralTested, behavioralTotal),
    contractCoverage: pct(contractTested, contractTotal),
    featuresWithDrift,
    featuresAt100,
    features,
  };
}

// --- Markdown generators ---

function healthIcon(coverage: number): string {
  if (coverage === 100) return '🟢';
  if (coverage >= 80) return '🟡';
  return '🔴';
}

function generatePRComment(data: HealthSummary): string {
  const lines: string[] = [];

  lines.push('## Feature Spec Coverage Report');
  lines.push('');
  lines.push(`> ${data.featureCount} features · ${data.totalAssertions} assertions · ${data.timestamp.split('T')[0]}`);
  lines.push('');

  // Overall coverage bar
  lines.push(`**Overall: ${data.overallCoverage}%** (${data.totalTested}/${data.totalAssertions})`);
  lines.push('');

  // Type breakdown
  lines.push('| Type | Tested | Total | Coverage |');
  lines.push('|------|--------|-------|----------|');
  lines.push(`| Invariant | ${data.features.reduce((s, f) => s + f.invariantTested, 0)} | ${data.features.reduce((s, f) => s + f.invariantTotal, 0)} | ${data.invariantCoverage}% |`);
  lines.push(`| Behavioral | ${data.features.reduce((s, f) => s + f.behavioralTested, 0)} | ${data.features.reduce((s, f) => s + f.behavioralTotal, 0)} | ${data.behavioralCoverage}% |`);
  lines.push(`| Contract | ${data.features.reduce((s, f) => s + f.contractTested, 0)} | ${data.features.reduce((s, f) => s + f.contractTotal, 0)} | ${data.contractCoverage}% |`);
  lines.push('');

  // Per-feature table
  lines.push('### Per-Feature Breakdown');
  lines.push('');
  lines.push('| Feature | Version | Assertions | Tested | Coverage | Drift |');
  lines.push('|---------|---------|------------|--------|----------|-------|');

  for (const f of data.features) {
    const drift = f.driftCount > 0 ? `${f.driftCount} cap(s)` : '-';
    lines.push(
      `| ${healthIcon(f.coverage)} ${f.name} | v${f.version} | ${f.total} | ${f.tested} | ${f.coverage}% | ${drift} |`,
    );
  }

  lines.push('');

  // Untested assertions (if any)
  const allUntested = data.features.flatMap(f => f.untestedIds.map(id => `\`${id}\``));
  if (allUntested.length > 0) {
    lines.push('<details>');
    lines.push(`<summary>Untested assertions (${allUntested.length})</summary>`);
    lines.push('');
    for (const id of allUntested) {
      lines.push(`- ${id}`);
    }
    lines.push('');
    lines.push('</details>');
    lines.push('');
  }

  // Drift summary
  if (data.featuresWithDrift > 0) {
    lines.push(`> **Version drift detected** in ${data.featuresWithDrift} feature(s). Run tests to update tracker.`);
    lines.push('');
  }

  // Footer
  lines.push('---');
  lines.push('*Generated by `npm run report:specs` · [Feature Spec System](plans/2026-02-21-living-feature-specs.md)*');

  return lines.join('\n');
}

function generateDashboard(data: HealthSummary): string {
  const lines: string[] = [];

  lines.push('# Feature Health Dashboard');
  lines.push('');
  lines.push(`> **Generated**: ${data.timestamp}`);
  lines.push(`> **Features**: ${data.featureCount} · **Assertions**: ${data.totalAssertions} · **Tested**: ${data.totalTested}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Overall health score
  const score = data.overallCoverage;
  const grade = score === 100 ? 'A+' : score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : 'D';
  lines.push(`## Health Score: ${grade} (${score}%)`);
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Overall coverage | ${score}% (${data.totalTested}/${data.totalAssertions}) |`);
  lines.push(`| Invariant coverage | ${data.invariantCoverage}% |`);
  lines.push(`| Behavioral coverage | ${data.behavioralCoverage}% |`);
  lines.push(`| Contract coverage | ${data.contractCoverage}% |`);
  lines.push(`| Features at 100% | ${data.featuresAt100}/${data.featureCount} |`);
  lines.push(`| Features with drift | ${data.featuresWithDrift} |`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Per-feature detail
  lines.push('## Feature Details');
  lines.push('');

  for (const f of data.features) {
    lines.push(`### ${healthIcon(f.coverage)} ${f.name} (v${f.version})`);
    lines.push('');
    lines.push(`| Property | Value |`);
    lines.push(`|----------|-------|`);
    lines.push(`| Status | ${f.status} |`);
    lines.push(`| Owner | ${f.owner} |`);
    lines.push(`| Coverage | ${f.coverage}% (${f.tested}/${f.total}) |`);
    lines.push(`| Invariants | ${f.invariantTested}/${f.invariantTotal} |`);
    lines.push(`| Behavioral | ${f.behavioralTested}/${f.behavioralTotal} |`);
    lines.push(`| Contracts | ${f.contractTested}/${f.contractTotal} |`);
    lines.push(`| Last tested | ${f.lastTested ? f.lastTested.split('T')[0] : 'Never'} |`);
    lines.push(`| Version drift | ${f.driftCount > 0 ? `${f.driftCount} capability(ies)` : 'None'} |`);
    lines.push('');

    // Capability breakdown
    lines.push('**Capabilities:**');
    lines.push('');
    lines.push('| Capability | Version | Tested | Total | Drift |');
    lines.push('|------------|---------|--------|-------|-------|');
    for (const c of f.capabilities) {
      const driftMark = c.hasDrift ? 'YES' : '-';
      lines.push(`| ${c.id} | v${c.version} | ${c.tested} | ${c.total} | ${driftMark} |`);
    }
    lines.push('');

    if (f.untestedIds.length > 0) {
      lines.push('**Untested assertions:**');
      for (const id of f.untestedIds) {
        lines.push(`- \`${id}\``);
      }
      lines.push('');
    }
  }

  lines.push('---');
  lines.push('');

  // Actionable items
  const allUntested = data.features.flatMap(f => f.untestedIds);
  const driftFeatures = data.features.filter(f => f.driftCount > 0);

  if (allUntested.length > 0 || driftFeatures.length > 0) {
    lines.push('## Action Items');
    lines.push('');

    if (allUntested.length > 0) {
      lines.push(`### Untested Assertions (${allUntested.length})`);
      lines.push('');
      for (const f of data.features) {
        if (f.untestedIds.length > 0) {
          lines.push(`**${f.name}:**`);
          for (const id of f.untestedIds) {
            lines.push(`- [ ] \`${id}\``);
          }
          lines.push('');
        }
      }
    }

    if (driftFeatures.length > 0) {
      lines.push('### Version Drift');
      lines.push('');
      for (const f of driftFeatures) {
        const driftCaps = f.capabilities.filter(c => c.hasDrift);
        lines.push(`**${f.name}:** ${driftCaps.map(c => c.id).join(', ')}`);
      }
      lines.push('');
    }
  } else {
    lines.push('## Action Items');
    lines.push('');
    lines.push('None — all assertions tested, no drift detected.');
    lines.push('');
  }

  lines.push('---');
  lines.push('*Generated by `npm run report:specs:dashboard` · Phase 3: Feature Spec Maturity*');

  return lines.join('\n');
}

// --- Main ---

function main(): void {
  if (!fs.existsSync(FEATURES_DIR)) {
    console.error('ERROR: specs/features/ directory does not exist');
    process.exit(1);
  }

  const data = collectHealthData();

  if (MODE === 'dashboard') {
    console.log(generateDashboard(data));
  } else {
    console.log(generatePRComment(data));
  }
}

main();
