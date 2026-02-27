import { useQuery } from '@tanstack/react-query';
import { api } from '../../api';
import { queryKeys } from './queryKeys';

interface FlakyTestStats {
  testName: string;
  totalRuns: number;
  failureCount: number;
  flipFlopCount: number;
  flakinessScore: number;
  severity: 'HIGH' | 'MEDIUM' | 'LOW' | 'STABLE';
  lastFlakedAt?: string;
}

/** GET /tests/flaky */
export function useFlakyTests() {
  return useQuery<FlakyTestStats[]>({
    queryKey: queryKeys.tests.flaky(),
    queryFn: async () => {
      const response = await api.get<{ data: FlakyTestStats[] }>('/tests/flaky');
      return response.data;
    },
  });
}
