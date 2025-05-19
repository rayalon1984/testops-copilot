import { Op } from 'sequelize';
import { TestRun } from '@/models/testRun.model';
import { Pipeline } from '@/models/pipeline.model';
import { NotFoundError, AuthorizationError } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';
import { TestRun as TestRunType } from '@/middleware/validation';

interface TestRunFilters {
  pipelineId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  branch?: string;
  tags?: string[];
}

export class TestRunController {
  async getAllTestRuns(userId: string, filters: TestRunFilters): Promise<TestRun[]> {
    const where: any = { userId };

    if (filters.pipelineId) {
      where.pipelineId = filters.pipelineId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.branch) {
      where.branch = filters.branch;
    }

    if (filters.tags) {
      where.tags = { [Op.overlap]: filters.tags };
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt[Op.gte] = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.createdAt[Op.lte] = new Date(filters.endDate);
      }
    }

    const testRuns = await TestRun.findAll({
      where,
      include: [{ model: Pipeline, as: 'pipeline' }],
      order: [['createdAt', 'DESC']],
    });

    return testRuns;
  }

  async getTestRunById(id: string, userId: string): Promise<TestRun> {
    const testRun = await TestRun.findOne({
      where: { id },
      include: [{ model: Pipeline, as: 'pipeline' }],
    });

    if (!testRun) {
      throw new NotFoundError('Test run not found');
    }

    if (testRun.userId !== userId) {
      throw new AuthorizationError('Not authorized to access this test run');
    }

    return testRun;
  }

  async createTestRun(data: TestRunType, userId: string): Promise<TestRun> {
    // Verify pipeline exists and user has access
    const pipeline = await Pipeline.findOne({
      where: { id: data.pipelineId, userId },
    });

    if (!pipeline) {
      throw new NotFoundError('Pipeline not found');
    }

    const testRun = await TestRun.create({
      ...data,
      userId,
      status: 'pending',
      startTime: new Date(),
    });

    logger.info(`Test run created: ${testRun.id}`);
    return testRun;
  }

  async cancelTestRun(id: string, userId: string): Promise<TestRun> {
    const testRun = await this.getTestRunById(id, userId);

    if (!['pending', 'running'].includes(testRun.status)) {
      throw new Error('Can only cancel pending or running test runs');
    }

    await testRun.update({
      status: 'cancelled',
      endTime: new Date(),
    });

    logger.info(`Test run cancelled: ${testRun.id}`);
    return testRun;
  }

  async retryTestRun(id: string, userId: string): Promise<TestRun> {
    const originalRun = await this.getTestRunById(id, userId);

    if (!['failure', 'cancelled', 'timeout'].includes(originalRun.status)) {
      throw new Error('Can only retry failed, cancelled, or timed out test runs');
    }

    if (originalRun.retryCount >= 5) {
      throw new Error('Maximum retry attempts reached');
    }

    const newTestRun = await TestRun.create({
      pipelineId: originalRun.pipelineId,
      userId,
      status: 'pending',
      startTime: new Date(),
      branch: originalRun.branch,
      parameters: originalRun.parameters,
      retryCount: (originalRun.retryCount || 0) + 1,
      tags: originalRun.tags,
    });

    logger.info(`Test run retry created: ${newTestRun.id}`);
    return newTestRun;
  }

  async getTestRunLogs(id: string, userId: string): Promise<string> {
    const testRun = await this.getTestRunById(id, userId);
    return testRun.logs || '';
  }

  async getTestRunArtifacts(id: string, userId: string): Promise<any[]> {
    const testRun = await this.getTestRunById(id, userId);
    
    // TODO: Implement artifact storage and retrieval
    return [];
  }

  async deleteTestRun(id: string): Promise<void> {
    const testRun = await TestRun.findByPk(id);
    if (!testRun) {
      throw new NotFoundError('Test run not found');
    }

    await testRun.destroy();
    logger.info(`Test run deleted: ${id}`);
  }

  async getSystemMetrics(): Promise<any> {
    const [
      totalRuns,
      successfulRuns,
      failedRuns,
      averageDuration,
      flakyTests,
    ] = await Promise.all([
      TestRun.count(),
      TestRun.count({ where: { status: 'success' } }),
      TestRun.count({ where: { status: 'failure' } }),
      this.calculateAverageDuration(),
      this.identifyFlakyTests(),
    ]);

    return {
      totalRuns,
      successfulRuns,
      failedRuns,
      successRate: (successfulRuns / totalRuns) * 100,
      averageDuration,
      flakyTests,
    };
  }

  private async calculateAverageDuration(): Promise<number> {
    const result = await TestRun.findAll({
      where: {
        duration: { [Op.not]: null },
      },
      attributes: [
        [sequelize.fn('AVG', sequelize.col('duration')), 'averageDuration'],
      ],
    });

    return result[0].getDataValue('averageDuration') || 0;
  }

  private async identifyFlakyTests(): Promise<any[]> {
    // TODO: Implement flaky test detection logic
    // This would involve analyzing test results across multiple runs
    // to identify tests that alternate between passing and failing
    return [];
  }
}