#!/usr/bin/env node

/**
 * Safe Update — dependency update with blast radius analysis and auto-recovery.
 *
 * Phases:
 *   1. Snapshot  — record current state (git SHA, lockfile checksums, installed versions)
 *   2. Update    — install dependencies across all workspaces
 *   3. Verify    — run the full verification loop (build, test, typecheck, lint, architecture, health, audit)
 *   4. Report    — blast radius analysis (what changed, what's affected)
 *   5. Recovery  — if verification fails: auto-fix → suggest → rollback
 *
 * Usage:
 *   node scripts/safe-update.js                     # Full update + verify cycle
 *   node scripts/safe-update.js --skip-update       # Verify only (no npm install)
 *   node scripts/safe-update.js --report-only       # Generate blast radius report from lockfile diff vs git HEAD
 *   node scripts/safe-update.js --json              # Output report as JSON to stdout
 *
 * Exit codes:
 *   0 — Update successful, all checks pass
 *   1 — Update failed, auto-fixed, re-verification passed
 *   2 — Update failed, manual fix suggested (with instructions)
 *   3 — Update failed, rolled back to previous state
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

// ── Constants ────────────────────────────────────────────────────────────────

const ROOT_DIR = path.resolve(__dirname, '..');
const REPORT_FILE = path.join(ROOT_DIR, '.safe-update-report.json');

const WORKSPACES = [
  { name: 'root', dir: ROOT_DIR, lockfile: 'package-lock.json' },
  { name: 'backend', dir: path.join(ROOT_DIR, 'backend'), lockfile: 'package-lock.json' },
  { name: 'frontend', dir: path.join(ROOT_DIR, 'frontend'), lockfile: 'package-lock.json' },
  { name: 'mcp-server', dir: path.join(ROOT_DIR, 'mcp-server'), lockfile: 'package-lock.json' },
];

const VERIFICATION_STEPS = [
  { name: 'build', command: 'npm run build', timeout: 300_000 },
  { name: 'test', command: 'npm run test', timeout: 300_000 },
  { name: 'typecheck', command: 'npm run typecheck', timeout: 180_000 },
  { name: 'lint', command: 'npm run lint', timeout: 180_000 },
  { name: 'architecture', command: 'npm run check:architecture', timeout: 60_000 },
  { name: 'health', command: 'npm run check:health', timeout: 60_000 },
  { name: 'audit-backend', command: 'cd backend && npm audit --audit-level=high', timeout: 60_000 },
  { name: 'audit-frontend', command: 'cd frontend && npm audit --audit-level=high', timeout: 60_000 },
];

const MAX_AUTO_FIX_ATTEMPTS = 2;

// ── CLI flags ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const skipUpdate = args.includes('--skip-update');
const reportOnly = args.includes('--report-only');
const jsonOutput = args.includes('--json');

// ── Colors (matching check-health.js) ────────────────────────────────────────

const C = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
};

function log(msg) {
  if (!jsonOutput) process.stdout.write(`${msg}\n`);
}

function logHeader(msg) {
  log('');
  log(`${C.bold}${'═'.repeat(60)}${C.reset}`);
  log(`${C.bold} ${msg}${C.reset}`);
  log(`${C.bold}${'═'.repeat(60)}${C.reset}`);
  log('');
}

function logStep(icon, msg) {
  log(`  ${icon} ${msg}`);
}

// ── Utility Functions ────────────────────────────────────────────────────────

function computeFileChecksum(filePath) {
  try {
    const content = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
  } catch {
    return null;
  }
}

function execSafe(command, options = {}) {
  const opts = {
    cwd: ROOT_DIR,
    encoding: 'utf8',
    stdio: 'pipe',
    timeout: 120_000,
    ...options,
  };
  try {
    const stdout = execSync(command, opts);
    return { success: true, stdout: stdout || '', stderr: '', exitCode: 0 };
  } catch (err) {
    return {
      success: false,
      stdout: err.stdout || '',
      stderr: err.stderr || err.message || '',
      exitCode: err.status || 1,
    };
  }
}

function getGitSha() {
  const result = execSafe('git rev-parse HEAD');
  return result.success ? result.stdout.trim() : 'unknown';
}

function parseSemverMajor(version) {
  if (!version) return 0;
  const match = version.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

// ── Lockfile Parsing (lockfileVersion 3) ─────────────────────────────────────

function parseLockfilePackages(lockfilePath) {
  const packages = new Map();
  try {
    const lockfile = JSON.parse(fs.readFileSync(lockfilePath, 'utf8'));
    const pkgs = lockfile.packages || {};
    for (const [key, value] of Object.entries(pkgs)) {
      if (key === '') continue; // skip root entry
      // Only top-level (no nested node_modules)
      const name = key.replace(/^node_modules\//, '');
      if (!name.includes('node_modules/')) {
        packages.set(name, value.version || 'unknown');
      }
    }
  } catch {
    // Lockfile missing or unparseable
  }
  return packages;
}

function diffPackages(beforeMap, afterMap) {
  const added = [];
  const removed = [];
  const updated = [];

  for (const [name, version] of afterMap) {
    if (!beforeMap.has(name)) {
      added.push({ name, version });
    } else if (beforeMap.get(name) !== version) {
      updated.push({ name, from: beforeMap.get(name), to: version });
    }
  }

  for (const [name, version] of beforeMap) {
    if (!afterMap.has(name)) {
      removed.push({ name, version });
    }
  }

  return { added, removed, updated };
}

// ── Phase 1: Snapshot ────────────────────────────────────────────────────────

function captureSnapshot() {
  logStep(`${C.blue}i${C.reset}`, 'Capturing snapshot...');
  const snapshot = {
    gitSha: getGitSha(),
    timestamp: new Date().toISOString(),
    lockfiles: {},
    packages: {},
  };

  for (const ws of WORKSPACES) {
    const lockPath = path.join(ws.dir, ws.lockfile);
    snapshot.lockfiles[ws.name] = computeFileChecksum(lockPath);
    snapshot.packages[ws.name] = parseLockfilePackages(lockPath);
  }

  return snapshot;
}

/**
 * For --report-only or --skip-update, reconstruct the "before" state
 * by reading lockfiles from git HEAD (what was committed).
 */
