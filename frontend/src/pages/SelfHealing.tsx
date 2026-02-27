/**
 * Self-Healing Dashboard
 *
 * View / manage healing rules, quarantined tests, and healing events.
 * Phase 1: Auto-Retry | Phase 2: Quarantine | Phase 3: AI Fix PRs
 */

import React, { useState } from 'react';
import {
  Container, Typography, Paper, Box, Button, Chip, Switch, Tabs, Tab,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, CircularProgress, Alert, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, FormControl, InputLabel,
  Select, MenuItem, Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Replay as RetryIcon,
  Shield as ShieldIcon,
  TrendingUp as StatsIcon,
  Restore as ReinstateIcon,
} from '@mui/icons-material';
import PageHeader from '../components/PageHeader/PageHeader';
import {
  useHealingRules, useHealingEvents, useHealingStats,
  useCreateHealingRule, useToggleHealingRule, useDeleteHealingRule,
  useSeedHealingRules, useQuarantinedTests, useReinstateTest,
  useDeleteQuarantinedTest,
  type HealingRule, type QuarantinedTest,
} from '../hooks/api';

// ─── Helpers ─────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, 'warning' | 'error' | 'info' | 'default'> = {
  transient: 'warning',
  infrastructure: 'error',
  flaky: 'info',
  custom: 'default',
};

const STATUS_COLORS: Record<string, 'success' | 'error' | 'warning' | 'default' | 'info'> = {
  succeeded: 'success',
  failed: 'error',
  skipped: 'warning',
  executing: 'info',
  pending: 'default',
};

// ─── Component ──────────────────────────────────────────

