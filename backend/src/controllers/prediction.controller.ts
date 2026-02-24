/**
 * Prediction Controller
 * HTTP handlers for predictive failure analysis endpoints
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PredictionAnalysisService } from '../services/prediction-analysis.service';

const trendsSchema = z.object({
  days: z.coerce.number().int().min(7).max(365).default(30),
  groupBy: z.enum(['day', 'week']).default('day'),
  testName: z.string().optional(),
  category: z.string().optional(),
});

const predictionsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  minOccurrences: z.coerce.number().int().min(1).default(2),
});

const anomaliesSchema = z.object({
  days: z.coerce.number().int().min(7).max(365).default(30),
  sensitivity: z.coerce.number().min(0.5).max(5.0).default(2.0),
  testName: z.string().optional(),
  category: z.string().optional(),
});

export class PredictionController {
  /**
   * GET /api/v1/failure-archive/trends
   */
  static async getTrends(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const params = trendsSchema.parse(req.query);

      const timeSeries = await PredictionAnalysisService.getFailureTimeSeries(params);
      const trend = PredictionAnalysisService.calculateTrend(timeSeries);

      res.json({ success: true, data: trend });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/failure-archive/predictions
   */
  static async getPredictions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const params = predictionsSchema.parse(req.query);

      const scores = await PredictionAnalysisService.calculateRiskScores(params);

      res.json({ success: true, data: scores });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/failure-archive/anomalies
   */
  static async getAnomalies(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const params = anomaliesSchema.parse(req.query);

      const timeSeries = await PredictionAnalysisService.getFailureTimeSeries({
        days: params.days,
        testName: params.testName,
        category: params.category,
      });
      const anomalies = PredictionAnalysisService.detectAnomalies(timeSeries, params.sensitivity);

      res.json({ success: true, data: anomalies });
    } catch (error) {
      next(error);
    }
  }
}
