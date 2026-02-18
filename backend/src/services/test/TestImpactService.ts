
/**
 * Test Impact Service (Smart Test Selection)
 * 
 * Maps changed source files to relevant tests to optimize CI execution.
 * 
 * Strategies:
 * 1. Direct Mapping: `src/foo/bar.ts` -> `src/foo/__tests__/bar.test.ts`
 * 2. Dependency Graph: (Future) Parse imports to find dependents.
 * 3. Directory Mapping: If `src/foo/*` changes, run all tests in `src/foo/__tests__`.
 */

import path from 'path';
import { logger } from '@/utils/logger';

export interface TestSelectionResult {
    selectedTests: string[];
    reason: string;
    totalTests: number; // Placeholder for total available tests
    savedTests: number;
}

export class TestImpactService {

    /**
     * Given a list of changed file paths, determine which tests to run.
     * @param changedFiles List of file paths relative to project root (e.g., 'backend/src/services/auth.service.ts')
     */
    async getTestsForChanges(changedFiles: string[]): Promise<TestSelectionResult> {
        const selectedTests = new Set<string>();

        for (const file of changedFiles) {
            // Normalize path
            const normalized = file.replace(/\\/g, '/');

            // Strategy 1: Direct Test File Change
            if (normalized.includes('.test.ts') || normalized.includes('.spec.ts')) {
                selectedTests.add(this.extractTestName(normalized));
                continue;
            }

            // Strategy 2: Source File -> Test File Convention
            // Pattern: src/path/to/file.ts -> src/path/to/__tests__/file.test.ts
            const testFile = this.mapSourceToTest(normalized);
            if (testFile) {
                // In a real scenario, we would check if this file actually exists on disk.
                // For now, we assume standard convention holds.
                selectedTests.add(testFile);
            }

            // Strategy 3: Special global files trigger all tests
            if (normalized.includes('schema.prisma') || normalized.includes('package.json')) {
                return {
                    selectedTests: ['ALL'],
                    reason: 'Global Configuration Change',
                    totalTests: 100, // mock
                    savedTests: 0
                };
            }
        }

        return {
            selectedTests: Array.from(selectedTests),
            reason: 'Impact Analysis',
            totalTests: 100, // mock
            savedTests: 100 - selectedTests.size
        };
    }

    /**
     * Maps a source file to its expected test file.
     * e.g., backend/src/services/auth.service.ts -> backend/src/services/__tests__/auth.service.test.ts
     */
    private mapSourceToTest(filePath: string): string | null {
        // Simple heuristic for the current project structure
        const parts = filePath.split('/');
        const fileName = parts.pop();

        if (!fileName || !filePath.includes('src/')) return null;

        const dir = parts.join('/');
        // Check standard convention: sibling __tests__ folder
        return `${dir}/__tests__/${fileName.replace('.ts', '.test.ts')}`;
    }

    private extractTestName(filePath: string): string {
        return path.basename(filePath);
    }
}

export const testImpactService = new TestImpactService();
