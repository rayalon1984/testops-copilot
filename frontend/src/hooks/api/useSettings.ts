import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api';
import { queryKeys } from './queryKeys';
import type { Settings } from '../../pages/settings/types';

/** GET /settings */
export function useSettings() {
  return useQuery<Settings>({
    queryKey: queryKeys.settings.all(),
    queryFn: () => api.get<Settings>('/settings'),
  });
}

/** PUT /settings */
export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (newSettings: Partial<Settings>) => api.put<Settings>('/settings', newSettings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.all() });
    },
  });
}
