import { PrismaClient } from '@prisma/client';
import { GitHubService } from '../services/github.service';
import { AuthorizationError, NotFoundError } from '../middleware/errorHandler';
import {
  CreatePipelineDTO,
  UpdatePipelineDTO,
  PipelineFilters,
  toPipeline
} from '../types/pipeline';
import { PipelineStatus, TestStatus, PipelineType } from '../constants';
import {
  createPipelineInput,
  updatePipelineInput,
  parsePipelineConfig,
  toInputJsonValue
} from '../utils/prismaHelpers';

const prisma = new PrismaClient();

export class PipelineController {
  private githubService: GitHubService;

  constructor() {
    this.githubService = new GitHubService();
  }

  async listPipelines(userId: string, filters?: PipelineFilters) {
    const where = {
      // userId, // Removed
      ...(filters?.type && { type: filters.type }),
      // ...(filters?.status && { status: filters.status }) // Removed status
    };

    const prismaPipelines = await prisma.pipeline.findMany({
      where,
      include: {
        testRuns: {
          orderBy: { createdAt: 'desc' },
          take: 20
        }
      }
    });

    // Transform to frontend format with calculated success rate
    return prismaPipelines.map(pipeline => {
      const testRuns = pipeline.testRuns || [];
      const lastRun = testRuns.length > 0 ? testRuns[0].createdAt.toISOString() : new Date().toISOString();

      // Calculate success rate
      const totalRuns = testRuns.length;
      const passedRuns = testRuns.filter(run => run.status === 'PASSED').length;
      const successRate = totalRuns > 0 ? Math.round((passedRuns / totalRuns) * 100) : 0;

      // Map status
      const lastRunStatus = testRuns.length > 0 ? testRuns[0].status : 'PENDING';
      const statusMap: Record<string, string> = {
        'PASSED': 'success',
        'FAILED': 'failed',
        'RUNNING': 'running',
        'PENDING': 'pending'
      };

      return {
        id: pipeline.id,
        name: pipeline.name,
        type: pipeline.type.toLowerCase().replace('_', '-') as 'jenkins' | 'github-actions',
        status: statusMap[lastRunStatus] || 'pending',
        lastRun,
        successRate,
        config: typeof pipeline.config === 'string' ? JSON.parse(pipeline.config) : pipeline.config
      };
    });
  }

  async getPipeline(id: string, userId: string) {
    const prismaPipeline = await prisma.pipeline.findUnique({
      where: { id },
      include: {
        testRuns: {
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      }
    });

    if (!prismaPipeline) {
      throw new NotFoundError('Pipeline not found');
    }

    // if (prismaPipeline.userId !== userId) {
    //   throw new AuthorizationError('Not authorized to access this pipeline');
    // }

    // Convert Prisma pipeline to our Pipeline type
    return toPipeline(prismaPipeline);
  }

  async createPipeline(data: CreatePipelineDTO, userId: string) {
    // Validate connection before creating
    await this.githubService.validateConnection(data.config);

    const createData = createPipelineInput({
      ...data,
      // userId, // Removed
      // status: PipelineStatus.PENDING // Removed
    });

    const prismaPipeline = await prisma.pipeline.create({
      data: createData
    });

    // Convert Prisma pipeline to our Pipeline type
    return toPipeline(prismaPipeline);
  }

  async updatePipeline(id: string, data: UpdatePipelineDTO, userId: string) {
    const pipeline = await this.getPipeline(id, userId);

    if (data.config) {
      await this.githubService.validateConnection(data.config);
    }

    const updateData = updatePipelineInput(data);

    const prismaPipeline = await prisma.pipeline.update({
      where: { id },
      data: updateData
    });

    // Convert Prisma pipeline to our Pipeline type
    return toPipeline(prismaPipeline);
  }

  async deletePipeline(id: string, userId: string) {
    const pipeline = await this.getPipeline(id, userId);

    await prisma.pipeline.delete({
      where: { id }
    });
  }

  async startPipeline(id: string, userId: string) {
    const pipeline = await this.getPipeline(id, userId);

    // Start pipeline based on type
    let testRun;

    switch (pipeline.type) {
      case PipelineType.GITHUB_ACTIONS:
        testRun = await this.githubService.startPipeline(pipeline);
        break;
      default:
        throw new Error(`Unsupported pipeline type: ${pipeline.type}`);
    }

    // Update pipeline status - REMOVED as status field is gone
    /* await prisma.pipeline.update({
      where: { id },
      data: { status: 'RUNNING' }
    }); */

    return testRun;
  }

  async getTestRuns(id: string, userId: string) {
    const pipeline = await this.getPipeline(id, userId);

    const testRuns = await prisma.testRun.findMany({
      where: { pipelineId: pipeline.id },
      orderBy: { createdAt: 'desc' }
    });

    return testRuns;
  }

  async schedulePipeline(id: string, schedule: string, userId: string) {
    const pipeline = await this.getPipeline(id, userId);
    const currentConfig = parsePipelineConfig<Record<string, unknown>>(pipeline.config);

    await prisma.pipeline.update({
      where: { id },
      data: {
        config: JSON.stringify({
          ...currentConfig,
          schedule
        })
      }
    });
  }

  async getFailedTests(id: string, userId: string) {
    const pipeline = await this.getPipeline(id, userId);

    const testRuns = await prisma.testRun.findMany({
      where: {
        pipelineId: pipeline.id,
        status: TestStatus.FAILED
      },
      orderBy: { createdAt: 'desc' }
    });

    return testRuns;
  }

  async getFlakeyTests(id: string, userId: string) {
    const pipeline = await this.getPipeline(id, userId);

    const testRuns = await prisma.testRun.findMany({
      where: {
        pipelineId: pipeline.id,
        OR: [
          { status: TestStatus.FAILED },
          { status: TestStatus.FLAKY }
        ]
      },
      orderBy: { createdAt: 'desc' }
    });

    return testRuns;
  }

  async validatePipelineConfig(config: unknown) {
    try {
      await this.githubService.validateConnection(config);
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Invalid configuration'
      };
    }
  }
}

export const pipelineController = new PipelineController();