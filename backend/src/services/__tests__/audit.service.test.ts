
import { auditService } from '../audit.service';
import { prisma } from '../../lib/prisma';
import { logger } from '../../utils/logger';

// Mock prisma
jest.mock('../../lib/prisma', () => ({
    prisma: {
        auditLog: {
            create: jest.fn(),
            findMany: jest.fn(),
        },
    },
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
    logger: {
        error: jest.fn(),
        info: jest.fn(),
    }
}));

const prismaMock = prisma as any;

describe('AuditService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('log', () => {
        it('should create an audit log entry', async () => {
            const mockData = {
                action: 'TEST_ACTION',
                entityType: 'TestEntity',
                entityId: '123',
                userId: 'user-123',
                metadata: { foo: 'bar' },
            };

            (prismaMock.auditLog.create as jest.Mock).mockResolvedValue({ id: 'log-1', ...mockData });

            await auditService.log(
                mockData.action,
                mockData.entityType,
                mockData.entityId,
                mockData.userId,
                mockData.metadata
            );

            expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
                data: {
                    action: mockData.action,
                    entityType: mockData.entityType,
                    entityId: mockData.entityId,
                    userId: mockData.userId,
                    metadata: mockData.metadata,
                },
            });
            expect(logger.error).not.toHaveBeenCalled();
        });

        it('should log an error if creation fails but not throw', async () => {
            const mockError = new Error('DB Error');
            (prismaMock.auditLog.create as jest.Mock).mockRejectedValue(mockError);

            await auditService.log('ACTION', 'Type', 'id', 'user');

            expect(prismaMock.auditLog.create).toHaveBeenCalled();
            expect(logger.error).toHaveBeenCalledWith('Failed to create audit log', expect.any(Object));
        });
    });

    describe('getLogs', () => {
        it('should retrieve logs with filters', async () => {
            const filters = { entityType: 'Pipeline', limit: 10 };
            const mockLogs = [{ id: '1', action: 'CREATE' }];

            (prismaMock.auditLog.findMany as jest.Mock).mockResolvedValue(mockLogs);

            const result = await auditService.getLogs(filters);

            expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({
                where: { entityType: 'Pipeline' },
                take: 10,
                include: { user: expect.any(Object) }
            }));
            expect(result).toEqual(mockLogs);
        });
    });
});
