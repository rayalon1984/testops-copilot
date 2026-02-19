/**
 * ConfirmationShell — Shared wrapper for all write-tool confirmation previews.
 *
 * Features:
 * - Countdown timer (5min TTL, green -> amber -> red)
 * - Keyboard shortcuts: Enter = approve, Escape = deny
 * - Role gating: VIEWER/BILLING cannot approve
 * - Post-approve/deny visual transitions
 * - Dark mode: theme-aware header backgrounds and progress colors
 * - A11y: role="alertdialog", aria-label, focus management
 */

import { useEffect, useRef, useState, useCallback, ReactNode, KeyboardEvent } from 'react';
import { Box, Paper, Typography, Button, LinearProgress, useTheme } from '@mui/material';
import { Check as CheckIcon } from '@mui/icons-material';
import ServiceBadge from './ServiceBadge';
import { canAct } from './CardActions';

const ACTION_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface ConfirmationShellProps {
    tool: string;
    actionId: string;
    status: 'pending' | 'approved' | 'denied';
    createdAt: Date;
    userRole: string;
    onConfirm: () => void;
    onDeny: () => void;
    children: ReactNode;
}

function getServiceFromTool(tool: string): string {
    if (tool.startsWith('jira_')) return 'jira';
    if (tool.startsWith('github_')) return 'github';
    if (tool.startsWith('jenkins_')) return 'jenkins';
    if (tool.startsWith('confluence_')) return 'confluence';
    if (tool.startsWith('testrun_')) return 'jenkins';
    return 'generic';
}

function getActionLabel(tool: string): string {
    const labels: Record<string, string> = {
        jira_create_issue: 'Create Issue',
        jira_transition_issue: 'Transition',
        jira_comment: 'Comment',
        github_create_pr: 'Create PR',
        github_create_branch: 'Create Branch',
        github_update_file: 'Commit File',
        github_rerun_workflow: 'Re-run Workflow',
        jenkins_trigger_build: 'Trigger Build',
        testrun_cancel: 'Cancel Run',
        testrun_retry: 'Retry Run',
    };
    return labels[tool] || 'Execute';
}

