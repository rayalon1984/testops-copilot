/**
 * Smart Selection React Query Hooks
 *
 * Data fetching hooks for the Smart Test Selection dashboard,
 * regression tracking, and accuracy metrics.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api';
import { queryKeys } from './queryKeys';

// ── Types ────────────────────────────────────────────────────────────────

export interface AccuracyStats {
  totalRecords: number;
  avgPrecision: number;
  avgRecall: number;
  avgF1: number;
  missedRegressionRate: number;
  byStrategy: Record<string, { count: number; avgPrecision: number; avgRecall: number }>;
  trend: Array<{
    period: string;
    avgPrecision: number;
    avgRecall: number;
    avgF1: number;
    totalSelections: number;
    missedRegressions: number;
  }>;
}

export interface RegressionEvent {
  id: string;
  testName: string;
  pipelineId: string;
  introducingCommit: string | null;
  introducingPR: number | null;
  prTitle: string | null;
  prAuthor: string | null;
  testRunId: string;
  lastPassingCommit: string | null;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'detected' | 'confirmed' | 'resolved' | 'false_positive';
  errorMessage: string | null;
  detectedAt: string;
}

export interface RegressionSummary {
  totalRegressions: number;
  openRegressions: number;
  resolvedRegressions: number;
  falsePositives: number;
  avgTimeToDetectMs: number;
  byPipeline: Array<{ pipelineId: string; count: number }>;
  bySeverity: Record<string, number>;
  recentRegressions: RegressionEvent[];
}

export interface RecallHealth {
  healthy: boolean;
  currentRecall: number;
  message: string;
}

// ── Queries ──────────────────────────────────────────────────────────────

/** GET /ci/smart-select/accuracy?days=N */
export function useSelectionAccuracy(windowDays: number = 30) {
  return useQuery<AccuracyStats>({
    queryKey: queryKeys.smartSelection.accuracy(windowDays),
    queryFn: () =>
      api.get<AccuracyStats>(`/ci/smart-select/accuracy?days=${windowDays}`),
  });
}

/** GET /ci/smart-select/regressions?days=N */
export function useRegressionSummary(windowDays: number = 30) {
  return useQuery<RegressionSummary>({
    queryKey: queryKeys.smartSelection.regressions(windowDays),
    queryFn: () =>
      api.get<RegressionSummary>(`/ci/smart-select/regressions?days=${windowDays}`),
  });
}

/** GET /ci/smart-select/recall-health */
export function useRecallHealth() {
  return useQuery<RecallHealth>({
    queryKey: queryKeys.smartSelection.recallHealth(),
    queryFn: () =>
      api.get<RecallHealth>(`/ci/smart-select/recall-health`),
    refetchInterval: 60_000, // Check every minute
  });
}

// ── Mutations ────────────────────────────────────────────────────────────

/** POST /ci/smart-select/regressions/:id/confirm */
export function useConfirmRegression() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (regressionId: string) =>
      api.post(`/ci/smart-select/regressions/${regressionId}/confirm`, {}),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['smart-selection', 'regressions'] });
    },
  });
}

/** POST /ci/smart-select/regressions/:id/false-positive */
export function useMarkFalsePositive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (regressionId: string) =>
      api.post(`/ci/smart-select/regressions/${regressionId}/false-positive`, {}),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['smart-selection', 'regressions'] });
    },
  });
}
