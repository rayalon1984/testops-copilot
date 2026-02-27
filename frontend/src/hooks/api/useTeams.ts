/**
 * Team Management Hooks
 *
 * React Query hooks for team CRUD, member management, and role updates.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api';
import type { ApiSchemas } from '../../api';
import { queryKeys } from './queryKeys';

type Team = ApiSchemas['Team'];
type TeamListItem = ApiSchemas['TeamListItem'];

// ─── Queries ──────────────────────────────────────────────────

export function useTeams() {
  return useQuery({
    queryKey: queryKeys.teams.all(),
    queryFn: async () => {
      const json = await api.get<{ success: boolean; data: TeamListItem[] }>('/teams');
      return json.data;
    },
  });
}

export function useTeamDetail(teamId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.teams.detail(teamId),
    queryFn: async () => {
      const json = await api.get<{ success: boolean; data: Team }>(`/teams/${teamId}`);
      return json.data;
    },
    enabled: !!teamId,
  });
}

// ─── Mutations ────────────────────────────────────────────────

export function useCreateTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; slug: string; description: string }) => {
      const json = await api.post<{ success: boolean; data: Team }>('/teams', data);
      return json.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.teams.all() });
    },
  });
}

export function useAddTeamMember(teamId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { userId: string; role: string }) => {
      const json = await api.post<{ success: boolean }>(`/teams/${teamId}/members`, data);
      return json;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.teams.detail(teamId) });
    },
  });
}

export function useRemoveTeamMember(teamId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      await api.delete(`/teams/${teamId}/members/${userId}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.teams.detail(teamId) });
    },
  });
}

export function useUpdateTeamMemberRole(teamId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      await api.put(`/teams/${teamId}/members/${userId}/role`, { role });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.teams.detail(teamId) });
    },
  });
}
