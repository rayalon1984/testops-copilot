/**
 * Failure Archive Controller
 * API endpoints for RCA management
 */

import { Request, Response } from 'express';
import { FailureArchiveService } from '../services/failure-archive.service';
import { FailureStatus, FailureSeverity } from '../types/failure-archive';
import { z } from 'zod';

// Validation schemas
const createFailureSchema = z.object({
  testRunId: z.string().uuid(),
  testCaseId: z.string().uuid().optional(),
  testName: z.string().min(1),
  errorMessage: z.string().min(1),
  category: z.string().optional(),
  stackTrace: z.string().optional(),
  logSnippet: z.string().optional(),
  screenshots: z.array(z.string()).optional(),
  environment: z.string().optional(),
  buildNumber: z.string().optional(),
  commitSha: z.string().optional(),
  branch: z.string().optional(),
  severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).optional(),
  tags: z.array(z.string()).optional()
});

const documentRCASchema = z.object({
  rootCause: z.string().min(10),
  detailedAnalysis: z.string().optional(),
  solution: z.string().optional(),
  preventionSteps: z.string().optional(),
  workaround: z.string().optional(),
  relatedDocumentation: z.array(z.string()).optional(),
  jiraIssueKey: z.string().optional(),
  prUrl: z.string().url().optional(),
  tags: z.array(z.string()).optional(),
  resolvedBy: z.string().optional(),
  timeToResolve: z.number().int().positive().optional()
});

const searchSchema = z.object({
  testName: z.string().optional(),
  errorMessage: z.string().optional(),
  status: z.enum(['NEW', 'INVESTIGATING', 'DOCUMENTED', 'RESOLVED', 'RECURRING']).optional(),
  severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).optional(),
  isRecurring: z.boolean().optional(),
  isKnownIssue: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.number().int().positive().max(100).optional(),
  offset: z.number().int().nonnegative().optional()
});

export class FailureArchiveController {
  /**
   * POST /api/failure-archive
   * Create a new failure archive entry
   */
  static async createFailure(req: Request, res: Response): Promise<void> {
    try {
      const parsed = createFailureSchema.parse(req.body);
      const data = {
        ...parsed,
        severity: parsed.severity as FailureSeverity | undefined
      };
      const failure = await FailureArchiveService.createFailure(data);

      // Find similar failures for immediate feedback
      const similarFailures = await FailureArchiveService.findSimilarFailures(
        data.testName,
        data.errorMessage,
        data.stackTrace,
        3
      );

      res.status(201).json({
        failure,
        similarFailures: similarFailures.length > 0 ? similarFailures : undefined,
        message: similarFailures.length > 0
          ? 'Failure logged. Similar past failures found.'
          : 'Failure logged successfully.'
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
        return;
      }
      console.error('Error creating failure:', error);
      res.status(500).json({ error: 'Failed to create failure archive entry' });
    }
  }

  /**
   * PUT /api/failure-archive/:id/document-rca
   * Document root cause analysis
   */
  static async documentRCA(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const data = documentRCASchema.parse(req.body);

      const failure = await FailureArchiveService.documentRCA({
        id,
        ...data
      });

      res.json({
        failure,
        message: 'Root cause analysis documented successfully'
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
        return;
      }
      console.error('Error documenting RCA:', error);
      res.status(500).json({ error: 'Failed to document RCA' });
    }
  }

  /**
   * GET /api/failure-archive/:id
   * Get failure details by ID
   */
  static async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const failure = await FailureArchiveService.getById(id);

      if (!failure) {
        res.status(404).json({ error: 'Failure not found' });
        return;
      }

      // Get similar failures
      const similarFailures = await FailureArchiveService.findSimilarFailures(
        failure.testName,
        failure.errorMessage,
        failure.stackTrace,
        5
      );

      res.json({
        failure,
        similarFailures: similarFailures.filter(sf => sf.failure.id !== id)
      });
    } catch (error) {
      console.error('Error fetching failure:', error);
      res.status(500).json({ error: 'Failed to fetch failure' });
    }
  }

  /**
   * GET /api/failure-archive/search
   * Search failures with filters
   */
  static async searchFailures(req: Request, res: Response): Promise<void> {
    try {
      const query = searchSchema.parse({
        ...req.query,
        tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
        isRecurring: req.query.isRecurring === 'true' ? true : req.query.isRecurring === 'false' ? false : undefined,
        isKnownIssue: req.query.isKnownIssue === 'true' ? true : req.query.isKnownIssue === 'false' ? false : undefined
      });

      const result = await FailureArchiveService.searchFailures({
        ...query,
        status: query.status as FailureStatus | undefined,
        severity: query.severity as FailureSeverity | undefined,
        startDate: query.startDate ? new Date(query.startDate) : undefined,
        endDate: query.endDate ? new Date(query.endDate) : undefined
      });

      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
        return;
      }
      console.error('Error searching failures:', error);
      res.status(500).json({ error: 'Failed to search failures' });
    }
  }

  /**
   * POST /api/failure-archive/find-similar
   * Find similar failures for a given error
   */
  static async findSimilar(req: Request, res: Response): Promise<void> {
    try {
      const { testName, errorMessage, stackTrace, limit } = req.body;

      if (!testName || !errorMessage) {
        res.status(400).json({ error: 'testName and errorMessage are required' });
        return;
      }

      const similarFailures = await FailureArchiveService.findSimilarFailures(
        testName,
        errorMessage,
        stackTrace,
        limit || 5
      );

      res.json({ similarFailures });
    } catch (error) {
      console.error('Error finding similar failures:', error);
      res.status(500).json({ error: 'Failed to find similar failures' });
    }
  }

  /**
   * GET /api/failure-archive/insights
   * Get failure insights and statistics
   */
  static async getInsights(req: Request, res: Response): Promise<void> {
    try {
      const days = req.query.days ? parseInt(req.query.days as string) : 30;
      const insights = await FailureArchiveService.getInsights(days);

      res.json(insights);
    } catch (error) {
      console.error('Error getting insights:', error);
      res.status(500).json({ error: 'Failed to get insights' });
    }
  }

  /**
   * PUT /api/failure-archive/:id/resolve
   * Mark failure as resolved
   */
  static async markResolved(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { resolvedBy, timeToResolve } = req.body;

      if (!resolvedBy) {
        res.status(400).json({ error: 'resolvedBy is required' });
        return;
      }

      const failure = await FailureArchiveService.markResolved(
        id,
        resolvedBy,
        timeToResolve
      );

      res.json({
        failure,
        message: 'Failure marked as resolved'
      });
    } catch (error) {
      console.error('Error resolving failure:', error);
      res.status(500).json({ error: 'Failed to resolve failure' });
    }
  }


}
