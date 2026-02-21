/**
 * GenericResultCard — Fallback for unrecognized tool names.
 * Shows summary text + expandable raw data.
 */

import { Box, Paper, Typography } from '@mui/material';
import ServiceBadge from './shared/ServiceBadge';
import ExpandableSection from './shared/ExpandableSection';

interface GenericResultCardProps {
    toolName?: string;
    summary: string;
    data?: Record<string, unknown>;
}

export default function GenericResultCard({ toolName, summary, data }: GenericResultCardProps) {
    return (
        <Paper sx={{
            mb: 2,
            borderRadius: 2,
            overflow: 'hidden',
            border: 1,
            borderColor: 'divider',
            borderLeft: 3,
            borderLeftColor: '#64748B',
        }}>
            <Box sx={{ p: 1.5 }}>
                <ServiceBadge service="generic" subtitle={toolName} />

                <Typography variant="body2" sx={{ mb: data ? 0.75 : 0 }}>
                    {summary}
                </Typography>

                {data && (
                    <ExpandableSection label="Show raw data">
                        <Box
                            component="pre"
                            sx={{
                                bgcolor: 'grey.900',
                                color: 'grey.100',
                                p: 1,
                                borderRadius: 1,
                                overflow: 'auto',
                                fontSize: '0.7rem',
                                fontFamily: 'monospace',
                                maxHeight: 200,
                                m: 0,
                            }}
                        >
                            {JSON.stringify(data, null, 2)}
                        </Box>
                    </ExpandableSection>
                )}
            </Box>
        </Paper>
    );
}
