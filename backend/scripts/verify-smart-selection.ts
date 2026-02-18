
import { testImpactService } from '../src/services/test/TestImpactService';

async function main() {
    console.log('🚀 Verifying Smart Test Selection...');

    const cases = [
        {
            name: 'Direct Test Change',
            files: ['backend/src/services/__tests__/auth.service.test.ts'],
            expected: ['auth.service.test.ts']
        },
        {
            name: 'Source File Change',
            files: ['backend/src/services/auth.service.ts'],
            expected: ['backend/src/services/__tests__/auth.service.test.ts']
        },
        {
            name: 'Global Change',
            files: ['backend/package.json'],
            expected: ['ALL']
        },
        {
            name: 'Mixed Changes',
            files: ['backend/src/services/user.service.ts', 'backend/src/utils/logger.ts'],
            expected: [
                'backend/src/services/__tests__/user.service.test.ts',
                'backend/src/utils/__tests__/logger.test.ts'
            ]
        }
    ];

    for (const c of cases) {
        console.log(`\n📋 Case: ${c.name}`);
        const result = await testImpactService.getTestsForChanges(c.files);
        console.log(`   Input: ${c.files}`);
        console.log(`   Output: ${result.selectedTests}`);

        // Simple assertion
        const success = JSON.stringify(result.selectedTests.sort()) === JSON.stringify(c.expected.sort());
        if (success) console.log('   ✅ PASS');
        else {
            console.log('   ❌ FAIL');
            console.error(`   Expected: ${c.expected}`);
            console.error(`   Got: ${result.selectedTests}`);
            // Don't exit, just log
        }
    }
}

main();
