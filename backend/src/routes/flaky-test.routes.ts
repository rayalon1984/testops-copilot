
import { Router } from 'express';
import { flakyTestController } from '../controllers/flaky-test.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// Protect all routes with authentication
router.use(authenticate);

// GET /api/v1/tests/flaky
router.get('/flaky', (req, res, next) => flakyTestController.getFlakyTests(req, res, next));

// GET /api/v1/tests/:testName/flaky-history
router.get('/:testName/flaky-history', (req, res, next) => flakyTestController.getTestFlakiness(req, res, next));

export default router;
