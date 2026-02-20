/**
 * ServiceBadge — Icon + name + colored left border identifying the service.
 *
 * Dark mode: accent colors have light/dark variants.
 * A11y: icon has aria-hidden, service label is screen-reader-friendly.
 */

import { Box, Typography, useTheme } from '@mui/material';

interface ServiceColorSet {
    icon: string;
    light: string;
    dark: string;
    label: string;
}

const SERVICE_CONFIG: Record<string, ServiceColorSet> = {
    jira:        { icon: '\u2B21', light: '#0052CC', dark: '#4C9AFF', label: 'Jira' },
    github:      { icon: '\u25D1', light: '#24292f', dark: '#C9D1D9', label: 'GitHub' },
    jenkins:     { icon: '\u2699', light: '#D33833', dark: '#F97171', label: 'Jenkins' },
    confluence:  { icon: '\uD83D\uDCC4', light: '#1868DB', dark: '#579DFF', label: 'Confluence' },
    dashboard:   { icon: '\uD83D\uDCCA', light: '#6366F1', dark: '#A5B4FC', label: 'Dashboard' },
    predictions: { icon: '\uD83D\uDD2E', light: '#8B5CF6', dark: '#C4B5FD', label: 'Predictions' },
    giphy:       { icon: '\uD83C\uDFAC', light: '#00E676', dark: '#69F0AE', label: 'Giphy' },
    generic:     { icon: '\uD83D\uDD27', light: '#64748B', dark: '#94A3B8', label: 'Tool' },
};

interface ServiceBadgeProps {
    service: string;
    subtitle?: string;
}

export function getServiceAccent(service: string, mode: 'light' | 'dark' = 'light'): string {
    const cfg = SERVICE_CONFIG[service] ?? SERVICE_CONFIG.generic;
    return mode === 'dark' ? cfg.dark : cfg.light;
}

/**
 * React hook for theme-aware service accent color.
 * Use in card components for borders/highlights that need dark-mode variants.
 */
export function useServiceAccent(service: string): string {
    const theme = useTheme();
    return getServiceAccent(service, theme.palette.mode as 'light' | 'dark');
}

export default function ServiceBadge({ service, subtitle }: ServiceBadgeProps) {
    const theme = useTheme();
    const cfg = SERVICE_CONFIG[service] ?? SERVICE_CONFIG.generic;
    const accent = theme.palette.mode === 'dark' ? cfg.dark : cfg.light;

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }} role="heading" aria-level={3}>
            <Typography aria-hidden="true" sx={{ fontSize: '1rem', lineHeight: 1 }}>{cfg.icon}</Typography>
            <Typography variant="caption" fontWeight={600} sx={{ color: accent }}>
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
