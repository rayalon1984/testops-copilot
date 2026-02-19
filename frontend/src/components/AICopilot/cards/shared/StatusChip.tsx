/**
 * StatusChip — Semantic status display with service-aware colors.
 *
 * Dark mode: uses lighter backgrounds with muted text for contrast.
 * A11y: role="status" for screen readers.
 */

import { Chip, useTheme } from '@mui/material';

interface ColorPair { bg: string; text: string }

const STATUS_COLORS_LIGHT: Record<string, ColorPair> = {
    // Jira / general
    'To Do':       { bg: '#E2E8F0', text: '#475569' },
    'TODO':        { bg: '#E2E8F0', text: '#475569' },
    'Open':        { bg: '#E2E8F0', text: '#475569' },
    'In Progress': { bg: '#DBEAFE', text: '#1D4ED8' },
    'IN_PROGRESS': { bg: '#DBEAFE', text: '#1D4ED8' },
    'Done':        { bg: '#D1FAE5', text: '#065F46' },
    'DONE':        { bg: '#D1FAE5', text: '#065F46' },
    'Closed':      { bg: '#D1FAE5', text: '#065F46' },
    // Jenkins / test
    'PENDING':     { bg: '#E2E8F0', text: '#475569' },
    'RUNNING':     { bg: '#DBEAFE', text: '#1D4ED8' },
    'PASSED':      { bg: '#D1FAE5', text: '#065F46' },
    'PASSING':     { bg: '#D1FAE5', text: '#065F46' },
    'SUCCESS':     { bg: '#D1FAE5', text: '#065F46' },
    'FAILED':      { bg: '#FEE2E2', text: '#991B1B' },
    'FAILING':     { bg: '#FEE2E2', text: '#991B1B' },
    'FAILURE':     { bg: '#FEE2E2', text: '#991B1B' },
    'FLAKY':       { bg: '#FEF3C7', text: '#92400E' },
    'SKIPPED':     { bg: '#E2E8F0', text: '#475569' },
    'CANCELLED':   { bg: '#E2E8F0', text: '#475569' },
    // GitHub PR
    'open':        { bg: '#D1FAE5', text: '#065F46' },
    'closed':      { bg: '#FEE2E2', text: '#991B1B' },
    'merged':      { bg: '#EDE9FE', text: '#5B21B6' },
};

const STATUS_COLORS_DARK: Record<string, ColorPair> = {
    // Neutral / pending
    'To Do':       { bg: '#334155', text: '#94A3B8' },
    'TODO':        { bg: '#334155', text: '#94A3B8' },
    'Open':        { bg: '#334155', text: '#94A3B8' },
    'PENDING':     { bg: '#334155', text: '#94A3B8' },
    'SKIPPED':     { bg: '#334155', text: '#94A3B8' },
    'CANCELLED':   { bg: '#334155', text: '#94A3B8' },
    // Blue / in progress
    'In Progress': { bg: '#1E3A5F', text: '#93C5FD' },
    'IN_PROGRESS': { bg: '#1E3A5F', text: '#93C5FD' },
    'RUNNING':     { bg: '#1E3A5F', text: '#93C5FD' },
    // Green / success
    'Done':        { bg: '#14432A', text: '#6EE7B7' },
    'DONE':        { bg: '#14432A', text: '#6EE7B7' },
    'Closed':      { bg: '#14432A', text: '#6EE7B7' },
    'PASSED':      { bg: '#14432A', text: '#6EE7B7' },
    'PASSING':     { bg: '#14432A', text: '#6EE7B7' },
    'SUCCESS':     { bg: '#14432A', text: '#6EE7B7' },
    // Red / failure
    'FAILED':      { bg: '#450A0A', text: '#FCA5A5' },
    'FAILING':     { bg: '#450A0A', text: '#FCA5A5' },
    'FAILURE':     { bg: '#450A0A', text: '#FCA5A5' },
    // Amber / flaky
    'FLAKY':       { bg: '#451A03', text: '#FCD34D' },
    // GitHub PR
    'open':        { bg: '#14432A', text: '#6EE7B7' },
    'closed':      { bg: '#450A0A', text: '#FCA5A5' },
    'merged':      { bg: '#2E1065', text: '#C4B5FD' },
};

const DEFAULT_LIGHT: ColorPair = { bg: '#E2E8F0', text: '#475569' };
const DEFAULT_DARK: ColorPair = { bg: '#334155', text: '#94A3B8' };

interface StatusChipProps {
    status: string;
    animated?: boolean;
}

export default function StatusChip({ status, animated }: StatusChipProps) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const colorMap = isDark ? STATUS_COLORS_DARK : STATUS_COLORS_LIGHT;
    const fallback = isDark ? DEFAULT_DARK : DEFAULT_LIGHT;
    const colors = colorMap[status] ?? fallback;

    return (
        <Chip
            label={status}
            size="small"
            role="status"
            aria-label={`Status: ${status}`}
            sx={{
                bgcolor: colors.bg,
                color: colors.text,
                fontWeight: 600,
                fontSize: '0.7rem',
                height: 22,
                transition: animated ? 'all 0.3s ease' : undefined,
            }}
        />
    );
}
