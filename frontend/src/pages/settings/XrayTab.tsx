/**
 * XrayTab — Xray Cloud Integration settings tab.
 *
 * Self-contained: fetches its own data via useXray hooks (not the parent Settings object).
 * Admin-only "Test Connection" button validates OAuth2 credentials.
 * Shows auto-sync toggle, test plan browser, and recent sync history.
 */

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  Typography,
  Box,
  Button,
  Alert,
  CircularProgress,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Switch,
  FormControlLabel,
  LinearProgress,
  Collapse,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Sync as SyncIcon,
  LinkOff as LinkOffIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import {
  useXrayTestConnection,
  useXraySyncHistory,
  useXrayTestPlans,
  useXrayTestPlanDetail,
  useXrayConfig,
  useUpdateXrayConfig,
} from '../../hooks/api';
import type { XraySyncRecord, XrayTestPlan } from '../../hooks/api';

// ─── Status Chip Helper ──────────────────────────────────────

function SyncStatusChip({ status }: { status: XraySyncRecord['status'] }) {
  const map: Record<string, { color: 'success' | 'error' | 'warning' | 'default'; label: string }> = {
    SYNCED: { color: 'success', label: 'Synced' },
    FAILED: { color: 'error', label: 'Failed' },
    SYNCING: { color: 'warning', label: 'Syncing' },
    PENDING: { color: 'default', label: 'Pending' },
  };
  const { color, label } = map[status] ?? { color: 'default' as const, label: status };
  return <Chip size="small" color={color} label={label} />;
}

function TriggerChip({ trigger }: { trigger: 'MANUAL' | 'AUTO' }) {
  return (
    <Chip
      size="small"
      variant="outlined"
      label={trigger === 'AUTO' ? 'Auto' : 'Manual'}
      color={trigger === 'AUTO' ? 'info' : 'default'}
      sx={{ fontSize: '0.7rem' }}
    />
  );
}

// ─── Coverage Bar ────────────────────────────────────────────

function CoverageBar({ percentage }: { percentage: number }) {
  const color = percentage >= 80 ? 'success' : percentage >= 50 ? 'warning' : 'error';
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 120 }}>
      <LinearProgress
        variant="determinate"
        value={percentage}
        color={color}
        sx={{ flex: 1, height: 6, borderRadius: 3 }}
      />
      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 36, textAlign: 'right' }}>
        {percentage}%
      </Typography>
    </Box>
  );
}

// ─── Test Plan Detail Row ────────────────────────────────────

