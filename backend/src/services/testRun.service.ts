
import { TestRun, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { NotFoundError, AuthorizationError, ValidationError } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';
import { config } from '@/config';
import { xrayService } from '@/services/xray.service';

/** Valid terminal statuses for completing a test run. */
const VALID_COMPLETION_STATUSES = ['PASSED', 'FAILED', 'SKIPPED', 'FLAKY'] as const;

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

const STATUS_MAP: Record<string, string> = {
    'PASSED': 'success',
    'FAILED': 'failed',
    'RUNNING': 'running',
    'PENDING': 'pending',
    'SKIPPED': 'skipped',
    'FLAKY': 'flaky'
};

export interface FormattedTestRun {
    id: string;
    pipelineId: string;
    pipelineName: string;
    status: string;
    startTime: string;
    endTime: string;
    duration: number;
    errorCount: number;
    errorLogs?: string[];
    screenshots: string[];
}

export class TestRunService {

    async getFormattedTestRuns(userId: string): Promise<FormattedTestRun[]> {
        const testRuns = await prisma.testRun.findMany({
            where: { userId },
            include: {
                pipeline: true,
                results: { select: { status: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });

        return testRuns.map(run => {
            const failed = run.results?.filter((r: { status: string }) => r.status === 'FAILED').length || 0;
            return {
                id: run.id,
                pipelineId: run.pipelineId,
                pipelineName: run.pipeline?.name || 'Unknown Pipeline',
                status: STATUS_MAP[run.status] || 'pending',
                startTime: run.startedAt?.toISOString() || run.createdAt.toISOString(),
                endTime: run.completedAt?.toISOString() || run.createdAt.toISOString(),
                duration: run.duration || 0,
                errorCount: failed,
                screenshots: [],
            };
        });
    }

    async getFormattedTestRunById(id: string, userId: string): Promise<FormattedTestRun> {
        const testRun = await prisma.testRun.findFirst({
            where: { id, userId },
            include: { pipeline: true, results: true },
        });

        if (!testRun) {
            throw new NotFoundError('Test run not found');
        }

        const failed = testRun.results?.filter((r: { status: string }) => r.status === 'FAILED').length || 0;
        const errorLogs = testRun.results
            ?.filter((r: { status: string; error?: string | null }) => r.status === 'FAILED' && r.error)
            .map((r: { error?: string | null }) => r.error!) || [];

        return {
            id: testRun.id,
            pipelineId: testRun.pipelineId,
            pipelineName: testRun.pipeline?.name || 'Unknown Pipeline',
            status: STATUS_MAP[testRun.status] || 'pending',
            startTime: testRun.startedAt?.toISOString() || testRun.createdAt.toISOString(),
            endTime: testRun.completedAt?.toISOString() || testRun.createdAt.toISOString(),
            duration: testRun.duration || 0,
            errorCount: failed,
            errorLogs,
            screenshots: [],
        };
    }

    async getAllTestRuns(userId: string, filters: TestRunFilters): Promise<TestRun[]> {
        const where: Prisma.TestRunWhereInput = { userId };

        if (filters.pipelineId) {
            where.pipelineId = filters.pipelineId;
        }

        if (filters.status) {
            where.status = filters.status as Prisma.TestRunWhereInput['status'];
        }

        if (filters.branch) {
            where.branch = filters.branch;
        }

        // Note: SQLite schema in prisma uses a String for tags, not array.
        if (filters.tags && filters.tags.length > 0) {
            // Simple implementation for comma-separated string tags
            // This is a limitation of the current schema design for SQLite
            // @ts-expect-error - Prisma StringFilter on `tags` field is valid but strict TS rejects the OR shape
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

        return prisma.testRun.findMany({
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
        const testRun = await prisma.testRun.findUnique({
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
        const pipeline = await prisma.pipeline.findFirst({
            where: {
                id: data.pipelineId,
            },
        });

        if (!pipeline) {
            throw new NotFoundError('Pipeline not found');
        }

        const testRun = await prisma.testRun.create({
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
        const updatedTestRun = await prisma.testRun.update({
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

        const newTestRun = await prisma.testRun.create({
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

    /**
     * Transition a test run to COMPLETED (or given status) and trigger auto-sync if enabled.
     * Fire-and-forget: auto-sync never blocks the completion response.
     */
    async completeTestRun(id: string, userId: string, status: string = 'PASSED'): Promise<TestRun> {
        if (!(VALID_COMPLETION_STATUSES as readonly string[]).includes(status)) {
            throw new ValidationError(`Invalid completion status: ${status}. Must be one of: ${VALID_COMPLETION_STATUSES.join(', ')}`);
        }

        const testRun = await this.getTestRunById(id, userId);

        if (!['PENDING', 'RUNNING'].includes(testRun.status)) {
            throw new ValidationError('Can only complete pending or running test runs');
        }

        const updatedTestRun = await prisma.testRun.update({
            where: { id },
            data: {
                status: status as TestRun['status'],
                completedAt: new Date(),
            },
        });

        logger.info(`Test run completed: ${id} (status: ${status})`);

        // Auto-sync to Xray (fire-and-forget — never blocks completion)
        if (config.xray?.autoSync && xrayService.isEnabled()) {
            xrayService.syncTestRun(id, 'AUTO').catch((err) => {
                logger.warn('Auto-sync to Xray failed', { testRunId: id, error: (err as Error).message });
            });
        }

        return updatedTestRun;
    }

    async deleteTestRun(id: string): Promise<void> {
        // We need to check existence but usually we can just deleteMany or delete
        const testRun = await prisma.testRun.findUnique({ where: { id } });
        if (!testRun) {
            throw new NotFoundError('Test run not found');
        }
        await prisma.testRun.delete({ where: { id } });
        logger.info(`Test run deleted: ${id}`);
    }
}
