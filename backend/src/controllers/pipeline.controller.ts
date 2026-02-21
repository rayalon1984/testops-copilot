/**
 * PipelineController — Thin HTTP adapter.
 *
 * Delegates all business logic and data access to PipelineService.
 * No Prisma imports allowed here.
 */

import { pipelineService } from '../services/pipeline.service';
import {
  CreatePipelineDTO,
  UpdatePipelineDTO,
  PipelineFilters,
} from '../types/pipeline';

export class PipelineController {
  async listPipelines(userId: string, filters?: PipelineFilters) {
    return pipelineService.list(userId, filters);
  }

  async getPipeline(id: string, userId: string) {
    return pipelineService.getById(id, userId);
  }

  async createPipeline(data: CreatePipelineDTO, userId: string) {
    return pipelineService.create(data, userId);
  }

  async updatePipeline(id: string, data: UpdatePipelineDTO, userId: string) {
    return pipelineService.update(id, data, userId);
  }

  async deletePipeline(id: string, userId: string) {
    return pipelineService.delete(id, userId);
  }

  async startPipeline(id: string, userId: string) {
    return pipelineService.start(id, userId);
  }

  async getTestRuns(id: string, userId: string) {
    return pipelineService.getTestRuns(id, userId);
  }

  async schedulePipeline(id: string, schedule: string, userId: string) {
    return pipelineService.schedule(id, schedule, userId);
  }

  async getFailedTests(id: string, userId: string) {
    return pipelineService.getFailedTests(id, userId);
  }

  async getFlakeyTests(id: string, userId: string) {
    return pipelineService.getFlakyTests(id, userId);
  }

  async validatePipelineConfig(config: unknown) {
    return pipelineService.validateConfig(config);
  }
}

export const pipelineController = new PipelineController();