function TestPlanExpandableRow({ plan }: { plan: XrayTestPlan }) {
  const [expanded, setExpanded] = useState(false);
  const { data: detail, isLoading } = useXrayTestPlanDetail(expanded ? plan.key : undefined);

  return (
    <>
      <TableRow
        hover
        sx={{ cursor: 'pointer', '& > td': { borderBottom: expanded ? 0 : undefined } }}
        onClick={() => setExpanded(!expanded)}
      >
        <TableCell>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <IconButton size="small" sx={{ p: 0.25 }}>
              {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </IconButton>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
              {plan.key}
            </Typography>
          </Box>
        </TableCell>
        <TableCell>
          <Typography variant="body2" sx={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>
            {plan.summary}
          </Typography>
        </TableCell>
        <TableCell align="center">{plan.testCount}</TableCell>
        <TableCell>
          <CoverageBar percentage={plan.coveragePercentage} />
        </TableCell>
        <TableCell>
          <Typography variant="body2" color="text.secondary">
            {plan.lastUpdated ? new Date(plan.lastUpdated).toLocaleDateString() : '—'}
          </Typography>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={5} sx={{ py: 0, px: 0 }}>
          <Collapse in={expanded} timeout="auto" unmountOnExit>
            <Box sx={{ px: 3, py: 1.5, bgcolor: 'action.hover' }}>
              {isLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
                  <CircularProgress size={20} />
                </Box>
              ) : detail?.testCases && detail.testCases.length > 0 ? (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Test Case</TableCell>
                      <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Summary</TableCell>
                      <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Last Run</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {detail.testCases.map((tc) => (
                      <TableRow key={tc.key}>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                            {tc.key}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                            {tc.summary}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={tc.status}
                            color={tc.status === 'PASS' ? 'success' : tc.status === 'FAIL' ? 'error' : 'default'}
                            sx={{ fontSize: '0.7rem' }}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                            {tc.lastExecution ? new Date(tc.lastExecution).toLocaleDateString() : '—'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No test cases found for this plan.
                </Typography>
              )}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

// ─── Component ───────────────────────────────────────────────

export function XrayTab(): React.ReactElement {
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [connectionError, setConnectionError] = useState('');

  const testConnection = useXrayTestConnection();
  const { data: syncData, isLoading: historyLoading } = useXraySyncHistory();
  const { data: plansData, isLoading: plansLoading } = useXrayTestPlans();
  const { data: xrayConfig, isLoading: configLoading } = useXrayConfig();
  const updateConfig = useUpdateXrayConfig();

  const syncHistory = syncData?.syncs;
  const testPlans = plansData?.testPlans;

  const handleTestConnection = (): void => {
    setConnectionStatus('idle');
    setConnectionError('');
    testConnection.mutate(undefined, {
      onSuccess: (data) => {
        setConnectionStatus(data.connected ? 'success' : 'error');
        if (!data.connected) setConnectionError('Authentication failed. Check your credentials.');
      },
      onError: (err: Error) => {
        setConnectionStatus('error');
        setConnectionError(err.message || 'Connection test failed');
      },
    });
  };

  const handleAutoSyncToggle = (_event: React.ChangeEvent<HTMLInputElement>, checked: boolean): void => {
    updateConfig.mutate({ autoSync: checked });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Connection Card */}
      <Card>
        <CardHeader
          title="Xray Cloud Connection"
          subheader="Connect to Xray Cloud to sync test executions and search test cases from the AI Copilot."
        />
        <CardContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Xray credentials are configured via environment variables:
            <code style={{ display: 'block', marginTop: 8, padding: '8px 12px', background: 'rgba(0,0,0,0.04)', borderRadius: 4 }}>
              XRAY_CLIENT_ID, XRAY_CLIENT_SECRET, XRAY_PROJECT_KEY
            </code>
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={testConnection.isPending ? <CircularProgress size={16} /> : <SyncIcon />}
              onClick={handleTestConnection}
              disabled={testConnection.isPending}
            >
              {testConnection.isPending ? 'Testing\u2026' : 'Test Connection'}
            </Button>

            {connectionStatus === 'success' && (
              <Chip
                icon={<CheckIcon />}
                label="Connected"
                color="success"
                variant="outlined"
                size="small"
              />
            )}

            {connectionStatus === 'error' && (
              <Chip
                icon={<ErrorIcon />}
                label="Not Connected"
                color="error"
                variant="outlined"
                size="small"
              />
            )}
          </Box>

          {connectionStatus === 'success' && (
            <Alert severity="success" sx={{ mt: 2 }}>
              Xray Cloud credentials are valid. Test case search and sync are available.
            </Alert>
          )}

          {connectionStatus === 'error' && (
            <Alert severity="error" sx={{ mt: 2 }} icon={<LinkOffIcon />}>
              {connectionError}
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Auto-Sync Configuration Card */}
      <Card>
        <CardHeader
          title="Auto-Sync"
          subheader="Automatically sync test run results to Xray when a test run completes."
        />
        <CardContent>
          {configLoading ? (
            <CircularProgress size={20} />
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={xrayConfig?.autoSync ?? false}
                    onChange={handleAutoSyncToggle}
                    disabled={updateConfig.isPending || !xrayConfig?.configured}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2">
                      {xrayConfig?.autoSync ? 'Auto-sync enabled' : 'Auto-sync disabled'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {xrayConfig?.configured
                        ? 'Test results will be pushed to Xray automatically when runs complete.'
                        : 'Configure Xray credentials first to enable auto-sync.'}
                    </Typography>
                  </Box>
                }
              />
              {updateConfig.isPending && <CircularProgress size={16} />}
            </Box>
          )}

          {updateConfig.isSuccess && (
            <Alert severity="success" sx={{ mt: 1 }}>
              {updateConfig.data?.message || 'Config updated.'}
            </Alert>
          )}

          {updateConfig.isError && (
            <Alert severity="error" sx={{ mt: 1 }}>
              Failed to update auto-sync setting.
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Test Plans Browser Card */}
      <Card>
        <CardHeader
          title="Test Plans"
          subheader="Browse Xray test plans with coverage data. Expand a plan to see its test cases."
          action={
            plansData?.total !== undefined ? (
              <Tooltip title="Total plans">
                <Chip label={`${plansData.total} plans`} size="small" variant="outlined" />
              </Tooltip>
            ) : null
          }
        />
        <CardContent>
          {plansLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={24} />
            </Box>
          ) : !testPlans || testPlans.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No test plans found. Ensure Xray is configured and has test plans in the project.
            </Typography>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Plan</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Summary</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="center">Tests</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Coverage</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Updated</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {testPlans.map((plan) => (
                    <TestPlanExpandableRow key={plan.key} plan={plan} />
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Sync History Card */}
      <Card>
        <CardHeader
          title="Sync History"
          subheader="Recent test run syncs to Xray Cloud."
        />
        <CardContent>
          {historyLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={24} />
            </Box>
          ) : !syncHistory || syncHistory.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No syncs yet. Sync a test run from the test run detail page.
            </Typography>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Xray Execution</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Trigger</TableCell>
                    <TableCell align="right">Results</TableCell>
                    <TableCell>Synced At</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {syncHistory.map((sync) => (
                    <TableRow key={sync.id}>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                          {sync.xrayExecutionId ?? '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <SyncStatusChip status={sync.status} />
                      </TableCell>
                      <TableCell>
                        <TriggerChip trigger={sync.trigger ?? 'MANUAL'} />
                      </TableCell>
                      <TableCell align="right">{sync.resultCount}</TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {sync.syncedAt ? new Date(sync.syncedAt).toLocaleString() : '—'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
