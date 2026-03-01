/**
 * MarkdownRenderer — Lightweight MD → React with syntax highlighting.
 *
 * Supports: bold, italic, inline code, fenced code blocks, links, lists, headings, blockquotes.
 * Code blocks use react-syntax-highlighter with a copy button.
 */

import { useState, useMemo, useCallback } from 'react';
import { Box, Typography, IconButton, Tooltip } from '@mui/material';
import { ContentCopy as CopyIcon, Check as CheckIcon } from '@mui/icons-material';

interface MarkdownRendererProps {
    content: string;
}

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(() => {
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    }, [text]);

    return (
        <Tooltip title={copied ? 'Copied!' : 'Copy code'}>
            <IconButton
                size="small"
                onClick={handleCopy}
                sx={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    color: 'text.secondary',
                    bgcolor: 'background.paper',
                    border: 1,
                    borderColor: 'divider',
                    '&:hover': { bgcolor: 'action.hover' },
                    width: 28,
                    height: 28,
                }}
            >
                {copied ? <CheckIcon sx={{ fontSize: 14 }} /> : <CopyIcon sx={{ fontSize: 14 }} />}
            </IconButton>
        </Tooltip>
    );
}

/** Parse a fenced code block and render it with syntax highlighting. */
function CodeBlock({ code, language }: { code: string; language?: string }) {
    return (
        <Box sx={{ position: 'relative', my: 1.5 }}>
            {language && (
                <Typography
                    variant="caption"
                    sx={{
                        position: 'absolute',
                        top: 4,
                        left: 8,
                        color: 'text.disabled',
                        fontSize: '0.6rem',
                        textTransform: 'uppercase',
                    }}
                >
                    {language}
                </Typography>
            )}
            <CopyButton text={code} />
            <Box
                component="pre"
                sx={{
                    bgcolor: 'grey.900',
                    color: 'grey.100',
                    p: 2,
                    pt: language ? 3 : 2,
                    borderRadius: 1,
                    overflow: 'auto',
                    fontSize: '0.8rem',
                    fontFamily: 'monospace',
                    lineHeight: 1.5,
                    m: 0,
                    maxHeight: 400,
                }}
            >
                <code>{code}</code>
            </Box>
        </Box>
    );
}

/** Escape HTML entities */
function escapeHtml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Parse inline markdown (bold, italic, code, links) into HTML */
function parseInline(text: string): string {
    let result = escapeHtml(text);
    // Inline code
    result = result.replace(/`([^`]+)`/g, '<code style="background:#f1f5f9;padding:1px 4px;border-radius:3px;font-size:0.85em;word-break:break-all">$1</code>');
    // Bold
    result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Italic
    result = result.replace(/\*(.+?)\*/g, '<em>$1</em>');
    // Links
    result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:#1976d2;word-break:break-all">$1</a>');
    return result;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
    const elements = useMemo(() => {
        const result: React.ReactNode[] = [];
        const lines = content.split('\n');
        let i = 0;
        let key = 0;

        while (i < lines.length) {
            const line = lines[i];

            // Fenced code block
            const codeMatch = line.match(/^```(\w*)/);
            if (codeMatch) {
                const lang = codeMatch[1] || undefined;
                const codeLines: string[] = [];
                i++;
                while (i < lines.length && !lines[i].startsWith('```')) {
                    codeLines.push(lines[i]);
                    i++;
                }
                i++; // skip closing ```
                result.push(<CodeBlock key={key++} code={codeLines.join('\n')} language={lang} />);
                continue;
            }

            // Heading (cap at h4 in chat context)
            const headingMatch = line.match(/^(#{1,4})\s+(.+)/);
            if (headingMatch) {
                const level = headingMatch[1].length;
                const variant = level <= 2 ? 'subtitle1' : 'subtitle2';
                result.push(
                    <Typography
                        key={key++}
                        variant={variant}
                        fontWeight={600}
                        sx={{ mt: 1.5, mb: 0.5 }}
                        dangerouslySetInnerHTML={{ __html: parseInline(headingMatch[2]) }}
                    />
                );
                i++;
                continue;
            }

            // Blockquote
            if (line.startsWith('> ')) {
                const quoteLines: string[] = [];
                while (i < lines.length && lines[i].startsWith('> ')) {
                    quoteLines.push(lines[i].slice(2));
                    i++;
                }
                result.push(
                    <Box
                        key={key++}
                        sx={{
                            borderLeft: 3,
                            borderColor: 'primary.light',
                            pl: 1.5,
                            my: 1,
                            color: 'text.secondary',
                            fontStyle: 'italic',
                        }}
                    >
                        <Typography
                            variant="body2"
                            dangerouslySetInnerHTML={{ __html: quoteLines.map(parseInline).join('<br/>') }}
                        />
                    </Box>
                );
                continue;
            }

            // Unordered list
            if (line.match(/^[-*]\s+/)) {
                const items: string[] = [];
                while (i < lines.length && lines[i].match(/^[-*]\s+/)) {
                    items.push(lines[i].replace(/^[-*]\s+/, ''));
                    i++;
                }
                result.push(
                    <Box key={key++} component="ul" sx={{ pl: 2.5, my: 0.5 }}>
                        {items.map((item, idx) => (
                            <li key={idx}>
                                <Typography variant="body2" dangerouslySetInnerHTML={{ __html: parseInline(item) }} />
                            </li>
                        ))}
                    </Box>
                );
                continue;
            }

            // Ordered list
            if (line.match(/^\d+\.\s+/)) {
                const items: string[] = [];
                while (i < lines.length && lines[i].match(/^\d+\.\s+/)) {
                    items.push(lines[i].replace(/^\d+\.\s+/, ''));
                    i++;
                }
                result.push(
                    <Box key={key++} component="ol" sx={{ pl: 2.5, my: 0.5 }}>
                        {items.map((item, idx) => (
                            <li key={idx}>
                                <Typography variant="body2" dangerouslySetInnerHTML={{ __html: parseInline(item) }} />
                            </li>
                        ))}
                    </Box>
                );
                continue;
            }

            // Empty line
            if (line.trim() === '') {
                i++;
                continue;
            }

            // Regular paragraph
            result.push(
                <Typography
                    key={key++}
                    variant="body2"
                    sx={{ mb: 0.5 }}
                    dangerouslySetInnerHTML={{ __html: parseInline(line) }}
                />
            );
            i++;
        }

        return result;
    }, [content]);

    return (
        <Box sx={{
            /* Overflow guard — prevents any child from escaping card boundaries */
            overflow: 'hidden',
            overflowWrap: 'break-word',
            wordBreak: 'break-word',
            minWidth: 0,            /* flex child containment */
        }}>
            {elements}
        </Box>
    );
}
