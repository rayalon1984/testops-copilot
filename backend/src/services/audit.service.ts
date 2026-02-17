import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

const prismaClient = prisma as any;

export class AuditService {
    /**
     * Log an action to the audit log asynchronously.
     * We don't await this in the main flow to avoid blocking response times.
     */
    async log(
        action: string,
        entityType: string,
        entityId: string,
        userId: string,
        metadata?: Record<string, any>
    ): Promise<void> {
        try {
            await prismaClient.auditLog.create({
                data: {
                    action,
                    entityType,
                    entityId,
                    userId,
                    metadata: metadata || {},
                },
            });
        } catch (error) {
            // enhanced error logging for audit failures
            logger.error('Failed to create audit log', {
                action,
                entityType,
                entityId,
                userId,
                error,
            });
            // We do NOT throw here to prevent blocking the main user action
        }
    }

    /**
     * Retrieve audit logs with optional filtering
     */
    async getLogs(params: {
        entityType?: string;
        entityId?: string;
        userId?: string;
        limit?: number;
        offset?: number;
    }) {
        const { entityType, entityId, userId, limit = 50, offset = 0 } = params;

        return prismaClient.auditLog.findMany({
            where: {
                entityType,
                entityId,
                userId,
            },
            orderBy: {
                createdAt: 'desc',
            },
            take: limit,
            skip: offset,
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                    },
                },
            },
        });
    }
}

export const auditService = new AuditService();
