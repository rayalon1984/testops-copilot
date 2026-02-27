import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api';
import type { ApiSchemas } from '../../api';

type FailureInsights = ApiSchemas['FailureInsights'];
type Failure = ApiSchemas['FailureSearchResult'];
type Comment = ApiSchemas['FailureComment'];

export const failureKeys = {
  insights: (days: number) => ['failure-archive', 'insights', days] as const,
  search: (params: Record<string, string>) => ['failure-archive', 'search', params] as const,
  comments: (failureId: string) => ['failure-archive', failureId, 'comments'] as const,
};

/** GET /failure-archive/insights?days= */
export function useFailureInsights(days = 30) {
  return useQuery<FailureInsights>({
    queryKey: failureKeys.insights(days),
    queryFn: () => api.get<FailureInsights>(`/failure-archive/insights?days=${days}`),
  });
}

/** GET /failure-archive/search?... */
export function useFailureSearch(params: Record<string, string>) {
  return useQuery<{ failures: Failure[]; total: number }>({
    queryKey: failureKeys.search(params),
    queryFn: () => {
      const qs = new URLSearchParams(params).toString();
      return api.get<{ failures: Failure[]; total: number }>(`/failure-archive/search?${qs}`);
    },
  });
}

/** GET /failure-archive/:id/comments */
export function useFailureComments(failureId: string) {
  return useQuery({
    queryKey: failureKeys.comments(failureId),
    queryFn: async () => {
      const json = await api.get<{ success: boolean; data: { comments: Comment[]; total: number } }>(
        `/failure-archive/${failureId}/comments`,
      );
      return json.success ? json.data.comments : [];
    },
    enabled: !!failureId,
  });
}

/** POST /failure-archive/:id/comments */
export function useAddFailureComment(failureId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (content: string) =>
      api.post(`/failure-archive/${failureId}/comments`, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: failureKeys.comments(failureId) });
    },
  });
}

/** DELETE /failure-archive/:id/comments/:commentId */
export function useDeleteFailureComment(failureId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) =>
      api.delete(`/failure-archive/${failureId}/comments/${commentId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: failureKeys.comments(failureId) });
    },
  });
}
