import { useQuery } from '@tanstack/react-query';
import { api } from '../../api';
import type { ApiSchemas } from '../../api';
import { queryKeys } from './queryKeys';

type DashboardMetrics = ApiSchemas['DashboardMetrics'];

/** GET /dashboard — polls every 30s */
export function useDashboardMetrics() {
  return useQuery<DashboardMetrics>({
    queryKey: queryKeys.dashboard.metrics(),
    queryFn: async () => {
      const response = await api.get<{ data: DashboardMetrics }>('/dashboard');
      return response.data;
    },
    refetchInterval: 30000,
  });
}