const SelfHealing: React.FC = () => {
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '', description: '', pattern: '',
    patternType: 'regex', category: 'custom', action: 'retry',
    confidenceThreshold: 0.9, priority: 50,
  });
  const [error, setError] = useState<string | null>(null);
  const [tabIndex, setTabIndex] = useState(0);

  // ─── Queries ─────────────────────────────────────────
  const { data: rules = [], isLoading: rulesLoading } = useHealingRules();
  const { data: events = [] } = useHealingEvents({ limit: 20 });
  const { data: stats } = useHealingStats();
  const { data: quarantinedTests = [] } = useQuarantinedTests();

  // ─── Mutations ───────────────────────────────────────
  const createMutation = useCreateHealingRule();
  const toggleMutation = useToggleHealingRule();
  const deleteMutation = useDeleteHealingRule();
  const seedMutation = useSeedHealingRules();
  const reinstateMutation = useReinstateTest();
  const deleteQuarantineMutation = useDeleteQuarantinedTest();

  const handleCreate = () => {
    if (!createForm.name.trim() || !createForm.pattern.trim()) return;
    createMutation.mutate(createForm, {
      onSuccess: () => {
        setCreateOpen(false);
        setCreateForm({ name: '', description: '', pattern: '', patternType: 'regex', category: 'custom', action: 'retry', confidenceThreshold: 0.9, priority: 50 });
      },
      onError: (err) => setError(err instanceof Error ? err.message : 'Failed to create rule'),
    });
  };

  const handleSeed = () => {
    seedMutation.mutate(undefined, {
      onSuccess: (data) => setError(data?.seeded ? `Seeded ${data.seeded} built-in rules` : 'All built-in rules already exist'),
      onError: (err) => setError(err instanceof Error ? err.message : 'Failed to seed rules'),
    });
  };

  if (rulesLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg">
      <PageHeader
        title="Self-Healing Pipelines"
        subtitle="Automatic failure detection, retry, and recovery"
      />

      {error && (
        <Alert severity="info" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabIndex} onChange={(_, v) => setTabIndex(v)}>
          <Tab label="Rules & Events" />
          <Tab label={`Quarantine (${(quarantinedTests as QuarantinedTest[]).length})`} />
        </Tabs>
      </Paper>

      {tabIndex === 0 && (<>
      {/* Stats Cards */}
      {stats && (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, mb: 3 }}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <StatsIcon color="primary" />
            <Typography variant="h5" fontWeight={700}>{stats.activeRules}</Typography>
            <Typography variant="caption" color="text.secondary">Active Rules</Typography>
          </Paper>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <RetryIcon color="success" />
            <Typography variant="h5" fontWeight={700}>{stats.successfulRetries}</Typography>
            <Typography variant="caption" color="text.secondary">Successful Retries</Typography>
          </Paper>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <ShieldIcon color="warning" />
            <Typography variant="h5" fontWeight={700}>{stats.retriesSavedToday}</Typography>
            <Typography variant="caption" color="text.secondary">Saved Today</Typography>
          </Paper>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h5" fontWeight={700}>{stats.skippedEvents}</Typography>
            <Typography variant="caption" color="text.secondary">Skipped (Circuit Breaker)</Typography>
          </Paper>
        </Box>
      )}

      {/* Healing Rules */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Healing Rules</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="outlined" size="small" onClick={handleSeed} disabled={seedMutation.isPending}>
              {seedMutation.isPending ? <CircularProgress size={16} sx={{ mr: 0.5 }} /> : null}
              Seed Built-in
            </Button>
            <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
              Add Rule
            </Button>
          </Box>
        </Box>

        {rules.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No healing rules configured. Click &quot;Seed Built-in&quot; to add default transient failure patterns.
          </Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Action</TableCell>
                  <TableCell>Confidence</TableCell>
                  <TableCell>Events</TableCell>
                  <TableCell>Enabled</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(rules as HealingRule[]).map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell>
                      <Tooltip title={rule.description}>
                        <Typography variant="body2" fontWeight={500}>
                          {rule.name}
                          {rule.isBuiltIn && <Chip label="Built-in" size="small" sx={{ ml: 1, height: 18, fontSize: '0.6rem' }} />}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Chip label={rule.category} size="small" color={CATEGORY_COLORS[rule.category] || 'default'} />
                    </TableCell>
                    <TableCell>
                      <Chip label={rule.action} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>{(rule.confidenceThreshold * 100).toFixed(0)}%</TableCell>
                    <TableCell>{rule._count?.events ?? 0}</TableCell>
                    <TableCell>
                      <Switch
                        size="small"
                        checked={rule.enabled}
                        onChange={() => toggleMutation.mutate({ id: rule.id, enabled: !rule.enabled })}
                      />
                    </TableCell>
                    <TableCell align="right">
                      {!rule.isBuiltIn && (
                        <IconButton size="small" color="error" onClick={() => deleteMutation.mutate(rule.id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Recent Events */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>Recent Healing Events</Typography>
        {events.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No healing events yet. Events appear when failures are detected and matched against rules.
          </Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Time</TableCell>
                  <TableCell>Rule</TableCell>
                  <TableCell>Action</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Confidence</TableCell>
                  <TableCell>Reason</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>
                      <Typography variant="caption">
                        {new Date(event.createdAt).toLocaleString()}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{event.rule?.name || 'Manual'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={event.action} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Chip label={event.status} size="small" color={STATUS_COLORS[event.status] || 'default'} />
                    </TableCell>
                    <TableCell>{(event.matchConfidence * 100).toFixed(0)}%</TableCell>
                    <TableCell>
                      <Typography variant="caption" sx={{ maxWidth: 200, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {event.matchReason}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
      </>)}

      {/* Quarantine Tab */}
      {tabIndex === 1 && (
        <Paper sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Quarantined Tests</Typography>
            <Chip label={`${(quarantinedTests as QuarantinedTest[]).length} quarantined`} color="warning" size="small" />
          </Box>

          {(quarantinedTests as QuarantinedTest[]).length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No tests are currently quarantined. Tests are auto-quarantined when flaky patterns are detected.
            </Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Test Name</TableCell>
                    <TableCell>Severity</TableCell>
                    <TableCell>Score</TableCell>
                    <TableCell>Occurrences</TableCell>
                    <TableCell>Quarantined</TableCell>
                    <TableCell>Reason</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(quarantinedTests as QuarantinedTest[]).map((test) => (
                    <TableRow key={test.id}>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>{test.testName}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={test.severity}
                          size="small"
                          color={test.severity === 'HIGH' ? 'error' : test.severity === 'MEDIUM' ? 'warning' : 'info'}
                        />
                      </TableCell>
                      <TableCell>{(test.flakinessScore * 100).toFixed(0)}%</TableCell>
                      <TableCell>{test.occurrenceCount}</TableCell>
                      <TableCell>
                        <Typography variant="caption">{new Date(test.createdAt).toLocaleDateString()}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ maxWidth: 200, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {test.reason}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Reinstate test">
                          <IconButton size="small" color="success" onClick={() => reinstateMutation.mutate(test.id)}>
                            <ReinstateIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete quarantine record">
                          <IconButton size="small" color="error" onClick={() => deleteQuarantineMutation.mutate(test.id)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      )}

      {/* Create Rule Dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Healing Rule</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Name" value={createForm.name}
            onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
            sx={{ mt: 1, mb: 2 }} />
          <TextField fullWidth label="Description" value={createForm.description}
            onChange={(e) => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
            sx={{ mb: 2 }} />
          <TextField fullWidth label="Pattern (regex or keywords)" value={createForm.pattern}
            onChange={(e) => setCreateForm(prev => ({ ...prev, pattern: e.target.value }))}
            helperText={createForm.patternType === 'regex' ? 'Regular expression pattern' : 'Comma-separated keywords'}
            sx={{ mb: 2 }} />
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Pattern Type</InputLabel>
              <Select value={createForm.patternType} label="Pattern Type"
                onChange={(e) => setCreateForm(prev => ({ ...prev, patternType: e.target.value }))}>
                <MenuItem value="regex">Regex</MenuItem>
                <MenuItem value="keyword">Keyword</MenuItem>
                <MenuItem value="signature">Signature</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel>Category</InputLabel>
              <Select value={createForm.category} label="Category"
                onChange={(e) => setCreateForm(prev => ({ ...prev, category: e.target.value }))}>
                <MenuItem value="transient">Transient</MenuItem>
                <MenuItem value="infrastructure">Infrastructure</MenuItem>
                <MenuItem value="flaky">Flaky</MenuItem>
                <MenuItem value="custom">Custom</MenuItem>
              </Select>
            </FormControl>
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Action</InputLabel>
              <Select value={createForm.action} label="Action"
                onChange={(e) => setCreateForm(prev => ({ ...prev, action: e.target.value }))}>
                <MenuItem value="retry">Retry</MenuItem>
                <MenuItem value="notify">Notify Only</MenuItem>
                <MenuItem value="quarantine">Quarantine</MenuItem>
                <MenuItem value="fix_pr">Fix PR</MenuItem>
              </Select>
            </FormControl>
            <TextField fullWidth size="small" label="Confidence %" type="number"
              value={createForm.confidenceThreshold * 100}
              onChange={(e) => setCreateForm(prev => ({ ...prev, confidenceThreshold: Number(e.target.value) / 100 }))}
              inputProps={{ min: 0, max: 100, step: 5 }} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate}
            disabled={createMutation.isPending || !createForm.name.trim() || !createForm.pattern.trim()}>
            {createMutation.isPending ? <CircularProgress size={20} /> : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default SelfHealing;
