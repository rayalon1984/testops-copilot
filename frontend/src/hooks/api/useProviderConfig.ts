/**
 * AI Provider Configuration Hooks
 *
 * React Query hooks for fetching, testing, and saving AI provider config.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api';
import { queryKeys } from './queryKeys';

export interface ProviderConfig {
  provider: string;
  model: string;
  providerLabel: string;
  modelLabel: string;
  hasApiKey: boolean;
  extraConfig?: Record<string, string>;
  isPersonal?: boolean;
}

// ─── Query ────────────────────────────────────────────────────

export function useProviderConfig() {
  return useQuery({
    queryKey: queryKeys.aiConfig.current(),
    queryFn: async () => {
      const json = await api.get<{ data: ProviderConfig }>('/ai/config');
      return json.data;
    },
  });
}

// ─── Mutations ────────────────────────────────────────────────

export function useTestProviderConnection() {
  return useMutation({
    mutationFn: async (data: { provider: string; model: string; apiKey: string; extraConfig?: Record<string, string> }) => {
      const json = await api.post<{ data: { success: boolean; error?: string } }>('/ai/config/test', data);
      return json.data;
    },
  });
}

export function useSaveProviderConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { provider: string; model: string; apiKey?: string; extraConfig?: Record<string, string> }) => {
      const json = await api.put<{ data: ProviderConfig }>('/ai/config', data);
      return json.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.aiConfig.current() });
    },
  });
}

// ─── Per-User Config ─────────────────────────────────────────

export function useMyProviderConfig() {
  return useQuery({
    queryKey: queryKeys.aiConfig.my(),
    queryFn: async () => {
      const json = await api.get<{ data: ProviderConfig }>('/ai/my-config');
      return json.data;
    },
  });
}

export function useSaveMyProviderConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { provider: string; model: string; apiKey?: string; extraConfig?: Record<string, string> }) => {
      const json = await api.put<{ data: ProviderConfig }>('/ai/my-config', data);
      return json.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.aiConfig.my() });
    },
  });
}

export function useTestMyProviderConnection() {
  return useMutation({
    mutationFn: async (data: { provider: string; model: string; apiKey: string; extraConfig?: Record<string, string> }) => {
      const json = await api.post<{ data: { success: boolean; error?: string } }>('/ai/my-config/test', data);
      return json.data;
    },
  });
}

export function useDeleteMyProviderConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const json = await api.delete<{ data: ProviderConfig }>('/ai/my-config');
      return json.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.aiConfig.my() });
    },
  });
}