export default function ConfirmationShell({
    tool, actionId, status, createdAt, userRole, onConfirm, onDeny, children
}: ConfirmationShellProps) {
    const [remainingMs, setRemainingMs] = useState(ACTION_TTL_MS);
    const containerRef = useRef<HTMLDivElement>(null);
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const isPending = status === 'pending';
    const isApproved = status === 'approved';
    const userCanApprove = canAct(userRole);

    // Auto-focus when pending for keyboard access
    useEffect(() => {
        if (isPending) containerRef.current?.focus();
    }, [isPending]);

    // Countdown timer
    useEffect(() => {
        if (!isPending) return;
        const interval = setInterval(() => {
            const elapsed = Date.now() - createdAt.getTime();
            setRemainingMs(Math.max(0, ACTION_TTL_MS - elapsed));
        }, 1000);
        return () => clearInterval(interval);
    }, [isPending, createdAt]);

    // Keyboard shortcuts
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (!isPending) return;
        if (e.key === 'Enter' && userCanApprove) {
            e.preventDefault();
            onConfirm();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            onDeny();
        }
    }, [isPending, userCanApprove, onConfirm, onDeny]);

    const progress = (remainingMs / ACTION_TTL_MS) * 100;
    const seconds = Math.ceil(remainingMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const timeStr = `${minutes}:${secs.toString().padStart(2, '0')}`;

    // Progress bar color (works in both modes)
    let progressColor = isDark ? '#6EE7B7' : '#065F46';
    if (remainingMs < 30000) progressColor = isDark ? '#FCA5A5' : '#991B1B';
    else if (remainingMs < 120000) progressColor = isDark ? '#FCD34D' : '#92400E';

    // Border color
    let borderColor = isDark ? '#F59E0B' : '#ED6C02';
    if (isApproved) borderColor = isDark ? '#4ADE80' : '#2E7D32';
    if (status === 'denied') borderColor = isDark ? '#6B7280' : '#9E9E9E';

    // Header backgrounds
    const headerBg = isApproved
        ? (isDark ? 'rgba(74, 222, 128, 0.1)' : '#E8F5E9')
        : status === 'denied'
            ? (isDark ? 'rgba(107, 114, 128, 0.1)' : '#F5F5F5')
            : (isDark ? 'rgba(245, 158, 11, 0.1)' : '#FFF3E0');

    const service = getServiceFromTool(tool);
    const actionLabel = getActionLabel(tool);

    return (
        <Paper
            ref={containerRef}
            tabIndex={0}
            role="alertdialog"
            aria-label={`${actionLabel} confirmation — ${isPending ? 'pending review' : status}`}
            onKeyDown={handleKeyDown}
            elevation={isPending ? 3 : 1}
            sx={{
                mb: 2,
                borderRadius: 2,
                overflow: 'hidden',
                border: 2,
                borderColor,
                outline: 'none',
                '&:focus-visible': { boxShadow: `0 0 0 3px ${isDark ? 'rgba(245, 158, 11, 0.3)' : 'rgba(237, 108, 2, 0.3)'}` },
                transition: 'all 0.3s ease',
                opacity: status === 'denied' ? 0.6 : 1,
            }}
        >
            {/* Header */}
            <Box sx={{
                px: 1.5,
                py: 1,
                bgcolor: headerBg,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ServiceBadge service={service} />
                    <Typography variant="caption" fontWeight={700} color="text.secondary">
                        {isApproved ? 'APPROVED' : status === 'denied' ? 'DENIED' : 'REVIEW'}
                    </Typography>
                </Box>
                {isApproved && <CheckIcon sx={{ color: isDark ? '#4ADE80' : '#2E7D32', fontSize: 18 }} aria-hidden="true" />}
            </Box>

            {/* Content */}
            <Box sx={{ p: 1.5 }}>
                {children}
            </Box>

            {/* Footer: timer + buttons */}
            {isPending && (
                <Box sx={{ px: 1.5, pb: 1.5 }}>
                    {/* Countdown bar */}
                    <Box sx={{ mb: 1 }}>
                        <LinearProgress
                            variant="determinate"
                            value={progress}
                            aria-label={`${timeStr} remaining to respond`}
                            aria-valuenow={Math.round(progress)}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            sx={{
                                height: 4,
                                borderRadius: 2,
                                bgcolor: isDark ? '#334155' : '#E2E8F0',
                                '& .MuiLinearProgress-bar': { bgcolor: progressColor, borderRadius: 2 },
                            }}
                        />
                        <Typography variant="caption" color="text.disabled" sx={{ mt: 0.25, display: 'block', textAlign: 'right' }}>
                            {timeStr} remaining
                        </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', gap: 1.5 }} role="group" aria-label="Confirmation actions">
                        <Button
                            fullWidth
                            variant="outlined"
                            color="inherit"
                            onClick={onDeny}
                            aria-label="Deny action (Escape)"
                            sx={{ borderRadius: 2, textTransform: 'none', color: 'text.secondary' }}
                        >
                            Deny <Typography component="span" variant="caption" aria-hidden="true" sx={{ ml: 0.5, opacity: 0.6 }}>{'\u238B'}</Typography>
                        </Button>
                        {userCanApprove ? (
                            <Button
                                fullWidth
                                variant="contained"
                                onClick={onConfirm}
                                aria-label={`${actionLabel} (Enter)`}
                                sx={{
                                    borderRadius: 2,
                                    textTransform: 'none',
                                    bgcolor: isDark ? '#16A34A' : '#2E7D32',
                                    '&:hover': { bgcolor: isDark ? '#15803D' : '#1B5E20' },
                                }}
                                startIcon={<CheckIcon />}
                            >
                                {actionLabel} <Typography component="span" variant="caption" aria-hidden="true" sx={{ ml: 0.5, opacity: 0.7 }}>{'\u23CE'}</Typography>
                            </Button>
                        ) : (
                            <Typography variant="caption" color="text.disabled" sx={{ alignSelf: 'center' }}>
                                Requires Editor role
                            </Typography>
                        )}
                    </Box>
                </Box>
            )}
        </Paper>
    );
}
