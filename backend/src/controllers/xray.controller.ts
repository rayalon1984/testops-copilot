import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { xrayService } from '@/services/xray.service';
import { config } from '@/config';
import { asyncHandler } from '@/middleware/errorHandler';
import { authenticate, authorize } from '@/middleware/auth';
import { UserRole } from '@/constants';

const router: Router = Router();

// All Xray routes require authentication
router.use(authenticate);

// ─── Test Connection (ADMIN only) ────────────────────────────────────

router.get(
  '/test-connection',
  authorize(UserRole.ADMIN),
  asyncHandler(async (_req: Request, res: Response) => {
    if (!xrayService.isEnabled()) {
      return res.status(503).json({
        message: 'Xray integration is not configured',
        configured: false,
      });
    }

    const connected = await xrayService.validateConnection();
    if (connected) {
      return res.status(200).json({ connected: true });
    }

    return res.status(400).json({
      connected: false,
      message: 'Failed to connect to Xray. Check your credentials.',
    });
  })
);

// ─── Search Test Cases ───────────────────────────────────────────────

const testCaseQuerySchema = z.object({
  q: z.string().min(1, 'Search query is required'),
  limit: z.coerce.number().int().min(1).max(25).optional().default(10),
});

router.get(
  '/test-cases',
  asyncHandler(async (req: Request, res: Response) => {
    if (!xrayService.isEnabled()) {
      return res.status(503).json({
        message: 'Xray integration is not configured',
      });
    }

    const { q, limit } = testCaseQuerySchema.parse(req.query);
    const testCases = await xrayService.getTestCases(q, limit);
    return res.status(200).json({ testCases, total: testCases.length });
  })
);

// ─── List Test Plans (paginated with coverage) ───────────────────────

const testPlanQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(25).optional().default(10),
  start: z.coerce.number().int().min(0).optional().default(0),
});

router.get(
  '/test-plans',
  asyncHandler(async (req: Request, res: Response) => {
    if (!xrayService.isEnabled()) {
      return res.status(503).json({
        message: 'Xray integration is not configured',
      });
    }

    const { limit, start } = testPlanQuerySchema.parse(req.query);
    const result = await xrayService.getTestPlans(limit, start);
    return res.status(200).json({ testPlans: result.plans, total: result.total });
  })
);

// ─── Get Single Test Plan (with test cases) ──────────────────────────

const testPlanIdSchema = z.object({
  planId: z.string().min(1, 'Plan ID is required'),
});

router.get(
  '/test-plans/:planId',
  asyncHandler(async (req: Request, res: Response) => {
    if (!xrayService.isEnabled()) {
      return res.status(503).json({
        message: 'Xray integration is not configured',
      });
    }

    const { planId } = testPlanIdSchema.parse(req.params);
    const plan = await xrayService.getTestPlan(planId);
    return res.status(200).json(plan);
  })
);

// ─── Get Test Case History (for AI enrichment) ──────────────────────

const testCaseKeySchema = z.object({
  key: z.string().min(1, 'Test case key is required'),
});

router.get(
  '/test-cases/:key/history',
  asyncHandler(async (req: Request, res: Response) => {
    if (!xrayService.isEnabled()) {
      return res.status(503).json({
        message: 'Xray integration is not configured',
      });
    }

    const { key } = testCaseKeySchema.parse(req.params);
    const history = await xrayService.getTestCaseHistory(key);
    return res.status(200).json(history);
  })
);

// ─── Sync Test Run ───────────────────────────────────────────────────

const syncParamsSchema = z.object({
  testRunId: z.string().uuid('Invalid test run ID'),
});

router.post(
  '/sync/:testRunId',
  asyncHandler(async (req: Request, res: Response) => {
    if (!xrayService.isEnabled()) {
      return res.status(503).json({
        message: 'Xray integration is not configured',
      });
    }

    const { testRunId } = syncParamsSchema.parse(req.params);
    const result = await xrayService.syncTestRun(testRunId, 'MANUAL');
    return res.status(200).json(result);
  })
);

// ─── Config (ADMIN — auto-sync toggle) ──────────────────────────────

const configPatchSchema = z.object({
  autoSync: z.boolean().optional(),
});

router.patch(
  '/config',
  authorize(UserRole.ADMIN),
  asyncHandler(async (req: Request, res: Response) => {
    const body = configPatchSchema.parse(req.body);

    // In production this would persist to org settings table.
    // For demo mode, update the runtime config in memory.
    if (body.autoSync !== undefined && config.xray) {
      config.xray.autoSync = body.autoSync;
    }

    return res.status(200).json({
      autoSync: config.xray?.autoSync ?? false,
      message: body.autoSync ? 'Auto-sync enabled' : 'Auto-sync disabled',
    });
  })
);

// ─── Get Config (current Xray config state) ─────────────────────────

router.get(
  '/config',
  asyncHandler(async (_req: Request, res: Response) => {
    return res.status(200).json({
      configured: xrayService.isEnabled(),
      autoSync: config.xray?.autoSync ?? false,
    });
  })
);

// ─── Sync History ────────────────────────────────────────────────────

router.get(
  '/syncs',
  asyncHandler(async (_req: Request, res: Response) => {
    const syncs = await xrayService.getSyncHistory();
    return res.status(200).json({ syncs, total: syncs.length });
  })
);

// ─── Sync Status ─────────────────────────────────────────────────────

const syncIdSchema = z.object({
  id: z.string().uuid('Invalid sync ID'),
});

router.get(
  '/syncs/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = syncIdSchema.parse(req.params);
    const sync = await xrayService.getSyncStatus(id);
    return res.status(200).json(sync);
  })
);

// ─── Error Handling ──────────────────────────────────────────────────

router.use((err: Error, _req: Request, res: Response, next: NextFunction) => {
  if (err instanceof z.ZodError) {
    return res.status(400).json({
      message: 'Validation error',
      errors: err.errors,
    });
  }

  return next(err);
});

export const xrayController: Router = router;
