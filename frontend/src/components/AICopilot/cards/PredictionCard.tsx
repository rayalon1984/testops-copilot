/**
 * PredictionCard — Risk analysis, trends, and anomaly detection.
 * For: failure_predictions result (3 variants based on data shape)
 */

import { Box, Paper, Typography, Chip } from '@mui/material';
import ServiceBadge, { getServiceAccent } from './shared/ServiceBadge';

interface PredictionCardProps {
    data: Record<string, unknown>;
}

interface RiskScore {
    testName: string;
    score: number;
    level: string;
    prediction?: string;
}

interface AnomalyEntry {
    date: string;
    actual: number;
    baseline: number;
    zScore: number;
    isAnomaly: boolean;
}

function getSeverityColor(level: string): { bg: string; text: string } {
    switch (level?.toUpperCase()) {
        case 'CRITICAL': return { bg: '#FEE2E2', text: '#991B1B' };
        case 'HIGH':     return { bg: '#FEF3C7', text: '#92400E' };
        case 'MODERATE': return { bg: '#DBEAFE', text: '#1D4ED8' };
        case 'LOW':      return { bg: '#D1FAE5', text: '#065F46' };
        default:         return { bg: '#E2E8F0', text: '#475569' };
    }
}

function RiskScoresView({ scores }: { scores: RiskScore[] }) {
    return (
        <Box>
            <Typography variant="caption" fontWeight={600} sx={{ mb: 0.5, display: 'block' }}>
                Top Risk Scores
            </Typography>
            {scores.slice(0, 8).map((s, i) => {
                const color = getSeverityColor(s.level);
                return (
                    <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: s.score >= 70 ? '#991B1B' : s.score >= 40 ? '#92400E' : '#475569' }} />
                        <Typography variant="caption" fontFamily="monospace" sx={{ flex: 1 }} noWrap>
                            {s.testName}
                        </Typography>
                        <Typography variant="caption" fontWeight={700}>{s.score}</Typography>
                        <Chip label={s.level} size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: color.bg, color: color.text }} />
                    </Box>
                );
            })}
            {scores[0]?.prediction && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', fontStyle: 'italic' }}>
                    {scores[0].prediction}
                </Typography>
            )}
        </Box>
    );
}

function TrendView({ data }: { data: Record<string, unknown> }) {
    const direction = data.direction as string || 'stable';
    const arrow = direction === 'increasing' || direction === 'INCREASING' ? '\u2191' : direction === 'decreasing' || direction === 'DECREASING' ? '\u2193' : '\u2194';

    return (
        <Box>
            <Typography variant="caption" fontWeight={600} sx={{ mb: 0.5, display: 'block' }}>
                Failure Trend
            </Typography>
            <Typography variant="body2">
                Direction: {direction} {arrow}
            </Typography>
            {data.rateOfChange !== undefined && (
                <Typography variant="caption" color="text.secondary">
                    Rate: {String(data.rateOfChange)} failures/day
                </Typography>
            )}
            {data.movingAverage7d !== undefined && (
                <Typography variant="caption" color="text.secondary" display="block">
                    7-day avg: {String(data.movingAverage7d)}
                </Typography>
            )}
            {data.percentChange7d !== undefined && (
                <Typography variant="caption" color="text.secondary" display="block">
                    Week-over-week: {Number(data.percentChange7d) > 0 ? '+' : ''}{String(data.percentChange7d)}%
                </Typography>
            )}
        </Box>
    );
}

function AnomalyView({ anomalies, count }: { anomalies: AnomalyEntry[]; count: number }) {
    const flagged = anomalies.filter(a => a.isAnomaly);
    return (
        <Box>
            <Typography variant="caption" fontWeight={600} sx={{ mb: 0.5, display: 'block' }}>
                Anomalies Detected ({count})
            </Typography>
            {flagged.length === 0 ? (
                <Typography variant="caption" color="text.secondary">No anomalies in range.</Typography>
            ) : (
                flagged.slice(0, 6).map((a, i) => (
                    <Box key={i} sx={{ display: 'flex', gap: 1.5, mb: 0.25 }}>
                        <Typography variant="caption" fontFamily="monospace">{a.date}</Typography>
                        <Typography variant="caption" color="text.secondary">
                            Expected: {a.baseline}
                        </Typography>
                        <Typography variant="caption" fontWeight={600} sx={{ color: '#991B1B' }}>
                            Actual: {a.actual}
                        </Typography>
                        <Typography variant="caption" color="text.disabled">
                            z: {a.zScore?.toFixed?.(1) ?? a.zScore}
                        </Typography>
                    </Box>
                ))
            )}
        </Box>
    );
}

export default function PredictionCard({ data }: PredictionCardProps) {
    // Detect variant by checking which fields exist
    const hasScores = Array.isArray(data.scores);
    const hasDirection = data.direction !== undefined;
    const hasAnomalies = Array.isArray(data.anomalies);

    let subtitle = 'Analysis';
    if (hasScores) subtitle = 'Risk Scores';
    else if (hasDirection) subtitle = 'Trend';
    else if (hasAnomalies) subtitle = 'Anomalies';

    return (
        <Paper sx={{
            mb: 2,
            borderRadius: 2,
            overflow: 'hidden',
            border: 1,
            borderColor: 'divider',
            borderLeft: 3,
            borderLeftColor: getServiceAccent('predictions'),
        }}>
            <Box sx={{ p: 1.5 }}>
                <ServiceBadge service="predictions" subtitle={subtitle} />

                {hasScores && <RiskScoresView scores={data.scores as RiskScore[]} />}
                {hasDirection && !hasScores && <TrendView data={data} />}
                {hasAnomalies && !hasScores && !hasDirection && (
                    <AnomalyView anomalies={data.anomalies as AnomalyEntry[]} count={(data.flaggedCount as number) ?? 0} />
                )}
            </Box>
        </Paper>
    );
}
