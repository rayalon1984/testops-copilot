/**
 * Self-Healing Pipeline Hooks
 *
 * React Query hooks for healing rules, events, and stats.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api';
import { queryKeys } from './queryKeys';

// ─── Types ────────────────────────────────────────────────

export interface HealingRule {
  id: string;
  name: string;
  description: string;
  pattern: string;
  patternType: string;
  category: string;
  action: string;
  maxRetries: number;
  cooldownMinutes: number;
  confidenceThreshold: number;
  enabled: boolean;
  isBuiltIn: boolean;
  priority: number;
  createdAt: string;
  _count?: { events: number };
}

export interface HealingEvent {
  id: string;
  ruleId: string | null;
  testRunId: string;
  pipelineId: string;
  action: string;
  status: string;
  matchConfidence: number;
  matchReason: string;
  errorMessage: string | null;
  retriedRunId: string | null;
  createdAt: string;
  completedAt: string | null;
  rule?: { name: string; category: string } | null;
}

export interface HealingStats {
  totalEvents: number;
  successfulRetries: number;
  failedRetries: number;
  skippedEvents: number;
  activeRules: number;
  retriesSavedToday: number;
}

// ─── Queries ──────────────────────────────────────────────

export function useHealingRules() {
  return useQuery({
    queryKey: queryKeys.healing.rules(),
    queryFn: async () => {
      const json = await api.get<{ data: HealingRule[] }>('/healing/rules');
      return json.data;
    },
  });
}

export function useHealingEvents(filters?: { pipelineId?: string; limit?: number }) {
  return useQuery({
    queryKey: queryKeys.healing.events(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.pipelineId) params.set('pipelineId', filters.pipelineId);
      if (filters?.limit) params.set('limit', String(filters.limit));
      const qs = params.toString();
      const json = await api.get<{ data: HealingEvent[] }>(`/healing/events${qs ? `?${qs}` : ''}`);
      return json.data;
    },
  });
}

export function useHealingStats() {
  return useQuery({
    queryKey: queryKeys.healing.stats(),
    queryFn: async () => {
      const json = await api.get<{ data: HealingStats }>('/healing/stats');
      return json.data;
    },
    refetchInterval: 30_000, // Refresh every 30 seconds
  });
}

// ─── Mutations ────────────────────────────────────────────

export function useCreateHealingRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<HealingRule>) => {
      const json = await api.post<{ data: HealingRule }>('/healing/rules', data);
      return json.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.healing.rules() });
    },
  });
}

export function useUpdateHealingRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<HealingRule> & { id: string }) => {
      const json = await api.put<{ data: HealingRule }>(`/healing/rules/${id}`, data);
      return json.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.healing.rules() });
    },
  });
}

export function useToggleHealingRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const json = await api.patch<{ data: HealingRule }>(`/healing/rules/${id}/toggle`, { enabled });
      return json.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.healing.rules() });
    },
  });
}

export function useDeleteHealingRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/healing/rules/${id}`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.healing.rules() });
    },
  });
}

export function useEvaluateHealing() {
  return useMutation({
    mutationFn: async (testRunId: string) => {
      const json = await api.post<{ data: unknown }>('/healing/evaluate', { testRunId });
      return json.data;
    },
  });
}

export function useExecuteHealing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (testRunId: string) => {
      const json = await api.post<{ data: unknown }>('/healing/execute', { testRunId });
      return json.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.healing.events() });
      void qc.invalidateQueries({ queryKey: queryKeys.healing.stats() });
    },
  });
}

export function useSeedHealingRules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const json = await api.post<{ data: { seeded: number } }>('/healing/seed', {});
      return json.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.healing.rules() });
    },
  });
}
