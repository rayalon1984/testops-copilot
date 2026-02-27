import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePageContext } from '../hooks/usePageContext';
import {
  Container,
  Grid,
  Typography,
  Box,
  Skeleton,
  Grow,
  useTheme,
} from '@mui/material';
import {
  BugReport as BugIcon,
  Assessment as AssessmentIcon,
  Speed as SpeedIcon,
  AttachMoney as MoneyIcon,
} from '@mui/icons-material';
import type { ApiSchemas } from '../api';
import { useDashboardMetrics } from '../hooks/api';
import FlakyTestsWidget from '../components/FlakyTestsWidget/FlakyTestsWidget';
import WelcomeBanner from './dashboard/WelcomeBanner';
import StatsCards from './dashboard/StatsCards';
import FailureCategories from './dashboard/FailureCategories';
import RecentFailures from './dashboard/RecentFailures';
import AIPerformanceCard from './dashboard/AIPerformanceCard';
import ProvidersCard from './dashboard/ProvidersCard';
import FailureDetailModal from './dashboard/FailureDetailModal';
import ProviderDetailModal from './dashboard/ProviderDetailModal';

type DashboardMetrics = ApiSchemas['DashboardMetrics'];
type RecentFailure = ApiSchemas['RecentFailure'];
type ProviderInfo = ApiSchemas['ProviderInfo'];

function useCountUp(end: number, duration: number = 2000) {
  const [count, setCount] = useState(0);
  const countRef = useRef(0);

  useEffect(() => {
    if (end === 0) return;

    const startTime = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(easeOut * end);

      countRef.current = current;
      setCount(current);

      if (progress >= 1) {
        clearInterval(timer);
        setCount(end);
      }
    }, 16);

    return () => clearInterval(timer);
  }, [end, duration]);

  return count;
}

export default function Dashboard() {
  usePageContext('dashboard');
  const navigate = useNavigate();
  const theme = useTheme();
  const [selectedFailure, setSelectedFailure] = useState<RecentFailure | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<ProviderInfo | null>(null);

  const { data: metrics, isLoading } = useDashboardMetrics();

  const animatedTestCount = useCountUp(metrics?.totalTestsAnalyzed || 0, 1500);
  const animatedFailureCount = useCountUp(metrics?.failuresAutoCategorized || 0, 1500);
  const animatedTimeSaved = useCountUp(metrics?.timeSavedHours || 0, 1500);
  const animatedCost = useCountUp((metrics?.aiCostUSD || 0) * 100, 1500) / 100;

  if (isLoading) {
    return (
      <Container maxWidth="xl" sx={{ mt: 2, mb: 4 }}>
        <Skeleton variant="rounded" height={100} sx={{ mb: 3, borderRadius: 3 }} />
        <Grid container spacing={3} sx={{ mb: 3 }}>
          {[1, 2, 3, 4].map((i) => (
            <Grid item xs={12} sm={6} md={3} key={i}>
              <Skeleton variant="rounded" height={140} sx={{ borderRadius: 2 }} />
            </Grid>
          ))}
        </Grid>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Skeleton variant="rounded" height={320} sx={{ borderRadius: 2 }} />
          </Grid>
          <Grid item xs={12} md={6}>
            <Skeleton variant="rounded" height={320} sx={{ borderRadius: 2 }} />
          </Grid>
        </Grid>
      </Container>
    );
  }

  if (!metrics) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h6" color="error">
          Failed to load dashboard metrics
        </Typography>
      </Container>
    );
  }

  const budgetPercent =
    metrics.aiPerformance.monthlyBudgetTotal > 0
      ? (metrics.aiPerformance.monthlyBudgetUsed / metrics.aiPerformance.monthlyBudgetTotal) * 100
      : 0;

  const statCards = [
    { label: 'Tests Analyzed', value: animatedTestCount.toLocaleString(), trend: '+12% from yesterday', trendUp: true, icon: <AssessmentIcon />, color: theme.palette.success.main, onClick: () => navigate('/test-runs') },
    { label: 'Failures Categorized', value: animatedFailureCount.toLocaleString(), trend: '100% categorization rate', trendUp: true, icon: <BugIcon />, color: theme.palette.warning.main, onClick: () => navigate('/failure-knowledge-base') },
    { label: 'Hours Saved', value: `${animatedTimeSaved}h`, trend: 'vs manual analysis', trendUp: true, icon: <SpeedIcon />, color: theme.palette.info.main, onClick: undefined },
    { label: 'AI Spend', value: `$${animatedCost.toFixed(2)}`, trend: `${metrics.cacheSavingsPercent}% saved via cache`, trendUp: true, icon: <MoneyIcon />, color: theme.palette.secondary.main, onClick: () => navigate('/cost-tracker') },
  ];

  const failureCategoryColor = selectedFailure
    ? metrics.failureCategories.find((c) => c.category === selectedFailure.category)?.color || theme.palette.text.disabled
    : theme.palette.text.disabled;

  return (
    <Container maxWidth="xl" sx={{ mt: 2, mb: 4 }}>
      <WelcomeBanner metrics={metrics} />
      <StatsCards statCards={statCards} />

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={5}>
          <FailureCategories metrics={metrics} />
        </Grid>
        <Grid item xs={12} md={7}>
          <RecentFailures
            metrics={metrics}
            onViewAll={() => navigate('/failure-knowledge-base')}
            onSelectFailure={setSelectedFailure}
          />
        </Grid>
      </Grid>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <Grow in timeout={1000}>
            <Box sx={{ height: '400px' }}>
              <FlakyTestsWidget />
            </Box>
          </Grow>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <AIPerformanceCard metrics={metrics} budgetPercent={budgetPercent} />
        </Grid>
        <Grid item xs={12} md={6}>
          <ProvidersCard providers={metrics.providers} onSelectProvider={setSelectedProvider} />
        </Grid>
      </Grid>

      <FailureDetailModal failure={selectedFailure} categoryColor={failureCategoryColor} onClose={() => setSelectedFailure(null)} />
      <ProviderDetailModal provider={selectedProvider} onClose={() => setSelectedProvider(null)} />
    </Container>
  );
}
