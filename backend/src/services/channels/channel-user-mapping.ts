/**
 * Channel User Mapping Service
 *
 * Maps external channel user IDs (Slack, Teams) to internal TestOps users.
 * Used by channel adapters to authenticate and authorize incoming messages.
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '@/utils/logger';

const prisma = new PrismaClient();

export interface ChannelUserInfo {
    userId: string;
    userRole: string;
    displayName?: string;
}

/**
 * Look up an internal user from a channel-specific external ID.
 * Returns null if no mapping exists (user must link their account first).
 */
export async function getChannelUserMapping(
    channel: string,
    externalId: string,
): Promise<ChannelUserInfo | null> {
    try {
        const mapping = await prisma.channelUserMapping.findUnique({
            where: {
                channel_externalId: { channel, externalId },
            },
        });

        if (!mapping) return null;

        // Fetch the internal user's current role
        const user = await prisma.user.findUnique({
            where: { id: mapping.userId },
            select: { id: true, role: true, firstName: true, lastName: true },
        });

        if (!user) {
            logger.warn(`[ChannelMapping] Mapping exists but user ${mapping.userId} not found`);
            return null;
        }

        const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || undefined;

        return {
            userId: user.id,
            userRole: user.role || 'USER',
            displayName,
        };
    } catch (error) {
        logger.error(`[ChannelMapping] Lookup failed for ${channel}:${externalId}:`, error);
        return null;
    }
}

/**
 * Create or update a channel user mapping.
 * Called when a user links their Slack/Teams account in settings.
 */
export async function upsertChannelUserMapping(
    channel: string,
    externalId: string,
    userId: string,
    metadata?: Record<string, unknown>,
): Promise<void> {
    try {
        await prisma.channelUserMapping.upsert({
            where: {
                channel_externalId: { channel, externalId },
            },
            update: { userId, metadata: metadata ? JSON.stringify(metadata) : null },
            create: { channel, externalId, userId, metadata: metadata ? JSON.stringify(metadata) : null },
        });
        logger.info(`[ChannelMapping] Upserted ${channel}:${externalId} → ${userId}`);
    } catch (error) {
        logger.error(`[ChannelMapping] Upsert failed:`, error);
        throw error;
    }
}

/**
 * Remove a channel user mapping.
 */
export async function removeChannelUserMapping(
    channel: string,
    externalId: string,
): Promise<void> {
    try {
        await prisma.channelUserMapping.delete({
            where: {
                channel_externalId: { channel, externalId },
            },
        });
    } catch (error) {
        // Ignore if not found
        logger.debug(`[ChannelMapping] Delete for ${channel}:${externalId}:`, error);
    }
}
