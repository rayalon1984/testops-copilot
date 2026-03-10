import { Router } from 'express';
import { testImpactController } from '../controllers/test-impact.controller';
import { ciAuthenticate } from '../middleware/ci-auth';
import { validateSmartSelect } from '../middleware/validation/test-impact';

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

export default router;
