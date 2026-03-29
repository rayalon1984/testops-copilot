/**
 * PipelineService — Business logic + data access for pipelines.
 *
 * Extracted from pipeline.controller.ts to enforce the thin-controller pattern.
 * All Prisma calls, success rate calculations, config transforms, and audit
 * logging live here.
 */

import { prisma } from '../lib/prisma';
import { auditService } from './audit.service';
import { GitHubService } from './github.service';
import { NotFoundError } from '../middleware/errorHandler';
import {
  CreatePipelineDTO,
  UpdatePipelineDTO,
  PipelineFilters,
  toPipeline,
} from '../types/pipeline';
import { TestStatus, PipelineType } from '../constants';
import {
  createPipelineInput,
  updatePipelineInput,
  parsePipelineConfig,
} from '../utils/prismaHelpers';

// ─── Response shapes ───

export interface PipelineListItem {
  id: string;
  name: string;
  type: 'jenkins' | 'github-actions';
  status: string;
  lastRun: string;
  successRate: number;
  config: Record<string, unknown>;
}

export interface FormattedTestRun {
  id: string;
  status: string;
  startTime: string;
  endTime: string;
  duration: number;
  errorCount: number;
}

const STATUS_MAP: Record<string, string> = {
  PASSED: 'success',
  FAILED: 'failed',
  RUNNING: 'running',
  PENDING: 'pending',
};

// ─── Service ───

class PipelineService {
  private githubService: GitHubService;

  constructor() {
    this.githubService = new GitHubService();
  }

  async list(_userId: string, filters?: PipelineFilters): Promise<PipelineListItem[]> {
    const where = {
      ...(filters?.type && { type: filters.type }),
    };

    const pipelines = await prisma.pipeline.findMany({
      where,
      include: {
        testRuns: {
          orderBy: { createdAt: 'desc' as const },
          take: 100,
        },
      },
    });

    return pipelines.map(pipeline => {
      const testRuns = pipeline.testRuns || [];
      const lastRun = testRuns.length > 0
        ? testRuns[0].createdAt.toISOString()
        : new Date().toISOString();

      const successRate = this.calculateSuccessRate(testRuns);
      const lastRunStatus = testRuns.length > 0 ? testRuns[0].status : 'PENDING';

      const rawConfig = typeof pipeline.config === 'string'
        ? JSON.parse(pipeline.config)
        : pipeline.config;
      const { credentials: _creds, ...safeConfig } = rawConfig || {};

      return {
        id: pipeline.id,
        name: pipeline.name,
        type: pipeline.type.toLowerCase().replace('_', '-') as 'jenkins' | 'github-actions',
        status: STATUS_MAP[lastRunStatus] || 'pending',
        lastRun,
        successRate,
        config: safeConfig,
      };
    });
  }

  async getById(id: string, _userId: string) {
    const pipeline = await prisma.pipeline.findUnique({
      where: { id },
      include: {
        testRuns: {
          orderBy: { createdAt: 'desc' as const },
          take: 50,
        },
      },
    });

    if (!pipeline) {
      throw new NotFoundError('Pipeline not found');
    }

    return toPipeline(pipeline);
  }

  async create(data: CreatePipelineDTO, userId: string) {
    if (data.type === PipelineType.GITHUB_ACTIONS) {
      await this.githubService.validateConnection(data.config);
    }

    const createData = createPipelineInput({ ...data });
    const pipeline = await prisma.pipeline.create({ data: createData });

    void auditService.log(
      'PIPELINE_CREATE',
      'Pipeline',
      pipeline.id,
      userId,
      { name: pipeline.name, type: pipeline.type },
    );

    return toPipeline(pipeline);
  }

  async update(id: string, data: UpdatePipelineDTO, userId: string) {
    await this.getById(id, userId);

    if (data.config) {
      await this.githubService.validateConnection(data.config);
    }

    const updateData = updatePipelineInput(data);
    const pipeline = await prisma.pipeline.update({
      where: { id },
      data: updateData,
    });

    void auditService.log(
      'PIPELINE_UPDATE',
      'Pipeline',
      pipeline.id,
      userId,
      { updates: Object.keys(data) },
    );

    return toPipeline(pipeline);
  }

  async delete(id: string, userId: string): Promise<void> {
    await this.getById(id, userId);

    const deleted = await prisma.pipeline.delete({ where: { id } });

    void auditService.log(
      'PIPELINE_DELETE',
      'Pipeline',
      id,
      userId,
      { name: deleted.name },
    );
  }

  async start(id: string, userId: string) {
    const pipeline = await this.getById(id, userId);

    switch (pipeline.type) {
      case PipelineType.GITHUB_ACTIONS:
        return this.githubService.startPipeline(pipeline);
      default:
        throw new Error(`Unsupported pipeline type: ${pipeline.type}`);
    }
  }

  async getTestRuns(pipelineId: string, userId: string): Promise<FormattedTestRun[]> {
    await this.getById(pipelineId, userId);

    const runs = await prisma.testRun.findMany({
      where: { pipelineId },
      orderBy: { createdAt: 'desc' as const },
      take: 100,
      include: { results: { select: { status: true } } },
    });

    return runs.map(run => {
      const failed = run.results?.filter(r => r.status === 'FAILED').length || 0;
      return {
        id: run.id,
        status: STATUS_MAP[run.status] || 'pending',
        startTime: run.startedAt?.toISOString() || run.createdAt.toISOString(),
        endTime: run.completedAt?.toISOString() || run.createdAt.toISOString(),
        duration: run.duration || 0,
        errorCount: failed,
      };
    });
  }

  async schedule(id: string, schedule: string, userId: string): Promise<void> {
    const pipeline = await this.getById(id, userId);
    const currentConfig = parsePipelineConfig<Record<string, unknown>>(pipeline.config);

    await prisma.pipeline.update({
      where: { id },
      data: { config: JSON.stringify({ ...currentConfig, schedule }) },
    });
  }

  async getFailedTests(id: string, userId: string) {
    await this.getById(id, userId);

    return prisma.testRun.findMany({
      where: { pipelineId: id, status: TestStatus.FAILED },
      orderBy: { createdAt: 'desc' as const },
    });
  }

  async getFlakyTests(id: string, userId: string) {
    await this.getById(id, userId);

    return prisma.testRun.findMany({
      where: {
        pipelineId: id,
        OR: [
          { status: TestStatus.FAILED },
          { status: TestStatus.FLAKY },
        ],
      },
      orderBy: { createdAt: 'desc' as const },
    });
  }

  async validateConfig(config: unknown): Promise<{ valid: boolean; error?: string }> {
    try {
      await this.githubService.validateConnection(config);
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Invalid configuration',
      };
    }
  }

  // ─── Private helpers ───

  private calculateSuccessRate(testRuns: { status: string }[]): number {
    if (testRuns.length === 0) return 0;
    const passed = testRuns.filter(r => r.status === 'PASSED').length;
    return Math.round((passed / testRuns.length) * 100);
  }
}

export const pipelineService = new PipelineService();
