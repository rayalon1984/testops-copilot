import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api';
import { queryKeys } from './queryKeys';

export interface AppNotification {
  id: string;
  type: 'success' | 'failure' | 'warning';
  message: string;
  timestamp: string;
  read: boolean;
  delivered?: boolean;
  pipelineName?: string;
}

/** GET /notifications/unread — polls every 30s */
export function useUnreadNotifications() {
  return useQuery<AppNotification[]>({
    queryKey: queryKeys.notifications.unread(),
    queryFn: () => api.get<AppNotification[]>('/notifications/unread'),
    refetchInterval: 30000,
  });
}

/** GET /notifications or /notifications/undelivered */
export function useNotifications(showUndeliveredOnly: boolean) {
  return useQuery<AppNotification[]>({
    queryKey: queryKeys.notifications.list(showUndeliveredOnly),
    queryFn: () => {
      const path = showUndeliveredOnly ? '/notifications/undelivered' : '/notifications';
      return api.get<AppNotification[]>(path);
    },
  });
}

/** PATCH /notifications/:id/read */
export function useMarkNotificationAsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all() });
    },
  });
}

/** POST /notifications/mark-all-read */
export function useMarkAllNotificationsAsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/notifications/mark-all-read'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all() });
    },
  });
}

/** PATCH /notifications/:id/delivered */
export function useMarkNotificationAsDelivered() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/delivered`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all() });
    },
  });
}

/** DELETE /notifications/:id */
export function useDeleteNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/notifications/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all() });
    },
  });
}

/** DELETE /notifications */
export function useClearAllNotifications() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete('/notifications'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all() });
    },
  });
}
