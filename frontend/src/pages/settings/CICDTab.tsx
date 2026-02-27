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