function captureGitSnapshot() {
  logStep(`${C.blue}i${C.reset}`, 'Capturing git baseline (HEAD)...');
  const snapshot = {
    gitSha: getGitSha(),
    timestamp: new Date().toISOString(),
    lockfiles: {},
    packages: {},
  };

  for (const ws of WORKSPACES) {
    const relativeLockPath = path.relative(ROOT_DIR, path.join(ws.dir, ws.lockfile));
    const result = execSafe(`git show HEAD:${relativeLockPath}`);
    if (result.success) {
      const checksum = crypto.createHash('sha256').update(result.stdout).digest('hex');
      snapshot.lockfiles[ws.name] = checksum;
      // Parse packages from git content
      try {
        const lockfile = JSON.parse(result.stdout);
        const packages = new Map();
        for (const [key, value] of Object.entries(lockfile.packages || {})) {
          if (key === '') continue;
          const name = key.replace(/^node_modules\//, '');
          if (!name.includes('node_modules/')) {
            packages.set(name, value.version || 'unknown');
          }
        }
        snapshot.packages[ws.name] = packages;
      } catch {
        snapshot.packages[ws.name] = new Map();
      }
    } else {
      snapshot.lockfiles[ws.name] = null;
      snapshot.packages[ws.name] = new Map();
    }
  }

  return snapshot;
}

// ── Phase 2: Update ──────────────────────────────────────────────────────────

function runUpdate() {
  logHeader('Phase 2: Update');
  const results = [];

  for (const ws of WORKSPACES) {
    logStep(`${C.cyan}→${C.reset}`, `Installing deps in ${C.bold}${ws.name}${C.reset}...`);
    const result = execSafe('npm install', { cwd: ws.dir, timeout: 120_000 });
    results.push({
      workspace: ws.name,
      success: result.success,
      stdout: result.stdout,
      stderr: result.stderr,
    });

    if (result.success) {
      logStep(`${C.green}✓${C.reset}`, `${ws.name}: install succeeded`);
    } else {
      logStep(`${C.red}✗${C.reset}`, `${ws.name}: install failed`);
    }
  }

  return results;
}

// ── Phase 3: Verify ──────────────────────────────────────────────────────────

function runVerificationLoop() {
  logHeader('Phase 3: Verify');
  const results = [];

  for (const step of VERIFICATION_STEPS) {
    const start = Date.now();
    logStep(`${C.cyan}→${C.reset}`, `Running ${C.bold}${step.name}${C.reset}...`);

    const result = execSafe(step.command, { timeout: step.timeout });
    const duration = ((Date.now() - start) / 1000).toFixed(1);

    const entry = {
      step: step.name,
      passed: result.success,
      duration: `${duration}s`,
      durationMs: Date.now() - start,
      stdout: result.stdout.slice(-2000), // Keep last 2KB for analysis
      stderr: result.stderr.slice(-2000),
      exitCode: result.exitCode,
    };
    results.push(entry);

    if (result.success) {
      logStep(`${C.green}✓${C.reset}`, `${step.name} ${C.dim}(${duration}s)${C.reset}`);
    } else {
      logStep(`${C.red}✗${C.reset}`, `${step.name} ${C.red}FAILED${C.reset} ${C.dim}(${duration}s)${C.reset}`);
    }
  }

  return results;
}

// ── Phase 4: Blast Radius Report ─────────────────────────────────────────────

function diffLockfiles(beforeSnapshot, afterSnapshot) {
  const diffs = [];

  for (const ws of WORKSPACES) {
    const beforePkgs = beforeSnapshot.packages[ws.name] || new Map();
    const afterPkgs = afterSnapshot.packages[ws.name] || new Map();
    const diff = diffPackages(beforePkgs, afterPkgs);

    if (diff.added.length || diff.removed.length || diff.updated.length) {
      diffs.push({
        workspace: ws.name,
        lockfileChanged: beforeSnapshot.lockfiles[ws.name] !== afterSnapshot.lockfiles[ws.name],
        ...diff,
      });
    }
  }

  return diffs;
}

function computeBlastRadius(lockfileDiffs, verificationResults) {
  const totalAdded = lockfileDiffs.reduce((s, d) => s + d.added.length, 0);
  const totalRemoved = lockfileDiffs.reduce((s, d) => s + d.removed.length, 0);
  const totalUpdated = lockfileDiffs.reduce((s, d) => s + d.updated.length, 0);
  const affectedWorkspaces = lockfileDiffs.length;
  const failingSteps = verificationResults.filter((v) => !v.passed).length;

  // Count major version bumps
  const majorBumps = [];
  for (const diff of lockfileDiffs) {
    for (const pkg of diff.updated) {
      if (parseSemverMajor(pkg.from) !== parseSemverMajor(pkg.to)) {
        majorBumps.push({ ...pkg, workspace: diff.workspace });
      }
    }
  }

  let score = 0;
  score += totalAdded * 2;
  score += totalRemoved * 3;
  score += totalUpdated * 1;
  score += majorBumps.length * 15;
  score += affectedWorkspaces * 5;
  score += failingSteps * 20;
  score = Math.min(score, 100);

  const level = score <= 20 ? 'low' : score <= 50 ? 'medium' : 'high';

  // Correlate failures to package changes
  const correlations = [];
  const failedSteps = verificationResults.filter((v) => !v.passed);
  const allChangedPackageNames = new Set();
  for (const diff of lockfileDiffs) {
    for (const pkg of [...diff.added, ...diff.removed, ...diff.updated]) {
      allChangedPackageNames.add(pkg.name);
    }
  }

  for (const failed of failedSteps) {
    const output = `${failed.stdout} ${failed.stderr}`;
    const matchedPkgs = [];
    for (const pkgName of allChangedPackageNames) {
      // Check if the package name appears in the error output
      if (output.includes(pkgName)) {
        matchedPkgs.push(pkgName);
      }
    }
    correlations.push({
      failingStep: failed.step,
      likelyCauses: matchedPkgs.length > 0 ? matchedPkgs : ['unknown'],
      confidence: matchedPkgs.length > 0 ? 'high' : 'low',
    });
  }

  const totalChanges = totalAdded + totalRemoved + totalUpdated;
  const summary = `${totalChanges} package change(s) across ${affectedWorkspaces} workspace(s). ${failingSteps} verification failure(s).`;

  return {
    level,
    score,
    summary,
    packageChanges: lockfileDiffs,
    affectedAreas: lockfileDiffs.map((d) => d.workspace),
    majorVersionBumps: majorBumps,
    verificationResults: verificationResults.map((v) => ({
      step: v.step,
      passed: v.passed,
      duration: v.duration,
    })),
    verificationFailures: failedSteps.map((v) => ({
      step: v.step,
      stderr: v.stderr.slice(-500),
    })),
    correlations,
  };
}

// ── Phase 5: Recovery ────────────────────────────────────────────────────────

// Level 1: Auto-fix
const AUTO_FIX_PATTERNS = [
  {
    pattern: /Cannot find module '([^']+)'/,
    name: 'missing-module',
    fix(match, failedStep) {
      const moduleName = match[1];
      // Determine workspace from the step
      const ws = failedStep.step.includes('backend') ? 'backend' : guessWorkspace(failedStep);
      const dir = ws === 'root' ? ROOT_DIR : path.join(ROOT_DIR, ws);
      logStep(`${C.yellow}⚡${C.reset}`, `Auto-fix: installing missing module ${C.bold}${moduleName}${C.reset} in ${ws}`);
      return execSafe(`npm install`, { cwd: dir });
    },
  },
  {
    pattern: /TS2307: Cannot find module '([^']+)' or its corresponding type declarations/,
    name: 'missing-types',
    fix(match) {
      const moduleName = match[1];
      // Strip leading @scope/ for types package name
      const typesPackage = moduleName.startsWith('@')
        ? `@types/${moduleName.replace('@', '').replace('/', '__')}`
        : `@types/${moduleName}`;
      logStep(`${C.yellow}⚡${C.reset}`, `Auto-fix: installing ${C.bold}${typesPackage}${C.reset}`);
      return execSafe(`npm install --save-dev ${typesPackage}`, { cwd: path.join(ROOT_DIR, 'backend') });
    },
  },
  {
    pattern: /ERESOLVE/,
    name: 'peer-dep-conflict',
    fix(match, failedStep) {
      const ws = guessWorkspace(failedStep);
      const dir = ws === 'root' ? ROOT_DIR : path.join(ROOT_DIR, ws);
      logStep(`${C.yellow}⚡${C.reset}`, `Auto-fix: retrying install with --legacy-peer-deps in ${ws}`);
      return execSafe(`npm install --legacy-peer-deps`, { cwd: dir });
    },
  },
  {
    pattern: /The generated Prisma Client is not compatible|prisma generate/i,
    name: 'prisma-mismatch',
    fix() {
      logStep(`${C.yellow}⚡${C.reset}`, `Auto-fix: regenerating Prisma client`);
      return execSafe('npx prisma generate', { cwd: path.join(ROOT_DIR, 'backend') });
    },
  },
  {
    pattern: /npm ERR! Invalid: lock file/i,
    name: 'lockfile-integrity',
    fix(match, failedStep) {
      const ws = guessWorkspace(failedStep);
      const dir = ws === 'root' ? ROOT_DIR : path.join(ROOT_DIR, ws);
      logStep(`${C.yellow}⚡${C.reset}`, `Auto-fix: clean install in ${ws}`);
      return execSafe(`rm -rf node_modules && npm ci`, { cwd: dir });
    },
  },
];

