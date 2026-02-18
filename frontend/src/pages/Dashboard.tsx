import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Grid,
  Typography,
  Box,
  CircularProgress,
  Card,
  CardContent,
  LinearProgress,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Divider,
  Tooltip,
  Fade,
  Grow,
  Skeleton,
  IconButton,
  useTheme,
  alpha,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  BugReport as BugIcon,
  Code as CodeIcon,
  Build as BuildIcon,
  Assessment as AssessmentIcon,
  Speed as SpeedIcon,
  AttachMoney as MoneyIcon,
  CheckCircle as CheckCircleIcon,
  AccessTime as TimeIcon,
  FiberManualRecord as DotIcon,
  ArrowForward as ArrowForwardIcon,
  Cached as CacheIcon,
  Psychology as AIIcon,
  DataUsage as DataUsageIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth';
import FlakyTestsWidget from '../components/FlakyTestsWidget/FlakyTestsWidget';

interface DashboardMetrics {
  totalTestsAnalyzed: number;
  failuresAutoCategorized: number;
  timeSavedHours: number;
  aiCostUSD: number;
  cacheHitRate: number;
  cacheHits: number;
  cacheSavingsPercent: number;
  lastUpdated: string;
  timeRange: string;
  failureCategories: {
    category: string;
    count: number;
    percentage: number;
    color: string;
  }[];
  recentFailures: {
    id: string;
    testName: string;
    errorMessage: string;
    rootCause: string | null;
    category: string;
    confidence: number;
    similarCount: number;
    filePath: string | null;
    timestamp: string;
  }[];
  aiPerformance: {
    avgAnalysisTimeSeconds: number;
    categorizationAccuracy: number;
    similarFailuresFound: number;
    cacheHitRate: number;
    monthlyBudgetUsed: number;
    monthlyBudgetTotal: number;
  };
  providers: {
    name: string;
    costPer1M: number;
    contextWindow: string;
    speed: string;
    isActive: boolean;
  }[];
}

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

// Count-up animation hook
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

// Circular progress gauge component
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
  const theme = useTheme();

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

