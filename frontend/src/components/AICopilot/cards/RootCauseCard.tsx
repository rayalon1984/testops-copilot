/**
 * RootCauseCard — Root Cause Analysis result card.
 *
 * Matches the README screenshot design: emoji header, bold title,
 * description text, confidence badge. No ServiceBadge, no left border.
 *
 * For: rca_identify tool result
 */

import { Box, Paper, Typography, Chip, useTheme, alpha } from '@mui/material';

interface RootCauseData {
    title?: string;
    rootCause: string;
    testName?: string;
    confidence?: number;
    category?: string;
    relatedIssue?: string;
}

interface RootCauseCardProps {
    data: Record<string, unknown>;
}

export default function RootCauseCard({ data }: RootCauseCardProps) {
    const theme = useTheme();
    const rca = data as unknown as RootCauseData;
    const confidencePct = rca.confidence ? Math.round(rca.confidence * 100) : null;

    return (
        <Paper
            elevation={1}
            sx={{
                borderRadius: 3,
                p: 2,
                /* Text-containment guards */
                overflow: 'hidden',
                overflowWrap: 'break-word',
                wordBreak: 'break-word',
                minWidth: 0,
            }}
        >
            {/* Header: emoji + title */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Typography sx={{ fontSize: '1.2rem', lineHeight: 1 }} aria-hidden="true">
                    {'\uD83D\uDD25'}
                </Typography>
                <Typography variant="subtitle1" fontWeight={700} color="text.primary">
                    {rca.title || 'Root Cause Identified'}
                </Typography>
            </Box>

            {/* Root cause description */}
            <Typography variant="body2" color="text.primary" sx={{ mb: 1, lineHeight: 1.6 }}>
                {rca.rootCause}
            </Typography>

            {/* Metadata row: confidence + category + related issue */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                {confidencePct !== null && (
                    <Chip
                        label={`${confidencePct}% confidence`}
                        size="small"
                        sx={{
                            height: 22,
                            fontSize: '0.65rem',
                            fontWeight: 600,
                            bgcolor: alpha(theme.palette.success.main, 0.12),
                            color: theme.palette.success.main,
                        }}
                    />
                )}
                {rca.category && (
                    <Chip
                        label={rca.category}
                        size="small"
                        variant="outlined"
                        sx={{ height: 22, fontSize: '0.65rem', textTransform: 'uppercase' }}
                    />
                )}
                {rca.relatedIssue && (
                    <Typography variant="caption" color="text.secondary">
                        Related: <strong>{rca.relatedIssue}</strong>
                    </Typography>
                )}
            </Box>
        </Paper>
    );
}
