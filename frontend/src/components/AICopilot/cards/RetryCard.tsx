/**
 * RetryCard — Smart Retry with Play Button.
 *
 * Displays when a test failure is detected as transient (env, network, flaky).
 * Shows confidence score, failure history, and a prominent retry button.
 * Supports batch retry when multiple tests affected.
 *
 * For: testrun_retry tool result (Sprint 7)
 */

import { Box, Paper, Typography, Button, Chip, LinearProgress } from '@mui/material';
import { PlayArrow as PlayIcon, SkipNext as SkipIcon } from '@mui/icons-material';
import ServiceBadge from './shared/ServiceBadge';
import CardActions from './shared/CardActions';
import type { CardState } from '../../../hooks/useAICopilot';

interface RetryData {
    testRunId?: string;
    testId?: string;
    testName?: string;
    failureReason?: string;
    confidence?: number;
    rootCause?: string;
    affectedCount?: number;
    previousRuns?: string[];
    newRunId?: string;
    status?: string;
}

interface RetryCardProps {
    data: Record<string, unknown>;
    userRole?: string;
    onAction?: (prompt: string) => void;
    cardState?: CardState;
}

/** Confidence color: green if high, amber if medium */
function getConfidenceColor(confidence: number): string {
    if (confidence >= 0.85) return '#4caf50';
    if (confidence >= 0.7) return '#ff9800';
    return '#f44336';
}

export default function RetryCard({ data, userRole, onAction, cardState }: RetryCardProps) {
    const retry = data as unknown as RetryData;
    const isPending = cardState === 'action_pending';
    const confidence = retry.confidence || 0;
    const confidencePercent = Math.round(confidence * 100);

    // If this is a result from a completed retry
    if (retry.newRunId || retry.status === 'PENDING') {
        return (
            <Paper sx={{
                mb: 2,
                borderRadius: 2,
                overflow: 'hidden',
                border: 1,
                borderColor: 'divider',
                borderLeft: 3,
                borderLeftColor: '#4caf50',
            }}>
                <Box sx={{ p: 1.5 }}>
                    <ServiceBadge service="jenkins" subtitle="Retry" />
                    <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                        Retrying test run <strong>{retry.testRunId}</strong>
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        New run: {retry.newRunId} — Status: {retry.status}
                    </Typography>
                </Box>
            </Paper>
        );
    }

    // Smart retry suggestion card
    return (
        <Paper sx={{
            mb: 2,
            borderRadius: 2,
            overflow: 'hidden',
            border: 1,
            borderColor: 'divider',
            borderLeft: 3,
            borderLeftColor: '#FF9800',
            transition: 'all 0.3s ease',
        }}>
            <Box sx={{ p: 1.5 }}>
                {/* Header */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
                    <Typography sx={{ fontSize: '1rem', lineHeight: 1 }} aria-hidden="true">
                        {'\uD83D\uDD04'}
                    </Typography>
                    <Typography variant="caption" fontWeight={600} sx={{ color: '#FF9800' }}>
                        Transient Failure Detected
                    </Typography>
                </Box>

                {/* Test name */}
                {retry.testName && (
                    <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5, fontSize: '0.8rem' }}>
                        {retry.testName}
                    </Typography>
                )}

                {/* Root cause */}
                {retry.rootCause && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                        Root cause: {retry.rootCause}
                    </Typography>
                )}

                {/* Confidence bar */}
                {confidence > 0 && (
                    <Box sx={{ mb: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                                Confidence
                            </Typography>
                            <Typography variant="caption" fontWeight={600} sx={{
                                fontSize: '0.65rem',
                                color: getConfidenceColor(confidence),
                            }}>
                                {confidencePercent}%
                            </Typography>
                        </Box>
                        <LinearProgress
                            variant="determinate"
                            value={confidencePercent}
                            sx={{
                                height: 4,
                                borderRadius: 2,
                                bgcolor: 'action.hover',
                                '& .MuiLinearProgress-bar': {
                                    bgcolor: getConfidenceColor(confidence),
                                    borderRadius: 2,
                                },
                            }}
                        />
                    </Box>
                )}

                {/* Previous run indicators */}
                {retry.previousRuns && retry.previousRuns.length > 0 && (
                    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', mb: 0.75 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                            Previous runs:
                        </Typography>
                        {retry.previousRuns.map((status, i) => (
                            <Typography key={i} sx={{ fontSize: '0.7rem' }}>
                                {status === 'pass' ? '\u2705' : '\u274C'}
                            </Typography>
                        ))}
                    </Box>
                )}

                {/* Affected count badge */}
                {retry.affectedCount && retry.affectedCount > 1 && (
                    <Chip
                        label={`${retry.affectedCount} tests affected`}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: '0.6rem', height: 18, mb: 0.75, color: '#FF9800', borderColor: '#FF9800' }}
                    />
                )}

                {/* Action buttons */}
                <CardActions userRole={userRole || 'VIEWER'}>
                    <Button
                        size="small"
                        variant="contained"
                        startIcon={<PlayIcon sx={{ fontSize: 16 }} />}
                        disabled={isPending}
                        onClick={() => onAction?.(`Retry test ${retry.testName || retry.testId || retry.testRunId}`)}
                        sx={{
                            fontSize: '0.7rem',
                            textTransform: 'none',
                            bgcolor: '#FF9800',
                            '&:hover': { bgcolor: '#F57C00' },
                        }}
                    >
                        {isPending ? 'Retrying...' : (retry.affectedCount && retry.affectedCount > 1 ? `Retry All ${retry.affectedCount}` : 'Retry Now')}
                    </Button>
                    <Button
                        size="small"
                        variant="outlined"
                        startIcon={<SkipIcon sx={{ fontSize: 14 }} />}
                        onClick={() => onAction?.('Skip retry, continue investigation')}
                        sx={{ fontSize: '0.65rem', textTransform: 'none' }}
                    >
                        Skip
                    </Button>
                </CardActions>
            </Box>
        </Paper>
    );
}
