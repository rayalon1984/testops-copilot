/**
 * DashboardController — Thin HTTP adapter.
 *
 * Delegates all metrics aggregation and data access to DashboardService.
 * No Prisma imports allowed here.
 */

import { Request, Response } from 'express';
import { dashboardService } from '../services/dashboard.service';

export type { DashboardMetrics } from '../services/dashboard.service';

export class DashboardController {
  static async getDashboardMetrics(req: Request, res: Response): Promise<void> {
    try {
      const timeRange = (req.query.timeRange as string) || '30d';
      const metrics = await dashboardService.getMetrics(timeRange);

      res.json({
        success: true,
        data: metrics,
      });
    } catch (error) {
      console.error('Failed to fetch dashboard metrics:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch dashboard metrics',
      });
    }
  }
}
