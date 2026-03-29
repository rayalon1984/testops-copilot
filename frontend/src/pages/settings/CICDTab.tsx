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

export function CICDTab({ settings, updateSettings, onSubmit }: SettingsTabProps): React.ReactElement {
  const [cicd, setCicd] = useState(settings.cicd);

  useEffect(() => {
    setCicd(settings.cicd);
  }, [settings.cicd]);

  const handleSubmit = (e: React.FormEvent): void => {
    // Sync local state back to settings before the parent's onSubmit reads it
    settings.cicd = cicd;
    onSubmit(e);
  };

  return (
    <form onSubmit={handleSubmit}>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Card>
            <CardHeader title="Jenkins Integration" />
            <CardContent>
              <FormControlLabel
                control={
                  <Switch
                    checked={cicd.jenkins.enabled}
                    onChange={(e) => {
                      const updated = { ...cicd, jenkins: { ...cicd.jenkins, enabled: e.target.checked } };
                      setCicd(updated);
                      updateSettings.mutate({ cicd: updated });
                    }}
                  />
                }
                label="Enable Jenkins Integration"
              />
              <TextField
                margin="normal"
                fullWidth
                label="Jenkins URL"
                value={cicd.jenkins.url}
                onChange={(e) => setCicd({ ...cicd, jenkins: { ...cicd.jenkins, url: e.target.value } })}
                disabled={!cicd.jenkins.enabled}
              />
              <TextField
                margin="normal"
                fullWidth
                label="Username"
                value={cicd.jenkins.username}
                onChange={(e) => setCicd({ ...cicd, jenkins: { ...cicd.jenkins, username: e.target.value } })}
                disabled={!cicd.jenkins.enabled}
              />
              <TextField
                margin="normal"
                fullWidth
                label="API Token"
                type="password"
                value={cicd.jenkins.apiToken}
                onChange={(e) => setCicd({ ...cicd, jenkins: { ...cicd.jenkins, apiToken: e.target.value } })}
                disabled={!cicd.jenkins.enabled}
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
                    checked={cicd.github.enabled}
                    onChange={(e) => {
                      const updated = { ...cicd, github: { ...cicd.github, enabled: e.target.checked } };
                      setCicd(updated);
                      updateSettings.mutate({ cicd: updated });
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
                value={cicd.github.apiToken}
                onChange={(e) => setCicd({ ...cicd, github: { ...cicd.github, apiToken: e.target.value } })}
                disabled={!cicd.github.enabled}
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
