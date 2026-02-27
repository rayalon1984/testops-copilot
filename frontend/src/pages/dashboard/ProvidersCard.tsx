import {
  Grid,
  Typography,
  Box,
  Card,
  CardContent,
  Chip,
  Fade,
  Grow,
  useTheme,
  alpha,
} from '@mui/material';
import type { ApiSchemas } from '../../api';

type ProviderInfo = ApiSchemas['ProviderInfo'];

export default function ProvidersCard({
  providers,
  onSelectProvider,
}: {
  providers: ProviderInfo[];
  onSelectProvider: (provider: ProviderInfo) => void;
}) {
  const theme = useTheme();
  return (
    <Grow in timeout={1200}>
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
            <Typography variant="h6" fontWeight={600} color="text.primary">
              Providers
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Multi-provider &middot; Cost-optimized
            </Typography>
          </Box>

          <Grid container spacing={1.5}>
            {providers.map((provider, index) => (
              <Grid item xs={12} sm={6} key={provider.name}>
                <Fade in timeout={1200 + index * 150}>
                  <Box
                    onClick={() => onSelectProvider(provider)}
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      border: `1px solid ${provider.isActive
                        ? alpha(theme.palette.primary.main, 0.25)
                        : alpha(theme.palette.divider, 0.6)
                        }`,
                      backgroundColor: provider.isActive
                        ? alpha(theme.palette.primary.main, 0.04)
                        : 'transparent',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      opacity: provider.isActive ? 1 : 0.65,
                      '&:hover': {
                        borderColor: alpha(theme.palette.primary.main, 0.4),
                        backgroundColor: alpha(theme.palette.primary.main, 0.06),
                        opacity: 1,
                      },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                      <Typography variant="body2" fontWeight={600} color="text.primary">
                        {provider.name}
                      </Typography>
                      {provider.isActive && (
                        <Chip
                          label="Active"
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: '0.65rem',
                            fontWeight: 600,
                            backgroundColor: alpha(theme.palette.success.main, 0.12),
                            color: theme.palette.success.main,
                            border: `1px solid ${alpha(theme.palette.success.main, 0.2)}`,
                          }}
                        />
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <Box>
                        <Typography variant="caption" color="text.disabled" sx={{ display: 'block' }}>
                          Cost/1M
                        </Typography>
                        <Typography
                          variant="body2"
                          fontWeight={600}
                          color={
                            provider.costPer1M < 5
                              ? theme.palette.success.main
                              : 'text.primary'
                          }
                        >
                          ${provider.costPer1M.toFixed(2)}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.disabled" sx={{ display: 'block' }}>
                          Context
                        </Typography>
                        <Typography variant="body2" fontWeight={500} color="text.primary">
                          {provider.contextWindow}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.disabled" sx={{ display: 'block' }}>
                          Speed
                        </Typography>
                        <Typography variant="body2" fontWeight={500} color="text.primary">
                          {provider.speed}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                </Fade>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>
    </Grow>
  );
}
