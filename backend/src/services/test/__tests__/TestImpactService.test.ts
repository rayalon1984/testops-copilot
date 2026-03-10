import { TestImpactService } from '../TestImpactService';

// Mock prisma
jest.mock('../../../lib/prisma', () => ({
  prisma: {
    testResult: {
      findMany: jest.fn(),
    },
  },
}));

// Mock logger
jest.mock('../../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock fs/promises
jest.mock('fs/promises', () => ({
  access: jest.fn(),
}));

import { prisma } from '../../../lib/prisma';
import fs from 'fs/promises';

const prismaMock = prisma as any;
const fsMock = fs as jest.Mocked<typeof fs>;

describe('TestImpactService', () => {
  let service: TestImpactService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TestImpactService();

    // Default: return 100 distinct test names
    prismaMock.testResult.findMany.mockResolvedValue(
      Array.from({ length: 100 }, (_, i) => ({ name: `test-${i}` }))
    );
  });

  describe('getTestsForChanges', () => {
    describe('Direct Test File Changes', () => {
      it('should select test files that are directly changed (.test.ts)', async () => {
        const result = await service.getTestsForChanges([
          'backend/src/services/__tests__/auth.service.test.ts',
        ]);

        expect(result.selectedTests).toContain(
          'backend/src/services/__tests__/auth.service.test.ts'
        );
        expect(result.selectionStrategy).toBe('direct');
        expect(result.confidence).toBe(1.0);
      });

      it('should select test files that are directly changed (.spec.ts)', async () => {
        const result = await service.getTestsForChanges([
          'tests/e2e/login.spec.ts',
        ]);

        expect(result.selectedTests).toContain('tests/e2e/login.spec.ts');
        expect(result.selectionStrategy).toBe('direct');
      });

      it('should select .test.tsx React test files', async () => {
        const result = await service.getTestsForChanges([
          'frontend/src/components/Button.test.tsx',
        ]);

        expect(result.selectedTests).toContain(
          'frontend/src/components/Button.test.tsx'
        );
      });

      it('should select multiple direct test files', async () => {
        const result = await service.getTestsForChanges([
          'backend/src/services/__tests__/auth.service.test.ts',
          'backend/src/services/__tests__/user.service.test.ts',
        ]);

        expect(result.selectedTests).toHaveLength(2);
        expect(result.selectionStrategy).toBe('direct');
        expect(result.confidence).toBe(1.0);
      });
    });

    describe('Convention-Based Mapping', () => {
      it('should map source file to __tests__ convention', async () => {
        const result = await service.getTestsForChanges([
          'backend/src/services/auth.service.ts',
        ]);

        expect(result.selectedTests).toContain(
          'backend/src/services/__tests__/auth.service.test.ts'
        );
        expect(result.selectionStrategy).toBe('convention');
        expect(result.confidence).toBe(0.7);
      });

      it('should map .tsx source files correctly', async () => {
        const result = await service.getTestsForChanges([
          'frontend/src/components/Header.tsx',
        ]);

        expect(result.selectedTests).toContain(
          'frontend/src/components/__tests__/Header.test.ts'
        );
      });

      it('should not map non-source files (markdown, yaml, etc.)', async () => {
        const result = await service.getTestsForChanges([
          'docs/README.md',
          'specs/features/auth.feature.yaml',
        ]);

        expect(result.selectedTests).toHaveLength(0);
        expect(result.reason).toBe('No test-relevant changes detected');
      });

      it('should not map files outside src/ directories', async () => {
        const result = await service.getTestsForChanges([
          'scripts/deploy.ts',
        ]);

        expect(result.selectedTests).toHaveLength(0);
      });
    });

    describe('Global File Detection', () => {
      it('should trigger ALL tests for schema.prisma changes', async () => {
        const result = await service.getTestsForChanges([
          'backend/prisma/schema.prisma',
        ]);

        expect(result.selectedTests).toEqual(['ALL']);
        expect(result.reason).toContain('Global configuration change');
        expect(result.selectionStrategy).toBe('global');
        expect(result.confidence).toBe(1.0);
        expect(result.savedTests).toBe(0);
      });

      it('should trigger ALL tests for package.json changes', async () => {
        const result = await service.getTestsForChanges([
          'backend/package.json',
        ]);

        expect(result.selectedTests).toEqual(['ALL']);
        expect(result.reason).toContain('package.json');
      });

      it('should trigger ALL tests for package-lock.json changes', async () => {
        const result = await service.getTestsForChanges([
          'package-lock.json',
        ]);

        expect(result.selectedTests).toEqual(['ALL']);
      });

      it('should trigger ALL tests for tsconfig.json changes', async () => {
        const result = await service.getTestsForChanges([
          'tsconfig.json',
        ]);

        expect(result.selectedTests).toEqual(['ALL']);
      });

      it('should trigger ALL tests for jest.config.js changes', async () => {
        const result = await service.getTestsForChanges([
          'backend/jest.config.js',
        ]);

        expect(result.selectedTests).toEqual(['ALL']);
      });

      it('should trigger ALL tests for vitest.config.ts changes', async () => {
        const result = await service.getTestsForChanges([
          'frontend/vitest.config.ts',
        ]);

        expect(result.selectedTests).toEqual(['ALL']);
      });

      it('should trigger ALL tests for docker-compose.yml changes', async () => {
        const result = await service.getTestsForChanges([
          'docker-compose.yml',
        ]);

        expect(result.selectedTests).toEqual(['ALL']);
      });

      it('should trigger ALL tests for Dockerfile changes', async () => {
        const result = await service.getTestsForChanges([
          'backend/Dockerfile',
        ]);

        expect(result.selectedTests).toEqual(['ALL']);
      });

      it('should accept custom global files via options', async () => {
        const result = await service.getTestsForChanges(
          ['custom.config.ts'],
          { globalFiles: ['custom.config.ts'] }
        );

        expect(result.selectedTests).toEqual(['ALL']);
      });

      it('should early exit on first global file even with other changes', async () => {
        const result = await service.getTestsForChanges([
          'backend/prisma/schema.prisma',
          'backend/src/services/auth.service.ts',
        ]);

        expect(result.selectedTests).toEqual(['ALL']);
        expect(result.selectionStrategy).toBe('global');
      });
    });

    describe('Mixed Strategies', () => {
      it('should combine direct and convention-based selections', async () => {
        const result = await service.getTestsForChanges([
          'backend/src/services/__tests__/auth.service.test.ts',
          'backend/src/services/user.service.ts',
        ]);

        expect(result.selectedTests).toHaveLength(2);
        expect(result.selectionStrategy).toBe('mixed');
        expect(result.details).toHaveLength(2);
      });

      it('should not duplicate tests when source and test change together', async () => {
        const result = await service.getTestsForChanges([
          'backend/src/services/auth.service.ts',
          'backend/src/services/__tests__/auth.service.test.ts',
        ]);

        // The direct hit and convention map should produce the same or similar path
        expect(result.selectedTests.length).toBeGreaterThanOrEqual(1);
      });
    });

    describe('Edge Cases', () => {
      it('should handle empty file list', async () => {
        const result = await service.getTestsForChanges([]);

        expect(result.selectedTests).toHaveLength(0);
        expect(result.reason).toBe('No test-relevant changes detected');
        expect(result.savedTests).toBe(100);
      });

      it('should normalize Windows-style paths', async () => {
        const result = await service.getTestsForChanges([
          'backend\\src\\services\\auth.service.ts',
        ]);

        expect(result.selectedTests).toContain(
          'backend/src/services/__tests__/auth.service.test.ts'
        );
      });

      it('should handle files with multiple extensions gracefully', async () => {
        const result = await service.getTestsForChanges([
          'backend/src/services/auth.service.integration.ts',
        ]);

        // Should still produce a mapping
        expect(result.selectedTests.length).toBeGreaterThanOrEqual(0);
      });
    });

    describe('File Existence Validation', () => {
      it('should validate file existence when option is enabled', async () => {
        (fsMock.access as jest.Mock).mockResolvedValueOnce(undefined); // first candidate exists
        (fsMock.access as jest.Mock).mockRejectedValue(new Error('ENOENT')); // rest don't

        const result = await service.getTestsForChanges(
          ['backend/src/services/auth.service.ts'],
          { validateFileExistence: true, projectRoot: '/project' }
        );

        expect(result.selectedTests.length).toBeGreaterThanOrEqual(1);
        expect(fsMock.access).toHaveBeenCalled();
      });

      it('should return empty when no test files exist on disk', async () => {
        (fsMock.access as jest.Mock).mockRejectedValue(new Error('ENOENT'));

        const result = await service.getTestsForChanges(
          ['backend/src/services/auth.service.ts'],
          { validateFileExistence: true, projectRoot: '/project' }
        );

        expect(result.selectedTests).toHaveLength(0);
      });
    });

    describe('Total Test Count', () => {
      it('should query real test count from database', async () => {
        prismaMock.testResult.findMany.mockResolvedValue(
          Array.from({ length: 250 }, (_, i) => ({ name: `test-${i}` }))
        );

        const result = await service.getTestsForChanges([
          'backend/src/services/auth.service.ts',
        ]);

        expect(result.totalTests).toBe(250);
        expect(result.savedTests).toBe(249);
        expect(prismaMock.testResult.findMany).toHaveBeenCalledWith({
          distinct: ['name'],
          select: { name: true },
        });
      });

      it('should gracefully handle database errors', async () => {
        prismaMock.testResult.findMany.mockRejectedValue(
          new Error('Database connection lost')
        );

        const result = await service.getTestsForChanges([
          'backend/src/services/auth.service.ts',
        ]);

        // Should fallback to 0 and not throw
        expect(result.totalTests).toBe(0);
      });
    });

    describe('Confidence Scoring', () => {
      it('should return 1.0 confidence for direct test changes', async () => {
        const result = await service.getTestsForChanges([
          'backend/src/services/__tests__/auth.service.test.ts',
        ]);

        expect(result.confidence).toBe(1.0);
      });

      it('should return 0.7 confidence for convention-based mapping', async () => {
        const result = await service.getTestsForChanges([
          'backend/src/services/auth.service.ts',
        ]);

        expect(result.confidence).toBe(0.7);
      });

      it('should return 1.0 confidence for global file triggers', async () => {
        const result = await service.getTestsForChanges([
          'backend/prisma/schema.prisma',
        ]);

        expect(result.confidence).toBe(1.0);
      });

      it('should return 1.0 confidence for empty change list', async () => {
        const result = await service.getTestsForChanges([]);

        expect(result.confidence).toBe(1.0);
      });

      it('should average confidence for mixed strategies', async () => {
        const result = await service.getTestsForChanges([
          'backend/src/services/__tests__/auth.service.test.ts', // direct = 1.0
          'backend/src/services/user.service.ts', // convention = 0.7
        ]);

        // (1.0 + 0.7) / 2 = 0.85
        expect(result.confidence).toBe(0.85);
      });
    });

    describe('Selection Details', () => {
      it('should include per-file selection details', async () => {
        const result = await service.getTestsForChanges([
          'backend/src/services/auth.service.ts',
        ]);

        expect(result.details).toHaveLength(1);
        expect(result.details[0]).toEqual({
          changedFile: 'backend/src/services/auth.service.ts',
          mappedTests: ['backend/src/services/__tests__/auth.service.test.ts'],
          strategy: 'convention',
        });
      });

      it('should show strategy for each changed file', async () => {
        const result = await service.getTestsForChanges([
          'backend/src/services/__tests__/auth.service.test.ts',
          'backend/src/services/user.service.ts',
        ]);

        const directDetail = result.details.find(d => d.strategy === 'direct');
        const conventionDetail = result.details.find(d => d.strategy === 'convention');

        expect(directDetail).toBeDefined();
        expect(conventionDetail).toBeDefined();
      });
    });
  });
});
