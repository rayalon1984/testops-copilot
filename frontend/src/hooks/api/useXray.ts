/**
 * Xray Integration Hooks
 *
 * React Query hooks for Xray Cloud test management:
 * - Test connection validation (Admin only)
 * - Search test cases / test plans
 * - Sync test runs to Xray as Test Executions
 * - View sync history and status
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
}

export interface XraySyncRecord {
  id: string;
  testRunId: string;
  xrayExecutionId: string | null;
  projectKey: string;
  status: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';
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

// ─── Queries ─────────────────────────────────────────────────

export function useXrayTestCases(query: string, limit = 10) {
  return useQuery({
    queryKey: queryKeys.xray.testCases(query),
    queryFn: async () => {
      const json = await api.get<{ data: XrayTestCase[] }>(
        `/xray/test-cases?query=${encodeURIComponent(query)}&limit=${limit}`,
      );
      return json.data;
    },
    enabled: query.length > 0,
  });
}

export function useXrayTestPlans() {
  return useQuery({
    queryKey: queryKeys.xray.testPlans(),
    queryFn: async () => {
      const json = await api.get<{ data: XrayTestPlan[] }>('/xray/test-plans');
      return json.data;
    },
  });
}

export function useXraySyncHistory(limit = 20) {
  return useQuery({
    queryKey: queryKeys.xray.syncHistory(),
    queryFn: async () => {
      const json = await api.get<{ data: XraySyncRecord[] }>(`/xray/syncs?limit=${limit}`);
      return json.data;
    },
  });
}

export function useXraySyncStatus(syncId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.xray.syncStatus(syncId),
    queryFn: async () => {
      const json = await api.get<{ data: XraySyncRecord }>(`/xray/syncs/${syncId}`);
      return json.data;
    },
    enabled: !!syncId,
  });
}

// ─── Mutations ───────────────────────────────────────────────

export function useXrayTestConnection() {
  return useMutation({
    mutationFn: async () => {
      const json = await api.post<{ data: { connected: boolean } }>('/xray/test-connection');
      return json.data;
    },
  });
}

export function useXraySyncTestRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (testRunId: string) => {
      const json = await api.post<{ data: XraySyncResult }>(`/xray/sync/${testRunId}`);
      return json.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.xray.syncHistory() });
    },
  });
}
