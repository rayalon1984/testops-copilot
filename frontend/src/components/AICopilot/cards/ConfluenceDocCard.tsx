/**
 * ConfluenceDocCard — Doc snippet with labels and "Read Full Page" link.
 * For: confluence_search results
 */

import { Box, Paper, Typography, Chip, Button } from '@mui/material';
import { OpenInNew as ExternalIcon } from '@mui/icons-material';
import ServiceBadge, { getServiceAccent } from './shared/ServiceBadge';

interface ConfluenceDoc {
    id: string;
    title: string;
    url: string;
    excerpt: string;
    labels?: string[];
}

interface ConfluenceDocCardProps {
    results: Record<string, unknown>[];
}

export default function ConfluenceDocCard({ results }: ConfluenceDocCardProps) {
    const docs = (Array.isArray(results) ? results : []) as unknown as ConfluenceDoc[];

    if (docs.length === 0) {
        return (
            <Paper sx={{ mb: 2, p: 1.5, borderRadius: 2, borderLeft: 3, borderLeftColor: getServiceAccent('confluence') }}>
                <ServiceBadge service="confluence" subtitle="Search" />
                <Typography variant="body2" color="text.secondary">No documents found.</Typography>
            </Paper>
        );
    }

    return (
        <>
            {docs.map((doc) => (
                <Paper
                    key={doc.id}
                    sx={{
                        mb: 2,
                        borderRadius: 2,
                        overflow: 'hidden',
                        border: 1,
                        borderColor: 'divider',
                        borderLeft: 3,
                        borderLeftColor: getServiceAccent('confluence'),
                    }}
                >
                    <Box sx={{ p: 1.5 }}>
                        <ServiceBadge service="confluence" />

                        <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5, overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                            {doc.title}
                        </Typography>

                        {doc.excerpt && (
                            <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{
                                    display: '-webkit-box',
                                    mb: 0.75,
                                    fontStyle: 'italic',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    WebkitLineClamp: 3,
                                    WebkitBoxOrient: 'vertical',
                                    overflowWrap: 'break-word',
                                    wordBreak: 'break-word',
                                }}
                            >
                                &ldquo;{doc.excerpt}&rdquo;
                            </Typography>
                        )}

                        {doc.labels && doc.labels.length > 0 && (
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 0.75 }}>
                                {doc.labels.map(label => (
                                    <Chip key={label} label={label} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.6rem' }} />
                                ))}
                            </Box>
                        )}

                        {doc.url && (
                            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <Button
                                    size="small"
                                    variant="text"
                                    endIcon={<ExternalIcon sx={{ fontSize: 12 }} />}
                                    href={doc.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    sx={{ fontSize: '0.7rem', textTransform: 'none' }}
                                >
                                    Read Full Page
                                </Button>
                            </Box>
                        )}
                    </Box>
                </Paper>
            ))}
        </>
    );
}
