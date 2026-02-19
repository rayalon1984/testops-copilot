/**
 * ConfirmationShell — Shared wrapper for all write-tool confirmation previews.
 *
 * Features:
 * - Countdown timer (5min TTL, green -> amber -> red)
 * - Keyboard shortcuts: Enter = approve, Escape = deny
 * - Role gating: VIEWER/BILLING cannot approve
 * - Post-approve/deny visual transitions
 */

import { useEffect, useRef, useState, useCallback, ReactNode, KeyboardEvent } from 'react';
import { Box, Paper, Typography, Button, LinearProgress } from '@mui/material';
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
    };
    return labels[tool] || 'Execute';
}

export default function ConfirmationShell({
    tool, actionId, status, createdAt, userRole, onConfirm, onDeny, children
}: ConfirmationShellProps) {
    const [remainingMs, setRemainingMs] = useState(ACTION_TTL_MS);
    const containerRef = useRef<HTMLDivElement>(null);
    const isPending = status === 'pending';
    const isApproved = status === 'approved';
    const userCanApprove = canAct(userRole);

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

    // Color transitions
    let progressColor = '#065F46'; // green
    if (remainingMs < 30000) progressColor = '#991B1B'; // red
    else if (remainingMs < 120000) progressColor = '#92400E'; // amber

    let borderColor = '#ED6C02'; // amber pending
    if (isApproved) borderColor = '#2E7D32'; // green
    if (status === 'denied') borderColor = '#9E9E9E'; // grey

    const service = getServiceFromTool(tool);
    const actionLabel = getActionLabel(tool);

    return (
        <Paper
            ref={containerRef}
            tabIndex={0}
            onKeyDown={handleKeyDown}
            elevation={isPending ? 3 : 1}
            sx={{
                mb: 2,
                borderRadius: 2,
                overflow: 'hidden',
                border: 2,
                borderColor,
                outline: 'none',
                transition: 'all 0.3s ease',
                opacity: status === 'denied' ? 0.6 : 1,
            }}
        >
            {/* Header */}
            <Box sx={{
                px: 1.5,
                py: 1,
                bgcolor: isApproved ? '#E8F5E9' : status === 'denied' ? '#F5F5F5' : '#FFF3E0',
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
                {isApproved && <CheckIcon sx={{ color: '#2E7D32', fontSize: 18 }} />}
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
                            sx={{
                                height: 4,
                                borderRadius: 2,
                                bgcolor: '#E2E8F0',
                                '& .MuiLinearProgress-bar': { bgcolor: progressColor, borderRadius: 2 },
                            }}
                        />
                        <Typography variant="caption" color="text.disabled" sx={{ mt: 0.25, display: 'block', textAlign: 'right' }}>
                            {timeStr} remaining
                        </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', gap: 1.5 }}>
                        <Button
                            fullWidth
                            variant="outlined"
                            color="inherit"
                            onClick={onDeny}
                            sx={{ borderRadius: 2, textTransform: 'none', color: 'text.secondary' }}
                        >
                            Deny <Typography variant="caption" sx={{ ml: 0.5, opacity: 0.6 }}>\u238B</Typography>
                        </Button>
                        {userCanApprove ? (
                            <Button
                                fullWidth
                                variant="contained"
                                onClick={onConfirm}
                                sx={{
                                    borderRadius: 2,
                                    textTransform: 'none',
                                    bgcolor: '#2E7D32',
                                    '&:hover': { bgcolor: '#1B5E20' },
                                }}
                                startIcon={<CheckIcon />}
                            >
                                {actionLabel} <Typography variant="caption" sx={{ ml: 0.5, opacity: 0.7 }}>\u23CE</Typography>
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
