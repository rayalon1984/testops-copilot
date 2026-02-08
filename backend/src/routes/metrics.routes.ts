/**
 * Metrics Routes
 *
 * API routes for Prometheus metrics and monitoring
 */

import { Router, type Router as RouterType } from 'express';
import { MetricsController } from '../controllers/metrics.controller';
import { authenticate } from '../middleware/auth';

const router: RouterType = Router();

// All metrics routes require authentication
router.use(authenticate);

// JSON API endpoints
router.get('/summary', MetricsController.getMetricsSummary);
router.get('/top-failures', MetricsController.getTopFailures);
router.get('/health', MetricsController.getHealth);

export default router;
