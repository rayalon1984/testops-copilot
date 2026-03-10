/**
 * Regression Badge Component
 *
 * Displays a colored badge indicating a test regression with hover details
 * showing the introducing commit, PR, and author information.
 *
 * Usage:
 *   <RegressionBadge regression={regressionEvent} />
 *   <RegressionBadge severity="HIGH" testName="auth.test.ts" />
 */

import React, { useState } from 'react';
import {
  Box,
  Chip,
  Tooltip,
  Typography,
  Popover,
  Paper,
  Divider,
  useTheme,
  type Theme,
} from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

// ── Types ────────────────────────────────────────────────────────────────

interface RegressionData {
  id?: string;
  testName: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'detected' | 'confirmed' | 'resolved' | 'false_positive';
  introducingCommit?: string | null;
  introducingPR?: number | null;
  prTitle?: string | null;
  prAuthor?: string | null;
  lastPassingCommit?: string | null;
  errorMessage?: string | null;
  detectedAt?: string;
}

interface RegressionBadgeProps {
  /** Full regression event data (provides all info) */
  regression?: RegressionData;
  /** Severity level (if regression prop not provided) */
  severity?: RegressionData['severity'];
  /** Test name for tooltip (if regression prop not provided) */
  testName?: string;
  /** Badge size */
  size?: 'small' | 'medium';
  /** Show detailed popover on click */
  interactive?: boolean;
}

