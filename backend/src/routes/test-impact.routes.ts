
import { Router } from 'express';
import { testImpactController } from '../controllers/test-impact.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// Protect all CI routes with authentication (or a specific CI token in future)
router.use(authenticate);

router.post('/smart-select', (req, res, next) => testImpactController.getImpactedtests(req, res, next));

export default router;
