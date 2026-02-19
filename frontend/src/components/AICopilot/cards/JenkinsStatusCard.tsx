/**
 * JenkinsStatusCard — Pipeline status with pass-rate bars. READ-ONLY.
 * For: jenkins_get_status result
 *
 * v3: NO action buttons. No jenkins write tools exist.
 */

import { Box, Paper, Typography, LinearProgress } from '@mui/material';
import ServiceBadge, { getServiceAccent } from './shared/ServiceBadge';
import StatusChip from './shared/StatusChip';

interface RunData {
    id: string;
    name?: string;
    status: string;
    branch?: string;
    passed?: number;
    failed?: number;
    skipped?: number;
    duration?: number;
    totalTests?: number;
    startedAt?: string;
    completedAt?: string;
}

interface JenkinsData {
    pipeline: Record<string, unknown>;
    recentRuns: RunData[];
}

interface JenkinsStatusCardProps {
    data: Record<string, unknown>;
}

function getPassRate(run: RunData): number {
    const total = (run.passed ?? 0) + (run.failed ?? 0) + (run.skipped ?? 0);
    if (total === 0) return 0;
    return Math.round(((run.passed ?? 0) / total) * 100);
}

function formatDuration(ms?: number): string {
    if (!ms) return '';
    const s = Math.round(ms / 1000);
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m${s % 60 ? (s % 60) + 's' : ''}`;
}

function deriveOverallStatus(runs: RunData[]): string {
    if (runs.length === 0) return 'PENDING';
    const latest = runs[0];
    if (latest.status === 'PASSED' || latest.status === 'SUCCESS') return 'PASSING';
    if (latest.status === 'FAILED' || latest.status === 'FAILURE') return 'FAILING';
    return latest.status;
}

export default function JenkinsStatusCard({ data }: JenkinsStatusCardProps) {
    const jenkins = data as unknown as JenkinsData;
    const pipelineName = (jenkins.pipeline?.name as string) || 'Pipeline';
    const runs = jenkins.recentRuns || [];
    const overallStatus = deriveOverallStatus(runs);

    return (
        <Paper sx={{
            mb: 2,
            borderRadius: 2,
            overflow: 'hidden',
            border: 1,
            borderColor: 'divider',
            borderLeft: 3,
            borderLeftColor: getServiceAccent('jenkins'),
        }}>
            <Box sx={{ p: 1.5 }}>
                <ServiceBadge service="jenkins" />

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="body2" fontWeight={600}>
                        {pipelineName}
                    </Typography>
                    <StatusChip status={overallStatus} />
                </Box>

                {runs.length > 0 && (
                    <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                            Recent runs:
                        </Typography>
                        {runs.map((run, idx) => {
                            const passRate = getPassRate(run);
                            const isFailed = run.status === 'FAILED' || run.status === 'FAILURE';
                            return (
                                <Box key={run.id || idx} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                    <Typography variant="caption" fontFamily="monospace" sx={{ minWidth: 36 }}>
                                        #{run.name || run.id?.slice(0, 4)}
                                    </Typography>
                                    <Typography variant="caption" color="text.disabled" sx={{ minWidth: 36 }}>
                                        {run.branch || 'main'}
                                    </Typography>
                                    <Box sx={{ flex: 1 }}>
                                        <LinearProgress
                                            variant="determinate"
                                            value={passRate}
                                            sx={{
                                                height: 8,
                                                borderRadius: 4,
                                                bgcolor: isFailed ? '#FEE2E2' : '#E2E8F0',
                                                '& .MuiLinearProgress-bar': {
                                                    bgcolor: isFailed ? '#991B1B' : '#065F46',
                                                    borderRadius: 4,
                                                },
                                            }}
                                        />
                                    </Box>
                                    <Typography variant="caption" fontWeight={600} sx={{ minWidth: 32, textAlign: 'right' }}>
                                        {passRate}%
                                    </Typography>
                                    {run.duration && (
                                        <Typography variant="caption" color="text.disabled" sx={{ minWidth: 40, textAlign: 'right' }}>
                                            {formatDuration(run.duration)}
                                        </Typography>
                                    )}
                                </Box>
                            );
                        })}
                    </Box>
                )}
            </Box>
        </Paper>
    );
}
