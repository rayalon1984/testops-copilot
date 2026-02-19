/**
 * ChatSessionService — CRUD for AI Copilot chat persistence
 *
 * Manages chat sessions and messages in the database.
 * Sessions auto-title from the first user message.
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/utils/logger';

export interface CreateSessionInput {
    id?: string;
    userId: string;
    title?: string;
}

export interface SaveMessageInput {
    sessionId: string;
    role: string;
    content: string;
    toolName?: string;
}

export interface SessionSummary {
    id: string;
    title: string;
    createdAt: Date;
    updatedAt: Date;
    messageCount: number;
}


/**
 * Create a new chat session for a user.
 */
export async function createSession(input: CreateSessionInput) {
    try {
        const session = await prisma.chatSession.create({
            data: {
                id: input.id, // Optional: use provided ID or generate new
                userId: input.userId,
                title: input.title || 'New Chat',
            },
        });
        logger.info(`[ChatSession] Created session ${session.id} for user ${input.userId}`);
        return session;
    } catch (error) {
        logger.error('[ChatSession] Failed to create session:', error);
        throw error;
    }
}

/**
 * Ensure a session exists (create if missing).
 */
export async function ensureSession(sessionId: string, userId: string) {
    const existing = await prisma.chatSession.findUnique({
        where: { id: sessionId },
    });

    if (existing) {
        return existing;
    }

    return createSession({
        id: sessionId,
        userId,
        title: 'New Chat',
    });
}


/**
 * Get all sessions for a user (newest first), with message count.
 */
export async function getUserSessions(userId: string): Promise<SessionSummary[]> {
    const sessions = await prisma.chatSession.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        include: {
            _count: { select: { messages: true } },
        },
    });

    return sessions.map(s => ({
        id: s.id,
        title: s.title,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        messageCount: s._count.messages,
    }));
}

/**
 * Get a session with all its messages.
 */
export async function getSessionWithMessages(sessionId: string, userId: string) {
    const session = await prisma.chatSession.findFirst({
        where: { id: sessionId, userId },
        include: {
            messages: { orderBy: { createdAt: 'asc' } },
        },
    });
    return session;
}

/**
 * Save a message to a session. Also updates the session title
 * from the first user message if it's still "New Chat".
 */
export async function saveMessage(input: SaveMessageInput) {
    const message = await prisma.chatMessage.create({
        data: {
            sessionId: input.sessionId,
            role: input.role,
            content: input.content,
            toolName: input.toolName,
        },
    });

    // Auto-title: use first user message (truncated) as session title
    if (input.role === 'user') {
        const session = await prisma.chatSession.findUnique({
            where: { id: input.sessionId },
        });
        if (session && session.title === 'New Chat') {
            const title = input.content.length > 60
                ? input.content.substring(0, 57) + '...'
                : input.content;
            await prisma.chatSession.update({
                where: { id: input.sessionId },
                data: { title },
            });
        }
    }

    // Touch the session's updatedAt
    await prisma.chatSession.update({
        where: { id: input.sessionId },
        data: { updatedAt: new Date() },
    });

    return message;
}

/**
 * Delete a session and all its messages (cascade).
 */
export async function deleteSession(sessionId: string, userId: string) {
    const session = await prisma.chatSession.findFirst({
        where: { id: sessionId, userId },
    });
    if (!session) {
        throw new Error('Session not found');
    }
    await prisma.chatSession.delete({ where: { id: sessionId } });
    logger.info(`[ChatSession] Deleted session ${sessionId}`);
}
