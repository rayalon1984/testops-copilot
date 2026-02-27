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
  return (
    <form onSubmit={onSubmit}>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Card>
            <CardHeader title="Slack Integration" />
            <CardContent>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.notifications.slack.enabled}
                    onChange={(e) => {
                      settings.notifications.slack.enabled = e.target.checked;
                      updateSettings.mutate({ notifications: settings.notifications });
                    }}
                  />
                }
                label="Enable Slack Notifications"
              />
              <TextField
                margin="normal"
                fullWidth
                label="Webhook URL"
                value={settings.notifications.slack.webhookUrl}
                onChange={(e) => {
                  settings.notifications.slack.webhookUrl = e.target.value;
                }}
                disabled={!settings.notifications.slack.enabled}
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
                    checked={settings.notifications.email.enabled}
                    onChange={(e) => {
                      settings.notifications.email.enabled = e.target.checked;
                      updateSettings.mutate({ notifications: settings.notifications });
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