export default function Dashboard() {
  const navigate = useNavigate();
  const theme = useTheme();
  const { user } = useAuth();
  const [selectedFailure, setSelectedFailure] = useState<
    DashboardMetrics['recentFailures'][number] | null
  >(null);
  const [selectedProvider, setSelectedProvider] = useState<
    DashboardMetrics['providers'][number] | null
  >(null);

  const { data: metrics, isLoading } = useQuery<DashboardMetrics>({
    queryKey: ['dashboard', 'ai-metrics'],
    queryFn: async () => {
      const token = localStorage.getItem('accessToken');
      const response = await axios.get('/api/v1/dashboard', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return response.data.data;
    },
    refetchInterval: 30000,
  });

  // Animated counts
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
    {
      label: 'Tests Analyzed',
      value: animatedTestCount.toLocaleString(),
      trend: '+12% from yesterday',
      trendUp: true,
      icon: <AssessmentIcon />,
      color: theme.palette.success.main,
      onClick: () => navigate('/test-runs'),
    },
    {
      label: 'Failures Categorized',
      value: animatedFailureCount.toLocaleString(),
      trend: '100% categorization rate',
      trendUp: true,
      icon: <BugIcon />,
      color: theme.palette.warning.main,
      onClick: () => navigate('/failure-knowledge-base'),
    },
    {
      label: 'Hours Saved',
      value: `${animatedTimeSaved}h`,
      trend: 'vs manual analysis',
      trendUp: true,
      icon: <SpeedIcon />,
      color: theme.palette.info.main,
      onClick: undefined,
    },
    {
      label: 'AI Spend',
      value: `$${animatedCost.toFixed(2)}`,
      trend: `${metrics.cacheSavingsPercent}% saved via cache`,
      trendUp: true,
      icon: <MoneyIcon />,
      color: theme.palette.secondary.main,
      onClick: () => navigate('/cost-tracker'),
    },
  ];

  return (
    <Container maxWidth="xl" sx={{ mt: 2, mb: 4 }}>
      {/* ─── Welcome Banner ─── */}
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

      {/* ─── Stats Cards ─── */}
      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        {statCards.map((card, index) => (
          <Grid item xs={12} sm={6} md={3} key={card.label}>
            <Grow in timeout={500 + index * 100}>
              <Card
                sx={{
                  cursor: card.onClick ? 'pointer' : 'default',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'all 0.25s ease',
                  '&:hover': card.onClick
                    ? {
                      transform: 'translateY(-4px)',
                      borderColor: alpha(card.color, 0.3),
                      boxShadow: `0 8px 24px ${alpha(card.color, 0.12)}`,
                    }
                    : {},
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: 3,
                    background: card.color,
                    borderRadius: '3px 0 0 3px',
                  },
                }}
                onClick={card.onClick}
              >
                <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        fontWeight={500}
                        textTransform="uppercase"
                        letterSpacing="0.05em"
                        sx={{ display: 'block', mb: 1 }}
                      >
                        {card.label}
                      </Typography>
                      <Typography
                        variant="h4"
                        fontWeight={700}
                        color="text.primary"
                        sx={{ mb: 0.75, lineHeight: 1.1 }}
                      >
                        {card.value}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {card.trendUp && (
                          <TrendingUpIcon sx={{ fontSize: 14, color: theme.palette.success.main }} />
                        )}
                        <Typography variant="caption" color="text.secondary">
                          {card.trend}
                        </Typography>
                      </Box>
                    </Box>
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: alpha(card.color, 0.1),
                        color: card.color,
                        flexShrink: 0,
                      }}
                    >
                      {card.icon}
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grow>
          </Grid>
        ))}
      </Grid>

      {/* ─── Main Content: Categories + Recent Failures ─── */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Failure Categories */}
        <Grid item xs={12} md={5}>
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
        </Grid>

        {/* Recent Failures */}
        <Grid item xs={12} md={7}>
          <Grow in timeout={900}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="h6" fontWeight={600} color="text.primary">
                    Recent Failures
                  </Typography>
                  <Button
                    size="small"
                    endIcon={<ArrowForwardIcon sx={{ fontSize: '14px !important' }} />}
                    onClick={() => navigate('/failure-knowledge-base')}
                    sx={{ textTransform: 'none', fontWeight: 500, fontSize: '0.8rem' }}
                  >
                    View all
                  </Button>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 3 }}>
                  Intelligent log summarization with root cause detection
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {metrics.recentFailures.slice(0, 3).map((failure, index) => {
                    const catColor =
                      metrics.failureCategories.find((c) => c.category === failure.category)
                        ?.color || theme.palette.text.disabled;

                    return (
                      <Fade in timeout={1000 + index * 200} key={failure.id}>
                        <Box
                          onClick={() => setSelectedFailure(failure)}
                          sx={{
                            p: 2,
                            borderRadius: 2,
                            border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
                            cursor: 'pointer',
                            position: 'relative',
                            transition: 'all 0.2s ease',
                            '&:hover': {
                              borderColor: alpha(catColor, 0.4),
                              backgroundColor: alpha(theme.palette.action.hover, 0.4),
                              transform: 'translateX(4px)',
                            },
                            '&::before': {
                              content: '""',
                              position: 'absolute',
                              left: 0,
                              top: 8,
                              bottom: 8,
                              width: 3,
                              borderRadius: 2,
                              backgroundColor: catColor,
                            },
                          }}
                        >
                          <Box sx={{ pl: 1.5 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
                              <Typography
                                variant="body2"
                                fontWeight={600}
                                color="text.primary"
                                sx={{
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  flex: 1,
                                  mr: 1.5,
                                }}
                              >
                                {failure.errorMessage}
                              </Typography>
                              <Chip
                                label={categoryLabels[failure.category] || failure.category}
                                size="small"
                                sx={{
                                  height: 22,
                                  fontSize: '0.68rem',
                                  fontWeight: 600,
                                  backgroundColor: alpha(catColor, 0.12),
                                  color: catColor,
                                  border: `1px solid ${alpha(catColor, 0.2)}`,
                                  flexShrink: 0,
                                }}
                              />
                            </Box>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                              {failure.rootCause || 'Analysis in progress...'}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                              <Typography variant="caption" color="text.disabled">
                                {(failure.confidence * 100).toFixed(0)}% confidence
                              </Typography>
                              <Typography variant="caption" color="text.disabled">
                                &middot;
                              </Typography>
                              <Typography variant="caption" color="text.disabled">
                                {failure.similarCount} similar
                              </Typography>
                              <Typography variant="caption" color="text.disabled">
                                &middot;
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.disabled"
                                sx={{
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {failure.filePath || failure.testName}
                              </Typography>
                            </Box>
                          </Box>
                        </Box>
                      </Fade>
                    );
                  })}
                </Box>
              </CardContent>
            </Card>
          </Grow>
        </Grid>
      </Grid>



      {/* ─── Flaky Tests Row ─── */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <Grow in timeout={1000}>
            <Box sx={{ height: '400px' }}>
              <FlakyTestsWidget />
            </Box>
          </Grow>
        </Grid>
      </Grid>

      {/* ─── Bottom Row: AI Performance + Providers ─── */}
      <Grid container spacing={3}>
        {/* AI Performance */}
        <Grid item xs={12} md={6}>
          <Grow in timeout={1200}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                  <AIIcon sx={{ fontSize: 20, color: theme.palette.primary.main }} />
                  <Typography variant="h6" fontWeight={600} color="text.primary">
                    AI Performance
                  </Typography>
                </Box>

                {/* Gauge Row */}
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

                {/* Metric Details */}
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
        </Grid>

        {/* AI Providers */}
        <Grid item xs={12} md={6}>
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
                  {metrics.providers.map((provider, index) => (
                    <Grid item xs={12} sm={6} key={provider.name}>
                      <Fade in timeout={1200 + index * 150}>
                        <Box
                          onClick={() => setSelectedProvider(provider)}
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
        </Grid>
      </Grid>

      {/* ─── Failure Detail Modal ─── */}
      <Dialog
        open={!!selectedFailure}
        onClose={() => setSelectedFailure(null)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            border: `1px solid ${theme.palette.divider}`,
          },
        }}
      >
        {selectedFailure && (
          <>
            <DialogTitle sx={{ borderBottom: `1px solid ${theme.palette.divider}`, pb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                <BugIcon sx={{ color: theme.palette.error.main }} />
                <Typography variant="h6" fontWeight={600}>
                  Failure Analysis
                </Typography>
              </Box>
              <Chip
                label={categoryLabels[selectedFailure.category] || selectedFailure.category}
                size="small"
                sx={{
                  backgroundColor:
                    metrics?.failureCategories.find((c) => c.category === selectedFailure.category)
                      ?.color || theme.palette.text.disabled,
                  color: '#fff',
                  fontWeight: 600,
                }}
              />
            </DialogTitle>
            <DialogContent sx={{ mt: 2 }}>
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Error Message
                </Typography>
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    backgroundColor: alpha(theme.palette.error.main, 0.06),
                    border: `1px solid ${alpha(theme.palette.error.main, 0.15)}`,
                  }}
                >
                  <Typography variant="body2" color="error.main" fontFamily="monospace">
                    {selectedFailure.errorMessage}
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography
                  variant="subtitle2"
                  color="text.secondary"
                  gutterBottom
                  sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                >
                  <CodeIcon fontSize="small" />
                  Test Name
                </Typography>
                <Typography variant="body2" color="text.primary" fontFamily="monospace">
                  {selectedFailure.testName || selectedFailure.filePath || 'N/A'}
                </Typography>
              </Box>

              <Divider sx={{ my: 2 }} />

              <Box sx={{ mb: 3 }}>
                <Typography
                  variant="subtitle2"
                  color="text.secondary"
                  gutterBottom
                  sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                >
                  <BuildIcon fontSize="small" />
                  AI Root Cause Analysis
                </Typography>
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    backgroundColor: alpha(theme.palette.success.main, 0.06),
                    border: `1px solid ${alpha(theme.palette.success.main, 0.15)}`,
                  }}
                >
                  <Typography variant="body2" color="success.main">
                    {selectedFailure.rootCause || 'Analysis in progress...'}
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Confidence & Context
                </Typography>
                <Box sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                  <Box>
                    <Typography variant="caption" color="text.disabled">
                      Confidence
                    </Typography>
                    <Typography variant="h6" fontWeight={700} color="text.primary">
                      {(selectedFailure.confidence * 100).toFixed(0)}%
                    </Typography>
                  </Box>
                  <Divider orientation="vertical" flexItem />
                  <Box>
                    <Typography variant="caption" color="text.disabled">
                      Similar Cases
                    </Typography>
                    <Typography variant="h6" fontWeight={700} color="text.primary">
                      {selectedFailure.similarCount}
                    </Typography>
                  </Box>
                  <Divider orientation="vertical" flexItem />
                  <Box>
                    <Typography variant="caption" color="text.disabled">
                      Detected
                    </Typography>
                    <Typography variant="body2" fontWeight={500} color="text.primary">
                      {new Date(selectedFailure.timestamp).toLocaleDateString()}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </DialogContent>
            <DialogActions sx={{ borderTop: `1px solid ${theme.palette.divider}`, p: 2, gap: 1 }}>
              <Button onClick={() => setSelectedFailure(null)} variant="outlined" size="small">
                Close
              </Button>
              <Button variant="contained" size="small">
                View Full Details
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* ─── Provider Detail Modal ─── */}
      <Dialog
        open={!!selectedProvider}
        onClose={() => setSelectedProvider(null)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            border: `1px solid ${theme.palette.divider}`,
          },
        }}
      >
        {selectedProvider && (
          <>
            <DialogTitle sx={{ borderBottom: `1px solid ${theme.palette.divider}`, pb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                <AIIcon sx={{ color: theme.palette.primary.main }} />
                <Typography variant="h6" fontWeight={600}>
                  {selectedProvider.name}
                </Typography>
              </Box>
              <Chip
                label={selectedProvider.isActive ? 'Active' : 'Inactive'}
                size="small"
                sx={{
                  fontWeight: 600,
                  backgroundColor: selectedProvider.isActive
                    ? alpha(theme.palette.success.main, 0.12)
                    : alpha(theme.palette.text.disabled, 0.12),
                  color: selectedProvider.isActive
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
                      selectedProvider.costPer1M < 5
                        ? theme.palette.success.main
                        : 'text.primary'
                    }
                  >
                    ${selectedProvider.costPer1M.toFixed(2)}
                  </Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 0.5 }}>
                    Context Window
                  </Typography>
                  <Typography variant="h5" fontWeight={700} color="text.primary">
                    {selectedProvider.contextWindow}
                  </Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 0.5 }}>
                    Speed
                  </Typography>
                  <Typography variant="h5" fontWeight={700} color="text.primary">
                    {selectedProvider.speed}
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
                  {selectedProvider.isActive
                    ? 'Currently active and processing all failure analysis requests.'
                    : 'Configured but not currently active. Activate to route analysis requests through this provider.'}
                </Typography>
              </Box>
            </DialogContent>
            <DialogActions sx={{ borderTop: `1px solid ${theme.palette.divider}`, p: 2, gap: 1 }}>
              <Button onClick={() => setSelectedProvider(null)} variant="outlined" size="small">
                Close
              </Button>
              {!selectedProvider.isActive && (
                <Button variant="contained" size="small">
                  Activate Provider
                </Button>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>
    </Container >
  );
}
