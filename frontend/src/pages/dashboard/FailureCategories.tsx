import {
  Typography,
  Box,
  Card,
  CardContent,
  LinearProgress,
  Chip,
  Fade,
  Grow,
  useTheme,
  alpha,
} from '@mui/material';
import type { ApiSchemas } from '../../api';

type DashboardMetrics = ApiSchemas['DashboardMetrics'];

const categoryIcons: Record<string, string> = {
  bug_critical: '🔴',
  bug_minor: '🟡',
  environment: '🌐',
  flaky: '⚡',
  configuration: '⚙️',
  unknown: '❓',
};

const categoryLabels: Record<string, string> = {
  bug_critical: 'Critical Bug',
  bug_minor: 'Minor Bug',
  environment: 'Environment',
  flaky: 'Flaky Test',
  configuration: 'Configuration',
  unknown: 'Unknown',
};

export { categoryIcons, categoryLabels };

export default function FailureCategories({ metrics }: { metrics: DashboardMetrics }) {
  const theme = useTheme();
  return (
    <Grow in timeout={900}>
      <Card sx={{ height: '100%' }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="h6" fontWeight={600} color="text.primary">
              Failure Categories
            </Typography>
            <Chip
              label={`${metrics.failureCategories.length} types`}
              size="small"
              variant="outlined"
              sx={{
                height: 24,
                fontSize: '0.7rem',
                borderColor: alpha(theme.palette.text.secondary, 0.2),
              }}
            />
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 3 }}>
            AI-powered classification with confidence scoring
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {metrics.failureCategories.map((category, index) => (
              <Fade in timeout={1000 + index * 150} key={`${category.category}-${index}`}>
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.75 }}>
                    <Typography variant="body2" color="text.primary" fontWeight={500}>
                      {categoryIcons[category.category]}{' '}
                      {categoryLabels[category.category] || category.category}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>
                      {category.count}
                      <Typography
                        component="span"
                        variant="caption"
                        color="text.disabled"
                        sx={{ ml: 0.5 }}
                      >
                        ({category.percentage.toFixed(0)}%)
                      </Typography>
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={category.percentage}
                    sx={{
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: alpha(theme.palette.text.primary, 0.06),
                      '& .MuiLinearProgress-bar': {
                        backgroundColor: category.color,
                        borderRadius: 3,
                        transition: 'width 1.2s ease-in-out',
                      },
                    }}
                  />
                </Box>
              </Fade>
            ))}
          </Box>
        </CardContent>
      </Card>
    </Grow>
  );
}
