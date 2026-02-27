import {
  Typography,
  Box,
  Chip,
  Fade,
  useTheme,
  alpha,
} from '@mui/material';
import {
  FiberManualRecord as DotIcon,
  Cached as CacheIcon,
} from '@mui/icons-material';
import type { ApiSchemas } from '../../api';

type DashboardMetrics = ApiSchemas['DashboardMetrics'];

export default function WelcomeBanner({ metrics }: { metrics: DashboardMetrics }) {
  const theme = useTheme();
  return (
    <Fade in timeout={600}>
      <Box
        sx={{
          mb: 4,
          p: { xs: 2.5, md: 3.5 },
          borderRadius: 3,
          background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, ${alpha(theme.palette.secondary.main, 0.06)} 100%)`,
          border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: { xs: 'flex-start', md: 'center' },
          justifyContent: 'space-between',
          gap: 2,
        }}
      >
        <Box>
          <Typography
            variant="h4"
            fontWeight={700}
            color="text.primary"
            sx={{ letterSpacing: '-0.02em', mb: 0.5 }}
          >
            Failure Analysis
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {metrics.timeRange} &middot; {metrics.totalTestsAnalyzed.toLocaleString()} tests
            processed &middot; Last sync{' '}
            {new Date(metrics.lastUpdated).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0 }}>
          <Chip
            icon={<DotIcon sx={{ fontSize: 10, color: `${theme.palette.success.main} !important` }} />}
            label="All Systems Operational"
            size="small"
            variant="outlined"
            sx={{
              borderColor: alpha(theme.palette.success.main, 0.3),
              color: theme.palette.success.main,
              fontWeight: 500,
              '& .MuiChip-icon': { ml: 0.5 },
            }}
          />
          <Chip
            label={`Cache ${metrics.cacheHitRate}%`}
            size="small"
            variant="outlined"
            icon={<CacheIcon sx={{ fontSize: 14 }} />}
            sx={{
              borderColor: alpha(theme.palette.text.secondary, 0.2),
              color: 'text.secondary',
              fontWeight: 500,
            }}
          />

        </Box>
      </Box>
    </Fade>
  );
}
