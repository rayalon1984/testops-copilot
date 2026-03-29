import { useState, useEffect } from 'react';
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
  const [general, setGeneral] = useState(settings.general);

  useEffect(() => {
    setGeneral(settings.general);
  }, [settings.general]);

  const handleSubmit = (e: React.FormEvent): void => {
    settings.general = general;
    onSubmit(e);
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader title="Application Settings" />
        <CardContent>
          <FormControlLabel
            control={
              <Switch
                checked={general.autoRefresh}
                onChange={(e) => {
                  const updated = { ...general, autoRefresh: e.target.checked };
                  setGeneral(updated);
                  updateSettings.mutate({ general: updated });
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
            value={general.refreshInterval}
            onChange={(e) => setGeneral({ ...general, refreshInterval: parseInt(e.target.value, 10) })}
            disabled={!general.autoRefresh}
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
