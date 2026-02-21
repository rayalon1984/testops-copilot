/**
 * Types for Predictive Failure Analysis
 */

export interface TimeSeriesPoint {
  date: string;       // ISO date (YYYY-MM-DD)
  count: number;
  category?: string;
}

export interface TrendAnalysis {
  direction: 'increasing' | 'decreasing' | 'stable';
  rateOfChange: number;       // failures per day
  movingAverage7d: number;
  movingAverage30d: number;
  percentChange7d: number;    // vs previous 7d period
  timeSeries: TimeSeriesPoint[];
}

export interface RiskFactor {
  name: string;
  weight: number;
  value: number;
  description: string;
}

export interface RiskScore {
  testName: string;
  score: number;              // 0-100
  level: 'critical' | 'high' | 'medium' | 'low';
  factors: RiskFactor[];
  prediction: string;         // human-readable prediction
  occurrenceCount: number;
  lastOccurrence: Date;
  severity: string;
}

export interface AnomalyResult {
  date: string;
  isAnomaly: boolean;
  zScore: number;
  baseline: number;
  actual: number;
  description: string;
}

export interface PredictionSummary {
  trendAnalysis: TrendAnalysis;
  topRisks: RiskScore[];
  anomalies: AnomalyResult[];
  generatedAt: string;
}
