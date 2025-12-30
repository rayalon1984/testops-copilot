/**
 * Dashboard Routes
 */

import { Router } from 'express';
import { DashboardController } from '../controllers/dashboard.controller';

const router = Router();

/**
 * GET /api/v1/dashboard
 * Get comprehensive AI dashboard metrics
 */
router.get('/', DashboardController.getDashboardMetrics);

export default router;
