#!/usr/bin/env node

/**
 * Architectural lint — enforces layer boundaries.
 *
 * Rules:
 *   1. Controllers must NOT import Prisma (use services instead)
 *   2. Controllers must NOT instantiate PrismaClient
 *   3. Services must NOT import Express types (req/res/next)
 *   4. Only lib/prisma.ts may instantiate PrismaClient
 *   5. Only AIManager may import provider classes directly
 *   6. No console.log in production backend code (use winston logger)
 *
 * Exit code 0 = clean, 1 = violations found.
 */

const fs = require('fs');
const path = require('path');

const BACKEND_SRC = path.resolve(__dirname, '..', 'backend', 'src');

const violations = [];

function scanFile(filePath, content, relativePath) {
  const lines = content.split('\n');

  const isController = relativePath.includes('/controllers/') && !relativePath.includes('__tests__');
  const isService = relativePath.includes('/services/') && !relativePath.includes('__tests__');
  const isPrismaLib = relativePath === 'lib/prisma.ts' || relativePath === 'lib\\prisma.ts';
  const isAIManager = relativePath.includes('services/ai/manager.ts');
  const isTestFile = relativePath.includes('__tests__') || relativePath.includes('.test.') || relativePath.includes('.spec.');

  if (isTestFile) return;

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    const trimmed = line.trim();

    // Skip comments
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;

    // Rule 1: Controllers must not import prisma
    if (isController) {
      if (/from\s+['"].*lib\/prisma['"]/.test(line) || /from\s+['"]@\/lib\/prisma['"]/.test(line)) {
        violations.push({
          file: relativePath,
          line: lineNum,
          rule: 'controller-no-prisma',
          message: 'Controllers must not import Prisma directly. Use a service instead.',
          content: trimmed,
        });
      }
      if (/from\s+['"]@prisma\/client['"]/.test(line) && /import.*PrismaClient/.test(line)) {
        violations.push({
          file: relativePath,
          line: lineNum,
          rule: 'controller-no-prisma-client',
          message: 'Controllers must not import PrismaClient.',
          content: trimmed,
        });
      }
    }

    // Rule 2: Only lib/prisma.ts may call new PrismaClient()
    if (!isPrismaLib && /new\s+PrismaClient\s*\(/.test(line)) {
      violations.push({
        file: relativePath,
        line: lineNum,
        rule: 'singleton-prisma',
        message: 'Only lib/prisma.ts may instantiate PrismaClient. Import the singleton from @/lib/prisma.',
        content: trimmed,
      });
    }

    // Rule 3: Services must not import Express types
    if (isService) {
      if (/from\s+['"]express['"]/.test(line) && /import.*\b(Request|Response|NextFunction)\b/.test(line)) {
        violations.push({
          file: relativePath,
          line: lineNum,
          rule: 'service-no-express',
          message: 'Services must not import Express HTTP types (Request, Response, NextFunction). Services handle business logic only.',
          content: trimmed,
        });
      }
    }

    // Rule 4: Only AI subsystem files may import provider classes directly
    if (!isAIManager && !relativePath.includes('services/ai/providers/') && !relativePath.includes('services/ai/index')) {
      if (/from\s+['"].*providers\/(anthropic|openai|google)\.provider['"]/.test(line)) {
        violations.push({
          file: relativePath,
          line: lineNum,
          rule: 'ai-manager-only',
          message: 'Only AIManager may import AI provider classes directly. Use AIManager.getInstance().',
          content: trimmed,
        });
      }
    }

    // Rule 5: No console.log in production backend code
    if (!isTestFile && /\bconsole\.log\s*\(/.test(line)) {
      violations.push({
        file: relativePath,
        line: lineNum,
        rule: 'no-console-log',
        message: 'Use winston logger (logger.info/warn/error) instead of console.log.',
        content: trimmed,
      });
    }
  });
}

function walkDir(dir, baseDir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'coverage') continue;
      walkDir(fullPath, baseDir);
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const relativePath = path.relative(baseDir, fullPath);
      scanFile(fullPath, content, relativePath);
    }
  }
}

// Run
console.log('Checking architectural boundaries...\n');
walkDir(BACKEND_SRC, BACKEND_SRC);

if (violations.length === 0) {
  console.log('✓ No architectural violations found.\n');
  process.exit(0);
} else {
  console.error(`✗ Found ${violations.length} architectural violation(s):\n`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}`);
    console.error(`    Rule: ${v.rule}`);
    console.error(`    ${v.message}`);
    console.error(`    > ${v.content}`);
    console.error('');
  }
  process.exit(1);
}
