import { useQuery } from '@tanstack/react-query';
import {
  Container,
  Grid,
  Paper,
  Typography,
  Box,
  CircularProgress,
  Card,
  CardContent,
  LinearProgress,
  Chip,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';
import axios from 'axios';

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
  bug_critical: 'Bug Critical',
  bug_minor: 'Bug Minor',
  environment: 'Environment',
  flaky: 'Flaky Test',
  configuration: 'Configuration',
  unknown: 'Unknown',
};

export default function Dashboard() {
  const { data: metrics, isLoading } = useQuery<DashboardMetrics>({
    queryKey: ['dashboard', 'ai-metrics'],
    queryFn: async () => {
      const response = await axios.get('/api/v1/dashboard');
      return response.data.data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <CircularProgress />
      </Box>
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

  return (
    <Container maxWidth="xl" sx={{ mt: 2, mb: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight="bold" color="text.primary" gutterBottom>
          AI-Powered Failure Analysis Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Real-time insights • {metrics.timeRange} • {metrics.totalTestsAnalyzed.toLocaleString()} tests analyzed
        </Typography>
      </Box>

      {/* Stats Cards Row */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Total Tests Analyzed */}
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Total Tests Analyzed
              </Typography>
              <Typography variant="h3" fontWeight="bold" color="success.main" sx={{ my: 1 }}>
                {metrics.totalTestsAnalyzed.toLocaleString()}
              </Typography>
              <Typography variant="body2" color="success.main">
                <TrendingUpIcon sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.5 }} />
                12% from yesterday
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Failures Auto-Categorized */}
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Failures Auto-Categorized
              </Typography>
              <Typography variant="h3" fontWeight="bold" color="warning.main" sx={{ my: 1 }}>
                {metrics.failuresAutoCategorized}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                100% categorization rate
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Time Saved */}
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Time Saved (AI Analysis)
              </Typography>
              <Typography variant="h3" fontWeight="bold" color="info.main" sx={{ my: 1 }}>
                {metrics.timeSavedHours}h
              </Typography>
              <Typography variant="body2" color="text.secondary">
                vs manual analysis
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* AI Cost */}
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                AI Cost (with caching)
              </Typography>
              <Typography variant="h3" fontWeight="bold" color="secondary.main" sx={{ my: 1 }}>
                ${metrics.aiCostUSD.toFixed(2)}
              </Typography>
              <Typography variant="body2" color="success.main">
                {metrics.cacheSavingsPercent}% savings • {metrics.cacheHits} cache hits
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Content Row */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Failure Categories Breakdown */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" color="text.primary" gutterBottom>
                Failure Categories Breakdown
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                AI-powered classification with confidence scoring
              </Typography>

              <Box sx={{ mt: 2 }}>
                {metrics.failureCategories.map((category) => (
                  <Box key={category.category} sx={{ mb: 2.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2" color="text.primary">
                        {categoryIcons[category.category]} {categoryLabels[category.category] || category.category}
                      </Typography>
                      <Typography variant="body2" color="text.primary">
                        {category.count} ({category.percentage.toFixed(1)}%)
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={category.percentage}
                      sx={{
                        height: 20,
                        borderRadius: 10,
                        backgroundColor: '#1e293b',
                        border: '1px solid #334155',
                        '& .MuiLinearProgress-bar': {
                          backgroundColor: category.color,
                          borderRadius: 10,
                        },
                      }}
                    />
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Recent AI Failure Analysis */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" color="text.primary" gutterBottom>
                Recent AI Failure Analysis
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Intelligent log summarization with root cause detection
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {metrics.recentFailures.slice(0, 3).map((failure) => (
                  <Paper
                    key={failure.id}
                    sx={{
                      p: 2,
                      backgroundColor: '#0f172a',
                      border: '1px solid #334155',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                      <Box
                        sx={{
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          backgroundColor: metrics.failureCategories.find(
                            (c) => c.category === failure.category
                          )?.color || '#64748b',
                          flexShrink: 0,
                          mt: 0.5,
                        }}
                      />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                          variant="body2"
                          fontWeight="bold"
                          color="text.primary"
                          sx={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {failure.errorMessage}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                          Root Cause: {failure.rootCause || 'Analyzing...'}
                        </Typography>
                        <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.5 }}>
                          Confidence: {(failure.confidence * 100).toFixed(0)}% • Similar: {failure.similarCount} past cases •{' '}
                          {failure.filePath || failure.testName}
                        </Typography>
                      </Box>
                      <Chip
                        label={categoryLabels[failure.category] || failure.category}
                        size="small"
                        sx={{
                          backgroundColor: '#334155',
                          color: metrics.failureCategories.find((c) => c.category === failure.category)?.color || '#94a3b8',
                          fontSize: '0.7rem',
                          height: 22,
                        }}
                      />
                    </Box>
                  </Paper>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Bottom Row */}
      <Grid container spacing={3}>
        {/* AI Performance Metrics */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" color="text.primary" gutterBottom>
                AI Performance Metrics
              </Typography>

              <Box sx={{ mt: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                  <Typography variant="body2" color="text.secondary">
                    Average Analysis Time:
                  </Typography>
                  <Typography variant="body2" fontWeight="bold" color="success.main">
                    {metrics.aiPerformance.avgAnalysisTimeSeconds} seconds
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                  <Typography variant="body2" color="text.secondary">
                    Categorization Accuracy:
                  </Typography>
                  <Typography variant="body2" fontWeight="bold" color="success.main">
                    {metrics.aiPerformance.categorizationAccuracy.toFixed(1)}%
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                  <Typography variant="body2" color="text.secondary">
                    Similar Failures Found:
                  </Typography>
                  <Typography variant="body2" fontWeight="bold" color="info.main">
                    {metrics.aiPerformance.similarFailuresFound} matches
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                  <Typography variant="body2" color="text.secondary">
                    Cache Hit Rate:
                  </Typography>
                  <Typography variant="body2" fontWeight="bold" color="secondary.main">
                    {(metrics.aiPerformance.cacheHitRate * 100).toFixed(1)}%
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">
                    Monthly AI Budget Used:
                  </Typography>
                  <Typography variant="body2" fontWeight="bold" color="warning.main">
                    ${metrics.aiPerformance.monthlyBudgetUsed.toFixed(2)} / ${metrics.aiPerformance.monthlyBudgetTotal}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* AI Provider Comparison */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" color="text.primary" gutterBottom>
                AI Provider Comparison
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Multi-provider support with intelligent cost optimization
              </Typography>

              <Box sx={{ overflowX: 'auto' }}>
                <Box sx={{ display: 'flex', mb: 1, pb: 1, borderBottom: '1px solid #334155' }}>
                  <Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ width: '35%' }}>
                    Provider
                  </Typography>
                  <Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ width: '20%' }}>
                    Cost/1M
                  </Typography>
                  <Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ width: '20%' }}>
                    Context
                  </Typography>
                  <Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ width: '25%' }}>
                    Speed
                  </Typography>
                </Box>

                {metrics.providers.map((provider) => (
                  <Box
                    key={provider.name}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      py: 1,
                      opacity: provider.isActive ? 1 : 0.6,
                    }}
                  >
                    <Box sx={{ width: '35%', display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box
                        sx={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          backgroundColor: provider.isActive ? '#10b981' : '#64748b',
                        }}
                      />
                      <Typography variant="body2" color="text.primary">
                        {provider.name}
                      </Typography>
                    </Box>
                    <Typography
                      variant="body2"
                      color={provider.costPer1M < 5 ? 'success.main' : 'text.primary'}
                      sx={{ width: '20%' }}
                    >
                      ${provider.costPer1M.toFixed(2)}
                    </Typography>
                    <Typography
                      variant="body2"
                      color={provider.contextWindow.includes('1M') ? 'info.main' : 'text.primary'}
                      sx={{ width: '20%' }}
                    >
                      {provider.contextWindow}
                    </Typography>
                    <Typography
                      variant="body2"
                      color={provider.speed.includes('⚡⚡⚡') ? 'success.main' : 'text.secondary'}
                      sx={{ width: '25%' }}
                    >
                      {provider.speed}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
}