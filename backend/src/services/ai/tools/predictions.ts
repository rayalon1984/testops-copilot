/**
 * Failure Predictions Tool — Read-only AI tool for ReAct loop
 *
 * Provides predictive failure analysis: risk scores, trend analysis, anomaly detection.
 */

import { Tool, ToolResult, ToolContext } from './types';
import { PredictionAnalysisService } from '@/services/prediction-analysis.service';
import { logger } from '@/utils/logger';

export const failurePredictionsTool: Tool = {
    name: 'failure_predictions',
    description: 'Get predictive failure analysis including risk scores, trend analysis, and anomaly detection. Use for questions about which tests are likely to fail, failure trends, and unusual patterns.',
    category: 'dashboard',
    requiresConfirmation: false,
    parameters: [
        {
            name: 'action',
            type: 'string',
            description: 'Analysis type: risk_scores (top risky tests), trends (failure count over time), anomalies (unusual days)',
            required: true,
            enum: ['risk_scores', 'trends', 'anomalies'],
        },
        {
            name: 'days',
            type: 'number',
            description: 'Lookback period in days (default 30)',
            required: false,
            default: 30,
        },
        {
            name: 'limit',
            type: 'number',
            description: 'Max results for risk_scores (default 10)',
            required: false,
            default: 10,
        },
        {
            name: 'testName',
            type: 'string',
            description: 'Filter by specific test name',
            required: false,
        },
    ],

    async execute(args: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
        try {
            const action = args.action as string;
            const days = (args.days as number) || 30;
            const limit = (args.limit as number) || 10;
            const testName = args.testName as string | undefined;

            switch (action) {
                case 'risk_scores': {
                    const scores = await PredictionAnalysisService.calculateRiskScores({
                        limit,
                        minOccurrences: 2,
                    });

                    if (scores.length === 0) {
                        return {
                            success: true,
                            data: { scores: [] },
                            summary: 'No recurring failures found with 2+ occurrences.',
                        };
                    }

                    const topScores = scores.slice(0, 5);
                    const summary = topScores
                        .map(s => `• ${s.testName}: ${s.score}/100 (${s.level}) — ${s.prediction}`)
                        .join('\n');

                    return {
                        success: true,
                        data: { scores },
                        summary: `Top ${topScores.length} risk scores:\n${summary}`,
                    };
                }

                case 'trends': {
                    const timeSeries = await PredictionAnalysisService.getFailureTimeSeries({
                        days,
                        testName,
                    });
                    const trend = PredictionAnalysisService.calculateTrend(timeSeries);

                    return {
                        success: true,
                        data: trend,
                        summary: `Failure trend (${days}d): ${trend.direction} (${trend.rateOfChange} failures/day). 7d avg: ${trend.movingAverage7d}, 7d change: ${trend.percentChange7d > 0 ? '+' : ''}${trend.percentChange7d}%.`,
                    };
                }

                case 'anomalies': {
                    const timeSeries = await PredictionAnalysisService.getFailureTimeSeries({
                        days,
                        testName,
                    });
                    const anomalies = PredictionAnalysisService.detectAnomalies(timeSeries);
                    const flagged = anomalies.filter(a => a.isAnomaly);

                    if (flagged.length === 0) {
                        return {
                            success: true,
                            data: { anomalies: [], flaggedCount: 0 },
                            summary: `No anomalies detected in ${days}-day window. Failure rates are within normal range.`,
                        };
                    }

                    const summary = flagged
                        .map(a => `• ${a.date}: ${a.actual} failures (expected ~${a.baseline}, z=${a.zScore})`)
                        .join('\n');

                    return {
                        success: true,
                        data: { anomalies, flaggedCount: flagged.length },
                        summary: `${flagged.length} anomalous day(s) detected:\n${summary}`,
                    };
                }

                default:
                    return {
                        success: false,
                        error: `Unknown action: ${action}. Use risk_scores, trends, or anomalies.`,
                        summary: `Unknown prediction action: ${action}`,
                    };
            }
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            logger.error('[failure_predictions] Failed:', error);
            return { success: false, error: msg, summary: `Prediction analysis failed: ${msg}` };
        }
    },
};
