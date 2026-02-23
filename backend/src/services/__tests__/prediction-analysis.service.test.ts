import { PredictionAnalysisService } from '../prediction-analysis.service';
import { prisma } from '../../lib/prisma';

jest.mock('../../lib/prisma', () => ({
  prisma: {
    $queryRaw: jest.fn(),
    $queryRawUnsafe: jest.fn(),
    failureArchive: {
      findMany: jest.fn(),
    },
  },
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prismaMock = prisma as any;

describe('PredictionAnalysisService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getFailureTimeSeries', () => {
    const mockRows = [
      { date: '2026-02-20', count: BigInt(5) },
      { date: '2026-02-21', count: BigInt(3) },
    ];

    it('should use $queryRaw (not $queryRawUnsafe) for day grouping', async () => {
      prismaMock.$queryRaw.mockResolvedValue(mockRows);

      const result = await PredictionAnalysisService.getFailureTimeSeries({
        days: 30,
        groupBy: 'day',
      });

      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
      expect(prismaMock.$queryRawUnsafe).not.toHaveBeenCalled();
      expect(result).toEqual([
        { date: '2026-02-20', count: 5 },
        { date: '2026-02-21', count: 3 },
      ]);
    });

    it('should use $queryRaw (not $queryRawUnsafe) for week grouping', async () => {
      const weekRows = [
        { date: '2026-W07', count: BigInt(12) },
        { date: '2026-W08', count: BigInt(8) },
      ];
      prismaMock.$queryRaw.mockResolvedValue(weekRows);

      const result = await PredictionAnalysisService.getFailureTimeSeries({
        days: 30,
        groupBy: 'week',
      });

      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
      expect(prismaMock.$queryRawUnsafe).not.toHaveBeenCalled();
      expect(result).toEqual([
        { date: '2026-W07', count: 12 },
        { date: '2026-W08', count: 8 },
      ]);
    });

    it('should handle optional testName and category filters', async () => {
      prismaMock.$queryRaw.mockResolvedValue(mockRows);

      await PredictionAnalysisService.getFailureTimeSeries({
        days: 14,
        testName: 'login.test.ts',
        category: 'flaky',
      });

      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
      expect(prismaMock.$queryRawUnsafe).not.toHaveBeenCalled();
    });

    it('should default to 30 days and day grouping', async () => {
      prismaMock.$queryRaw.mockResolvedValue([]);

      const result = await PredictionAnalysisService.getFailureTimeSeries({});

      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
      expect(result).toEqual([]);
    });

    it('should convert bigint counts to numbers', async () => {
      prismaMock.$queryRaw.mockResolvedValue([
        { date: '2026-02-22', count: BigInt(999) },
      ]);

      const result = await PredictionAnalysisService.getFailureTimeSeries({});

      expect(result[0].count).toBe(999);
      expect(typeof result[0].count).toBe('number');
    });
  });

  describe('calculateTrend', () => {
    it('should detect increasing trend', () => {
      const timeSeries = Array.from({ length: 14 }, (_, i) => ({
        date: `2026-02-${String(i + 1).padStart(2, '0')}`,
        count: i * 2, // steadily increasing
      }));

      const trend = PredictionAnalysisService.calculateTrend(timeSeries);

      expect(trend.direction).toBe('increasing');
      expect(trend.rateOfChange).toBeGreaterThan(0.1);
      expect(trend.timeSeries).toEqual(timeSeries);
    });

    it('should detect decreasing trend', () => {
      const timeSeries = Array.from({ length: 14 }, (_, i) => ({
        date: `2026-02-${String(i + 1).padStart(2, '0')}`,
        count: 30 - i * 2, // steadily decreasing
      }));

      const trend = PredictionAnalysisService.calculateTrend(timeSeries);

      expect(trend.direction).toBe('decreasing');
      expect(trend.rateOfChange).toBeLessThan(-0.1);
    });

    it('should detect stable trend for constant values', () => {
      const timeSeries = Array.from({ length: 14 }, (_, i) => ({
        date: `2026-02-${String(i + 1).padStart(2, '0')}`,
        count: 5,
      }));

      const trend = PredictionAnalysisService.calculateTrend(timeSeries);

      expect(trend.direction).toBe('stable');
      expect(trend.rateOfChange).toBe(0);
    });

    it('should calculate percentChange7d correctly', () => {
      // 7 days of 10, then 7 days of 20 => 100% increase
      const timeSeries = [
        ...Array.from({ length: 7 }, (_, i) => ({
          date: `2026-02-${String(i + 1).padStart(2, '0')}`,
          count: 10,
        })),
        ...Array.from({ length: 7 }, (_, i) => ({
          date: `2026-02-${String(i + 8).padStart(2, '0')}`,
          count: 20,
        })),
      ];

      const trend = PredictionAnalysisService.calculateTrend(timeSeries);

      expect(trend.percentChange7d).toBe(100);
    });

    it('should handle empty time-series', () => {
      const trend = PredictionAnalysisService.calculateTrend([]);

      expect(trend.direction).toBe('stable');
      expect(trend.movingAverage7d).toBe(0);
      expect(trend.movingAverage30d).toBe(0);
    });
  });

  describe('detectAnomalies', () => {
    it('should detect anomalous spikes', () => {
      const timeSeries = [
        ...Array.from({ length: 9 }, (_, i) => ({
          date: `2026-02-${String(i + 1).padStart(2, '0')}`,
          count: 5,
        })),
        { date: '2026-02-10', count: 50 }, // spike
      ];

      const anomalies = PredictionAnalysisService.detectAnomalies(timeSeries, 2.0);

      const spikeResult = anomalies.find(a => a.date === '2026-02-10');
      expect(spikeResult?.isAnomaly).toBe(true);
      expect(spikeResult?.zScore).toBeGreaterThan(2.0);
    });

    it('should return empty for fewer than 7 data points', () => {
      const timeSeries = Array.from({ length: 5 }, (_, i) => ({
        date: `2026-02-${String(i + 1).padStart(2, '0')}`,
        count: i + 1,
      }));

      const anomalies = PredictionAnalysisService.detectAnomalies(timeSeries);

      expect(anomalies).toEqual([]);
    });

    it('should return no anomalies for uniform data', () => {
      const timeSeries = Array.from({ length: 10 }, (_, i) => ({
        date: `2026-02-${String(i + 1).padStart(2, '0')}`,
        count: 5,
      }));

      const anomalies = PredictionAnalysisService.detectAnomalies(timeSeries);

      // stddev = 0 => returns empty
      expect(anomalies).toEqual([]);
    });

    it('should respect custom sensitivity', () => {
      const timeSeries = [
        ...Array.from({ length: 9 }, (_, i) => ({
          date: `2026-02-${String(i + 1).padStart(2, '0')}`,
          count: 5,
        })),
        { date: '2026-02-10', count: 15 },
      ];

      // Very strict sensitivity — fewer anomalies
      const strict = PredictionAnalysisService.detectAnomalies(timeSeries, 4.0);
      // Loose sensitivity — more anomalies
      const loose = PredictionAnalysisService.detectAnomalies(timeSeries, 1.0);

      const strictAnomalies = strict.filter(a => a.isAnomaly).length;
      const looseAnomalies = loose.filter(a => a.isAnomaly).length;
      expect(looseAnomalies).toBeGreaterThanOrEqual(strictAnomalies);
    });
  });

  describe('calculateRiskScores', () => {
    it('should score and rank failures by composite risk', async () => {
      const now = new Date();
      const recentDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
      const oldDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000); // 60 days ago

      prismaMock.failureArchive.findMany.mockResolvedValue([
        {
          testName: 'high-risk-test',
          occurrenceCount: 15,
          severity: 'CRITICAL',
          lastOccurrence: recentDate,
          firstOccurrence: oldDate,
        },
        {
          testName: 'low-risk-test',
          occurrenceCount: 2,
          severity: 'LOW',
          lastOccurrence: oldDate,
          firstOccurrence: oldDate,
        },
      ]);

      const scores = await PredictionAnalysisService.calculateRiskScores({
        limit: 10,
      });

      expect(scores.length).toBe(2);
      expect(scores[0].testName).toBe('high-risk-test');
      expect(scores[0].score).toBeGreaterThan(scores[1].score);
      expect(scores[0].factors).toHaveLength(4);
      expect(scores[0].level).toMatch(/critical|high/);
    });

    it('should respect limit parameter', async () => {
      prismaMock.failureArchive.findMany.mockResolvedValue(
        Array.from({ length: 10 }, (_, i) => ({
          testName: `test-${i}`,
          occurrenceCount: 10 - i,
          severity: 'MEDIUM',
          lastOccurrence: new Date(),
          firstOccurrence: new Date(),
        })),
      );

      const scores = await PredictionAnalysisService.calculateRiskScores({
        limit: 3,
      });

      expect(scores.length).toBe(3);
    });
  });
});