function guessWorkspace(failedStep) {
  const output = `${failedStep.stdout} ${failedStep.stderr}`;
  if (output.includes('backend/') || output.includes('testops-copilot-backend')) return 'backend';
  if (output.includes('frontend/') || output.includes('testops-copilot-frontend')) return 'frontend';
  if (output.includes('mcp-server/') || output.includes('@testops-copilot/mcp-server')) return 'mcp-server';
  return 'root';
}

function attemptAutoFix(verificationResults, lockfileDiffs) {
  logHeader('Phase 5a: Auto-Fix');
  const failedSteps = verificationResults.filter((v) => !v.passed);
  const actions = [];
  let anyFixed = false;

  for (const failed of failedSteps) {
    const output = `${failed.stdout} ${failed.stderr}`;

    for (const strategy of AUTO_FIX_PATTERNS) {
      const match = output.match(strategy.pattern);
      if (match) {
        const result = strategy.fix(match, failed);
        actions.push({
          strategy: strategy.name,
          step: failed.step,
          success: result.success,
        });
        if (result.success) anyFixed = true;
        break; // Only apply first matching fix per step
      }
    }
  }

  if (actions.length === 0) {
    logStep(`${C.dim}—${C.reset}`, 'No auto-fix patterns matched');
  }

  return { fixed: anyFixed, actions };
}

