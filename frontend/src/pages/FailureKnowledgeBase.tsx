/**
 * Failure Knowledge Base Dashboard
 * Browse, search, and analyze past failures and their RCAs
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Alert,
  CircularProgress,
  Divider,
  Paper,
  Stack
} from '@mui/material';
import {
  Search as SearchIcon,
  TrendingUp as TrendingUpIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Repeat as RepeatIcon
} from '@mui/icons-material';
import PageHeader from '../components/PageHeader/PageHeader';
import FailureTrendChart from '../components/FailureTrendChart/FailureTrendChart';
import RiskScoreTable from '../components/RiskScoreTable/RiskScoreTable';
import { api } from '../api';
import type { ApiSchemas } from '../api';

type FailureInsights = ApiSchemas['FailureInsights'];
type Failure = ApiSchemas['FailureSearchResult'];

export const FailureKnowledgeBase: React.FC = () => {
  const [insights, setInsights] = useState<FailureInsights | null>(null);
  const [failures, setFailures] = useState<Failure[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [showRecurringOnly, _setShowRecurringOnly] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [insightsData, failuresData] = await Promise.all([
        api.get<FailureInsights>('/failure-archive/insights?days=30'),
        api.get<{ failures: Failure[]; total: number }>('/failure-archive/search?limit=50'),
      ]);

      setInsights(insightsData);
      setFailures(failuresData.failures);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('testName', searchTerm);
      if (statusFilter) params.append('status', statusFilter);
      if (severityFilter) params.append('severity', severityFilter);
      if (showRecurringOnly) params.append('isRecurring', 'true');

      const data = await api.get<{ failures: Failure[]; total: number }>(`/failure-archive/search?${params.toString()}`);
      setFailures(data.failures);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !insights) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="xl">
      <PageHeader
        title="Failure Knowledge Base"
        subtitle="Learn from past failures and find solutions faster"
      />

      {/* Insights Summary */}
      {insights && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <ErrorIcon sx={{ fontSize: 40, color: 'error.main', mb: 1 }} />
              <Typography variant="h4">{insights.totalFailures}</Typography>
              <Typography variant="body2" color="text.secondary">
                Total Failures (30 days)
              </Typography>
            </Paper>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <CheckCircleIcon sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
              <Typography variant="h4">{insights.documentedCount}</Typography>
              <Typography variant="body2" color="text.secondary">
                With RCA ({Math.round(((insights.documentedCount ?? 0) / (insights.totalFailures || 1)) * 100)}%)
              </Typography>
            </Paper>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <RepeatIcon sx={{ fontSize: 40, color: 'warning.main', mb: 1 }} />
              <Typography variant="h4">{insights.recurringCount}</Typography>
              <Typography variant="body2" color="text.secondary">
                Recurring Issues
              </Typography>
            </Paper>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <TrendingUpIcon sx={{ fontSize: 40, color: 'info.main', mb: 1 }} />
              <Typography variant="h4">{insights.averageTimeToResolve}m</Typography>
              <Typography variant="body2" color="text.secondary">
                Avg Time to Resolve
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Predictive Analysis */}
      <FailureTrendChart />
      <RiskScoreTable />

      {/* Most Common Failures */}
      {insights && insights.mostCommonFailures && insights.mostCommonFailures.length > 0 && (
        <Paper sx={{ p: 3, mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            🔥 Most Common Failures (Last 30 Days)
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Stack spacing={1}>
            {insights.mostCommonFailures!.map((failure, index) => (
              <Box
                key={index}
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  p: 1,
                  bgcolor: 'background.default',
                  borderRadius: 1
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Chip label={`#${index + 1}`} size="small" color="primary" />
                  <Typography variant="body2">{failure.testName}</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Chip label={`${failure.count} occurrences`} size="small" />
                  <Typography variant="caption" color="text.secondary">
                    Last: {new Date(failure.lastOccurrence ?? '').toLocaleDateString()}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Stack>
        </Paper>
      )}

      {/* Search & Filters */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              placeholder="Search by test name or error message..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
              }}
            />
          </Grid>

          <Grid item xs={12} sm={4} md={2}>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                label="Status"
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="NEW">New</MenuItem>
                <MenuItem value="DOCUMENTED">Documented</MenuItem>
                <MenuItem value="RESOLVED">Resolved</MenuItem>
                <MenuItem value="RECURRING">Recurring</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={4} md={2}>
            <FormControl fullWidth>
              <InputLabel>Severity</InputLabel>
              <Select
                value={severityFilter}
                label="Severity"
                onChange={(e) => setSeverityFilter(e.target.value)}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="CRITICAL">Critical</MenuItem>
                <MenuItem value="HIGH">High</MenuItem>
                <MenuItem value="MEDIUM">Medium</MenuItem>
                <MenuItem value="LOW">Low</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={4} md={2}>
            <Button
              fullWidth
              variant="contained"
              onClick={handleSearch}
              sx={{ height: '56px' }}
            >
              Search
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Failures List */}
      {loading ? (
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
      ) : failures.length === 0 ? (
        <Alert severity="info">
          No failures found. Try adjusting your search criteria.
        </Alert>
      ) : (
        <Grid container spacing={3}>
          {failures.map((failure) => (
            <Grid item xs={12} key={failure.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h6" gutterBottom>
                        {failure.testName}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {(failure.errorMessage ?? '').substring(0, 200)}
                        {(failure.errorMessage ?? '').length > 200 && '...'}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Chip
                        label={failure.resolved ? 'RESOLVED' : 'OPEN'}
                        size="small"
                        color={failure.resolved ? 'success' : 'default'}
                      />
                      <Chip
                        label={failure.severity}
                        size="small"
                        color={
                          failure.severity === 'CRITICAL'
                            ? 'error'
                            : failure.severity === 'HIGH'
                            ? 'warning'
                            : 'default'
                        }
                      />
                      {(failure.occurrenceCount ?? 0) > 1 && (
                        <Chip
                          label={`${failure.occurrenceCount}x`}
                          size="small"
                          color="warning"
                          icon={<RepeatIcon />}
                        />
                      )}
                    </Box>
                  </Box>

                  {failure.rootCause && (
                    <Box sx={{ bgcolor: 'success.light', p: 2, borderRadius: 1, mb: 2, color: 'success.contrastText' }}>
                      <Typography variant="subtitle2" gutterBottom>
                        ✅ Root Cause Documented:
                      </Typography>
                      <Typography variant="body2">
                        {failure.rootCause.substring(0, 300)}
                        {failure.rootCause.length > 300 && '...'}
                      </Typography>
                    </Box>
                  )}

                  {failure.solution && (
                    <Box sx={{ bgcolor: 'info.light', p: 2, borderRadius: 1, mb: 2, color: 'info.contrastText' }}>
                      <Typography variant="subtitle2" gutterBottom>
                        💡 Solution:
                      </Typography>
                      <Typography variant="body2">
                        {failure.solution.substring(0, 200)}
                        {failure.solution.length > 200 && '...'}
                      </Typography>
                    </Box>
                  )}

                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                    {(failure.tags ? failure.tags.split(',').filter(Boolean) : []).map((tag) => (
                      <Chip key={tag} label={tag.trim()} size="small" />
                    ))}
                  </Box>

                  <Typography variant="caption" color="text.secondary">
                    Occurred: {new Date(failure.lastOccurrence ?? '').toLocaleString()}
                    {failure.relatedJiraIssue && ` • Jira: ${failure.relatedJiraIssue}`}
                  </Typography>
                </CardContent>

                <CardActions>
                  <Button size="small" href={`/failure-archive/${failure.id}`}>
                    View Full Details
                  </Button>
                  {!failure.rootCause && (
                    <Button size="small" variant="outlined">
                      Document RCA
                    </Button>
                  )}
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Container>
  );
};
