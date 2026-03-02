/**
 * XrayHistoryCard — Displays test case execution history from Xray.
 *
 * Shows: test case key/summary, execution timeline, linked defects.
 *
 * For: xray_test_case_history tool result
 */

import { Box, Paper, Typography, Chip, useTheme, alpha } from '@mui/material';
import CardHeaderV2 from './v2/CardHeaderV2';

interface ExecutionEntry {
    date: string;
    status: string;
    executionKey: string;
}

interface LinkedDefect {
    key: string;
    summary: string;
    status: string;
}

interface XrayHistoryData {
    testCaseKey: string;
    summary: string;
    status: string;
    executionHistory: ExecutionEntry[];
    linkedDefects: LinkedDefect[];
}

interface XrayHistoryCardProps {
    data: Record<string, unknown>;
}

function statusColor(status: string): 'success' | 'error' | 'warning' | 'default' {
    if (status === 'PASS') return 'success';
    if (status === 'FAIL') return 'error';
    if (status === 'TODO') return 'warning';
    return 'default';
}

export default function XrayHistoryCard({ data }: XrayHistoryCardProps) {
    const theme = useTheme();
    const history = data as unknown as XrayHistoryData;
    const executions = history.executionHistory || [];
    const defects = history.linkedDefects || [];

    return (
        <Paper elevation={1} sx={{ borderRadius: 3, p: 2, overflow: 'hidden', overflowWrap: 'break-word', wordBreak: 'break-word', minWidth: 0 }}>
            <CardHeaderV2
                emoji={'\uD83D\uDCC8'}
                title={`${history.testCaseKey || 'Test Case'} History`}
                chip={history.status ? { label: history.status, status: history.status } : undefined}
            />

            {/* Summary */}
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                {history.summary}
            </Typography>

            {/* Execution timeline */}
            {executions.length > 0 && (
                <Box sx={{ mb: defects.length > 0 ? 1.5 : 0 }}>
                    <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                        Recent Executions
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {executions.map((exec, i) => (
                            <Chip
                                key={exec.executionKey || i}
                                label={`${new Date(exec.date).toLocaleDateString()} · ${exec.status}`}
                                size="small"
                                color={statusColor(exec.status)}
                                variant="outlined"
                                sx={{ height: 22, fontSize: '0.65rem' }}
                            />
                        ))}
                    </Box>
                </Box>
            )}

            {/* Linked defects */}
            {defects.length > 0 && (
                <Box>
                    <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                        Linked Defects
                    </Typography>
                    {defects.map((defect) => (
                        <Paper
                            key={defect.key}
                            variant="outlined"
                            sx={{
                                p: 0.75,
                                mb: 0.5,
                                borderRadius: 1,
                                borderLeftWidth: 3,
                                borderLeftColor: alpha(theme.palette.error.main, 0.6),
                                '&:last-child': { mb: 0 },
                            }}
                        >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                <Typography variant="caption" fontWeight={700} sx={{ fontFamily: 'monospace' }}>
                                    {defect.key}
                                </Typography>
                                <Typography variant="caption" noWrap sx={{ flex: 1 }}>
                                    {defect.summary}
                                </Typography>
                                <Chip label={defect.status} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.6rem' }} />
                            </Box>
                        </Paper>
                    ))}
                </Box>
            )}
        </Paper>
    );
}
