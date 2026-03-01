/**
 * useStarterPrompts — React Query hooks for smart starter prompts.
 *
 * Fetches role-based + context-aware prompts, manages user pins.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api';
import { queryKeys } from './queryKeys';

// ─── Types ─────────────────────────────────────────────────────

export interface StarterPrompt {
  id: string;
  label: string;
  prompt: string;
  icon?: string;
  category?: string;
  pinned: boolean;
  source: 'pin' | 'context' | 'role';
}

export interface PinnedPromptEntry {
  id?: string;
  label: string;
  prompt: string;
}

// ─── Queries ───────────────────────────────────────────────────

/** Fetch resolved starter prompts for the current user. */
export function useStarterPrompts() {
  return useQuery({
    queryKey: queryKeys.ai.starterPrompts(),
    queryFn: async () => {
      const json = await api.get<{ data: { prompts: StarterPrompt[] } }>('/ai/starter-prompts');
      return json.data.prompts;
    },
    staleTime: 5 * 60 * 1000, // 5 min — matches API Cache-Control
  });
}

/** Fetch full prompt catalog for the settings UI. */
export function useStarterPromptCatalog() {
  return useQuery({
    queryKey: queryKeys.ai.starterCatalog(),
    queryFn: async () => {
      const json = await api.get<{ data: { rolePrompts: StarterPrompt[]; fullCatalog: Record<string, StarterPrompt[]> } }>(
        '/ai/starter-prompts/catalog',
      );
      return json.data;
    },
    staleTime: 30 * 60 * 1000, // 30 min — catalog rarely changes
  });
}

// ─── Mutations ─────────────────────────────────────────────────

/** Save user's pinned prompts. */
export function useSavePinnedPrompts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (pins: PinnedPromptEntry[]) => {
      const json = await api.patch<{ data: { prompts: StarterPrompt[] } }>(
        '/ai/starter-prompts/pins',
        { pins },
      );
      return json.data.prompts;
    },
    onSuccess: (prompts) => {
      // Optimistically update the cache with the new resolved prompts
      queryClient.setQueryData(queryKeys.ai.starterPrompts(), prompts);
    },
  });
}

/** Reset to role defaults. */
export function useResetPinnedPrompts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const json = await api.delete<{ data: { prompts: StarterPrompt[] } }>(
        '/ai/starter-prompts/pins',
      );
      return json.data.prompts;
    },
    onSuccess: (prompts) => {
      queryClient.setQueryData(queryKeys.ai.starterPrompts(), prompts);
    },
  });
}
