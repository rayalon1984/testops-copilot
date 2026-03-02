import { useState } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Tabs,
  Tab,
  Alert,
  CircularProgress,
} from '@mui/material';
import type { Settings as SettingsType } from './settings/types';
import { TabPanel } from './settings/TabPanel';
import { NotificationsTab } from './settings/NotificationsTab';
import { CICDTab } from './settings/CICDTab';
import { GeneralTab } from './settings/GeneralTab';
import { AutonomyTab } from './settings/AutonomyTab';
import { XrayTab } from './settings/XrayTab';
import { useSettings, useUpdateSettings } from '../hooks/api';

export default function Settings() {
  const [tabValue, setTabValue] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { data: settings, isLoading } = useSettings();

  const updateSettings = useUpdateSettings();

  // Wire up local success/error feedback on top of the shared mutation
  const handleMutate = (newSettings: Partial<SettingsType>) => {
    updateSettings.mutate(newSettings, {
      onSuccess: () => {
        setSuccess('Settings updated successfully');
        setTimeout(() => setSuccess(''), 3000);
      },
      onError: (err: Error) => {
        setError(err.message);
      },
    });
  };

  const handleSave = (section: keyof SettingsType) => (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    handleMutate({ [section]: settings[section] });
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
          <Tab label="Xray" />
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
          <NotificationsTab settings={settings} updateSettings={updateSettings} onSubmit={handleSave('notifications')} />
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <CICDTab settings={settings} updateSettings={updateSettings} onSubmit={handleSave('cicd')} />
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <GeneralTab settings={settings} updateSettings={updateSettings} onSubmit={handleSave('general')} />
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <AutonomyTab />
        </TabPanel>

        <TabPanel value={tabValue} index={4}>
          <XrayTab />
        </TabPanel>
      </Paper>
    </Container>
  );
}
