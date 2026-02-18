
import { PrismaClient } from '@prisma/client';
import { flakyTestService } from '../src/services/test/FlakyTestService';

const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Starting Flaky Test Verification...');

    // 1. Setup: Create a Pipeline and TestRun
    console.log('🏗️ Seeding test data...');

    // Cleanup previous run
    await prisma.testResult.deleteMany({ where: { testName: 'flaky-auth-test' } });

    const pipeline = await prisma.pipeline.create({
        data: {
            name: 'Flaky Verification Pipeline',
            config: '{}'
        }
    });

    const run = await prisma.testRun.create({
        data: {
            pipelineId: pipeline.id,
            name: 'Verification Run',
            status: 'COMPLETED'
        }
    });

    // 2. Create Flip-Flop Pattern
    // Pass -> Fail -> Pass -> Fail (on same commit implicitly as we use one run ID for simplicity of relational connection, 
    // although logically different runs would have different times.
    // FlakyTestService orders by createdAt.
    // Let's create multiple results simulating history.

    const statuses = ['PASSED', 'FAILED', 'PASSED', 'FAILED', 'PASSED', 'FAILED', 'PASSED'];

    for (let i = 0; i < statuses.length; i++) {
        await prisma.testResult.create({
            data: {
                testRunId: run.id,
                testName: 'flaky-auth-test',
                status: statuses[i],
                duration: 100,
                // Simulate time progression
                createdAt: new Date(Date.now() - (1000 * 60 * (statuses.length - i)))
            }
        });
    }

    // 3. Analyze
    console.log('🕵️ Analyzing test history...');
    const stats = await flakyTestService.analyzeTest('flaky-auth-test');

    console.log('📊 Result:', stats);

    // 4. Verification assertions
    if (stats.severity === 'STABLE') {
        throw new Error('Expected test to be detected as flaky (severity LOW/MEDIUM/HIGH), but got STABLE');
    }

    if (stats.flipFlopCount < 3) {
        throw new Error(`Expected at least 3 flip-flops, got ${stats.flipFlopCount}`);
    }

    console.log('✅ Flaky Test Detection Verified!');
}

main()
    .catch(console.error)
    .finally(async () => {
        // Cleanup if needed, but keeping data helps debugging
        await prisma.$disconnect();
    });