// Level 2: Suggest fix
function suggestFix(verificationResults, lockfileDiffs) {
  logHeader('Phase 5b: Suggested Fixes');
  const suggestions = [];
  const failedSteps = verificationResults.filter((v) => !v.passed);

  // Build a map of all changed packages
  const changedPackages = [];
  for (const diff of lockfileDiffs) {
    for (const pkg of diff.added) {
      changedPackages.push({ ...pkg, type: 'added', workspace: diff.workspace });
    }
    for (const pkg of diff.removed) {
      changedPackages.push({ ...pkg, type: 'removed', workspace: diff.workspace });
    }
    for (const pkg of diff.updated) {
      changedPackages.push({ ...pkg, type: 'updated', workspace: diff.workspace });
    }
  }

  for (const failed of failedSteps) {
    const output = `${failed.stdout} ${failed.stderr}`;

    // Find which changed packages appear in the error output
    const suspects = changedPackages.filter((pkg) => output.includes(pkg.name));

    if (suspects.length > 0) {
      for (const suspect of suspects) {
        const suggestion = {
          likelyCause: `${suspect.name}@${suspect.to || suspect.version}`,
          workspace: suspect.workspace,
          failingStep: failed.step,
          changelogUrl: `https://www.npmjs.com/package/${suspect.name}`,
        };

        if (suspect.type === 'updated' && suspect.from) {
          suggestion.suggestion = `Pin ${suspect.name} to previous version`;
          suggestion.command = `cd ${suspect.workspace} && npm install ${suspect.name}@${suspect.from}`;
        } else if (suspect.type === 'added') {
          suggestion.suggestion = `Check if ${suspect.name} requires additional setup or type declarations`;
          suggestion.command = `cd ${suspect.workspace} && npm install --save-dev @types/${suspect.name}`;
        } else if (suspect.type === 'removed') {
          suggestion.suggestion = `Re-install removed package ${suspect.name}`;
          suggestion.command = `cd ${suspect.workspace} && npm install ${suspect.name}@${suspect.version}`;
        }

        suggestions.push(suggestion);
      }
    } else {
      suggestions.push({
        likelyCause: 'unknown',
        workspace: 'unknown',
        failingStep: failed.step,
        suggestion: `Investigate ${failed.step} failure manually. Error does not correlate to any specific package change.`,
        command: null,
      });
    }
  }

  for (const s of suggestions) {
    logStep(`${C.yellow}💡${C.reset}`, `${C.bold}${s.failingStep}${C.reset}: ${s.suggestion}`);
    if (s.command) {
      logStep('  ', `${C.dim}Run: ${s.command}${C.reset}`);
    }
    if (s.changelogUrl) {
      logStep('  ', `${C.dim}Changelog: ${s.changelogUrl}${C.reset}`);
    }
  }

  return suggestions;
}

