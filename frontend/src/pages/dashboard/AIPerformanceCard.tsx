import {
  Typography,
  Box,
  Card,
  CardContent,
  CircularProgress,
  Grow,
  useTheme,
  alpha,
} from '@mui/material';
import {
  AttachMoney as MoneyIcon,
  AccessTime as TimeIcon,
  Psychology as AIIcon,
  DataUsage as DataUsageIcon,
} from '@mui/icons-material';
import type { ApiSchemas } from '../../api';

type DashboardMetrics = ApiSchemas['DashboardMetrics'];

function MetricGauge({
  value,
  label,
  color,
  suffix = '%',
}: {
  value: number;
  label: string;
  color: string;
  suffix?: string;
}) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
      <Box sx={{ position: 'relative', display: 'inline-flex' }}>
        <CircularProgress
          variant="determinate"
          value={100}
          size={72}
          thickness={4}
          sx={{ color: alpha(color, 0.12) }}
        />
        <CircularProgress
          variant="determinate"
          value={Math.min(value, 100)}
          size={72}
          thickness={4}
          sx={{
            color,
            position: 'absolute',
            left: 0,
            '& .MuiCircularProgress-circle': {
              strokeLinecap: 'round',
            },
          }}
        />
        <Box
          sx={{
            top: 0,
            left: 0,
            bottom: 0,
            right: 0,
            position: 'absolute',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography variant="body2" fontWeight={700} color="text.primary">
            {typeof value === 'number' && value % 1 !== 0 ? value.toFixed(1) : value}
            {suffix}
          </Typography>
        </Box>
      </Box>
      <Typography variant="caption" color="text.secondary" textAlign="center" lineHeight={1.3}>
        {label}
      </Typography>
    </Box>
  );
}

export default function AIPerformanceCard({ metrics, budgetPercent }: { metrics: DashboardMetrics; budgetPercent: number }) {
  const theme = useTheme();
  return (
    <Grow in timeout={1200}>
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
            <AIIcon sx={{ fontSize: 20, color: theme.palette.primary.main }} />
            <Typography variant="h6" fontWeight={600} color="text.primary">
              AI Performance
            </Typography>
          </Box>

          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-around',
              mb: 3,
              py: 2,
              borderRadius: 2,
              backgroundColor: alpha(theme.palette.background.default, 0.5),
            }}
          >
            <MetricGauge
              value={metrics.aiPerformance.categorizationAccuracy}
              label="Accuracy"
              color={theme.palette.success.main}
            />
            <MetricGauge
              value={metrics.aiPerformance.cacheHitRate * 100}
              label="Cache Hit"
              color={theme.palette.info.main}
            />
            <MetricGauge
              value={budgetPercent}
              label="Budget Used"
              color={
                budgetPercent > 80
                  ? theme.palette.error.main
                  : budgetPercent > 50
                    ? theme.palette.warning.main
                    : theme.palette.success.main
              }
            />
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TimeIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                <Typography variant="body2" color="text.secondary">
                  Avg Analysis Time
                </Typography>
              </Box>
              <Typography variant="body2" fontWeight={600} color="text.primary">
                {metrics.aiPerformance.avgAnalysisTimeSeconds}s
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <DataUsageIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                <Typography variant="body2" color="text.secondary">
                  Similar Failures Matched
                </Typography>
              </Box>
              <Typography variant="body2" fontWeight={600} color="text.primary">
                {metrics.aiPerformance.similarFailuresFound}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <MoneyIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                <Typography variant="body2" color="text.secondary">
                  Monthly Budget
                </Typography>
              </Box>
              <Typography variant="body2" fontWeight={600} color="text.primary">
                ${metrics.aiPerformance.monthlyBudgetUsed.toFixed(2)}{' '}
                <Typography component="span" variant="caption" color="text.disabled">
                  / ${metrics.aiPerformance.monthlyBudgetTotal}
                </Typography>
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Grow>
  );
}
