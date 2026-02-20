/**
 * InlineDiffViewer — Syntax-highlighted unified diff viewer for PR cards.
 *
 * Renders GitHub-style diff hunks with green/red line coloring,
 * file headers, and collapsible sections for large diffs.
 * Respects dark mode palette.
 */

import { useState } from 'react';
import { Box, Typography, Collapse, Button } from '@mui/material';
import {
    UnfoldMore as ExpandIcon,
    UnfoldLess as CollapseIcon,
} from '@mui/icons-material';

interface DiffFile {
    filename: string;
    additions: number;
    deletions: number;
    patch?: string;
}

interface InlineDiffViewerProps {
    files: DiffFile[];
    /** Max lines to show before collapsing (default: 20) */
    maxVisibleLines?: number;
}

const ADDITION_BG = 'rgba(46, 160, 67, 0.15)';
const DELETION_BG = 'rgba(248, 81, 73, 0.15)';
const HUNK_HEADER_BG = 'rgba(56, 139, 253, 0.1)';
const ADDITION_COLOR = '#3fb950';
const DELETION_COLOR = '#f85149';
const HUNK_HEADER_COLOR = '#58a6ff';

export default function InlineDiffViewer({ files, maxVisibleLines = 20 }: InlineDiffViewerProps) {
    const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

    const toggleFile = (filename: string) => {
        setExpandedFiles(prev => {
            const next = new Set(prev);
            if (next.has(filename)) {
                next.delete(filename);
            } else {
                next.add(filename);
            }
            return next;
        });
    };

    if (!files || files.length === 0) return null;

    return (
        <Box sx={{ mt: 1 }}>
            {files.map((file) => {
                const lines = file.patch?.split('\n') || [];
                const isLong = lines.length > maxVisibleLines;
                const isExpanded = expandedFiles.has(file.filename);
                const visibleLines = isLong && !isExpanded
                    ? lines.slice(0, maxVisibleLines)
                    : lines;

                return (
                    <Box key={file.filename} sx={{
                        mb: 1,
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 1,
                        overflow: 'hidden',
                    }}>
                        {/* File header */}
                        <Box sx={{
                            px: 1,
                            py: 0.5,
                            bgcolor: 'action.hover',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                        }}>
                            <Typography variant="caption" fontFamily="monospace" fontWeight={600}>
                                {file.filename}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                <Typography component="span" variant="caption" sx={{ color: ADDITION_COLOR }}>
                                    +{file.additions}
                                </Typography>
                                {' '}
                                <Typography component="span" variant="caption" sx={{ color: DELETION_COLOR }}>
                                    -{file.deletions}
                                </Typography>
                            </Typography>
                        </Box>

                        {/* Diff content */}
                        {file.patch && (
                            <Box sx={{
                                fontFamily: 'monospace',
                                fontSize: '0.7rem',
                                lineHeight: 1.6,
                                overflowX: 'auto',
                            }}>
                                {visibleLines.map((line, idx) => {
                                    let bg = 'transparent';
                                    let color = 'text.primary';

                                    if (line.startsWith('+') && !line.startsWith('+++')) {
                                        bg = ADDITION_BG;
                                        color = ADDITION_COLOR;
                                    } else if (line.startsWith('-') && !line.startsWith('---')) {
                                        bg = DELETION_BG;
                                        color = DELETION_COLOR;
                                    } else if (line.startsWith('@@')) {
                                        bg = HUNK_HEADER_BG;
                                        color = HUNK_HEADER_COLOR;
                                    }

                                    return (
                                        <Box key={idx} sx={{
                                            px: 1,
                                            bgcolor: bg,
                                            color,
                                            whiteSpace: 'pre',
                                            minHeight: '1.4em',
                                        }}>
                                            {line}
                                        </Box>
                                    );
                                })}

                                {/* Expand/collapse for long diffs */}
                                {isLong && (
                                    <Collapse in={isExpanded}>
                                        {lines.slice(maxVisibleLines).map((line, idx) => {
                                            let bg = 'transparent';
                                            let color = 'text.primary';

                                            if (line.startsWith('+') && !line.startsWith('+++')) {
                                                bg = ADDITION_BG;
                                                color = ADDITION_COLOR;
                                            } else if (line.startsWith('-') && !line.startsWith('---')) {
                                                bg = DELETION_BG;
                                                color = DELETION_COLOR;
                                            } else if (line.startsWith('@@')) {
                                                bg = HUNK_HEADER_BG;
                                                color = HUNK_HEADER_COLOR;
                                            }

                                            return (
                                                <Box key={`exp-${idx}`} sx={{
                                                    px: 1,
                                                    bgcolor: bg,
                                                    color,
                                                    whiteSpace: 'pre',
                                                    minHeight: '1.4em',
                                                }}>
                                                    {line}
                                                </Box>
                                            );
                                        })}
                                    </Collapse>
                                )}

                                {isLong && (
                                    <Box sx={{ textAlign: 'center', py: 0.5, bgcolor: 'action.hover' }}>
                                        <Button
                                            size="small"
                                            onClick={() => toggleFile(file.filename)}
                                            startIcon={isExpanded ? <CollapseIcon /> : <ExpandIcon />}
                                            sx={{ fontSize: '0.65rem', textTransform: 'none' }}
                                        >
                                            {isExpanded
                                                ? 'Show less'
                                                : `Show ${lines.length - maxVisibleLines} more lines`
                                            }
                                        </Button>
                                    </Box>
                                )}
                            </Box>
                        )}
                    </Box>
                );
            })}
        </Box>
    );
}
