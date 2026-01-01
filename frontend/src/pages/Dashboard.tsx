import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Divider,
  Tooltip,
  Fade,
  Grow,
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

      // Ease out function for smooth animation
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(easeOut * end);

      countRef.current = current;
      setCount(current);

      if (progress >= 1) {
        clearInterval(timer);
        setCount(end);
      }
    }, 16); // ~60fps

    return () => clearInterval(timer);
  }, [end, duration]);

  return count;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [selectedFailure, setSelectedFailure] = useState<any>(null);
  const [selectedProvider, setSelectedProvider] = useState<any>(null);

  const { data: metrics, isLoading } = useQuery<DashboardMetrics>({
    queryKey: ['dashboard', 'ai-metrics'],
    queryFn: async () => {
      const token = localStorage.getItem('accessToken');
      const response = await axios.get('/api/v1/dashboard', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      return response.data.data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Animated counts - MUST be called before any early returns (React Rules of Hooks)
  const animatedTestCount = useCountUp(metrics?.totalTestsAnalyzed || 0, 1500);
  const animatedFailureCount = useCountUp(metrics?.failuresAutoCategorized || 0, 1500);
  const animatedTimeSaved = useCountUp(metrics?.timeSavedHours || 0, 1500);
  const animatedCost = useCountUp((metrics?.aiCostUSD || 0) * 100, 1500) / 100; // For decimals

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
      <Fade in timeout={800}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" fontWeight="bold" color="text.primary" gutterBottom>
            AI-Powered Failure Analysis Dashboard
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Real-time insights • {metrics.timeRange} • {metrics.totalTestsAnalyzed.toLocaleString()} tests analyzed
          </Typography>
        </Box>
      </Fade>

      {/* Stats Cards Row */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Total Tests Analyzed */}
        <Grid item xs={12} sm={6} md={3}>
          <Grow in timeout={600}>
            <Tooltip title="Click to view test runs" arrow>
              <Card
                sx={{
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-8px)',
                    boxShadow: 6,
                    borderColor: 'success.main',
                    borderWidth: 2,
                    borderStyle: 'solid',
                  }
                }}
                onClick={() => navigate('/test-runs')}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Total Tests Analyzed
                    </Typography>
                    <AssessmentIcon color="success" />
                  </Box>
                  <Typography variant="h3" fontWeight="bold" color="success.main" sx={{ my: 1 }}>
                    {animatedTestCount.toLocaleString()}
                  </Typography>
                  <Typography variant="body2" color="success.main">
                    <TrendingUpIcon sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.5 }} />
                    12% from yesterday
                  </Typography>
                </CardContent>
              </Card>
            </Tooltip>
          </Grow>
        </Grid>

        {/* Failures Auto-Categorized */}
        <Grid item xs={12} sm={6} md={3}>
          <Grow in timeout={800}>
            <Tooltip title="Click to view failure knowledge base" arrow>
              <Card
                sx={{
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-8px)',
                    boxShadow: 6,
                    borderColor: 'warning.main',
                    borderWidth: 2,
                    borderStyle: 'solid',
                  }
                }}
                onClick={() => navigate('/failure-knowledge-base')}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Failures Auto-Categorized
                    </Typography>
                    <BugIcon color="warning" />
                  </Box>
                  <Typography variant="h3" fontWeight="bold" color="warning.main" sx={{ my: 1 }}>
                    {animatedFailureCount.toLocaleString()}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    <CheckCircleIcon sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.5 }} />
                    100% categorization rate
                  </Typography>
                </CardContent>
              </Card>
            </Tooltip>
          </Grow>
        </Grid>

        {/* Time Saved */}
        <Grid item xs={12} sm={6} md={3}>
          <Grow in timeout={1000}>
            <Tooltip title="Time saved with AI-powered analysis" arrow>
              <Card
                sx={{
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-8px)',
                    boxShadow: 6,
                    borderColor: 'info.main',
                    borderWidth: 2,
                    borderStyle: 'solid',
                  }
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Time Saved (AI Analysis)
                    </Typography>
                    <SpeedIcon color="info" />
                  </Box>
                  <Typography variant="h3" fontWeight="bold" color="info.main" sx={{ my: 1 }}>
                    {animatedTimeSaved}h
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    vs manual analysis
                  </Typography>
                </CardContent>
              </Card>
            </Tooltip>
          </Grow>
        </Grid>

        {/* AI Cost */}
        <Grid item xs={12} sm={6} md={3}>
          <Grow in timeout={1200}>
            <Tooltip title="Click to view cost tracker" arrow>
              <Card
                sx={{
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-8px)',
                    boxShadow: 6,
                    borderColor: 'secondary.main',
                    borderWidth: 2,
                    borderStyle: 'solid',
                  }
                }}
                onClick={() => navigate('/cost-tracker')}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      AI Cost (with caching)
                    </Typography>
                    <MoneyIcon color="secondary" />
                  </Box>
                  <Typography variant="h3" fontWeight="bold" color="secondary.main" sx={{ my: 1 }}>
                    ${animatedCost.toFixed(2)}
                  </Typography>
                  <Typography variant="body2" color="success.main">
                    {metrics.cacheSavingsPercent}% savings • {metrics.cacheHits} cache hits
                  </Typography>
                </CardContent>
              </Card>
            </Tooltip>
          </Grow>
        </Grid>
      </Grid>

      {/* Main Content Row */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Failure Categories Breakdown */}
        <Grid item xs={12} md={6}>
          <Grow in timeout={1400}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" fontWeight="bold" color="text.primary" gutterBottom>
                  Failure Categories Breakdown
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  AI-powered classification with confidence scoring
                </Typography>

                <Box sx={{ mt: 2 }}>
                  {metrics.failureCategories.map((category, index) => (
                    <Fade in timeout={1600 + (index * 200)} key={`${category.category}-${index}`}>
                      <Box sx={{ mb: 2.5 }}>
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
                              transition: 'width 1s ease-in-out',
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

        {/* Recent AI Failure Analysis */}
        <Grid item xs={12} md={6}>
          <Grow in timeout={1400}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" fontWeight="bold" color="text.primary" gutterBottom>
                  Recent AI Failure Analysis
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Intelligent log summarization with root cause detection
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {metrics.recentFailures.slice(0, 3).map((failure, index) => (
                    <Fade in timeout={1600 + (index * 300)} key={failure.id}>
                      <Paper
                        onClick={() => setSelectedFailure(failure)}
                        sx={{
                          p: 2,
                          backgroundColor: '#0f172a',
                          border: '1px solid #334155',
                          cursor: 'pointer',
                          transition: 'all 0.3s ease',
                          '&:hover': {
                            backgroundColor: '#1e293b',
                            borderColor: '#475569',
                            transform: 'translateY(-4px) scale(1.02)',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                          },
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
                    </Fade>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grow>
        </Grid>
      </Grid>

      {/* Bottom Row */}
      <Grid container spacing={3}>
        {/* AI Performance Metrics */}
        <Grid item xs={12} md={4}>
          <Grow in timeout={1800}>
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
          </Grow>
        </Grid>

        {/* AI Provider Comparison */}
        <Grid item xs={12} md={8}>
          <Grow in timeout={1800}>
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight="bold" color="text.primary" gutterBottom>
                  AI Provider Comparison
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Multi-provider support with intelligent cost optimization • Click to see details
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

                  {metrics.providers.map((provider, index) => (
                    <Fade in timeout={2000 + (index * 200)} key={provider.name}>
                      <Box
                        onClick={() => setSelectedProvider(provider)}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          py: 1.5,
                          px: 1,
                          borderRadius: 1,
                          opacity: provider.isActive ? 1 : 0.6,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          '&:hover': {
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            transform: 'translateX(4px)',
                          },
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
                    </Fade>
                ))}
              </Box>
            </CardContent>
          </Card>
          </Grow>
        </Grid>
      </Grid>

      {/* Failure Detail Modal */}
      <Dialog
        open={!!selectedFailure}
        onClose={() => setSelectedFailure(null)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: '#0f172a',
            backgroundImage: 'none',
          }
        }}
      >
        {selectedFailure && (
          <>
            <DialogTitle sx={{ borderBottom: '1px solid #334155', pb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <BugIcon color="error" />
                <Typography variant="h6" fontWeight="bold">
                  Failure Analysis Detail
                </Typography>
              </Box>
              <Chip
                label={categoryLabels[selectedFailure.category] || selectedFailure.category}
                size="small"
                sx={{
                  backgroundColor: metrics?.failureCategories.find(
                    (c) => c.category === selectedFailure.category
                  )?.color || '#64748b',
                  color: '#fff',
                  fontWeight: 'bold',
                }}
              />
            </DialogTitle>
            <DialogContent sx={{ mt: 2 }}>
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Error Message
                </Typography>
                <Paper sx={{ p: 2, backgroundColor: '#1e293b', border: '1px solid #334155' }}>
                  <Typography variant="body2" color="error.main" fontFamily="monospace">
                    {selectedFailure.errorMessage}
                  </Typography>
                </Paper>
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CodeIcon fontSize="small" />
                  Test Name
                </Typography>
                <Typography variant="body2" color="text.primary" fontFamily="monospace">
                  {selectedFailure.testName || selectedFailure.filePath || 'N/A'}
                </Typography>
              </Box>

              <Divider sx={{ my: 2, borderColor: '#334155' }} />

              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <BuildIcon fontSize="small" />
                  AI Root Cause Analysis
                </Typography>
                <Paper sx={{ p: 2, backgroundColor: '#1e293b', border: '1px solid #10b981' }}>
                  <Typography variant="body2" color="success.main">
                    {selectedFailure.rootCause || 'Analysis in progress...'}
                  </Typography>
                </Paper>
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  AI Confidence & Similar Cases
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Confidence Score
                    </Typography>
                    <Typography variant="h6" color="success.main">
                      {(selectedFailure.confidence * 100).toFixed(0)}%
                    </Typography>
                  </Box>
                  <Divider orientation="vertical" flexItem sx={{ borderColor: '#334155' }} />
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Similar Past Cases
                    </Typography>
                    <Typography variant="h6" color="info.main">
                      {selectedFailure.similarCount}
                    </Typography>
                  </Box>
                  <Divider orientation="vertical" flexItem sx={{ borderColor: '#334155' }} />
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      First Detected
                    </Typography>
                    <Typography variant="body2" color="text.primary">
                      {new Date(selectedFailure.timestamp).toLocaleDateString()}
                    </Typography>
                  </Box>
                </Box>
              </Box>

              <Box sx={{ p: 2, backgroundColor: '#1e293b', borderRadius: 1, border: '1px solid #334155' }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  💡 AI-Powered Insight
                </Typography>
                <Typography variant="body2" color="text.primary">
                  This failure pattern has been automatically categorized and analyzed using advanced AI models.
                  The root cause has been identified with high confidence based on similar historical failures.
                </Typography>
              </Box>
            </DialogContent>
            <DialogActions sx={{ borderTop: '1px solid #334155', p: 2 }}>
              <Button onClick={() => setSelectedFailure(null)} variant="outlined">
                Close
              </Button>
              <Button variant="contained" color="primary">
                View Full Details
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Provider Detail Modal */}
      <Dialog
        open={!!selectedProvider}
        onClose={() => setSelectedProvider(null)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: '#0f172a',
            backgroundImage: 'none',
          }
        }}
      >
        {selectedProvider && (
          <>
            <DialogTitle sx={{ borderBottom: '1px solid #334155', pb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <CodeIcon color="primary" />
                <Typography variant="h6" fontWeight="bold">
                  {selectedProvider.name}
                </Typography>
              </Box>
              <Chip
                label={selectedProvider.isActive ? 'Active' : 'Inactive'}
                size="small"
                color={selectedProvider.isActive ? 'success' : 'default'}
                sx={{ fontWeight: 'bold' }}
              />
            </DialogTitle>
            <DialogContent sx={{ mt: 2 }}>
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Cost per 1M Tokens
                </Typography>
                <Typography variant="h4" fontWeight="bold" color={selectedProvider.costPer1M < 5 ? 'success.main' : 'text.primary'}>
                  ${selectedProvider.costPer1M.toFixed(2)}
                </Typography>
              </Box>

              <Divider sx={{ my: 2, borderColor: '#334155' }} />

              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Context Window
                </Typography>
                <Typography variant="h5" fontWeight="bold" color="info.main">
                  {selectedProvider.contextWindow}
                </Typography>
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Processing Speed
                </Typography>
                <Typography variant="h5" fontWeight="bold" color="success.main">
                  {selectedProvider.speed}
                </Typography>
              </Box>

              <Box sx={{ p: 2, backgroundColor: '#1e293b', borderRadius: 1, border: '1px solid #334155' }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  💡 Provider Info
                </Typography>
                <Typography variant="body2" color="text.primary">
                  This AI provider is {selectedProvider.isActive ? 'currently active and processing requests' : 'configured but not currently active'}.
                  {selectedProvider.isActive && ' All failure analysis is being routed through this provider for optimal performance and cost.'}
                </Typography>
              </Box>
            </DialogContent>
            <DialogActions sx={{ borderTop: '1px solid #334155', p: 2 }}>
              <Button onClick={() => setSelectedProvider(null)} variant="outlined">
                Close
              </Button>
              {!selectedProvider.isActive && (
                <Button variant="contained" color="primary">
                  Activate Provider
                </Button>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>
    </Container>
  );
}