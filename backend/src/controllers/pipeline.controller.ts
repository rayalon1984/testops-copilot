import { Pipeline } from '@/models/pipeline.model';
import { TestRun } from '@/models/testRun.model';
import { NotFoundError, AuthorizationError } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';
import { Pipeline as PipelineType, TestRun as TestRunType, Schedule, MetricsQuery } from '@/middleware/validation';
import { JenkinsService } from '@/services/jenkins.service';
import { GithubService } from '@/services/github.service';
import { NotificationService } from '@/services/notification.service';

export class PipelineController {
  private jenkinsService: JenkinsService;
  private githubService: GithubService;
  private notificationService: NotificationService;

  constructor() {
    this.jenkinsService = new JenkinsService();
    this.githubService = new GithubService();
    this.notificationService = new NotificationService();
  }

  async getAllPipelines(userId: string): Promise<Pipeline[]> {
    const pipelines = await Pipeline.findAll({
      where: { userId },
      include: [{ model: TestRun, limit: 5, order: [['createdAt', 'DESC']] }],
    });
    return pipelines;
  }

  async getPipelineById(id: string, userId: string): Promise<Pipeline> {
    const pipeline = await Pipeline.findOne({
      where: { id },
      include: [{ model: TestRun, limit: 10, order: [['createdAt', 'DESC']] }],
    });

    if (!pipeline) {
      throw new NotFoundError('Pipeline not found');
    }

    if (pipeline.userId !== userId) {
      throw new AuthorizationError('Not authorized to access this pipeline');
    }

    return pipeline;
  }

  async createPipeline(data: PipelineType, userId: string): Promise<Pipeline> {
    // Validate external service connection
    await this.validateExternalService(data);

    const pipeline = await Pipeline.create({
      ...data,
      userId,
    });

    logger.info(`Pipeline created: ${pipeline.id}`);
    return pipeline;
  }

  async updatePipeline(id: string, data: Partial<PipelineType>, userId: string): Promise<Pipeline> {
    const pipeline = await this.getPipelineById(id, userId);

    // Validate external service connection if config is being updated
    if (data.config) {
      await this.validateExternalService({ ...pipeline, ...data });
    }

    await pipeline.update(data);
    logger.info(`Pipeline updated: ${pipeline.id}`);
    return pipeline;
  }

  async deletePipeline(id: string, userId: string): Promise<void> {
    const pipeline = await this.getPipelineById(id, userId);
    await pipeline.destroy();
    logger.info(`Pipeline deleted: ${id}`);
  }

  async runPipeline(id: string, userId: string): Promise<TestRun> {
    const pipeline = await this.getPipelineById(id, userId);
    
    let testRun: TestRun;
    try {
      // Start pipeline execution based on type
      switch (pipeline.type) {
        case 'jenkins':
          testRun = await this.jenkinsService.startPipeline(pipeline);
          break;
        case 'github-actions':
          testRun = await this.githubService.startPipeline(pipeline);
          break;
        case 'custom':
          testRun = await this.runCustomPipeline(pipeline);
          break;
        default:
          throw new Error(`Unsupported pipeline type: ${pipeline.type}`);
      }

      // Send notifications if enabled
      if (pipeline.notifications?.enabled) {
        await this.notificationService.sendPipelineStartNotification(pipeline, testRun);
      }

      logger.info(`Pipeline run started: ${testRun.id}`);
      return testRun;

    } catch (error) {
      logger.error(`Failed to run pipeline: ${pipeline.id}`, error);
      throw error;
    }
  }

  async getPipelineRuns(id: string, userId: string): Promise<TestRun[]> {
    const pipeline = await this.getPipelineById(id, userId);
    return TestRun.findAll({
      where: { pipelineId: pipeline.id },
      order: [['createdAt', 'DESC']],
    });
  }

  async schedulePipeline(id: string, schedule: Schedule, userId: string): Promise<Pipeline> {
    const pipeline = await this.getPipelineById(id, userId);
    await pipeline.update({ schedule });
    logger.info(`Pipeline scheduled: ${pipeline.id}`);
    return pipeline;
  }

  async getPipelineMetrics(id: string, userId: string): Promise<any> {
    const pipeline = await this.getPipelineById(id, userId);
    const runs = await TestRun.findAll({
      where: { pipelineId: pipeline.id },
      order: [['createdAt', 'ASC']],
    });

    return this.calculateMetrics(runs);
  }

  async getSystemMetrics(): Promise<any> {
    const runs = await TestRun.findAll({
      order: [['createdAt', 'ASC']],
    });

    return this.calculateMetrics(runs);
  }

  private async validateExternalService(pipeline: PipelineType): Promise<void> {
    try {
      switch (pipeline.type) {
        case 'jenkins':
          await this.jenkinsService.validateConnection(pipeline.config);
          break;
        case 'github-actions':
          await this.githubService.validateConnection(pipeline.config);
          break;
        case 'custom':
          // Custom validation logic
          break;
      }
    } catch (error) {
      logger.error('External service validation failed:', error);
      throw error;
    }
  }

  private async runCustomPipeline(pipeline: Pipeline): Promise<TestRun> {
    // Implement custom pipeline execution logic
    throw new Error('Custom pipeline execution not implemented');
  }

  private calculateMetrics(runs: TestRun[]): any {
    // Calculate success rate, average duration, flaky tests, etc.
    const totalRuns = runs.length;
    const successfulRuns = runs.filter(run => run.status === 'success').length;
    const failedRuns = runs.filter(run => run.status === 'failure').length;
    const averageDuration = runs.reduce((acc, run) => acc + run.duration, 0) / totalRuns;

    return {
      totalRuns,
      successfulRuns,
      failedRuns,
      successRate: (successfulRuns / totalRuns) * 100,
      averageDuration,
      // Add more metrics as needed
    };
  }
}