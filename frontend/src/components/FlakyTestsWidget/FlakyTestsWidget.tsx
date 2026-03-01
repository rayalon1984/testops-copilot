
import React from 'react';
import { useFlakyTests } from '../../hooks/api';
import {
    Card,
    CardContent,
    Typography,
    Box,
    Chip,
    List,
    ListItem,
    ListItemText,
    CircularProgress,
    useTheme,
    alpha,
    Tooltip
} from '@mui/material';
import { Warning as WarningIcon, CheckCircle as StableIcon } from '@mui/icons-material';

export default function FlakyTestsWidget() {
    const theme = useTheme();

    const { data: flakyTests, isLoading, error } = useFlakyTests();

    if (isLoading) {
        return (
            <Card sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CircularProgress />
            </Card>
        );
    }

    if (error) {
        return (
            <Card sx={{ height: '100%', p: 2 }}>
                <Typography color="error">Failed to load flaky tests.</Typography>
            </Card>
        );
    }

    const tests = flakyTests || [];

    return (
        <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, p: 3, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <WarningIcon color="warning" />
                        <Typography variant="h6" fontWeight={600}>
                            Top Flaky Tests
                        </Typography>
                    </Box>
                    <Chip
                        label={`${tests.length} detected`}
                        size="small"
                        color={tests.length > 0 ? 'warning' : 'success'}
                        variant="outlined"
                    />
                </Box>

                <Typography variant="caption" color="text.secondary" sx={{ mb: 2 }}>
                    Tests with frequent status flips (Pass ↔ Fail)
                </Typography>

                {tests.length === 0 ? (
                    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.6 }}>
                        <StableIcon sx={{ fontSize: 48, color: theme.palette.success.main, mb: 1 }} />
                        <Typography variant="body2">No flaky tests detected!</Typography>
                    </Box>
                ) : (
                    <List sx={{ flex: 1, overflowY: 'auto', minHeight: 0, mx: -1, px: 1 }}>
                        {tests.map((test) => (
                            <ListItem
                                key={test.testName}
                                sx={{
                                    border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
                                    borderRadius: 2,
                                    mb: 1,
                                    transition: 'all 0.15s ease',
                                    '&:hover': {
                                        borderColor: theme.palette.primary.main,
                                        bgcolor: alpha(theme.palette.primary.main, 0.06),
                                        boxShadow: `0 2px 8px ${alpha(theme.palette.primary.main, 0.15)}`,
                                        transform: 'translateY(-1px)',
                                    }
                                }}
                            >
                                <ListItemText
                                    primary={
                                        <Tooltip title={test.testName}>
                                            <Typography variant="subtitle2" noWrap sx={{ maxWidth: '250px' }}>
                                                {test.testName}
                                            </Typography>
                                        </Tooltip>
                                    }
                                    secondary={
                                        <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                                            <Typography variant="caption" color="text.secondary">
                                                Score: {test.flakinessScore.toFixed(2)}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                Flips: {test.flipFlopCount}
                                            </Typography>
                                        </Box>
                                    }
                                />
                                <Chip
                                    label={test.severity}
                                    size="small"
                                    color={test.severity === 'HIGH' ? 'error' : 'warning'}
                                    sx={{ height: 20, fontSize: '0.65rem' }}
                                />
                            </ListItem>
                        ))}
                    </List>
                )}
            </CardContent>
        </Card>
    );
}
