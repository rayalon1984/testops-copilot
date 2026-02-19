/**
 * ExpandableSection — Show/hide details toggle.
 */

import { useState, ReactNode } from 'react';
import { Box, Typography } from '@mui/material';

interface ExpandableSectionProps {
    label?: string;
    children: ReactNode;
    defaultExpanded?: boolean;
}

export default function ExpandableSection({ label = 'Show details', children, defaultExpanded = false }: ExpandableSectionProps) {
    const [expanded, setExpanded] = useState(defaultExpanded);

    return (
        <Box>
            <Typography
                variant="caption"
                sx={{
                    cursor: 'pointer',
                    color: 'primary.main',
                    '&:hover': { textDecoration: 'underline' },
                    userSelect: 'none',
                }}
                onClick={() => setExpanded(!expanded)}
            >
                {expanded ? '\u25BE' : '\u25B8'} {expanded ? 'Hide details' : label}
            </Typography>
            {expanded && (
                <Box sx={{ mt: 0.5 }}>
                    {children}
                </Box>
            )}
        </Box>
    );
}
