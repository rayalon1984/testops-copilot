import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Container,
  Paper,
  Typography,
  Box,
  Tabs,
  Tab,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
  Grid,
  Card,
  CardContent,
  CardHeader,
} from '@mui/material';
import {
  Save as SaveIcon,
} from '@mui/icons-material';

interface Settings {
  notifications: {
    slack: {
      enabled: boolean;
      webhookUrl: string;
    };
    email: {
      enabled: boolean;
      recipients: string[];
    };
  };
  cicd: {
    jenkins: {
      enabled: boolean;
      url: string;
      username: string;
      apiToken: string;
    };
    github: {
      enabled: boolean;
      apiToken: string;
      repositories: string[];
    };
  };
  general: {
    autoRefresh: boolean;
    refreshInterval: number;
    theme: 'light' | 'dark';
  };
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export default function Settings() {
  const [tabValue, setTabValue] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const queryClient = useQueryClient();

  // Fetch settings
  const { data: settings, isLoading } = useQuery<Settings>({
    queryKey: ['settings'],
    queryFn: async () => {
      const response = await fetch('/api/v1/settings');
      if (!response.ok) throw new Error('Failed to fetch settings');
      return response.json();
    },
  });

  // Update settings mutation
  const updateSettings = useMutation({
    mutationFn: async (newSettings: Partial<Settings>) => {
      const response = await fetch('/api/v1/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newSettings),
      });
      if (!response.ok) throw new Error('Failed to update settings');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setSuccess('Settings updated successfully');
      setTimeout(() => setSuccess(''), 3000);
    },
    onError: (error: Error) => {
      setError(error.message);
    },
  });

  const handleSaveNotifications = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;

    updateSettings.mutate({
      notifications: settings.notifications,
    });
  };

  const handleSaveCICD = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;

    updateSettings.mutate({
      cicd: settings.cicd,
    });
  };

  const handleSaveGeneral = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;

    updateSettings.mutate({
      general: settings.general,
    });
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!settings) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="error">Failed to load settings</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h5" sx={{ mb: 3 }}>
        Settings
      </Typography>

      <Paper sx={{ width: '100%' }}>
        <Tabs
          value={tabValue}
          onChange={(_, newValue) => setTabValue(newValue)}
          indicatorColor="primary"
          textColor="primary"
        >
          <Tab label="Notifications" />
          <Tab label="CI/CD Integration" />
          <Tab label="General" />
        </Tabs>

        {error && (
          <Alert severity="error" sx={{ m: 2 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ m: 2 }}>
            {success}
          </Alert>
        )}

        {/* Notifications Settings */}
        <TabPanel value={tabValue} index={0}>
          <form onSubmit={handleSaveNotifications}>
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
        </TabPanel>

        {/* CI/CD Integration Settings */}
        <TabPanel value={tabValue} index={1}>
          <form onSubmit={handleSaveCICD}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Card>
                  <CardHeader title="Jenkins Integration" />
                  <CardContent>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={settings.cicd.jenkins.enabled}
                          onChange={(e) => {
                            settings.cicd.jenkins.enabled = e.target.checked;
                            updateSettings.mutate({ cicd: settings.cicd });
                          }}
                        />
                      }
                      label="Enable Jenkins Integration"
                    />
                    <TextField
                      margin="normal"
                      fullWidth
                      label="Jenkins URL"
                      value={settings.cicd.jenkins.url}
                      onChange={(e) => {
                        settings.cicd.jenkins.url = e.target.value;
                      }}
                      disabled={!settings.cicd.jenkins.enabled}
                    />
                    <TextField
                      margin="normal"
                      fullWidth
                      label="Username"
                      value={settings.cicd.jenkins.username}
                      onChange={(e) => {
                        settings.cicd.jenkins.username = e.target.value;
                      }}
                      disabled={!settings.cicd.jenkins.enabled}
                    />
                    <TextField
                      margin="normal"
                      fullWidth
                      label="API Token"
                      type="password"
                      value={settings.cicd.jenkins.apiToken}
                      onChange={(e) => {
                        settings.cicd.jenkins.apiToken = e.target.value;
                      }}
                      disabled={!settings.cicd.jenkins.enabled}
                    />
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12}>
                <Card>
                  <CardHeader title="GitHub Integration" />
                  <CardContent>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={settings.cicd.github.enabled}
                          onChange={(e) => {
                            settings.cicd.github.enabled = e.target.checked;
                            updateSettings.mutate({ cicd: settings.cicd });
                          }}
                        />
                      }
                      label="Enable GitHub Integration"
                    />
                    <TextField
                      margin="normal"
                      fullWidth
                      label="API Token"
                      type="password"
                      value={settings.cicd.github.apiToken}
                      onChange={(e) => {
                        settings.cicd.github.apiToken = e.target.value;
                      }}
                      disabled={!settings.cicd.github.enabled}
                    />
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
              <Button type="submit" variant="contained" startIcon={<SaveIcon />}>
                Save CI/CD Settings
              </Button>
            </Box>
          </form>
        </TabPanel>

        {/* General Settings */}
        <TabPanel value={tabValue} index={2}>
          <form onSubmit={handleSaveGeneral}>
            <Card>
              <CardHeader title="Application Settings" />
              <CardContent>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.general.autoRefresh}
                      onChange={(e) => {
                        settings.general.autoRefresh = e.target.checked;
                        updateSettings.mutate({ general: settings.general });
                      }}
                    />
                  }
                  label="Enable Auto Refresh"
                />
                <TextField
                  margin="normal"
                  fullWidth
                  type="number"
                  label="Refresh Interval (seconds)"
                  value={settings.general.refreshInterval}
                  onChange={(e) => {
                    settings.general.refreshInterval = parseInt(e.target.value, 10);
                  }}
                  disabled={!settings.general.autoRefresh}
                />
              </CardContent>
            </Card>

            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
              <Button type="submit" variant="contained" startIcon={<SaveIcon />}>
                Save General Settings
              </Button>
            </Box>
          </form>
        </TabPanel>
      </Paper>
    </Container>
  );
}