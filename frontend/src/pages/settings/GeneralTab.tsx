import {
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

export function GeneralTab({ settings, updateSettings, onSubmit }: SettingsTabProps): React.ReactElement {
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
