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
  CardHeader,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Schedule as PendingIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

interface PipelineStatus {
  id: string;
  name: string;
  status: 'success' | 'failed' | 'running' | 'pending';
  lastRun: string;
  successRate: number;
}

interface DashboardMetrics {
  totalPipelines: number;
  activePipelines: number;
  totalTestRuns: number;
  passRate: number;
  recentFailures: number;
}

export default function Dashboard() {
  const navigate = useNavigate();

  // Fetch dashboard metrics
  const { data: metrics, isLoading: metricsLoading } = useQuery<DashboardMetrics>({
    queryKey: ['dashboard', 'metrics'],
    queryFn: async () => {
      const response = await fetch('/api/v1/dashboard/metrics');
      if (!response.ok) throw new Error('Failed to fetch metrics');
      return response.json();
    },
  });

  // Fetch recent pipeline statuses
  const { data: pipelines, isLoading: pipelinesLoading } = useQuery<PipelineStatus[]>({
    queryKey: ['dashboard', 'pipelines'],
    queryFn: async () => {
      const response = await fetch('/api/v1/dashboard/pipelines');
      if (!response.ok) throw new Error('Failed to fetch pipelines');
      return response.json();
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <SuccessIcon color="success" />;
      case 'failed':
        return <ErrorIcon color="error" />;
      case 'running':
        return <CircularProgress size={20} />;
      default:
        return <PendingIcon color="disabled" />;
    }
  };

  if (metricsLoading || pipelinesLoading) {
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

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Grid container spacing={3}>
        {/* Metrics Overview */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6">Overview</Typography>
              <Tooltip title="Refresh">
                <IconButton>
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
            </Box>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={4}>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      Total Pipelines
                    </Typography>
                    <Typography variant="h4">{metrics?.totalPipelines}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      Pass Rate
                    </Typography>
                    <Typography variant="h4">{metrics?.passRate}%</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      Recent Failures
                    </Typography>
                    <Typography variant="h4" color="error">
                      {metrics?.recentFailures}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* Recent Pipeline Status */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Recent Pipeline Status
            </Typography>
            <Grid container spacing={2}>
              {pipelines?.map((pipeline) => (
                <Grid item xs={12} sm={6} md={4} key={pipeline.id}>
                  <Card
                    sx={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/pipelines/${pipeline.id}`)}
                  >
                    <CardHeader
                      title={pipeline.name}
                      action={getStatusIcon(pipeline.status)}
                    />
                    <CardContent>
                      <Typography variant="body2" color="textSecondary">
                        Last Run: {new Date(pipeline.lastRun).toLocaleString()}
                      </Typography>
                      <Typography variant="body2">
                        Success Rate: {pipeline.successRate}%
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}