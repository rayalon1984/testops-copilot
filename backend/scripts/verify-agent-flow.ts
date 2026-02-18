
import { handleChatStream, ChatRequest } from '../src/services/ai/AIChatService';
import { initializeAI, shutdownAI } from '../src/services/ai/manager';
import { Response } from 'express';
import { prisma } from '../src/lib/prisma';

// Mock Response
class MockResponse {
    writableEnded = false;

    write(chunk: string) {
        console.log('SSE Chunk:', chunk.trim());
    }

    end() {
        this.writableEnded = true;
        console.log('Stream ended');
    }
}

// Mock Pool
const mockPool = {
    connect: async () => ({
        query: async () => ({ rows: [] }),
        release: () => { },
    }),
    query: async () => ({ rows: [] }),
    end: async () => { },
    on: () => { },
} as any;

async function setupTestData() {
    console.log('🛠 Setting up test data...');
    let user = await prisma.user.findFirst();
    if (!user) {
        user = await prisma.user.create({
            data: {
                email: 'test-agent@example.com',
                password: 'password',
                role: 'ADMIN',
                firstName: 'Test',
                lastName: 'Agent',
            }
        });
        console.log('Created test user:', user.id);
    } else {
        console.log('Using existing user:', user.id);
    }

    const session = await prisma.chatSession.create({
        data: {
            userId: user.id,
            title: 'Verification Session ' + new Date().toISOString(),
        }
    });
    console.log('Created test session:', session.id);

    return { userId: user.id, sessionId: session.id };
}

async function main() {
    console.log('🚀 Starting Agent Flow Verification...');

    // Initialize AI with mock DB pool (for AIManager/CostTracker)
    await initializeAI({ db: mockPool });

    // Setup real DB data for ConfirmationService
    const { userId, sessionId } = await setupTestData();

    const req: ChatRequest = {
        userId,
        userRole: 'engineer',
        sessionId,
        message: 'Create a Jira ticket for the last failure',
    };

    const res = new MockResponse() as unknown as Response;

    console.log(`\n💬 Sending message: "${req.message}"\n`);

    try {
        await handleChatStream(req, res);
    } catch (error) {
        console.error('HandleChatStream error:', error);
    }

    await shutdownAI();
}

main().catch(console.error);
