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
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  Save as SaveIcon,
  Shield as ShieldIcon,
  Balance as BalanceIcon,
  AutoFixHigh as AutoIcon,
} from '@mui/icons-material';
import { api } from '../api';

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

function NotificationsTab({
  settings,
  updateSettings,
  onSubmit,
}: {
  settings: Settings;
  updateSettings: ReturnType<typeof useMutation<Settings, Error, Partial<Settings>>>;
  onSubmit: (e: React.FormEvent) => void;
}) {
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

function CICDTab({
  settings,
  updateSettings,
  onSubmit,
}: {
  settings: Settings;
  updateSettings: ReturnType<typeof useMutation<Settings, Error, Partial<Settings>>>;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit}>
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
  );
}

function GeneralTab({
  settings,
  updateSettings,
  onSubmit,
}: {
  settings: Settings;
  updateSettings: ReturnType<typeof useMutation<Settings, Error, Partial<Settings>>>;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit}>
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
    queryFn: () => api.get<Settings>('/settings'),
  });

  // Update settings mutation
  const updateSettings = useMutation({
    mutationFn: (newSettings: Partial<Settings>) => api.put<Settings>('/settings', newSettings),
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
          <Tab label="AI Copilot" />
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

        <TabPanel value={tabValue} index={0}>
          <NotificationsTab settings={settings} updateSettings={updateSettings} onSubmit={handleSaveNotifications} />
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <CICDTab settings={settings} updateSettings={updateSettings} onSubmit={handleSaveCICD} />
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <GeneralTab settings={settings} updateSettings={updateSettings} onSubmit={handleSaveGeneral} />
        </TabPanel>

        {/* AI Copilot Settings */}
        <TabPanel value={tabValue} index={3}>
          <AutonomyPreferencePanel />
        </TabPanel>
      </Paper>
    </Container>
  );
}

// ─── Autonomy Preference Panel (Sprint 6) ───

type AutonomyLevel = 'conservative' | 'balanced' | 'autonomous';

const AUTONOMY_DESCRIPTIONS: Record<AutonomyLevel, { label: string; description: string; icon: React.ReactNode }> = {
  conservative: {
    label: 'Conservative',
    description: 'All write operations require your explicit approval. Best for production environments or when learning the AI features.',
    icon: <ShieldIcon sx={{ fontSize: 20 }} />,
  },
  balanced: {
    label: 'Balanced',
    description: 'Internal/reversible actions auto-execute. Team-visible actions show a card for one-click approval. Destructive actions require full confirmation.',
    icon: <BalanceIcon sx={{ fontSize: 20 }} />,
  },
  autonomous: {
    label: 'Autonomous',
    description: 'The AI handles most actions automatically, only pausing for destructive or irreversible operations. Best for experienced users who trust the AI.',
    icon: <AutoIcon sx={{ fontSize: 20 }} />,
  },
};

function AutonomyPreferencePanel() {
  const [saveSuccess, setSaveSuccess] = useState('');
  const [saveError, setSaveError] = useState('');
  const queryClient = useQueryClient();

  const { data: autonomyData, isLoading } = useQuery<{ data: { autonomyLevel: AutonomyLevel } }>({
    queryKey: ['autonomy-preference'],
    queryFn: () => api.get<{ data: { autonomyLevel: AutonomyLevel } }>('/ai/autonomy'),
  });

  const updateAutonomy = useMutation({
    mutationFn: (level: AutonomyLevel) =>
      api.put<{ data: { autonomyLevel: AutonomyLevel } }>('/ai/autonomy', { autonomyLevel: level }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['autonomy-preference'] });
      setSaveSuccess('Autonomy preference updated');
      setTimeout(() => setSaveSuccess(''), 3000);
    },
    onError: (err: Error) => {
      setSaveError(err.message);
      setTimeout(() => setSaveError(''), 5000);
    },
  });

  const currentLevel = autonomyData?.data?.autonomyLevel || 'balanced';

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  return (
    <Card>
      <CardHeader
        title="AI Autonomy Level"
        subheader="Control how much independence the AI Copilot has when taking actions on your behalf."
      />
      <CardContent>
        {saveSuccess && <Alert severity="success" sx={{ mb: 2 }}>{saveSuccess}</Alert>}
        {saveError && <Alert severity="error" sx={{ mb: 2 }}>{saveError}</Alert>}

        <ToggleButtonGroup
          value={currentLevel}
          exclusive
          onChange={(_, value: AutonomyLevel | null) => {
            if (value) updateAutonomy.mutate(value);
          }}
          fullWidth
          sx={{ mb: 3 }}
        >
          {(Object.entries(AUTONOMY_DESCRIPTIONS) as [AutonomyLevel, typeof AUTONOMY_DESCRIPTIONS[AutonomyLevel]][]).map(
            ([level, { label, icon }]) => (
              <ToggleButton
                key={level}
                value={level}
                sx={{
                  textTransform: 'none',
                  py: 1.5,
                  display: 'flex',
                  gap: 1,
                  fontWeight: currentLevel === level ? 700 : 400,
                }}
              >
                {icon}
                {label}
              </ToggleButton>
            )
          )}
        </ToggleButtonGroup>

        <Paper variant="outlined" sx={{ p: 2, bgcolor: 'action.hover' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            {AUTONOMY_DESCRIPTIONS[currentLevel].icon}
            <Typography variant="subtitle2" fontWeight={600}>
              {AUTONOMY_DESCRIPTIONS[currentLevel].label}
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            {AUTONOMY_DESCRIPTIONS[currentLevel].description}
          </Typography>
        </Paper>

        <Box sx={{ mt: 3 }}>
          <Typography variant="caption" color="text.secondary">
            The bright-line rule: Visible to the team = user decides. Internal/reversible = AI acts.
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}