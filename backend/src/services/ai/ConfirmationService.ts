/**
 * ConfirmationService — Human-in-the-Loop for Write Tools
 *
 * Manages pending actions that require user approval before execution.
 * All pending actions are persisted in the database for audit trail,
 * horizontal scaling, and crash recovery.
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/utils/logger';

// ─── Types ───

export interface CreatePendingActionInput {
    sessionId: string;
    userId: string;
    toolName: string;
    parameters: Record<string, unknown>;
}

export interface PendingActionSummary {
    id: string;
    sessionId: string;
    toolName: string;
    parameters: Record<string, unknown>;
    status: string;
    createdAt: Date;
    resolvedAt: Date | null;
}

export type ActionStatus = 'PENDING' | 'APPROVED' | 'DENIED' | 'EXPIRED';

// ─── Action Expiry ───

/** Pending actions expire after 5 minutes */
const ACTION_TTL_MS = 5 * 60 * 1000;

// ─── Service Functions ───

/**
 * Create a pending action and pause the ReAct loop.
 * Returns the action ID for the frontend to reference.
 */
export async function createPendingAction(input: CreatePendingActionInput): Promise<PendingActionSummary> {
    try {
        const action = await prisma.pendingAction.create({
            data: {
                sessionId: input.sessionId,
                userId: input.userId,
                toolName: input.toolName,
                parameters: JSON.stringify(input.parameters),
                status: 'PENDING',
            },
        });

        logger.info(`[Confirmation] Created pending action ${action.id} for tool '${input.toolName}'`);

        return {
            id: action.id,
            sessionId: action.sessionId,
            toolName: action.toolName,
            parameters: input.parameters,
            status: action.status,
            createdAt: action.createdAt,
            resolvedAt: null,
        };
    } catch (error) {
        logger.error('[Confirmation] Failed to create pending action:', error);
        throw error;
    }
}

/**
 * Resolve a pending action (approve or deny).
 * Returns the resolved action with updated status.
 */
export async function resolveAction(
    actionId: string,
    userId: string,
    approved: boolean
): Promise<PendingActionSummary> {
    const action = await prisma.pendingAction.findUnique({
        where: { id: actionId },
    });

    if (!action) {
        throw new Error(`Pending action ${actionId} not found`);
    }

    if (action.status !== 'PENDING') {
        throw new Error(`Action ${actionId} already resolved (status: ${action.status})`);
    }

    // Check expiry
    const age = Date.now() - action.createdAt.getTime();
    if (age > ACTION_TTL_MS) {
        await prisma.pendingAction.update({
            where: { id: actionId },
            data: { status: 'EXPIRED', resolvedAt: new Date() },
        });
        throw new Error(`Action ${actionId} expired (${Math.round(age / 1000)}s old)`);
    }

    const newStatus: ActionStatus = approved ? 'APPROVED' : 'DENIED';

    const updated = await prisma.pendingAction.update({
        where: { id: actionId },
        data: {
            status: newStatus,
            resolvedAt: new Date(),
            resolvedBy: userId,
        },
    });

    logger.info(`[Confirmation] Action ${actionId} ${newStatus} by user ${userId}`);

    return {
        id: updated.id,
        sessionId: updated.sessionId,
        toolName: updated.toolName,
        parameters: JSON.parse(updated.parameters),
        status: updated.status,
        createdAt: updated.createdAt,
        resolvedAt: updated.resolvedAt,
    };
}

/**
 * Get all pending actions for a session.
 */
export async function getSessionPendingActions(sessionId: string): Promise<PendingActionSummary[]> {
    const actions = await prisma.pendingAction.findMany({
        where: { sessionId, status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
    });

    return actions.map(a => ({
        id: a.id,
        sessionId: a.sessionId,
        toolName: a.toolName,
        parameters: JSON.parse(a.parameters),
        status: a.status,
        createdAt: a.createdAt,
        resolvedAt: a.resolvedAt,
    }));
}

/**
 * Expire stale pending actions (cleanup job).
 */
export async function expireStaleActions(): Promise<number> {
    const cutoff = new Date(Date.now() - ACTION_TTL_MS);

    const result = await prisma.pendingAction.updateMany({
        where: {
            status: 'PENDING',
            createdAt: { lt: cutoff },
        },
        data: {
            status: 'EXPIRED',
            resolvedAt: new Date(),
        },
    });

    if (result.count > 0) {
        logger.info(`[Confirmation] Expired ${result.count} stale pending actions`);
    }

    return result.count;
}
