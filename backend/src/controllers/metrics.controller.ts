/**
 * Metrics Controller
 *
 * Handles HTTP requests for Prometheus metrics export
 */

import { Request, Response } from 'express';
import MetricsService from '../services/metrics.service';
import { MetricsTimeRange } from '../types/metrics';
import { safeParseInt } from '@/utils/common';

export class MetricsController {
  /**
   * GET /metrics
   * Export metrics in Prometheus text format (standard endpoint)
   */
  static async getPrometheusMetrics(req: Request, res: Response): Promise<void> {
    try {
      const includeTimestamp = req.query.timestamp === 'true';

      // Optional time range filtering
      let timeRange: MetricsTimeRange | undefined;
      if (req.query.start && req.query.end) {
        timeRange = {
          start: new Date(req.query.start as string),
          end: new Date(req.query.end as string),
        };
      }

      const metricsText = await MetricsService.exportPrometheusMetrics({
        includeTimestamp,
        timeRange,
      });

      // Prometheus expects text/plain with version info
      res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
      res.send(metricsText);
    } catch (error) {
      res.status(500).send('# Error exporting metrics\n');
    }
  }

  /**
   * GET /api/v1/metrics/summary
   * Get metrics summary in JSON format (for dashboards)
   */
  static async getMetricsSummary(req: Request, res: Response): Promise<void> {
    try {
      let timeRange: MetricsTimeRange | undefined;
      if (req.query.start && req.query.end) {
        timeRange = {
          start: new Date(req.query.start as string),
          end: new Date(req.query.end as string),
        };
      }

      const summary = await MetricsService.getMetricsSummary(timeRange);

      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch metrics summary',
      });
    }
  }

  /**
   * GET /api/v1/metrics/top-failures
   * Get top failing tests
   */
  static async getTopFailures(req: Request, res: Response): Promise<void> {
    try {
      const limit = safeParseInt(req.query.limit as string | undefined, 10, 1, 100);
      const topFailures = await MetricsService.getTopFailingTests(limit);

      res.json({
        success: true,
        data: topFailures,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch top failures',
      });
    }
  }

  /**
   * GET /api/v1/metrics/health
   * Health check endpoint for monitoring
   */
  static async getHealth(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Health check failed',
      });
    }
  }
}
