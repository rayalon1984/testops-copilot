/**
 * ExpandableSection — Show/hide details toggle.
 *
 * A11y: aria-expanded, aria-controls, keyboard Enter/Space to toggle.
 * Analytics: fires onToggle callback when expanded/collapsed.
 */

import { useState, useId, ReactNode, KeyboardEvent } from 'react';
import { Box, Typography } from '@mui/material';

interface ExpandableSectionProps {
    label?: string;
    children: ReactNode;
    defaultExpanded?: boolean;
    /** Analytics callback — fired on expand/collapse */
    onToggle?: (expanded: boolean) => void;
}

export default function ExpandableSection({ label = 'Show details', children, defaultExpanded = false, onToggle }: ExpandableSectionProps) {
    const [expanded, setExpanded] = useState(defaultExpanded);
    const contentId = useId();

    const toggle = () => {
        const next = !expanded;
        setExpanded(next);
        onToggle?.(next);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggle();
        }
    };

    return (
        <Box>
            <Typography
                variant="caption"
                role="button"
                tabIndex={0}
                aria-expanded={expanded}
                aria-controls={contentId}
                onKeyDown={handleKeyDown}
                sx={{
                    cursor: 'pointer',
                    color: 'primary.main',
                    '&:hover': { textDecoration: 'underline' },
                    '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2, borderRadius: 0.5 },
                    userSelect: 'none',
                }}
                onClick={toggle}
            >
                {expanded ? '\u25BE' : '\u25B8'} {expanded ? 'Hide details' : label}
            </Typography>
            {expanded && (
                <Box id={contentId} role="region" sx={{ mt: 0.5 }}>
                    {children}
                </Box>
            )}
        </Box>
    );
}
