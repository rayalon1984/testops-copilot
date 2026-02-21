/**
 * ErrorMessage — Error display with retry and classification.
 *
 * Shows categorized errors with appropriate recovery actions:
 * - Network errors: auto-retry with countdown
 * - Rate limit errors: link to cost tracker
 * - Validation errors: descriptive message
 * - Unknown errors: manual retry option
 */

import { useState, useEffect, useCallback } from 'react';
import { Box, Paper, Typography, Button, LinearProgress, alpha } from '@mui/material';
import {
    Refresh as RetryIcon,
    WifiOff as NetworkIcon,
    MoneyOff as QuotaIcon,
    ErrorOutline as ErrorIcon,
} from '@mui/icons-material';

interface ErrorMessageProps {
    content: string;
    onRetry?: () => void;
}

type ErrorCategory = 'network' | 'rate_limit' | 'validation' | 'unknown';

function classifyError(content: string): ErrorCategory {
    const lower = content.toLowerCase();
    if (lower.includes('network') || lower.includes('connection') || lower.includes('timeout') || lower.includes('fetch') || lower.includes('econnrefused')) {
        return 'network';
    }
    if (lower.includes('rate limit') || lower.includes('quota') || lower.includes('budget') || lower.includes('429')) {
        return 'rate_limit';
    }
    if (lower.includes('validation') || lower.includes('invalid') || lower.includes('400')) {
        return 'validation';
    }
    return 'unknown';
}

const ERROR_CONFIG: Record<ErrorCategory, { icon: React.ReactNode; label: string; autoRetry: boolean; retryDelay: number }> = {
    network: {
        icon: <NetworkIcon sx={{ fontSize: 16 }} />,
        label: 'Connection Error',
        autoRetry: true,
        retryDelay: 5,
    },
    rate_limit: {
        icon: <QuotaIcon sx={{ fontSize: 16 }} />,
        label: 'Rate Limit Exceeded',
        autoRetry: false,
        retryDelay: 0,
    },
    validation: {
        icon: <ErrorIcon sx={{ fontSize: 16 }} />,
        label: 'Invalid Request',
        autoRetry: false,
        retryDelay: 0,
    },
    unknown: {
        icon: <ErrorIcon sx={{ fontSize: 16 }} />,
        label: 'Error',
        autoRetry: false,
        retryDelay: 0,
    },
};

export default function ErrorMessage({ content, onRetry }: ErrorMessageProps): React.ReactElement {
    const category = classifyError(content);
    const config = ERROR_CONFIG[category];
    const [countdown, setCountdown] = useState(config.autoRetry ? config.retryDelay : 0);
    const [autoRetrying, setAutoRetrying] = useState(config.autoRetry && !!onRetry);

    const handleRetry = useCallback((): void => {
        setAutoRetrying(false);
        setCountdown(0);
        onRetry?.();
    }, [onRetry]);

    // Auto-retry countdown for network errors
    useEffect(() => {
        if (!autoRetrying || countdown <= 0) return;
        const timer = setTimeout(() => {
            setCountdown(prev => prev - 1);
        }, 1000);
        return () => clearTimeout(timer);
    }, [autoRetrying, countdown]);

    // Trigger retry when countdown reaches 0
    useEffect(() => {
        if (autoRetrying && countdown === 0 && onRetry) {
            handleRetry();
        }
    }, [autoRetrying, countdown, onRetry, handleRetry]);

    const cancelAutoRetry = (): void => {
        setAutoRetrying(false);
        setCountdown(0);
    };

    return (
        <Box sx={{ mb: 2 }}>
            <Paper sx={{
                bgcolor: (theme) => alpha(theme.palette.error.main, 0.08),
                border: 1,
                borderColor: (theme) => alpha(theme.palette.error.main, 0.2),
                borderRadius: 2,
                overflow: 'hidden',
            }}>
                {/* Auto-retry progress bar */}
                {autoRetrying && countdown > 0 && (
                    <LinearProgress
                        variant="determinate"
                        value={((config.retryDelay - countdown) / config.retryDelay) * 100}
                        color="error"
                        sx={{ height: 2 }}
                    />
                )}

                <Box sx={{ p: 1.5 }}>
                    {/* Header with icon and category */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
                        <Box sx={{ color: 'error.main', display: 'flex' }}>
                            {config.icon}
                        </Box>
                        <Typography variant="caption" fontWeight={600} color="error.main">
                            {config.label}
                        </Typography>
                    </Box>

                    {/* Error message */}
                    <Typography variant="caption" color="error.main" sx={{ display: 'block', mb: 1, opacity: 0.9 }}>
                        {content}
                    </Typography>

                    {/* Actions */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {/* Auto-retry countdown */}
                        {autoRetrying && countdown > 0 && (
                            <>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                                    Retrying in {countdown}s...
                                </Typography>
                                <Button
                                    size="small"
                                    onClick={cancelAutoRetry}
                                    sx={{ fontSize: '0.65rem', textTransform: 'none', minWidth: 0, p: 0.5 }}
                                >
                                    Cancel
                                </Button>
                            </>
                        )}

                        {/* Manual retry button */}
                        {!autoRetrying && onRetry && (
                            <Button
                                size="small"
                                startIcon={<RetryIcon sx={{ fontSize: 14 }} />}
                                onClick={handleRetry}
                                sx={{
                                    fontSize: '0.65rem',
                                    textTransform: 'none',
                                    color: 'error.main',
                                }}
                            >
                                Try again
                            </Button>
                        )}

                        {/* Rate limit: link to cost tracker */}
                        {category === 'rate_limit' && (
                            <Button
                                size="small"
                                href="/cost-tracker"
                                sx={{
                                    fontSize: '0.65rem',
                                    textTransform: 'none',
                                    color: 'error.main',
                                }}
                            >
                                View usage
                            </Button>
                        )}
                    </Box>
                </Box>
            </Paper>
        </Box>
    );
}
