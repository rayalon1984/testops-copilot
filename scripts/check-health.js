#!/usr/bin/env node

/**
 * Code health check — catches structural bloat before it sets in.
 *
 * Hard limits (fail CI on NEW violations):
 *   - No source file exceeds 600 lines
 *   - No function/method exceeds 150 lines
 *
 * Soft limits (warn only):
 *   - Files over 400 lines flagged for splitting
 *   - Functions over 80 lines flagged for refactoring
 *
 * Baseline: Pre-existing violations are tracked in .health-baseline.json.
 * Only NEW violations (not in baseline) cause a build failure.
 *
 * Usage:
 *   node scripts/check-health.js              # Normal run (fail on new violations)
 *   node scripts/check-health.js --baseline   # Generate/update baseline from current state
 *
 * Exit code 0 = healthy (or only baseline violations), 1 = new violations found.
 */

const fs = require('fs');
const path = require('path');

const SRC_DIRS = [
  path.resolve(__dirname, '..', 'backend', 'src'),
  path.resolve(__dirname, '..', 'frontend', 'src'),
];

const BASELINE_FILE = path.resolve(__dirname, '..', '.health-baseline.json');

const HARD_FILE_LINES = 600;
const HARD_FUNCTION_LINES = 150;
const SOFT_FILE_LINES = 400;
const SOFT_FUNCTION_LINES = 80;

const isBaselineMode = process.argv.includes('--baseline');

const hardViolations = [];
const warnings = [];

function makeKey(violation) {
  return `${violation.file}::${violation.rule}::${violation.name || ''}`;
}

function checkFileLength(relativePath, lines) {
  const count = lines.length;
  if (count > HARD_FILE_LINES) {
    hardViolations.push({
      file: relativePath,
      rule: 'file-length',
      name: path.basename(relativePath),
      message: `File has ${count} lines (hard limit: ${HARD_FILE_LINES}). Must be split before merging.`,
    });
  } else if (count > SOFT_FILE_LINES) {
    warnings.push({
      file: relativePath,
      rule: 'file-length',
      message: `File has ${count} lines (target: <${SOFT_FILE_LINES}). Consider splitting.`,
    });
  }
}

function checkFunctionLength(relativePath, content) {
  const lines = content.split('\n');
  let funcStart = null;
  let funcName = null;
  let braceDepth = 0;
  let inFunc = false;

  const funcPatterns = [
    /(?:export\s+)?(?:async\s+)?function\s+(\w+)/,
    /(?:static\s+)?(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{/,
    /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(?[^)]*\)?\s*=>\s*\{/,
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;

    if (!inFunc) {
      for (const pattern of funcPatterns) {
        const match = trimmed.match(pattern);
        if (match && trimmed.includes('{')) {
          funcName = match[1];
          funcStart = i;
          braceDepth = 0;
          inFunc = true;
          break;
        }
      }
    }

    if (inFunc) {
      for (const ch of line) {
        if (ch === '{') braceDepth++;
        if (ch === '}') braceDepth--;
      }

      if (braceDepth <= 0) {
        const funcLength = i - funcStart + 1;
        if (funcLength > HARD_FUNCTION_LINES) {
          hardViolations.push({
            file: relativePath,
            line: funcStart + 1,
            rule: 'function-length',
            name: funcName,
            message: `Function "${funcName}" is ${funcLength} lines (hard limit: ${HARD_FUNCTION_LINES}). Must be refactored before merging.`,
          });
        } else if (funcLength > SOFT_FUNCTION_LINES) {
          warnings.push({
            file: relativePath,
            line: funcStart + 1,
            rule: 'function-length',
            message: `Function "${funcName}" is ${funcLength} lines (target: <${SOFT_FUNCTION_LINES}). Consider extracting helpers.`,
          });
        }
        inFunc = false;
        funcName = null;
        funcStart = null;
      }
    }
  }
}

function walkDir(dir) {
  if (!fs.existsSync(dir)) return;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', 'coverage', '__tests__', '.git'].includes(entry.name)) continue;
      walkDir(fullPath);
    } else if ((entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) && !entry.name.endsWith('.d.ts')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      const relativePath = path.relative(path.resolve(__dirname, '..'), fullPath);

      checkFileLength(relativePath, lines);
      checkFunctionLength(relativePath, content);
    }
  }
}

// Run
console.log('Checking code health metrics...\n');
for (const dir of SRC_DIRS) {
  walkDir(dir);
}

// Baseline mode: save current violations and exit
if (isBaselineMode) {
  const baseline = hardViolations.map((v) => makeKey(v)).sort();
  fs.writeFileSync(BASELINE_FILE, JSON.stringify(baseline, null, 2) + '\n');
  console.log(`Baseline saved with ${baseline.length} known violation(s) → .health-baseline.json\n`);
  console.log('These violations will be allowed until fixed. New violations will still fail CI.\n');
  process.exit(0);
}

// Load baseline
let baseline = new Set();
if (fs.existsSync(BASELINE_FILE)) {
  try {
    const data = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
    baseline = new Set(data);
  } catch {
    console.warn('⚠ Could not parse .health-baseline.json — treating all violations as new.\n');
  }
}

// Separate new violations from baselined ones
const newViolations = hardViolations.filter((v) => !baseline.has(makeKey(v)));
const baselinedViolations = hardViolations.filter((v) => baseline.has(makeKey(v)));

// Report
if (warnings.length > 0) {
  console.warn(`⚠ ${warnings.length} soft warning(s):\n`);
  for (const v of warnings) {
    console.warn(`  ${v.file}${v.line ? ':' + v.line : ''}`);
    console.warn(`    ${v.message}`);
  }
  console.warn('');
}

if (baselinedViolations.length > 0) {
  console.log(`ℹ ${baselinedViolations.length} known violation(s) (baselined — fix when touching these files):\n`);
  for (const v of baselinedViolations) {
    console.log(`  ${v.file}${v.line ? ':' + v.line : ''} — ${v.name || 'file'}`);
  }
  console.log('');
}

if (newViolations.length > 0) {
  console.error(`✗ ${newViolations.length} NEW hard violation(s) — must fix before merging:\n`);
  for (const v of newViolations) {
    console.error(`  ${v.file}${v.line ? ':' + v.line : ''}`);
    console.error(`    Rule: ${v.rule}`);
    console.error(`    ${v.message}`);
    console.error('');
  }
  process.exit(1);
} else {
  console.log(`✓ No new code health violations.\n`);
  process.exit(0);
}
