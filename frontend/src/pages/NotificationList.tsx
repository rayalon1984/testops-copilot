import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Container,
  Paper,
  Typography,
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  IconButton,
  CircularProgress,
  FormControlLabel,
  Switch,
  Divider,
  Button,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Delete as DeleteIcon,
  Done as DoneIcon,
} from '@mui/icons-material';

import type { ApiSchemas } from '../api';
type Notification = ApiSchemas['Notification'];

export default function NotificationList() {
  const queryClient = useQueryClient();
  const [showUndeliveredOnly, setShowUndeliveredOnly] = useState(false);

  // Fetch notifications
  const { data: notifications, isLoading } = useQuery<Notification[]>({
    queryKey: ['notifications', showUndeliveredOnly],
    queryFn: async () => {
      const url = showUndeliveredOnly
        ? '/api/v1/notifications/undelivered'
        : '/api/v1/notifications';
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch notifications');
      return response.json();
    },
  });

  // Mark as delivered mutation
  const markAsDelivered = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/v1/notifications/${id}/delivered`, {
        method: 'PATCH',
      });
      if (!response.ok) throw new Error('Failed to mark notification as delivered');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Delete notification mutation
  const deleteNotification = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/v1/notifications/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete notification');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Clear all notifications mutation
  const clearAllNotifications = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/v1/notifications', {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to clear all notifications');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <SuccessIcon color="success" />;
      case 'failure':
        return <ErrorIcon color="error" />;
      case 'warning':
        return <WarningIcon color="warning" />;
      default:
        return <NotificationsIcon />;
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ flexGrow: 1 }}>
          Notifications
        </Typography>
        <FormControlLabel
          control={
            <Switch
              checked={showUndeliveredOnly}
              onChange={(e) => setShowUndeliveredOnly(e.target.checked)}
            />
          }
          label="Show undelivered only"
        />
      </Box>

      <Paper>
        <List>
          {notifications?.map((notification) => (
            <div key={notification.id}>
              <ListItem>
                <ListItemIcon>
                  {getNotificationIcon(notification.type)}
                </ListItemIcon>
                <ListItemText
                  primary={notification.message}
                  secondary={
                    <>
                      <Typography component="span" variant="body2" color="text.primary">
                        {notification.pipelineName}
                      </Typography>
                      {' — '}
                      {new Date(notification.timestamp).toLocaleString()}
                    </>
                  }
                />
                <ListItemSecondaryAction>
                  {!notification.delivered && (
                    <IconButton
                      edge="end"
                      onClick={() => markAsDelivered.mutate(notification.id)}
                      sx={{ mr: 1 }}
                    >
                      <DoneIcon />
                    </IconButton>
                  )}
                  <IconButton
                    edge="end"
                    onClick={() => deleteNotification.mutate(notification.id)}
                  >
                    <DeleteIcon />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
              <Divider />
            </div>
          ))}
          {(!notifications || notifications.length === 0) && (
            <ListItem>
              <ListItemText primary="No notifications found" />
            </ListItem>
          )}
        </List>
      </Paper>

      {notifications && notifications.length > 0 && (
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="outlined"
            color="error"
            disabled={clearAllNotifications.isPending}
            onClick={() => {
              if (window.confirm('Are you sure you want to clear all notifications?')) {
                clearAllNotifications.mutate();
              }
            }}
          >
            {clearAllNotifications.isPending ? 'Clearing...' : 'Clear All'}
          </Button>
        </Box>
      )}
    </Container>
  );
}