/**
 * Smart Test Selection — Verification Script
 *
 * Validates the TestImpactService logic with known scenarios.
 * Run: npx ts-node -r tsconfig-paths/register scripts/verify-smart-selection.ts
 */

import { TestImpactService } from '../src/services/test/TestImpactService';

interface TestCase {
  name: string;
  input: string[];
  expectation: (result: any) => boolean;
  description: string;
}

const service = new TestImpactService();

const testCases: TestCase[] = [
  {
    name: 'Direct Test Change',
    input: ['backend/src/services/__tests__/auth.service.test.ts'],
    expectation: (r) =>
      r.selectedTests.includes('backend/src/services/__tests__/auth.service.test.ts') &&
      r.selectionStrategy === 'direct',
    description: 'Direct test file should be selected as-is',
  },
  {
    name: 'Source File Convention Mapping',
    input: ['backend/src/services/auth.service.ts'],
    expectation: (r) =>
      r.selectedTests.includes('backend/src/services/__tests__/auth.service.test.ts') &&
      r.selectionStrategy === 'convention',
    description: 'Source file should map to __tests__/name.test.ts',
  },
  {
    name: 'Global Configuration Change (schema.prisma)',
    input: ['backend/prisma/schema.prisma'],
    expectation: (r) =>
      r.selectedTests[0] === 'ALL' &&
      r.selectionStrategy === 'global' &&
      r.savedTests === 0,
    description: 'Global files should trigger ALL tests',
  },
  {
    name: 'Global Configuration Change (package.json)',
    input: ['package.json'],
    expectation: (r) => r.selectedTests[0] === 'ALL',
    description: 'package.json should trigger ALL tests',
  },
  {
    name: 'Mixed Changes (Direct + Convention)',
    input: [
      'backend/src/services/__tests__/auth.service.test.ts',
      'backend/src/services/user.service.ts',
    ],
    expectation: (r) =>
      r.selectedTests.length === 2 &&
      r.selectionStrategy === 'mixed',
    description: 'Mixed strategies should combine results',
  },
  {
    name: 'Non-Source Files (Markdown)',
    input: ['README.md', 'docs/architecture.md'],
    expectation: (r) =>
      r.selectedTests.length === 0 &&
      r.reason === 'No test-relevant changes detected',
    description: 'Non-source files should not select any tests',
  },
  {
    name: 'Empty File List',
    input: [],
    expectation: (r) => r.selectedTests.length === 0,
    description: 'Empty input should return empty selection',
  },
  {
    name: 'Windows-Style Paths',
    input: ['backend\\src\\services\\auth.service.ts'],
    expectation: (r) =>
      r.selectedTests.includes('backend/src/services/__tests__/auth.service.test.ts'),
    description: 'Windows paths should be normalized',
  },
];

async function runVerification(): Promise<void> {
  console.log('===================================================');
  console.log(' Smart Test Selection -- Verification');
  console.log('===================================================\n');

  let passed = 0;
  let failed = 0;

  for (const tc of testCases) {
    try {
      const result = await service.getTestsForChanges(tc.input);
      const ok = tc.expectation(result);

      if (ok) {
        console.log(`  PASS: ${tc.name}`);
        console.log(`     ${tc.description}`);
        passed++;
      } else {
        console.log(`  FAIL: ${tc.name}`);
        console.log(`     Expected: ${tc.description}`);
        console.log(`     Got: ${JSON.stringify(result, null, 2)}`);
        failed++;
      }
    } catch (error) {
      console.log(`  FAIL: ${tc.name} -- THREW ERROR`);
      console.log(`     ${error instanceof Error ? error.message : String(error)}`);
      failed++;
    }
    console.log();
  }

  console.log('===================================================');
  console.log(` Results: ${passed} passed, ${failed} failed (${testCases.length} total)`);
  console.log('===================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error('Verification failed with error:', err);
  process.exit(1);
});
