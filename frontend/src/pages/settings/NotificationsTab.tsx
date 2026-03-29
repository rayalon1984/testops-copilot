import { useState, useEffect } from 'react';
import {
  Grid,
  Card,
  CardContent,
  CardHeader,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Box,
} from '@mui/material';
import { Save as SaveIcon } from '@mui/icons-material';
import type { SettingsTabProps } from './types';

export function NotificationsTab({ settings, updateSettings, onSubmit }: SettingsTabProps): React.ReactElement {
  const [notifications, setNotifications] = useState(settings.notifications);

  useEffect(() => {
    setNotifications(settings.notifications);
  }, [settings.notifications]);

  const handleSubmit = (e: React.FormEvent): void => {
    settings.notifications = notifications;
    onSubmit(e);
  };

  return (
    <form onSubmit={handleSubmit}>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Card>
            <CardHeader title="Slack Integration" />
            <CardContent>
              <FormControlLabel
                control={
                  <Switch
                    checked={notifications.slack.enabled}
                    onChange={(e) => {
                      const updated = { ...notifications, slack: { ...notifications.slack, enabled: e.target.checked } };
                      setNotifications(updated);
                      updateSettings.mutate({ notifications: updated });
                    }}
                  />
                }
                label="Enable Slack Notifications"
              />
              <TextField
                margin="normal"
                fullWidth
                label="Webhook URL"
                value={notifications.slack.webhookUrl}
                onChange={(e) => setNotifications({ ...notifications, slack: { ...notifications.slack, webhookUrl: e.target.value } })}
                disabled={!notifications.slack.enabled}
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card>
            <CardHeader title="Email Notifications" />
            <CardContent>
              <FormControlLabel
                control={
                  <Switch
                    checked={notifications.email.enabled}
                    onChange={(e) => {
                      const updated = { ...notifications, email: { ...notifications.email, enabled: e.target.checked } };
                      setNotifications(updated);
                      updateSettings.mutate({ notifications: updated });
                    }}
                  />
                }
                label="Enable Email Notifications"
              />
              {/* Email recipients list */}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
        <Button type="submit" variant="contained" startIcon={<SaveIcon />}>
          Save Notification Settings
        </Button>
      </Box>
    </form>
  );
}
