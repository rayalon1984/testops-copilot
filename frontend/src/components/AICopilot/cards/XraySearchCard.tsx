/**
 * XraySearchCard — Displays Xray test case or test plan search results.
 *
 * Handles both data shapes:
 * - test_case type: { testCases: [...] }
 * - test_plan type: [...]  (direct array of plans)
 *
 * For: xray_search tool result
 */

import { Box, Paper, Typography, Chip, LinearProgress } from '@mui/material';
import CardHeaderV2 from './v2/CardHeaderV2';

interface XrayTestCaseResult {
    key: string;
    summary: string;
    status: string;
    lastRun?: string | null;
}

interface XrayTestPlanResult {
    key: string;
    summary: string;
    testCount: number;
    coveragePercentage: number;
}

interface XraySearchCardProps {
    data: Record<string, unknown>;
}

function statusColor(status: string): 'success' | 'error' | 'default' {
    if (status === 'PASS') return 'success';
    if (status === 'FAIL') return 'error';
    return 'default';
}

export default function XraySearchCard({ data }: XraySearchCardProps) {
    // Detect shape: test_case wraps in { testCases }, test_plan is a direct array
    const wrapper = data as Record<string, unknown>;
    const testCases = (wrapper.testCases as XrayTestCaseResult[] | undefined);
    const isTestPlanList = Array.isArray(data);

    if (isTestPlanList) {
        const plans = data as unknown as XrayTestPlanResult[];
        return (
            <Paper elevation={1} sx={{ borderRadius: 3, p: 2, overflow: 'hidden' }}>
                <CardHeaderV2 emoji={'\uD83D\uDCCB'} title={`Test Plans (${plans.length})`} />
                {plans.map((plan) => (
                    <Paper key={plan.key} variant="outlined" sx={{ p: 1, mb: 0.75, borderRadius: 1, '&:last-child': { mb: 0 } }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                    <Typography variant="caption" fontWeight={700} sx={{ fontFamily: 'monospace' }}>
                                        {plan.key}
                                    </Typography>
                                    <Typography variant="caption" noWrap sx={{ flex: 1 }}>
                                        {plan.summary}
                                    </Typography>
                                </Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                    <Chip label={`${plan.testCount} tests`} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.6rem' }} />
                                    <LinearProgress
                                        variant="determinate"
                                        value={plan.coveragePercentage}
                                        color={plan.coveragePercentage >= 80 ? 'success' : plan.coveragePercentage >= 50 ? 'warning' : 'error'}
                                        sx={{ flex: 1, height: 4, borderRadius: 2, maxWidth: 80 }}
                                    />
                                    <Typography variant="caption" color="text.secondary">{plan.coveragePercentage}%</Typography>
                                </Box>
                            </Box>
                        </Box>
                    </Paper>
                ))}
            </Paper>
        );
    }

    // Default: test case results
    const cases = testCases || [];
    if (cases.length === 0) {
        return (
            <Paper elevation={1} sx={{ borderRadius: 3, p: 2 }}>
                <CardHeaderV2 emoji={'\uD83D\uDD0D'} title="Xray Search" />
                <Typography variant="body2" color="text.secondary">No test cases found.</Typography>
            </Paper>
        );
    }

    return (
        <Paper elevation={1} sx={{ borderRadius: 3, p: 2, overflow: 'hidden' }}>
            <CardHeaderV2 emoji={'\uD83D\uDD0D'} title={`Test Cases (${cases.length})`} />
            {cases.map((tc) => (
                <Paper key={tc.key} variant="outlined" sx={{ p: 1, mb: 0.75, borderRadius: 1, '&:last-child': { mb: 0 } }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                <Typography variant="caption" fontWeight={700} sx={{ fontFamily: 'monospace' }}>
                                    {tc.key}
                                </Typography>
                                <Typography variant="caption" noWrap sx={{ flex: 1, overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                                    {tc.summary}
                                </Typography>
                            </Box>
                        </Box>
                        <Chip label={tc.status} size="small" color={statusColor(tc.status)} sx={{ height: 20, fontSize: '0.6rem' }} />
                    </Box>
                </Paper>
            ))}
        </Paper>
    );
}
