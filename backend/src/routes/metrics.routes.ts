/**
 * Metrics Routes
 *
 * API routes for Prometheus metrics and monitoring
 */

import { Router, type Router as RouterType } from 'express';
import { MetricsController } from '../controllers/metrics.controller';

const router: RouterType = Router();

// JSON API endpoints
router.get('/summary', MetricsController.getMetricsSummary);
router.get('/top-failures', MetricsController.getTopFailures);
router.get('/health', MetricsController.getHealth);

export default router;
