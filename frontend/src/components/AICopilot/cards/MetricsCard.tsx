/**
 * MetricsCard — Dashboard metrics with compact tiles and color-coded pass rate.
 * For: dashboard_metrics result
 */

import { Box, Paper, Typography } from '@mui/material';
import ServiceBadge, { getServiceAccent } from './shared/ServiceBadge';

interface MetricsData {
    timeRange: string;
    totalTestRuns: number;
    passedRuns: number;
    failedRuns: number;
    passRate: string;
    failuresArchived: number;
    activePipelines: number;
}

interface MetricsCardProps {
    data: Record<string, unknown>;
}

function MetricTile({ value, label }: { value: string | number; label: string }) {
    return (
        <Box sx={{
            flex: 1,
            textAlign: 'center',
            p: 1,
            bgcolor: 'background.default',
            borderRadius: 1,
            minWidth: 70,
        }}>
            <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.2 }}>
                {value}
            </Typography>
            <Typography variant="caption" color="text.secondary">
                {label}
            </Typography>
        </Box>
    );
}

export default function MetricsCard({ data }: MetricsCardProps) {
    const m = data as unknown as MetricsData;

    return (
        <Paper sx={{
            mb: 2,
            borderRadius: 2,
            overflow: 'hidden',
            border: 1,
            borderColor: 'divider',
            borderLeft: 3,
            borderLeftColor: getServiceAccent('dashboard'),
        }}>
            <Box sx={{ p: 1.5 }}>
                <ServiceBadge service="dashboard" subtitle={m.timeRange} />

                <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                    <MetricTile value={m.totalTestRuns} label="Test Runs" />
                    <MetricTile value={m.passRate || 'N/A'} label="Pass Rate" />
                    <MetricTile value={m.failuresArchived} label="Archived" />
                </Box>

                <Typography variant="caption" color="text.secondary">
                    Active Pipelines: {m.activePipelines} &middot; Passed: {m.passedRuns} &middot; Failed: {m.failedRuns}
                </Typography>
            </Box>
        </Paper>
    );
}
