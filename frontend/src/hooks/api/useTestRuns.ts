import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from '../../api';
import type { ApiSchemas } from '../../api';
import { queryKeys } from './queryKeys';

type TestRun = ApiSchemas['TestRun'];
type TestRunDetail = ApiSchemas['TestRunDetail'];

interface TestRunListFilters {
  page: number;
  rowsPerPage: number;
  statusFilter: string;
  debouncedSearch: string;
}

export interface PaginatedTestRuns {
  data: TestRun[];
  total: number;
  page: number;
  limit: number;
}

/** GET /test-runs?page=&limit=&status=&search= */
export function useTestRuns({ page, rowsPerPage, statusFilter, debouncedSearch }: TestRunListFilters) {
  return useQuery<PaginatedTestRuns>({
    queryKey: queryKeys.testRuns.list({
      page,
      limit: rowsPerPage,
      status: statusFilter,
      search: debouncedSearch,
    }),
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page + 1),
        limit: String(rowsPerPage),
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(debouncedSearch && { search: debouncedSearch }),
      });
      return api.get<PaginatedTestRuns>(`/test-runs?${params}`);
    },
    placeholderData: keepPreviousData,
  });
}

/** GET /test-runs/:id */
export function useTestRun(id: string | undefined) {
  return useQuery<TestRunDetail>({
    queryKey: queryKeys.testRuns.detail(id),
    queryFn: () => api.get<TestRunDetail>(`/test-runs/${id}`),
    enabled: !!id,
  });
}
