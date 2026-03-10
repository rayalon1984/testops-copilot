/**
 * Smart Selection Dashboard Page
 *
 * Displays test selection accuracy metrics, regression tracking,
 * and CI time savings over time. Provides full observability into
 * the Smart Test Selection system.
 *
 * Sections:
 * 1. Recall Health Banner — alert if recall drops below threshold
 * 2. Accuracy Metrics — precision, recall, F1 over time
 * 3. Strategy Breakdown — which strategies contribute most
 * 4. Active Regressions — detected regressions with actions
 */

import React, { useState } from 'react';
import {
  Container,
  Typography,
  Paper,
  Box,
  Grid,
  Chip,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Tabs,
  Tab,
  Button,
  Skeleton,
  Tooltip,
  IconButton,
  useTheme,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import SpeedIcon from '@mui/icons-material/Speed';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import BugReportIcon from '@mui/icons-material/BugReport';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import PageHeader from '../components/PageHeader/PageHeader';
import RegressionBadge from '../components/RegressionBadge/RegressionBadge';
import {
  useSelectionAccuracy,
  useRegressionSummary,
  useRecallHealth,
  useConfirmRegression,
  useMarkFalsePositive,
} from '../hooks/api';

// ── Severity Colors ──────────────────────────────────────────────────────

const SEVERITY_COLORS: Record<string, 'error' | 'warning' | 'info' | 'default'> = {
  CRITICAL: 'error',
  HIGH: 'error',
  MEDIUM: 'warning',
  LOW: 'info',
};

const STATUS_COLORS: Record<string, 'error' | 'warning' | 'success' | 'default'> = {
  detected: 'warning',
  confirmed: 'error',
  resolved: 'success',
  false_positive: 'default',
};

// ── Component ────────────────────────────────────────────────────────────

const SmartSelection: React.FC = () => {
  const theme = useTheme();
  const [tabIndex, setTabIndex] = useState(0);
  const [windowDays, setWindowDays] = useState(30);

  // Queries
  const { data: accuracy, isLoading: accuracyLoading } = useSelectionAccuracy(windowDays);
  const { data: regressions, isLoading: regressionsLoading } = useRegressionSummary(windowDays);
  const { data: recallHealth } = useRecallHealth();

  // Mutations
  const confirmRegression = useConfirmRegression();
  const markFalsePositive = useMarkFalsePositive();

  const isLoading = accuracyLoading || regressionsLoading;

  if (isLoading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 2, mb: 4 }}>
        <PageHeader
          title="Smart Test Selection"
          subtitle="Selection accuracy, regressions, and CI savings"
        />
        <Grid container spacing={3} sx={{ mb: 3 }}>
          {[1, 2, 3, 4].map((i) => (
            <Grid item xs={12} sm={6} md={3} key={i}>
              <Skeleton variant="rounded" height={140} sx={{ borderRadius: 2 }} />
            </Grid>
          ))}
        </Grid>
        <Skeleton variant="rounded" height={300} sx={{ borderRadius: 2 }} />
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 2, mb: 4 }}>
      <PageHeader
        title="Smart Test Selection"
        subtitle="Selection accuracy, regressions, and CI savings"
      />

      {/* Recall Health Banner */}
      {recallHealth && !recallHealth.healthy && (
        <Alert
          severity="warning"
          icon={<WarningAmberIcon />}
          sx={{ mb: 3, borderRadius: 2 }}
        >
          {recallHealth.message}
        </Alert>
      )}

      {recallHealth && recallHealth.healthy && (
        <Alert
          severity="success"
          icon={<CheckCircleOutlineIcon />}
          sx={{ mb: 3, borderRadius: 2 }}
        >
          {recallHealth.message}
        </Alert>
      )}

      {/* Time Window Selector */}
      <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
        {[7, 14, 30, 90].map((days) => (
          <Chip
            key={days}
            label={`${days}d`}
            variant={windowDays === days ? 'filled' : 'outlined'}
            color={windowDays === days ? 'primary' : 'default'}
            onClick={() => setWindowDays(days)}
            sx={{ fontWeight: 600 }}
          />
        ))}
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2.5, textAlign: 'center', borderRadius: 2 }}>
            <SpeedIcon color="primary" sx={{ fontSize: 32, mb: 1 }} />
            <Typography variant="h4" fontWeight={700}>
              {accuracy ? `${(accuracy.avgRecall * 100).toFixed(1)}%` : '—'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Avg Recall
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2.5, textAlign: 'center', borderRadius: 2 }}>
            <TrendingUpIcon color="success" sx={{ fontSize: 32, mb: 1 }} />
            <Typography variant="h4" fontWeight={700}>
              {accuracy ? `${(accuracy.avgPrecision * 100).toFixed(1)}%` : '—'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Avg Precision
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2.5, textAlign: 'center', borderRadius: 2 }}>
            <BugReportIcon color="warning" sx={{ fontSize: 32, mb: 1 }} />
            <Typography variant="h4" fontWeight={700}>
              {regressions?.openRegressions ?? 0}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Active Regressions
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2.5, textAlign: 'center', borderRadius: 2 }}>
            <CheckCircleOutlineIcon color="info" sx={{ fontSize: 32, mb: 1 }} />
            <Typography variant="h4" fontWeight={700}>
              {accuracy?.totalRecords ?? 0}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Selections Tracked
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Tab Navigation */}
      <Paper sx={{ mb: 3, borderRadius: 2 }}>
        <Tabs value={tabIndex} onChange={(_, v) => setTabIndex(v)}>
          <Tab label="Accuracy Trends" />
          <Tab label="Strategy Breakdown" />
          <Tab label={`Regressions (${regressions?.openRegressions ?? 0})`} />
        </Tabs>
      </Paper>

      {/* Tab Content */}
      {tabIndex === 0 && (
        <Paper sx={{ p: 3, borderRadius: 2 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            Accuracy Over Time
          </Typography>
          {accuracy && accuracy.trend.length > 0 ? (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Period</TableCell>
                    <TableCell align="right">Precision</TableCell>
                    <TableCell align="right">Recall</TableCell>
                    <TableCell align="right">F1 Score</TableCell>
                    <TableCell align="right">Selections</TableCell>
                    <TableCell align="right">Missed</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {accuracy.trend.map((entry) => (
                    <TableRow key={entry.period}>
                      <TableCell>{entry.period}</TableCell>
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          color={entry.avgPrecision >= 0.7 ? 'success.main' : 'warning.main'}
                          fontWeight={600}
                        >
                          {(entry.avgPrecision * 100).toFixed(1)}%
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          color={entry.avgRecall >= 0.95 ? 'success.main' : 'error.main'}
                          fontWeight={600}
                        >
                          {(entry.avgRecall * 100).toFixed(1)}%
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        {(entry.avgF1 * 100).toFixed(1)}%
                      </TableCell>
                      <TableCell align="right">{entry.totalSelections}</TableCell>
                      <TableCell align="right">
                        {entry.missedRegressions > 0 ? (
                          <Chip label={entry.missedRegressions} color="error" size="small" />
                        ) : (
                          <Chip label="0" color="success" size="small" variant="outlined" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              No accuracy data available yet. Accuracy is tracked after each CI run
              that uses smart test selection.
            </Typography>
          )}
        </Paper>
      )}

      {tabIndex === 1 && (
        <Paper sx={{ p: 3, borderRadius: 2 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            Strategy Performance
          </Typography>
          {accuracy && Object.keys(accuracy.byStrategy).length > 0 ? (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Strategy</TableCell>
                    <TableCell align="right">Usage Count</TableCell>
                    <TableCell align="right">Avg Precision</TableCell>
                    <TableCell align="right">Avg Recall</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Object.entries(accuracy.byStrategy).map(([strategy, stats]) => (
                    <TableRow key={strategy}>
                      <TableCell>
                        <Chip label={strategy} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell align="right">{stats.count}</TableCell>
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          color={stats.avgPrecision >= 0.7 ? 'success.main' : 'warning.main'}
                          fontWeight={600}
                        >
                          {(stats.avgPrecision * 100).toFixed(1)}%
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          color={stats.avgRecall >= 0.95 ? 'success.main' : 'error.main'}
                          fontWeight={600}
                        >
                          {(stats.avgRecall * 100).toFixed(1)}%
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              No strategy data available yet.
            </Typography>
          )}
        </Paper>
      )}

      {tabIndex === 2 && (
        <Paper sx={{ p: 3, borderRadius: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" fontWeight={600}>
              Active Regressions
            </Typography>
            {regressions && (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Chip
                  label={`${regressions.openRegressions} Open`}
                  color="warning"
                  size="small"
                />
                <Chip
                  label={`${regressions.resolvedRegressions} Resolved`}
                  color="success"
                  size="small"
                  variant="outlined"
                />
              </Box>
            )}
          </Box>

          {regressions && regressions.recentRegressions.length > 0 ? (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Test</TableCell>
                    <TableCell>Severity</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Commit</TableCell>
                    <TableCell>PR</TableCell>
                    <TableCell>Detected</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {regressions.recentRegressions.map((reg) => (
                    <TableRow key={reg.id}>
                      <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        <Tooltip title={reg.testName}>
                          <Typography variant="body2" noWrap>
                            {reg.testName}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <RegressionBadge
                          severity={reg.severity}
                          testName={reg.testName}
                          interactive={false}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={reg.status}
                          size="small"
                          color={STATUS_COLORS[reg.status] ?? 'default'}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace" fontSize="0.75rem">
                          {reg.introducingCommit?.substring(0, 8) ?? '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {reg.introducingPR
                          ? `#${reg.introducingPR}`
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption">
                          {new Date(reg.detectedAt).toLocaleDateString()}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        {['detected', 'confirmed'].includes(reg.status) && reg.id && (
                          <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                            <Tooltip title="Confirm regression">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => reg.id && confirmRegression.mutate(reg.id)}
                                disabled={reg.status === 'confirmed' || confirmRegression.isPending}
                              >
                                <ThumbUpIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Mark as false positive">
                              <IconButton
                                size="small"
                                color="default"
                                onClick={() => reg.id && markFalsePositive.mutate(reg.id)}
                                disabled={markFalsePositive.isPending}
                              >
                                <ThumbDownIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <CheckCircleOutlineIcon sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
              <Typography variant="body1" color="text.secondary">
                No regressions detected in the last {windowDays} days
              </Typography>
            </Box>
          )}

          {/* Severity Breakdown */}
          {regressions && Object.keys(regressions.bySeverity).length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                By Severity
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {Object.entries(regressions.bySeverity).map(([severity, count]) => (
                  <Chip
                    key={severity}
                    label={`${severity}: ${count}`}
                    size="small"
                    color={SEVERITY_COLORS[severity] ?? 'default'}
                    variant="outlined"
                  />
                ))}
              </Box>
            </Box>
          )}
        </Paper>
      )}
    </Container>
  );
};

export default SmartSelection;
