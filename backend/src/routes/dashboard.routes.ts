/**
 * Dashboard Routes
 */

import { Router } from 'express';
import { DashboardController } from '../controllers/dashboard.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// All dashboard routes require authentication
router.use(authenticate);

/**
 * GET /api/v1/dashboard
 * Get comprehensive AI dashboard metrics
 */
router.get('/', DashboardController.getDashboardMetrics);

export default router;