// ── Color Config ─────────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<string, {
  color: 'error' | 'warning' | 'info' | 'default' | 'success';
  icon: React.ReactElement;
  label: string;
}> = {
  CRITICAL: { color: 'error', icon: <ErrorOutlineIcon fontSize="small" />, label: 'Critical' },
  HIGH: { color: 'error', icon: <ErrorOutlineIcon fontSize="small" />, label: 'High' },
  MEDIUM: { color: 'warning', icon: <WarningAmberIcon fontSize="small" />, label: 'Medium' },
  LOW: { color: 'info', icon: <InfoOutlinedIcon fontSize="small" />, label: 'Low' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  detected: { label: 'Detected', color: '#ff9800' },
  confirmed: { label: 'Confirmed', color: '#f44336' },
  resolved: { label: 'Resolved', color: '#4caf50' },
  false_positive: { label: 'False Positive', color: '#9e9e9e' },
};

// ── Popover Content Sub-Component ─────────────────────────────────────────

interface RegressionPopoverContentProps {
  regression: RegressionData;
  config: { color: 'error' | 'warning' | 'info' | 'default' | 'success'; label: string };
  statusConfig: { label: string; color: string };
  testName: string;
  theme: Theme;
}

function RegressionPopoverContent({
  regression,
  config,
  statusConfig,
  testName,
  theme,
}: RegressionPopoverContentProps): React.ReactElement {
  return (
    <Paper sx={{ p: 2, maxWidth: 360 }}>
      <Typography variant="subtitle2" fontWeight={700} gutterBottom>
        Regression Details
      </Typography>

      <Box sx={{ mb: 1 }}>
        <Typography variant="caption" color="text.secondary">Test</Typography>
        <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
          {testName}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
        <Chip
          label={config.label}
          size="small"
          color={config.color}
          sx={{ fontWeight: 600 }}
        />
        <Chip
          label={statusConfig.label}
          size="small"
          variant="outlined"
          sx={{ fontWeight: 500, borderColor: statusConfig.color, color: statusConfig.color }}
        />
      </Box>

      <Divider sx={{ my: 1 }} />

      {regression.introducingCommit && (
        <Box sx={{ mb: 0.5 }}>
          <Typography variant="caption" color="text.secondary">
            Introducing Commit
          </Typography>
          <Typography variant="body2" fontFamily="monospace" fontSize="0.75rem">
            {regression.introducingCommit.substring(0, 8)}
          </Typography>
        </Box>
      )}

      {regression.introducingPR && (
        <Box sx={{ mb: 0.5 }}>
          <Typography variant="caption" color="text.secondary">
            Pull Request
          </Typography>
          <Typography variant="body2">
            #{regression.introducingPR}
            {regression.prTitle && `: ${regression.prTitle}`}
          </Typography>
        </Box>
      )}

      {regression.prAuthor && (
        <Box sx={{ mb: 0.5 }}>
          <Typography variant="caption" color="text.secondary">Author</Typography>
          <Typography variant="body2">{regression.prAuthor}</Typography>
        </Box>
      )}

      {regression.lastPassingCommit && (
        <Box sx={{ mb: 0.5 }}>
          <Typography variant="caption" color="text.secondary">
            Last Passing Commit
          </Typography>
          <Typography variant="body2" fontFamily="monospace" fontSize="0.75rem">
            {regression.lastPassingCommit.substring(0, 8)}
          </Typography>
        </Box>
      )}

      {regression.errorMessage && (
        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary">Error</Typography>
          <Typography
            variant="body2"
            sx={{
              fontSize: '0.75rem',
              fontFamily: 'monospace',
              bgcolor: theme.palette.mode === 'dark' ? 'grey.900' : 'grey.100',
              p: 1,
              borderRadius: 1,
              maxHeight: 80,
              overflow: 'auto',
              wordBreak: 'break-all',
            }}
          >
            {regression.errorMessage.substring(0, 200)}
            {(regression.errorMessage?.length ?? 0) > 200 ? '...' : ''}
          </Typography>
        </Box>
      )}

      {regression.detectedAt && (
        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Detected: {new Date(regression.detectedAt).toLocaleString()}
          </Typography>
        </Box>
      )}
    </Paper>
  );
}

// ── Component ────────────────────────────────────────────────────────────

export default function RegressionBadge({
  regression,
  severity: severityProp,
  testName: testNameProp,
  size = 'small',
  interactive = true,
}: RegressionBadgeProps) {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const severity = regression?.severity ?? severityProp ?? 'MEDIUM';
  const testName = regression?.testName ?? testNameProp ?? 'Unknown Test';
  const config = SEVERITY_CONFIG[severity] ?? SEVERITY_CONFIG.MEDIUM;
  const status = regression?.status ?? 'detected';
  const statusConfig = STATUS_CONFIG[status] ?? STATUS_CONFIG.detected;

  // Resolved regressions get a different look
  if (status === 'resolved') {
    return (
      <Tooltip title={`Regression resolved: ${testName}`}>
        <Chip
          icon={<CheckCircleOutlineIcon fontSize="small" />}
          label="Resolved"
          size={size}
          color="success"
          variant="outlined"
          sx={{ fontWeight: 500 }}
        />
      </Tooltip>
    );
  }

  // False positives are dimmed
  if (status === 'false_positive') {
    return (
      <Tooltip title={`False positive: ${testName}`}>
        <Chip
          label="FP"
          size={size}
          variant="outlined"
          sx={{ fontWeight: 500, opacity: 0.5 }}
        />
      </Tooltip>
    );
  }

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    if (interactive && regression) {
      setAnchorEl(event.currentTarget);
    }
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const popoverOpen = Boolean(anchorEl);

  return (
    <>
      <Tooltip title={interactive ? 'Click for details' : `Regression: ${testName}`}>
        <Chip
          icon={config.icon}
          label={`Regression (${config.label})`}
          size={size}
          color={config.color}
          onClick={interactive ? handleClick : undefined}
          sx={{
            fontWeight: 600,
            cursor: interactive ? 'pointer' : 'default',
            animation: severity === 'CRITICAL' ? 'pulse 2s infinite' : undefined,
            '@keyframes pulse': {
              '0%': { boxShadow: `0 0 0 0 ${theme.palette.error.main}40` },
              '70%': { boxShadow: `0 0 0 6px ${theme.palette.error.main}00` },
              '100%': { boxShadow: `0 0 0 0 ${theme.palette.error.main}00` },
            },
          }}
        />
      </Tooltip>

      {interactive && regression && (
        <Popover
          open={popoverOpen}
          anchorEl={anchorEl}
          onClose={handleClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        >
          <RegressionPopoverContent
            regression={regression}
            config={config}
            statusConfig={statusConfig}
            testName={testName}
            theme={theme}
          />
        </Popover>
      )}
    </>
  );
}
