import {
  Grid,
  Typography,
  Box,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
  alpha,
} from '@mui/material';
import { Psychology as AIIcon } from '@mui/icons-material';
import type { ApiSchemas } from '../../api';

type ProviderInfo = ApiSchemas['ProviderInfo'];

export default function ProviderDetailModal({
  provider,
  onClose,
}: {
  provider: ProviderInfo | null;
  onClose: () => void;
}) {
  const theme = useTheme();
  return (
    <Dialog
      open={!!provider}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          border: `1px solid ${theme.palette.divider}`,
        },
      }}
    >
      {provider && (
        <>
          <DialogTitle sx={{ borderBottom: `1px solid ${theme.palette.divider}`, pb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
              <AIIcon sx={{ color: theme.palette.primary.main }} />
              <Typography variant="h6" fontWeight={600}>
                {provider.name}
              </Typography>
            </Box>
            <Chip
              label={provider.isActive ? 'Active' : 'Inactive'}
              size="small"
              sx={{
                fontWeight: 600,
                backgroundColor: provider.isActive
                  ? alpha(theme.palette.success.main, 0.12)
                  : alpha(theme.palette.text.disabled, 0.12),
                color: provider.isActive
                  ? theme.palette.success.main
                  : theme.palette.text.disabled,
              }}
            />
          </DialogTitle>
          <DialogContent sx={{ mt: 2 }}>
            <Grid container spacing={3}>
              <Grid item xs={4}>
                <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 0.5 }}>
                  Cost / 1M Tokens
                </Typography>
                <Typography
                  variant="h5"
                  fontWeight={700}
                  color={
                    provider.costPer1M < 5
                      ? theme.palette.success.main
                      : 'text.primary'
                  }
                >
                  ${provider.costPer1M.toFixed(2)}
                </Typography>
              </Grid>
              <Grid item xs={4}>
                <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 0.5 }}>
                  Context Window
                </Typography>
                <Typography variant="h5" fontWeight={700} color="text.primary">
                  {provider.contextWindow}
                </Typography>
              </Grid>
              <Grid item xs={4}>
                <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 0.5 }}>
                  Speed
                </Typography>
                <Typography variant="h5" fontWeight={700} color="text.primary">
                  {provider.speed}
                </Typography>
              </Grid>
            </Grid>

            <Box
              sx={{
                mt: 3,
                p: 2,
                borderRadius: 2,
                backgroundColor: alpha(theme.palette.primary.main, 0.04),
                border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
              }}
            >
              <Typography variant="body2" color="text.secondary">
                {provider.isActive
                  ? 'Currently active and processing all failure analysis requests.'
                  : 'Configured but not currently active. Activate to route analysis requests through this provider.'}
              </Typography>
            </Box>
          </DialogContent>
          <DialogActions sx={{ borderTop: `1px solid ${theme.palette.divider}`, p: 2, gap: 1 }}>
            <Button onClick={onClose} variant="outlined" size="small">
              Close
            </Button>
            {!provider.isActive && (
              <Button variant="contained" size="small">
                Activate Provider
              </Button>
            )}
          </DialogActions>
        </>
      )}
    </Dialog>
  );
}
