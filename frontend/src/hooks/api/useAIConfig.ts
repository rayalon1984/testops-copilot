import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api';
import { queryKeys } from './queryKeys';

type AutonomyLevel = 'conservative' | 'balanced' | 'autonomous';

interface AutonomyResponse {
  data: { autonomyLevel: AutonomyLevel };
}

/** GET /ai/autonomy */
export function useAutonomyPreference() {
  return useQuery<AutonomyResponse>({
    queryKey: queryKeys.ai.autonomy(),
    queryFn: () => api.get<AutonomyResponse>('/ai/autonomy'),
  });
}

/** PUT /ai/autonomy */
export function useUpdateAutonomy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (level: AutonomyLevel) =>
      api.put<AutonomyResponse>('/ai/autonomy', { autonomyLevel: level }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ai.autonomy() });
    },
  });
}

interface CostMetrics {
  totalCost: number;
  monthlySpent: number;
  monthlyBudget: number;
  cacheSavings: number;
  cacheHitRate: number;
  averageCostPerAnalysis: number;
  totalAnalyses: number;
}

/** GET /ai/costs?timeRange= */
export function useCostMetrics(timeRange: string, initialData?: CostMetrics) {
  return useQuery({
    queryKey: queryKeys.ai.costMetrics(timeRange),
    queryFn: () => api.get<CostMetrics>(`/ai/costs?timeRange=${timeRange}`),
    initialData,
  });
}

interface CostData {
  totalCost: number;
  monthlySpent: number;
  monthlyBudget: number;
  cacheSavings: number;
  cacheHitRate: number;
}

/** GET /ai/costs — compact quota view, polls every 60s */
export function useAIQuota() {
  return useQuery<{ data: CostData }>({
    queryKey: queryKeys.ai.quota(),
    queryFn: () => api.get<{ data: CostData }>('/ai/costs'),
    refetchInterval: 60000,
    staleTime: 30000,
  });
}
