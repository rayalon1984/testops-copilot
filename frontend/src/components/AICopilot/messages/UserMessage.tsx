/**
 * UserMessage — Right-aligned blue bubble with overflow containment.
 */

import { Box, Paper, Typography } from '@mui/material';

interface UserMessageProps {
    content: string;
}

export default function UserMessage({ content }: UserMessageProps) {
    return (
        <Box sx={{ alignSelf: 'flex-end', mb: 2, maxWidth: '85%', minWidth: 0 }}>
            <Paper sx={{
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                p: 1.5,
                borderRadius: '16px 16px 0 16px',
                boxShadow: 2,
                /* Text-containment guards */
                overflow: 'hidden',
                overflowWrap: 'break-word',
                wordBreak: 'break-word',
            }}>
                <Typography variant="body2">{content}</Typography>
            </Paper>
        </Box>
    );
}
