/**
 * StatusChip — Semantic status display with service-aware colors.
 */

import { Chip } from '@mui/material';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
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
    'SUCCESS':     { bg: '#D1FAE5', text: '#065F46' },
    'FAILED':      { bg: '#FEE2E2', text: '#991B1B' },
    'FAILURE':     { bg: '#FEE2E2', text: '#991B1B' },
    'FLAKY':       { bg: '#FEF3C7', text: '#92400E' },
    'SKIPPED':     { bg: '#E2E8F0', text: '#475569' },
    'CANCELLED':   { bg: '#E2E8F0', text: '#475569' },
    // GitHub PR
    'open':        { bg: '#D1FAE5', text: '#065F46' },
    'closed':      { bg: '#FEE2E2', text: '#991B1B' },
    'merged':      { bg: '#EDE9FE', text: '#5B21B6' },
};

interface StatusChipProps {
    status: string;
    animated?: boolean;
}

export default function StatusChip({ status, animated }: StatusChipProps) {
    const colors = STATUS_COLORS[status] ?? { bg: '#E2E8F0', text: '#475569' };

    return (
        <Chip
            label={status}
            size="small"
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
