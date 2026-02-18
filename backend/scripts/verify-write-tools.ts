
import { PrismaClient } from '@prisma/client';
import * as confirmationService from '../src/services/ai/ConfirmationService';
import { toolRegistry } from '../src/services/ai/tools';
import { jiraCreateIssueTool } from '../src/services/ai/tools/jira-write';

// Initialize services
const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Starting Write Tool Verification...');

    // 1. Register tool if needed
    if (!toolRegistry.get('jira_create_issue')) {
        toolRegistry.register(jiraCreateIssueTool);
    }

    if (!toolRegistry.get('github_create_pr')) {
        toolRegistry.register({
            name: 'github_create_pr',
            description: 'mock',
            category: 'github',
            requiresConfirmation: true,
            parameters: [
                { name: 'title', type: 'string', required: true, description: 'Mock title' }
            ],
            execute: async () => ({ success: true, summary: 'Done' })
        });
    }

    // 2. Create prerequisite data (User + Session)
    console.log('👤 Creating test user and session...');
    const user = await prisma.user.create({
        data: {
            email: `test-user-${Date.now()}@example.com`,
            password: 'password123',
            role: 'ADMIN'
        }
    });

    const session = await prisma.chatSession.create({
        data: {
            userId: user.id,
            title: 'Verification Session'
        }
    });

    const userId = user.id;
    const sessionId = session.id;

    try {
        // 3. Create a pending action
        console.log('📝 Creating pending action...');

        const action = await confirmationService.createPendingAction({
            sessionId,
            userId,
            toolName: 'jira_create_issue',
            parameters: {
                summary: 'Test Issue from Verification Script',
                description: 'This is a test issue.',
                type: 'BUG'
            }
        });

        console.log(`✅ Pending action created: ${action.id}`);

        // 4. Verify it's in PENDING state
        if (action.status !== 'PENDING') {
            throw new Error(`Expected PENDING status, got ${action.status}`);
        }

        // 5. Confirm the action
        console.log('👍 Confirming action...');
        const resolved = await confirmationService.resolveAction(action.id, userId, true);

        console.log(`✅ Action resolved: ${resolved.status}`);

        if (resolved.status !== 'APPROVED') {
            throw new Error(`Expected APPROVED status, got ${resolved.status}`);
        }

        // 6. Deny flow
        console.log('📝 Creating another pending action for denial...');
        const action2 = await confirmationService.createPendingAction({
            sessionId,
            userId,
            toolName: 'github_create_pr',
            parameters: { title: 'Bad PR' }
        });

        console.log('👎 Denying action...');
        const denied = await confirmationService.resolveAction(action2.id, userId, false);

        if (denied.status !== 'DENIED') {
            throw new Error(`Expected DENIED status, got ${denied.status}`);
        }

        console.log('🎉 Verification Successful! The ConfirmationService logic is sound.');

    } catch (err) {
        console.error('❌ Verification Failed:', err);
        process.exit(1);
    } finally {
        // Cleanup
        console.log('🧹 Cleaning up...');
        await prisma.pendingAction.deleteMany({ where: { sessionId } });
        await prisma.chatSession.delete({ where: { id: sessionId } });
        await prisma.user.delete({ where: { id: userId } });
        await prisma.$disconnect();
    }
}

main();
