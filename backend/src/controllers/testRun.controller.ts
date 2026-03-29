import { Request, Response, NextFunction } from 'express';
import { TestRunService, CreateTestRunDTO } from '@/services/testRun.service';

const testRunService = new TestRunService();

export class TestRunController {
  async getAllTestRuns(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const filters = {
        pipelineId: req.query.pipelineId as string,
        status: req.query.status as string,
        branch: req.query.branch as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
        search: req.query.search as string,
      };

      const { data, total } = await testRunService.getAllTestRuns(userId, filters);
      res.json({ data, total, page: filters.page || 1, limit: filters.limit || 50 });
    } catch (error) {
      next(error);
    }
  }

  async getTestRunById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const id = req.params.id as string;

      const testRun = await testRunService.getTestRunById(id, userId);
      res.json(testRun);
    } catch (error) {
      next(error);
    }
  }

  async createTestRun(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const data: CreateTestRunDTO = req.body;

      const testRun = await testRunService.createTestRun(data, userId);
      res.status(201).json(testRun);
    } catch (error) {
      next(error);
    }
  }

  async cancelTestRun(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const id = req.params.id as string;

      const testRun = await testRunService.cancelTestRun(id, userId);
      res.json(testRun);
    } catch (error) {
      next(error);
    }
  }

  async retryTestRun(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const id = req.params.id as string;

      const testRun = await testRunService.retryTestRun(id, userId);
      res.status(201).json(testRun);
    } catch (error) {
      next(error);
    }
  }

  /** Planned for v3.1 — requires log storage backend (S3/GCS) */
  async getTestRunLogs(_req: Request, res: Response, _next: NextFunction): Promise<void> {
    res.status(501).json({ message: 'Log retrieval not yet implemented — planned for v3.1' });
  }

  /** Planned for v3.1 — requires artifact storage backend (S3/GCS) */
  async getTestRunArtifacts(_req: Request, res: Response, _next: NextFunction): Promise<void> {
    res.status(501).json({ message: 'Artifact retrieval not yet implemented — planned for v3.1' });
  }

  async deleteTestRun(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      await testRunService.deleteTestRun(id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  /** Planned for v3.1 — will be moved to a dedicated Statistics Service */
  async getSystemMetrics(_req: Request, res: Response, _next: NextFunction): Promise<void> {
    res.status(501).json({ message: 'System metrics not yet implemented — planned for v3.1' });
  }
}