import { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  Typography,
  Box,
  Paper,
  Alert,
  CircularProgress,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  Shield as ShieldIcon,
  Balance as BalanceIcon,
  AutoFixHigh as AutoIcon,
} from '@mui/icons-material';
import { useAutonomyPreference, useUpdateAutonomy } from '../../hooks/api';

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

export function AutonomyTab(): React.ReactElement {
  const [saveSuccess, setSaveSuccess] = useState('');
  const [saveError, setSaveError] = useState('');

  const { data: autonomyData, isLoading } = useAutonomyPreference();
  const updateAutonomy = useUpdateAutonomy();

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
            if (value) updateAutonomy.mutate(value, {
              onSuccess: () => {
                setSaveSuccess('Autonomy preference updated');
                setTimeout(() => setSaveSuccess(''), 3000);
              },
              onError: (err: Error) => {
                setSaveError(err.message);
                setTimeout(() => setSaveError(''), 5000);
              },
            });
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
