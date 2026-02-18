/**
 * Flaky Test Detection Service
 * 
 * Analyzes test execution history to identify unstable tests using a statistical approach.
 * 
 * Algorithm:
 * 1. Fetch the last N (default: 50) executions for a specific test or all tests.
 * 2. Identify "Flip-Flops": Status changes (Pass -> Fail -> Pass) on the same commit or adjacent runs.
 * 3. Calculate Flakiness Score:
 *    Score = (FlipFlops / TotalRuns) * ImpactFactor
 *    - ImpactFactor can be boosted for recent failures.
 * 4. Categorize:
 *    - Score > 0.5: HIGH
 *    - Score > 0.2: MEDIUM
 *    - Score > 0: LOW
 */

import { PrismaClient, TestRun } from '@prisma/client';
import { logger } from '@/utils/logger';

const prisma = new PrismaClient();

export interface FlakyStats {
    testName: string;
    totalRuns: number;
    failureCount: number;
    flipFlopCount: number;
    flakinessScore: number; // 0.0 to 1.0
    severity: 'HIGH' | 'MEDIUM' | 'LOW' | 'STABLE';
    lastFlakedAt?: Date;
}

export class FlakyTestService {
    private readonly WINDOW_SIZE = 50;

    /**
     * Analyze all tests in the system for flakiness.
     * This is a heavy operation, meant for background jobs.
     */
    async analyzeAllTests(): Promise<FlakyStats[]> {
        // Group runs by test name
        // Since TestResult has testName, we should query TestResults joined with TestRun
        // However, Prisma groupBy on relations is tricky.
        // Let's get distinct test names first.

        const testNames = await prisma.testResult.findMany({
            distinct: ['testName'],
            select: { testName: true }
        });

        logger.info(`[FlakyTestService] Analyzing ${testNames.length} tests...`);

        const results: FlakyStats[] = [];
        for (const { testName } of testNames) {
            const stats = await this.analyzeTest(testName);
            if (stats.severity !== 'STABLE') {
                results.push(stats);
            }
        }

        return results.sort((a, b) => b.flakinessScore - a.flakinessScore);
    }

    /**
     * Analyze a specific test for flakiness.
     */
    async analyzeTest(testName: string): Promise<FlakyStats> {
        // Fetch last N results for this test, ordered by time
        const history = await prisma.testResult.findMany({
            where: { testName },
            orderBy: { createdAt: 'desc' },
            take: this.WINDOW_SIZE,
            include: { testRun: true }
        });

        if (history.length < 5) {
            return {
                testName,
                totalRuns: history.length,
                failureCount: 0,
                flipFlopCount: 0,
                flakinessScore: 0,
                severity: 'STABLE'
            };
        }

        // Sort by time ascending for analysis
        const runs = history.reverse();

        let flipFlops = 0;
        let failureCount = 0;
        let lastStatus: string | null = null;
        let lastCommit: string | null = null;
        let lastFlakedAt: Date | undefined;

        for (const res of runs) {
            const currentStatus = res.status; // 'PASSED', 'FAILED'
            const currentCommit = res.testRun.commit;

            if (currentStatus === 'FAILED') {
                failureCount++;
            }

            // Detect Flip-Flop:
            // If status changed AND commit is the same, it's definitely flaky.
            // Even if commit changed, frequent toggling indicates instability.
            // Strictly: Fail -> Pass or Pass -> Fail on SAME commit is strongest signal.

            if (lastStatus && lastStatus !== currentStatus) {
                if (lastCommit === currentCommit) {
                    flipFlops++;
                    lastFlakedAt = res.createdAt;
                } else {
                    // Status changed across commits. 
                    // Could be a real regression or fix. 
                    // We treat this with lower weight or ignore for "FlipFlop" metric 
                    // unless we see Pass -> Fail -> Pass pattern across 3 commits.
                    // For simplicity in v1, we only count same-commit flips as definitive flakiness.
                }
            }

            lastStatus = currentStatus;
            lastCommit = currentCommit;
        }

        const score = flipFlops / runs.length;

        // Determine severity
        let severity: FlakyStats['severity'] = 'STABLE';
        if (score > 0.3) severity = 'HIGH';
        else if (score > 0.1) severity = 'MEDIUM';
        else if (score > 0) severity = 'LOW';

        return {
            testName,
            totalRuns: runs.length,
            failureCount,
            flipFlopCount: flipFlops,
            flakinessScore: parseFloat(score.toFixed(2)),
            severity,
            lastFlakedAt
        };
    }
}

export const flakyTestService = new FlakyTestService();
