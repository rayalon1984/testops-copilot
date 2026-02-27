import { useState } from 'react';
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

import { useNotifications, useMarkNotificationAsDelivered, useDeleteNotification, useClearAllNotifications } from '../hooks/api';

export default function NotificationList() {
  const [showUndeliveredOnly, setShowUndeliveredOnly] = useState(false);

  // Shared query hooks
  const { data: notifications, isLoading } = useNotifications(showUndeliveredOnly);
  const markAsDelivered = useMarkNotificationAsDelivered();
  const deleteNotification = useDeleteNotification();
  const clearAllNotifications = useClearAllNotifications();

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