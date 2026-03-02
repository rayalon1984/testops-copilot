import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { xrayService } from '@/services/xray.service';
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

// ─── List Test Plans ─────────────────────────────────────────────────

router.get(
  '/test-plans',
  asyncHandler(async (_req: Request, res: Response) => {
    if (!xrayService.isEnabled()) {
      return res.status(503).json({
        message: 'Xray integration is not configured',
      });
    }

    const testPlans = await xrayService.getTestPlans();
    return res.status(200).json({ testPlans, total: testPlans.length });
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
    const result = await xrayService.syncTestRun(testRunId);
    return res.status(200).json(result);
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
