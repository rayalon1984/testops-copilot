/**
 * Healing Controller
 * HTTP handlers for self-healing pipeline management.
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { SelfHealingService } from '../services/self-healing.service';

const createRuleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  pattern: z.string().min(1).max(1000),
  patternType: z.enum(['regex', 'keyword', 'signature']).optional(),
  category: z.enum(['transient', 'infrastructure', 'flaky', 'custom']).optional(),
  action: z.enum(['retry', 'quarantine', 'fix_pr', 'notify']).optional(),
  maxRetries: z.number().int().min(1).max(10).optional(),
  cooldownMinutes: z.number().int().min(5).max(1440).optional(),
  confidenceThreshold: z.number().min(0).max(1).optional(),
  priority: z.number().int().min(1).max(100).optional(),
});

const updateRuleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().min(1).max(500).optional(),
  pattern: z.string().min(1).max(1000).optional(),
  patternType: z.enum(['regex', 'keyword', 'signature']).optional(),
  category: z.enum(['transient', 'infrastructure', 'flaky', 'custom']).optional(),
  action: z.enum(['retry', 'quarantine', 'fix_pr', 'notify']).optional(),
  maxRetries: z.number().int().min(1).max(10).optional(),
  cooldownMinutes: z.number().int().min(5).max(1440).optional(),
  confidenceThreshold: z.number().min(0).max(1).optional(),
  enabled: z.boolean().optional(),
  priority: z.number().int().min(1).max(100).optional(),
});

const evaluateSchema = z.object({
  testRunId: z.string().uuid(),
});

const executeSchema = z.object({
  testRunId: z.string().uuid(),
});

export class HealingController {
  // ─── Rules CRUD ──────────────────────────────────────────

  static async getRules(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rules = await SelfHealingService.getRules();
      res.json({ success: true, data: rules });
    } catch (error) {
      next(error);
    }
  }

  static async getRule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rule = await SelfHealingService.getRuleById(req.params.ruleId);
      res.json({ success: true, data: rule });
    } catch (error) {
      next(error);
    }
  }

  static async createRule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = createRuleSchema.parse(req.body);
      const rule = await SelfHealingService.createRule(data);
      res.status(201).json({ success: true, data: rule });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
        return;
      }
      next(error);
    }
  }

  static async updateRule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = updateRuleSchema.parse(req.body);
      const rule = await SelfHealingService.updateRule(req.params.ruleId, data);
      res.json({ success: true, data: rule });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
        return;
      }
      next(error);
    }
  }

  static async toggleRule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { enabled } = z.object({ enabled: z.boolean() }).parse(req.body);
      const rule = await SelfHealingService.toggleRule(req.params.ruleId, enabled);
      res.json({ success: true, data: rule });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
        return;
      }
      next(error);
    }
  }

  static async deleteRule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await SelfHealingService.deleteRule(req.params.ruleId);
      res.json({ success: true, message: 'Rule deleted' });
    } catch (error) {
      next(error);
    }
  }

  // ─── Evaluation & Execution ─────────────────────────────

  static async evaluate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { testRunId } = evaluateSchema.parse(req.body);
      const evaluation = await SelfHealingService.evaluate(testRunId);
      res.json({ success: true, data: evaluation });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
        return;
      }
      next(error);
    }
  }

  static async execute(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { testRunId } = executeSchema.parse(req.body);
      const userId = String(req.user!.id);

      const evaluation = await SelfHealingService.evaluate(testRunId);
      if (!evaluation) {
        res.json({ success: true, data: { executed: false, reason: 'No matching healing rule found' } });
        return;
      }

      const result = await SelfHealingService.execute(evaluation, userId);
      res.json({ success: true, data: result });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
        return;
      }
      next(error);
    }
  }

  // ─── Events & Stats ────────────────────────────────────

  static async getEvents(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filters = {
        pipelineId: req.query.pipelineId as string | undefined,
        testRunId: req.query.testRunId as string | undefined,
        action: req.query.action as string | undefined,
        status: req.query.status as string | undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      };
      const events = await SelfHealingService.getEvents(filters);
      res.json({ success: true, data: events });
    } catch (error) {
      next(error);
    }
  }

  static async getStats(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await SelfHealingService.getStats();
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }

  // ─── Quarantine ─────────────────────────────────────────

  static async getQuarantinedTests(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tests = await SelfHealingService.getQuarantinedTests();
      res.json({ success: true, data: tests });
    } catch (error) {
      next(error);
    }
  }

  static async quarantineTest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = z.object({
        testName: z.string().min(1),
        reason: z.string().min(1).max(500),
        severity: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional(),
        flakinessScore: z.number().min(0).max(1).optional(),
      }).parse(req.body);

      const userId = String(req.user!.id);
      const test = await SelfHealingService.quarantineTest(
        data.testName, data.reason, data.severity || 'MEDIUM', userId, data.flakinessScore,
      );
      res.status(201).json({ success: true, data: test });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
        return;
      }
      next(error);
    }
  }

  static async reinstateTest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const test = await SelfHealingService.reinstateTest(req.params.testId);
      res.json({ success: true, data: test });
    } catch (error) {
      next(error);
    }
  }

  static async deleteQuarantinedTest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await SelfHealingService.deleteQuarantinedTest(req.params.testId);
      res.json({ success: true, message: 'Quarantined test removed' });
    } catch (error) {
      next(error);
    }
  }

  static async getQuarantineStats(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await SelfHealingService.getQuarantineStats();
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }

  // ─── Fix Suggestions ───────────────────────────────────

  static async getFixSuggestions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const suggestions = await SelfHealingService.getFixSuggestions(limit);
      res.json({ success: true, data: suggestions });
    } catch (error) {
      next(error);
    }
  }

  // ─── Seed ──────────────────────────────────────────────

  static async seedRules(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const count = await SelfHealingService.seedBuiltInRules();
      res.json({ success: true, data: { seeded: count } });
    } catch (error) {
      next(error);
    }
  }
}