// Level 3: Rollback
function rollback(beforeSnapshot) {
  logHeader('Phase 5c: Rollback');
  logStep(`${C.red}↩${C.reset}`, 'Rolling back lockfiles to previous state...');

  // Restore lockfiles from git
  for (const ws of WORKSPACES) {
    const lockPath = path.relative(ROOT_DIR, path.join(ws.dir, ws.lockfile));
    const result = execSafe(`git checkout HEAD -- ${lockPath}`);
    if (result.success) {
      logStep(`${C.green}✓${C.reset}`, `Restored ${lockPath}`);
    } else {
      logStep(`${C.red}✗${C.reset}`, `Failed to restore ${lockPath}: ${result.stderr}`);
    }
  }

  // Run npm ci in each workspace
  for (const ws of WORKSPACES) {
    logStep(`${C.cyan}→${C.reset}`, `Running npm ci in ${C.bold}${ws.name}${C.reset}...`);
    const result = execSafe('npm ci', { cwd: ws.dir, timeout: 120_000 });
    if (result.success) {
      logStep(`${C.green}✓${C.reset}`, `${ws.name}: clean install succeeded`);
    } else {
      logStep(`${C.red}✗${C.reset}`, `${ws.name}: clean install failed`);
      logStep('  ', `${C.dim}Manual recovery: cd ${ws.name} && rm -rf node_modules && npm install${C.reset}`);
    }
  }

  log('');
  logStep(`${C.yellow}⚠${C.reset}`, 'Lockfiles rolled back. Working tree restored to pre-update state.');
}

