import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

const prismaClient = prisma as unknown as {
    auditLog: {
        create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
        findMany: (args: Record<string, unknown>) => Promise<unknown[]>;
    };
};

export class AuditService {
    /**
     * Log an action to the audit log asynchronously.
     * We don't await this in the main flow to avoid blocking response times.
     */
    /**
     * Log an action to the audit log asynchronously.
     */
    async log(
        action: string,
        entityType: string,
        entityId: string,
        userId: string,
        metadata?: Record<string, unknown>,
        reqInfo?: { ip?: string; userAgent?: string }
    ): Promise<void> {
        try {
            const safeMetadata = this.redactMetadata(metadata || {});

            // Add request info to metadata if provided
            if (reqInfo) {
                if (reqInfo.ip) safeMetadata.ip = reqInfo.ip;
                if (reqInfo.userAgent) safeMetadata.userAgent = reqInfo.userAgent;
            }

            await prismaClient.auditLog.create({
                data: {
                    action,
                    entityType,
                    entityId,
                    userId,
                    metadata: JSON.stringify(safeMetadata),
                },
            });
        } catch (error) {
            logger.error('Failed to create audit log', {
                action,
                entityType,
                entityId,
                userId,
                error,
            });
        }
    }

    /**
     * Redact sensitive information from metadata
     */
    private redactMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
        const sensitiveKeys = ['password', 'token', 'secret', 'authorization', 'cookie', 'key', 'accessToken', 'refreshToken'];
        const redacted: Record<string, unknown> = { ...metadata };

        for (const key in redacted) {
            if (Object.prototype.hasOwnProperty.call(redacted, key)) {
                if (sensitiveKeys.some(k => key.toLowerCase().includes(k))) {
                    redacted[key] = '***REDACTED***';
                } else if (typeof redacted[key] === 'object' && redacted[key] !== null) {
                    redacted[key] = this.redactMetadata(redacted[key] as Record<string, unknown>);
                }
            }
        }

        return redacted;
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
