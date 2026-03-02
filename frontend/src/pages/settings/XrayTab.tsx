/**
 * XrayTab — Xray Cloud Integration settings tab.
 *
 * Self-contained: fetches its own data via useXray hooks (not the parent Settings object).
 * Admin-only "Test Connection" button validates OAuth2 credentials.
 * Shows recent sync history and connection status.
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
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Sync as SyncIcon,
  LinkOff as LinkOffIcon,
} from '@mui/icons-material';
import { useXrayTestConnection, useXraySyncHistory } from '../../hooks/api';
import type { XraySyncRecord } from '../../hooks/api';

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

// ─── Component ───────────────────────────────────────────────

export function XrayTab(): React.ReactElement {
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [connectionError, setConnectionError] = useState('');

  const testConnection = useXrayTestConnection();
  const { data: syncHistory, isLoading: historyLoading } = useXraySyncHistory();

  const handleTestConnection = () => {
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
              {testConnection.isPending ? 'Testing…' : 'Test Connection'}
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
