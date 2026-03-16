import { Router, Request, Response } from 'express';
import { testImpactController } from '../controllers/test-impact.controller';
import { ciAuthenticate } from '../middleware/ci-auth';
import { validateSmartSelect } from '../middleware/validation/test-impact';
import { asyncHandler } from '../middleware/errorHandler';
import { selectionAccuracyService } from '../services/test/SelectionAccuracyService';
import { regressionDetectionService } from '../services/test/RegressionDetectionService';

const router = Router();

// Protect all CI routes with CI-aware authentication:
// Accepts either standard JWT Bearer token OR X-CI-Token header
router.use(ciAuthenticate);

/**
 * POST /api/v1/ci/smart-select
 *
 * Smart test selection based on changed files.
 * Input validated by Zod schema (validateSmartSelect middleware).
 *
 * Auth: JWT Bearer token OR X-CI-Token header
 * Body: { files: string[], options?: { projectRoot?, testPatterns?, globalFiles?, validateFileExistence? } }
 * Returns: { success: true, data: TestSelectionResult }
 */
router.post(
  '/smart-select',
  validateSmartSelect,
  (req, res, next) => testImpactController.getImpactedTests(req, res, next)
);

/** GET /api/v1/ci/smart-select/accuracy?days=N */
router.get(
  '/smart-select/accuracy',
  asyncHandler(async (req: Request, res: Response) => {
    const days = parseInt(req.query.days as string, 10) || 30;
    const stats = await selectionAccuracyService.getStats(days);
    res.json(stats);
  })
);

/** GET /api/v1/ci/smart-select/regressions?days=N */
router.get(
  '/smart-select/regressions',
  asyncHandler(async (req: Request, res: Response) => {
    const days = parseInt(req.query.days as string, 10) || 30;
    const summary = await regressionDetectionService.getSummary(days);
    res.json(summary);
  })
);

/** GET /api/v1/ci/smart-select/recall-health */
router.get(
  '/smart-select/recall-health',
  asyncHandler(async (_req: Request, res: Response) => {
    const health = await selectionAccuracyService.checkRecallHealth();
    res.json(health);
  })
);

/** POST /api/v1/ci/smart-select/regressions/:id/confirm */
router.post(
  '/smart-select/regressions/:id/confirm',
  asyncHandler(async (req: Request, res: Response) => {
    await regressionDetectionService.confirmRegression(req.params.id as string);
    res.json({ success: true, message: 'Regression confirmed' });
  })
);

/** POST /api/v1/ci/smart-select/regressions/:id/false-positive */
router.post(
  '/smart-select/regressions/:id/false-positive',
  asyncHandler(async (req: Request, res: Response) => {
    await regressionDetectionService.markAsFalsePositive(req.params.id as string);
    res.json({ success: true, message: 'Marked as false positive' });
  })
);

export default router;
