/**
 * AssistantMessage — Markdown-rendered response with MessageActions.
 */

import { Box, Paper } from '@mui/material';
import MarkdownRenderer from '../MarkdownRenderer';

interface AssistantMessageProps {
    content: string;
    id: string;
}

export default function AssistantMessage({ content, id: _id }: AssistantMessageProps) {
    return (
        <Box sx={{ alignSelf: 'flex-start', mb: 2, maxWidth: '90%' }}>
            <Paper sx={{
                bgcolor: 'background.paper',
                color: 'text.primary',
                p: 1.5,
                borderRadius: '16px 16px 16px 0',
                border: 1,
                borderColor: 'divider',
                boxShadow: 1,
            }}>
                <MarkdownRenderer content={content} />
            </Paper>
        </Box>
    );
}
