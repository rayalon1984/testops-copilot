/**
 * QuotaIndicator — Budget/usage badge in the Copilot header.
 *
 * Shows:
 * - Monthly spend vs budget as a compact badge
 * - Warning state when approaching 80% of budget
 * - Error state when over budget
 * - Tooltip with detailed breakdown
 *
 * Fetches from GET /api/v1/ai/costs.
 */

import { Box, Chip, Tooltip, Typography, LinearProgress, alpha } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api';

interface CostData {
    totalCost: number;
    monthlySpent: number;
    monthlyBudget: number;
    cacheSavings: number;
    cacheHitRate: number;
}

function formatDollars(amount: number): string {
    return `$${amount.toFixed(2)}`;
}

export default function QuotaIndicator(): React.ReactElement | null {
    const { data } = useQuery<{ data: CostData }>({
        queryKey: ['ai-quota'],
        queryFn: () => api.get<{ data: CostData }>('/ai/costs'),
        refetchInterval: 60000, // Refresh every minute
        staleTime: 30000,
    });

    if (!data?.data) return null;

    const { monthlySpent, monthlyBudget, cacheHitRate } = data.data;
    const usedPercent = monthlyBudget > 0 ? (monthlySpent / monthlyBudget) * 100 : 0;
    const remaining = Math.max(0, monthlyBudget - monthlySpent);

    const isWarning = usedPercent >= 80;
    const isOver = usedPercent >= 100;

    const chipColor: 'default' | 'warning' | 'error' = isOver ? 'error' : isWarning ? 'warning' : 'default';
    const chipLabel = isOver
        ? 'Over budget'
        : `${formatDollars(remaining)} left`;

    const tooltipContent = (
        <Box sx={{ p: 0.5, minWidth: 160 }}>
            <Typography variant="caption" fontWeight={600} display="block" gutterBottom>
                AI Budget
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" color="text.secondary">Spent</Typography>
                <Typography variant="caption" fontWeight={600}>{formatDollars(monthlySpent)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" color="text.secondary">Budget</Typography>
                <Typography variant="caption">{formatDollars(monthlyBudget)}</Typography>
            </Box>
            <LinearProgress
                variant="determinate"
                value={Math.min(usedPercent, 100)}
                color={isOver ? 'error' : isWarning ? 'warning' : 'primary'}
                sx={{ height: 4, borderRadius: 2, my: 0.75 }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="caption" color="text.secondary">Cache hit rate</Typography>
                <Typography variant="caption">{Math.round(cacheHitRate * 100)}%</Typography>
            </Box>
        </Box>
    );

    return (
        <Tooltip title={tooltipContent} arrow placement="bottom">
            <Chip
                label={chipLabel}
                size="small"
                color={chipColor}
                variant="outlined"
                sx={{
                    fontSize: '0.6rem',
                    height: 22,
                    cursor: 'pointer',
                    ...(isOver && {
                        bgcolor: (theme) => alpha(theme.palette.error.main, 0.08),
                    }),
                    ...(isWarning && !isOver && {
                        bgcolor: (theme) => alpha(theme.palette.warning.main, 0.08),
                    }),
                }}
            />
        </Tooltip>
    );
}
