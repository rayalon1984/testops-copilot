/**
 * ServiceBadge — Icon + name + colored left border identifying the service.
 */

import { Box, Typography } from '@mui/material';

const SERVICE_CONFIG: Record<string, { icon: string; accent: string; label: string }> = {
    jira:        { icon: '\u2B21', accent: '#0052CC', label: 'Jira' },
    github:      { icon: '\u25D1', accent: '#24292f', label: 'GitHub' },
    jenkins:     { icon: '\u2699', accent: '#D33833', label: 'Jenkins' },
    confluence:  { icon: '\uD83D\uDCC4', accent: '#1868DB', label: 'Confluence' },
    dashboard:   { icon: '\uD83D\uDCCA', accent: '#6366F1', label: 'Dashboard' },
    predictions: { icon: '\uD83D\uDD2E', accent: '#8B5CF6', label: 'Predictions' },
    generic:     { icon: '\uD83D\uDD27', accent: '#64748B', label: 'Tool' },
};

interface ServiceBadgeProps {
    service: string;
    subtitle?: string;
}

export function getServiceAccent(service: string): string {
    return SERVICE_CONFIG[service]?.accent ?? SERVICE_CONFIG.generic.accent;
}

export default function ServiceBadge({ service, subtitle }: ServiceBadgeProps) {
    const cfg = SERVICE_CONFIG[service] ?? SERVICE_CONFIG.generic;

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
            <Typography sx={{ fontSize: '1rem', lineHeight: 1 }}>{cfg.icon}</Typography>
            <Typography variant="caption" fontWeight={600} color="text.secondary">
                {cfg.label}
            </Typography>
            {subtitle && (
                <Typography variant="caption" color="text.disabled">
                    {subtitle}
                </Typography>
            )}
        </Box>
    );
}
