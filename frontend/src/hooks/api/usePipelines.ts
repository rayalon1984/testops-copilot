import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api';
import type { ApiSchemas } from '../../api';
import { queryKeys } from './queryKeys';

type Pipeline = ApiSchemas['Pipeline'];
type CreatePipelineRequest = ApiSchemas['CreatePipelineRequest'];

/** GET /pipelines */
export function usePipelines() {
  return useQuery<Pipeline[]>({
    queryKey: queryKeys.pipelines.all(),
    queryFn: () => api.get<Pipeline[]>('/pipelines'),
  });
}

/** GET /pipelines/:id */
export function usePipeline(id: string | undefined) {
  return useQuery<Pipeline>({
    queryKey: queryKeys.pipelines.detail(id),
    queryFn: () => api.get<Pipeline>(`/pipelines/${id}`),
    enabled: !!id,
  });
}

/** GET /pipelines/:id/test-runs */
export function usePipelineTestRuns(id: string | undefined) {
  return useQuery<ApiSchemas['TestRun'][]>({
    queryKey: queryKeys.pipelines.testRuns(id),
    queryFn: () => api.get<ApiSchemas['TestRun'][]>(`/pipelines/${id}/test-runs`),
    enabled: !!id,
  });
}

/** POST /pipelines */
export function useCreatePipeline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePipelineRequest) => api.post<Pipeline>('/pipelines', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pipelines.all() });
    },
  });
}

/** PUT /pipelines/:id */
export function useUpdatePipeline(id: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Pipeline>) => api.put<Pipeline>(`/pipelines/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pipelines.detail(id) });
    },
  });
}

/** POST /pipelines/:id/start */
export function useStartPipeline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<unknown>(`/pipelines/${id}/start`),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pipelines.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.pipelines.testRuns(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.pipelines.all() });
    },
  });
}

/** DELETE /pipelines/:id */
export function useDeletePipeline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/pipelines/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pipelines.all() });
    },
  });
}