// ── Report Generation ────────────────────────────────────────────────────────

function generateReport(blastRadius, recovery) {
  const levelEmoji = { low: '🟢', medium: '🟡', high: '🔴' };
  const emoji = levelEmoji[blastRadius.level] || '⚪';

  const report = {
    ...blastRadius,
    recovery: recovery || null,
    generatedAt: new Date().toISOString(),
  };

  // Write JSON report
  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));

  if (jsonOutput) {
    // JSON mode: output to stdout for CI consumption
    process.stdout.write(JSON.stringify(report, null, 2));
    return report;
  }

  // Human-readable console output
  logHeader('Safe Update Report');

  log(`  ${emoji} Blast Radius: ${C.bold}${blastRadius.level.toUpperCase()}${C.reset} ${C.dim}(score: ${blastRadius.score}/100)${C.reset}`);
  log('');
  log(`  ${blastRadius.summary}`);
  log('');

  // Package changes
  if (blastRadius.packageChanges.length > 0) {
    log(`  ${C.bold}Package Changes:${C.reset}`);
    for (const ws of blastRadius.packageChanges) {
      log(`    ${C.bold}${ws.workspace}:${C.reset}`);
      for (const p of ws.added) {
        log(`      ${C.green}+ ${p.name}@${p.version}${C.reset} ${C.dim}(new)${C.reset}`);
      }
      for (const p of ws.removed) {
        log(`      ${C.red}- ${p.name}@${p.version}${C.reset} ${C.dim}(removed)${C.reset}`);
      }
      for (const p of ws.updated) {
        log(`      ${C.yellow}~ ${p.name}: ${p.from} → ${p.to}${C.reset}`);
      }
    }
    log('');
  } else {
    log(`  ${C.dim}No package changes detected.${C.reset}`);
    log('');
  }

  // Major version bumps
  if (blastRadius.majorVersionBumps.length > 0) {
    log(`  ${C.red}${C.bold}⚠ Major Version Bumps:${C.reset}`);
    for (const bump of blastRadius.majorVersionBumps) {
      log(`    ${C.red}${bump.name}: ${bump.from} → ${bump.to}${C.reset} (${bump.workspace})`);
    }
    log('');
  }

  // Verification results
  log(`  ${C.bold}Verification Results:${C.reset}`);
  for (const v of blastRadius.verificationResults) {
    const icon = v.passed ? `${C.green}✓${C.reset}` : `${C.red}✗${C.reset}`;
    log(`    ${icon} ${v.step} ${C.dim}(${v.duration})${C.reset}`);
  }
  log('');

  // Correlations
  if (blastRadius.correlations.length > 0) {
    log(`  ${C.bold}Failure Correlations:${C.reset}`);
    for (const c of blastRadius.correlations) {
      const causes = c.likelyCauses.join(', ');
      const conf = c.confidence === 'high' ? `${C.green}high${C.reset}` : `${C.yellow}low${C.reset}`;
      log(`    ${c.failingStep} → ${causes} ${C.dim}(confidence: ${conf}${C.dim})${C.reset}`);
    }
    log('');
  }

  // Recovery
  if (recovery) {
    log(`  ${C.bold}Recovery:${C.reset}`);
    if (recovery.autoFixed) {
      log(`    ${C.green}✓${C.reset} Auto-fixed: ${recovery.actions.map((a) => a.strategy).join(', ')}`);
    }
    if (recovery.suggestions && recovery.suggestions.length > 0) {
      log(`    ${C.yellow}💡${C.reset} Suggestions:`);
      for (const s of recovery.suggestions) {
        log(`      - ${s.suggestion}`);
        if (s.command) log(`        ${C.dim}${s.command}${C.reset}`);
      }
    }
    if (recovery.rolledBack) {
      log(`    ${C.red}↩${C.reset} Rolled back to pre-update state`);
    }
  }

  return report;
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  logHeader('Safe Update — Blast Radius Analysis');
  log(`  ${C.dim}Git SHA: ${getGitSha()}${C.reset}`);
  log(`  ${C.dim}Timestamp: ${new Date().toISOString()}${C.reset}`);

  // Phase 1: Snapshot
  logHeader('Phase 1: Snapshot');
  let beforeSnapshot;

  if (skipUpdate || reportOnly) {
    // In skip-update/report-only mode, use git HEAD as the "before" state
    // and the current working tree as the "after" state
    beforeSnapshot = captureGitSnapshot();
  } else {
    beforeSnapshot = captureSnapshot();
  }

  for (const ws of WORKSPACES) {
    const checksum = beforeSnapshot.lockfiles[ws.name];
    const pkgCount = beforeSnapshot.packages[ws.name]
      ? beforeSnapshot.packages[ws.name].size
      : 0;
    logStep(
      `${C.blue}i${C.reset}`,
      `${ws.name}: ${pkgCount} packages ${C.dim}(${checksum ? checksum.slice(0, 8) : 'missing'})${C.reset}`
    );
  }

  // Phase 2: Update
  if (!skipUpdate && !reportOnly) {
    runUpdate();
  } else {
    log('');
    logStep(`${C.dim}—${C.reset}`, `Skipping update phase (${skipUpdate ? '--skip-update' : '--report-only'})`);
  }

  // Capture "after" state
  const afterSnapshot = captureSnapshot();

  // Phase 4: Blast Radius (computed before verification for report-only mode)
  const lockfileDiffs = diffLockfiles(beforeSnapshot, afterSnapshot);

  if (reportOnly) {
    // Report-only mode: just compute and report, no verification
    const blastRadius = computeBlastRadius(lockfileDiffs, []);
    generateReport(blastRadius, null);
    process.exit(0);
  }

  // Phase 3: Verify
  const verificationResults = runVerificationLoop();
  const allPassed = verificationResults.every((v) => v.passed);

  // Phase 4: Blast Radius
  const blastRadius = computeBlastRadius(lockfileDiffs, verificationResults);

  if (allPassed) {
    const report = generateReport(blastRadius, null);
    log(`  ${C.green}${C.bold}Result: All checks passed. Update is safe.${C.reset}`);
    log('');
    process.exit(0);
  }

  // Phase 5: Recovery
  const recovery = { autoFixed: false, suggestions: [], rolledBack: false, actions: [] };

  // Level 1: Auto-fix
  for (let attempt = 0; attempt < MAX_AUTO_FIX_ATTEMPTS; attempt++) {
    const fixResult = attemptAutoFix(verificationResults, lockfileDiffs);
    recovery.actions.push(...fixResult.actions);

    if (fixResult.fixed) {
      logStep(`${C.cyan}→${C.reset}`, `Re-running verification after auto-fix (attempt ${attempt + 1})...`);
      const reVerify = runVerificationLoop();
      if (reVerify.every((v) => v.passed)) {
        recovery.autoFixed = true;
        const reBlastRadius = computeBlastRadius(lockfileDiffs, reVerify);
        generateReport(reBlastRadius, recovery);
        log(`  ${C.yellow}${C.bold}Result: Failed initially, auto-fixed. All checks now pass.${C.reset}`);
        log('');
        process.exit(1);
      }
    } else {
      break; // No fixes applied, don't retry
    }
  }

  // Level 2: Suggest
  recovery.suggestions = suggestFix(verificationResults, lockfileDiffs);

  if (recovery.suggestions.some((s) => s.command)) {
    generateReport(blastRadius, recovery);
    log(`  ${C.yellow}${C.bold}Result: Failed. Manual fix suggested — see recommendations above.${C.reset}`);
    log('');
    process.exit(2);
  }

  // Level 3: Rollback
  rollback(beforeSnapshot);
  recovery.rolledBack = true;
  generateReport(blastRadius, recovery);
  log(`  ${C.red}${C.bold}Result: Failed. Rolled back to pre-update state.${C.reset}`);
  log('');
  process.exit(3);
}

main();
