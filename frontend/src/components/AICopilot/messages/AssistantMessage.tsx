/**
 * AssistantMessage — Markdown-rendered response with overflow containment.
 *
 * NOTE: Outer positioning (alignSelf, maxWidth, mb) is handled by
 * the MessageRenderer wrapper in AICopilot.tsx — do NOT add here.
 */

import { Paper } from '@mui/material';
import MarkdownRenderer from '../MarkdownRenderer';

interface AssistantMessageProps {
    content: string;
    id: string;
}

export default function AssistantMessage({ content, id: _id }: AssistantMessageProps) {
    return (
        <Paper sx={{
            bgcolor: 'background.paper',
            color: 'text.primary',
            p: 1.5,
            borderRadius: '16px 16px 16px 0',
            border: 1,
            borderColor: 'divider',
            boxShadow: 1,
            /* Text-containment guards — prevent overflow */
            overflow: 'hidden',
            overflowWrap: 'break-word',
            wordBreak: 'break-word',
            minWidth: 0,
        }}>
            <MarkdownRenderer content={content} />
        </Paper>
    );
}
