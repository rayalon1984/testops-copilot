/**
 * CardActions — Role-gated action buttons for service cards.
 *
 * EDITOR+ (role hierarchy level >= 30) sees action buttons.
 * BILLING/VIEWER see nothing (buttons hidden, not disabled).
 */

import { ReactNode } from 'react';
import { Box } from '@mui/material';

const ROLE_HIERARCHY: Record<string, number> = {
    ADMIN: 40,
    EDITOR: 30,
    USER: 30,
    BILLING: 20,
    VIEWER: 10,
};

interface CardActionsProps {
    userRole: string;
    children: ReactNode;
}

export function canAct(userRole: string): boolean {
    return (ROLE_HIERARCHY[userRole?.toUpperCase()] ?? 0) >= 30;
}

export default function CardActions({ userRole, children }: CardActionsProps) {
    if (!canAct(userRole)) return null;

    return (
        <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
            {children}
        </Box>
    );
}
