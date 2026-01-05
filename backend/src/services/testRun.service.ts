
import { PrismaClient, TestRun, Prisma } from '@prisma/client';
import { NotFoundError, AuthorizationError } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';

// Reusing the type from validation if possible, otherwise defining here or importing
// Ideally, validation types should be shared. For now, using Partial<TestRun> for creation/update as a base
export interface CreateTestRunDTO {
    pipelineId: string;
    name: string;
    branch?: string;
    commit?: string;
    parameters?: string; // JSON string
    tags?: string; // Comma separated for now (SQLite limitation in schema), or handle as array if schema supports
}

export interface TestRunFilters {
    pipelineId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    branch?: string;
    tags?: string[];
}

export class TestRunService {
    private prisma: PrismaClient;

    constructor() {
        this.prisma = new PrismaClient();
    }

    async getAllTestRuns(userId: string, filters: TestRunFilters): Promise<TestRun[]> {
        const where: Prisma.TestRunWhereInput = { userId };

        if (filters.pipelineId) {
            where.pipelineId = filters.pipelineId;
        }

        if (filters.status) {
            where.status = filters.status as any;
        }

        if (filters.branch) {
            where.branch = filters.branch;
        }

        // Note: SQLite schema in prisma uses a String for tags, not array.
        if (filters.tags && filters.tags.length > 0) {
            // Simple implementation for comma-separated string tags
            // This is a limitation of the current schema design for SQLite
            // @ts-expect-error - OR usage matches Prisma generic types but strict TS might complain
            where.OR = filters.tags.map(tag => ({
                tags: { contains: tag }
            }));
        }

        if (filters.startDate || filters.endDate) {
            where.createdAt = {};
            if (filters.startDate) {
                where.createdAt.gte = new Date(filters.startDate);
            }
            if (filters.endDate) {
                where.createdAt.lte = new Date(filters.endDate);
            }
        }

        return this.prisma.testRun.findMany({
            where,
            include: {
                pipeline: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
    }

    async getTestRunById(id: string, userId: string): Promise<TestRun> {
        const testRun = await this.prisma.testRun.findUnique({
            where: { id },
            include: {
                pipeline: true,
            },
        });

        if (!testRun) {
            throw new NotFoundError('Test run not found');
        }

        if (testRun.userId !== userId) {
            throw new AuthorizationError('Not authorized to access this test run');
        }

        return testRun;
    }

    async createTestRun(data: CreateTestRunDTO, userId: string): Promise<TestRun> {
        // Verify pipeline exists
        // Note: Production schema does not associate pipelines with users directly
        const pipeline = await this.prisma.pipeline.findFirst({
            where: {
                id: data.pipelineId,
            },
        });

        if (!pipeline) {
            throw new NotFoundError('Pipeline not found');
        }

        const testRun = await this.prisma.testRun.create({
            data: {
                ...data,
                userId,
                status: 'PENDING',
                startedAt: new Date(),
                // Ensure other required fields are handled if missing in DTO
            },
        });

        logger.info(`Test run created: ${testRun.id}`);
        return testRun;
    }

    async cancelTestRun(id: string, userId: string): Promise<TestRun> {
        const testRun = await this.getTestRunById(id, userId);

        if (!['PENDING', 'RUNNING'].includes(testRun.status)) {
            throw new Error('Can only cancel pending or running test runs');
        }

        // 'CANCELLED' is not in standard TestStatus enum, mapping to FAILED
        const updatedTestRun = await this.prisma.testRun.update({
            where: { id },
            data: {
                status: 'FAILED',
                completedAt: new Date(),
            },
        });

        logger.info(`Test run cancelled: ${testRun.id}`);
        return updatedTestRun;
    }

    async retryTestRun(id: string, userId: string): Promise<TestRun> {
        const originalRun = await this.getTestRunById(id, userId);

        // schema supports: PENDING, RUNNING, PASSED, FAILED, SKIPPED, FLAKY
        if (!['FAILED', 'SKIPPED', 'FLAKY'].includes(originalRun.status)) {
            throw new Error('Can only retry failed, skipped, or flaky test runs');
        }

        const newTestRun = await this.prisma.testRun.create({
            data: {
                pipelineId: originalRun.pipelineId,
                userId,
                name: originalRun.name,
                status: 'PENDING',
                startedAt: new Date(),
                branch: originalRun.branch,
                commit: originalRun.commit,
            },
        });

        logger.info(`Test run retry created: ${newTestRun.id}`);
        return newTestRun;
    }

    async deleteTestRun(id: string): Promise<void> {
        // We need to check existence but usually we can just deleteMany or delete
        const testRun = await this.prisma.testRun.findUnique({ where: { id } });
        if (!testRun) {
            throw new NotFoundError('Test run not found');
        }
        await this.prisma.testRun.delete({ where: { id } });
        logger.info(`Test run deleted: ${id}`);
    }
}
