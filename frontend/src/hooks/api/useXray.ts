/**
 * Xray Integration Hooks
 *
 * React Query hooks for Xray Cloud test management:
 * - Test connection validation (Admin only)
 * - Search test cases / test plans (with coverage data)
 * - View single test plan detail with test cases
 * - Sync test runs to Xray as Test Executions
 * - View sync history and status
 * - Read / update Xray config (auto-sync toggle)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api';
import { queryKeys } from './queryKeys';

// ─── Types ───────────────────────────────────────────────────

export interface XrayTestCase {
  key: string;
  summary: string;
  status: string;
  lastExecution: string | null;
}

export interface XrayTestPlan {
  key: string;
  summary: string;
  testCount: number;
  passRate: number;
  coveragePercentage: number;
  coveredCount: number;
  lastUpdated: string | null;
}

export interface XrayTestPlanDetail extends XrayTestPlan {
  testCases: XrayTestCase[];
}

export interface XraySyncRecord {
  id: string;
  testRunId: string;
  xrayExecutionId: string | null;
  projectKey: string;
  status: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';
  trigger: 'MANUAL' | 'AUTO';
  resultCount: number;
  errorMessage: string | null;
  syncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface XraySyncResult {
  syncId: string;
  status: string;
  xrayExecutionId: string | null;
  resultCount: number;
}

export interface XrayConfig {
  configured: boolean;
  autoSync: boolean;
}

// ─── Queries ─────────────────────────────────────────────────

export function useXrayTestCases(query: string, limit = 10) {
  return useQuery({
    queryKey: queryKeys.xray.testCases(query),
    queryFn: async () => {
      const json = await api.get<{ testCases: XrayTestCase[] }>(
        `/xray/test-cases?q=${encodeURIComponent(query)}&limit=${limit}`,
      );
      return json.testCases;
    },
    enabled: query.length > 0,
  });
}

export function useXrayTestPlans() {
  return useQuery({
    queryKey: queryKeys.xray.testPlans(),
    queryFn: async () => {
      const json = await api.get<{ testPlans: XrayTestPlan[]; total: number }>('/xray/test-plans');
      return json;
    },
  });
}

export function useXrayTestPlanDetail(planId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.xray.testPlanDetail(planId),
    queryFn: async () => {
      const json = await api.get<XrayTestPlanDetail>(`/xray/test-plans/${planId}`);
      return json;
    },
    enabled: !!planId,
  });
}

export function useXraySyncHistory(limit = 20) {
  return useQuery({
    queryKey: queryKeys.xray.syncHistory(),
    queryFn: async () => {
      const json = await api.get<{ syncs: XraySyncRecord[]; total: number }>(`/xray/syncs?limit=${limit}`);
      return json;
    },
  });
}

export function useXraySyncStatus(syncId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.xray.syncStatus(syncId),
    queryFn: async () => {
      const json = await api.get<XraySyncRecord>(`/xray/syncs/${syncId}`);
      return json;
    },
    enabled: !!syncId,
  });
}

export function useXrayConfig() {
  return useQuery({
    queryKey: queryKeys.xray.config(),
    queryFn: async () => {
      const json = await api.get<XrayConfig>('/xray/config');
      return json;
    },
  });
}

// ─── Mutations ───────────────────────────────────────────────

export function useXrayTestConnection() {
  return useMutation({
    mutationFn: async () => {
      const json = await api.get<{ connected: boolean }>('/xray/test-connection');
      return json;
    },
  });
}

export function useXraySyncTestRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (testRunId: string) => {
      const json = await api.post<XraySyncResult>(`/xray/sync/${testRunId}`);
      return json;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.xray.syncHistory() });
    },
  });
}

export function useUpdateXrayConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: { autoSync?: boolean }) => {
      const json = await api.patch<{ autoSync: boolean; message: string }>('/xray/config', patch);
      return json;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.xray.config() });
    },
  });
}
