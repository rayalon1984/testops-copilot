/**
 * Cost Tracker Page
 * Track and analyze AI usage costs with detailed breakdowns
 */

import { useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  LinearProgress,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  CircularProgress,
} from '@mui/material';
import {
  AttachMoney as MoneyIcon,
  TrendingDown as TrendingDownIcon,
  Savings as SavingsIcon,
  Speed as SpeedIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

interface CostMetrics {
  totalCost: number;
  monthlySpent: number;
  monthlyBudget: number;
  cacheSavings: number;
  cacheHitRate: number;
  averageCostPerAnalysis: number;
  totalAnalyses: number;
}

interface UsageEntry {
  date: string;
  provider: string;
  model: string;
  requests: number;
  tokens: number;
  cost: number;
  cacheHits: number;
}

export default function CostTracker() {
  const [timeRange, setTimeRange] = useState('30d');

  // Fetch cost metrics
  const { data: metrics, isLoading } = useQuery<CostMetrics>({
    queryKey: ['cost-metrics', timeRange],
    queryFn: async () => {
      const token = localStorage.getItem('accessToken');
      const response = await axios.get(`/api/v1/ai/costs?timeRange=${timeRange}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      return response.data;
    },
    initialData: {
      totalCost: 2.34,
      monthlySpent: 47.20,
      monthlyBudget: 100,
      cacheSavings: 38.50,
      cacheHitRate: 65,
      averageCostPerAnalysis: 0.003,
      totalAnalyses: 783,
    },
  });

  // Mock usage data
  const usageData: UsageEntry[] = [
    { date: '2026-02-14', provider: 'Anthropic', model: 'Claude Opus 4.6', requests: 45, tokens: 54000, cost: 0.486, cacheHits: 28 },
    { date: '2026-02-13', provider: 'Anthropic', model: 'Claude Opus 4.6', requests: 52, tokens: 62400, cost: 0.562, cacheHits: 35 },
    { date: '2026-02-12', provider: 'OpenAI', model: 'GPT-4.1', requests: 18, tokens: 27000, cost: 0.540, cacheHits: 12 },
    { date: '2026-02-11', provider: 'Anthropic', model: 'Claude Opus 4.6', requests: 38, tokens: 45600, cost: 0.410, cacheHits: 22 },
    { date: '2026-02-10', provider: 'Google', model: 'Gemini 3.0 Flash', requests: 65, tokens: 71500, cost: 0.027, cacheHits: 48 },
    { date: '2026-02-09', provider: 'OpenRouter', model: 'meta-llama/llama-4-maverick', requests: 30, tokens: 42000, cost: 0.018, cacheHits: 19 },
  ];

  const budgetUsedPercent = (metrics.monthlySpent / metrics.monthlyBudget) * 100;

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 2, mb: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" fontWeight="bold" color="text.primary" gutterBottom>
            AI Cost Tracker
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Monitor and optimize your AI usage costs
          </Typography>
        </Box>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Time Range</InputLabel>
          <Select
            value={timeRange}
            label="Time Range"
            onChange={(e) => setTimeRange(e.target.value)}
          >
            <MenuItem value="7d">Last 7 days</MenuItem>
            <MenuItem value="30d">Last 30 days</MenuItem>
            <MenuItem value="90d">Last 90 days</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Total Cost */}
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Total Cost
                </Typography>
                <MoneyIcon color="primary" />
              </Box>
              <Typography variant="h3" fontWeight="bold" color="primary.main" sx={{ my: 1 }}>
                ${metrics.totalCost.toFixed(2)}
              </Typography>
              <Typography variant="body2" color="success.main">
                <TrendingDownIcon sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.5 }} />
                18% lower than last month
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Monthly Budget */}
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Monthly Budget
                </Typography>
                <MoneyIcon color={budgetUsedPercent > 80 ? 'error' : 'success'} />
              </Box>
              <Typography variant="h3" fontWeight="bold" color="text.primary" sx={{ my: 1 }}>
                ${metrics.monthlySpent.toFixed(2)}
              </Typography>
              <Box sx={{ mt: 1 }}>
                <LinearProgress
                  variant="determinate"
                  value={budgetUsedPercent}
                  sx={{
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: '#e0e0e0',
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: budgetUsedPercent > 80 ? '#ef4444' : '#10b981',
                    },
                  }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  {budgetUsedPercent.toFixed(1)}% of ${metrics.monthlyBudget} budget
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Cache Savings */}
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Cache Savings
                </Typography>
                <SavingsIcon color="success" />
              </Box>
              <Typography variant="h3" fontWeight="bold" color="success.main" sx={{ my: 1 }}>
                ${metrics.cacheSavings.toFixed(2)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {metrics.cacheHitRate}% cache hit rate
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Average Cost */}
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Avg Cost/Analysis
                </Typography>
                <SpeedIcon color="info" />
              </Box>
              <Typography variant="h3" fontWeight="bold" color="info.main" sx={{ my: 1 }}>
                ${metrics.averageCostPerAnalysis.toFixed(4)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {metrics.totalAnalyses} total analyses
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Usage Breakdown Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight="bold" gutterBottom>
            Daily Usage Breakdown
          </Typography>
          <TableContainer component={Paper} elevation={0}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell><strong>Date</strong></TableCell>
                  <TableCell><strong>Provider</strong></TableCell>
                  <TableCell><strong>Model</strong></TableCell>
                  <TableCell align="right"><strong>Requests</strong></TableCell>
                  <TableCell align="right"><strong>Tokens</strong></TableCell>
                  <TableCell align="right"><strong>Cache Hits</strong></TableCell>
                  <TableCell align="right"><strong>Cost</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {usageData.map((row, index) => (
                  <TableRow key={index} hover>
                    <TableCell>{row.date}</TableCell>
                    <TableCell>
                      <Chip
                        label={row.provider}
                        size="small"
                        color={
                          row.provider === 'Anthropic' ? 'primary' :
                            row.provider === 'OpenAI' ? 'secondary' :
                              row.provider === 'OpenRouter' ? 'warning' : 'success'
                        }
                      />
                    </TableCell>
                    <TableCell>{row.model}</TableCell>
                    <TableCell align="right">{row.requests}</TableCell>
                    <TableCell align="right">{row.tokens.toLocaleString()}</TableCell>
                    <TableCell align="right">
                      <Chip
                        label={row.cacheHits}
                        size="small"
                        color="success"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight="bold" color="primary">
                        ${row.cost.toFixed(3)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Container>
  );
}
