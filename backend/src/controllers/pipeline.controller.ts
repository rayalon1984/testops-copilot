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
      userId,
      ...(filters?.type && { type: filters.type }),
      ...(filters?.status && { status: filters.status })
    };

    const prismaPipelines = await prisma.pipeline.findMany({
      where,
      include: {
        testRuns: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    // Convert Prisma pipelines to our Pipeline type
    return prismaPipelines.map(pipeline => toPipeline(pipeline));
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

    if (prismaPipeline.userId !== userId) {
      throw new AuthorizationError('Not authorized to access this pipeline');
    }

    // Convert Prisma pipeline to our Pipeline type
    return toPipeline(prismaPipeline);
  }

  async createPipeline(data: CreatePipelineDTO, userId: string) {
    // Validate connection before creating
    await this.githubService.validateConnection(data.config);

    const createData = createPipelineInput({
      ...data,
      userId,
      status: PipelineStatus.PENDING
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

    try {
      // Start pipeline based on type
      let testRun;

      switch (pipeline.type) {
        case PipelineType.GITHUB_ACTIONS:
          testRun = await this.githubService.startPipeline(pipeline);
          break;
        default:
          throw new Error(`Unsupported pipeline type: ${pipeline.type}`);
      }

      // Update pipeline status
      await prisma.pipeline.update({
        where: { id },
        data: { status: 'RUNNING' }
      });

      return testRun;
    } catch (error) {
      await prisma.pipeline.update({
        where: { id },
        data: { status: 'FAILURE' }
      });
      throw error;
    }
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
    // @ts-expect-error - Prisma JsonValue type compatibility
    const currentConfig = parsePipelineConfig<Record<string, unknown>>(pipeline.config);

    await prisma.pipeline.update({
      where: { id },
      data: {
        config: toInputJsonValue({
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
          { status: TestStatus.ERROR }
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