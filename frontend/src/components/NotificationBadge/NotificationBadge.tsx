import { useState } from 'react';
import {
  Badge,
  IconButton,
  Popover,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Typography,
  Box,
  Button,
  Divider,
  useTheme,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Done as DoneIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useUnreadNotifications, useMarkNotificationAsRead, useMarkAllNotificationsAsRead, type AppNotification } from '../../hooks/api';

export default function NotificationBadge() {
  const theme = useTheme();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);

  // Shared query hooks
  const { data: notifications = [] } = useUnreadNotifications();
  const markAsRead = useMarkNotificationAsRead();
  const markAllAsRead = useMarkAllNotificationsAsRead();

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleNotificationClick = (notification: AppNotification) => {
    markAsRead.mutate(notification.id);
    handleClose();
    navigate('/notifications');
  };

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

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <>
      <IconButton color="inherit" onClick={handleClick}>
        <Badge badgeContent={unreadCount} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>

      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { width: 360, maxHeight: 480 } }}
      >
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6" sx={{ flex: 1 }}>Notifications</Typography>
          {unreadCount > 0 && (
            <Button size="small" startIcon={<DoneIcon />} onClick={() => markAllAsRead.mutate(undefined, { onSuccess: () => handleClose() })}>
              Mark all as read
            </Button>
          )}
        </Box>

        <Divider />

        <List sx={{ p: 0 }}>
          {notifications.length === 0 ? (
            <ListItem>
              <ListItemText primary="No new notifications" sx={{ textAlign: 'center', color: 'text.secondary' }} />
            </ListItem>
          ) : (
            notifications.map((notification) => (
              <ListItem
                key={notification.id}
                button
                onClick={() => handleNotificationClick(notification)}
                sx={{ bgcolor: notification.read ? 'transparent' : theme.palette.action.hover }}
              >
                <ListItemIcon>{getNotificationIcon(notification.type)}</ListItemIcon>
                <ListItemText
                  primary={notification.message}
                  secondary={new Date(notification.timestamp).toLocaleString()}
                  primaryTypographyProps={{ variant: 'body2', color: notification.read ? 'text.secondary' : 'text.primary' }}
                />
              </ListItem>
            ))
          )}
        </List>

        <Divider />

        <Box sx={{ p: 1 }}>
          <Button fullWidth size="small" onClick={() => { handleClose(); navigate('/notifications'); }}>
            View All Notifications
          </Button>
        </Box>
      </Popover>
    </>
  );
}