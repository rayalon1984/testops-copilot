/**
 * Risk Score Table
 * Displays top failure-prone tests with risk scores
 */

import React, { useState, useEffect } from 'react';
import {
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Box,
  Tooltip,
  LinearProgress,
} from '@mui/material';
import { api } from '../../api';

interface RiskFactor {
  name: string;
  weight: number;
  value: number;
  description: string;
}

interface RiskScore {
  testName: string;
  score: number;
  level: 'critical' | 'high' | 'medium' | 'low';
  factors: RiskFactor[];
  prediction: string;
  occurrenceCount: number;
  lastOccurrence: string;
  severity: string;
}

const LEVEL_COLORS: Record<string, 'error' | 'warning' | 'info' | 'success'> = {
  critical: 'error',
  high: 'warning',
  medium: 'info',
  low: 'success',
};

const RiskScoreTable: React.FC = () => {
  const [scores, setScores] = useState<RiskScore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPredictions = async (): Promise<void> => {
      try {
        const json = await api.get<{ success: boolean; data: RiskScore[] }>('/failure-archive/predictions?limit=10&minOccurrences=2');
        if (json.success) setScores(json.data);
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    };
    fetchPredictions();
  }, []);

  if (loading) {
    return (
      <Paper sx={{ p: 3, mb: 3, textAlign: 'center' }}>
        <CircularProgress size={24} />
      </Paper>
    );
  }

  if (scores.length === 0) return null;

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Failure Risk Scores
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Tests most likely to fail again, based on recurrence, severity, trend, and recency.
      </Typography>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Test</TableCell>
              <TableCell align="center">Risk Score</TableCell>
              <TableCell align="center">Level</TableCell>
              <TableCell align="center">Occurrences</TableCell>
              <TableCell>Prediction</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {scores.map((s) => (
              <TableRow key={s.testName} hover>
                <TableCell>
                  <Tooltip title={s.factors.map(f => f.description).join(' | ')}>
                    <Typography variant="body2" sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.testName}
                    </Typography>
                  </Tooltip>
                </TableCell>
                <TableCell align="center">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LinearProgress
                      variant="determinate"
                      value={s.score}
                      color={LEVEL_COLORS[s.level]}
                      sx={{ flex: 1, height: 8, borderRadius: 4 }}
                    />
                    <Typography variant="body2" fontWeight="bold" sx={{ minWidth: 30 }}>
                      {s.score}
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell align="center">
                  <Chip label={s.level} color={LEVEL_COLORS[s.level]} size="small" />
                </TableCell>
                <TableCell align="center">
                  <Typography variant="body2">{s.occurrenceCount}</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="caption" color="text.secondary">
                    {s.prediction}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
};

export default RiskScoreTable;
