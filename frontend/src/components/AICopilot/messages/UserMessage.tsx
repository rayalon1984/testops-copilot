/**
 * UserMessage — Right-aligned blue bubble.
 */

import { Box, Paper, Typography } from '@mui/material';

interface UserMessageProps {
    content: string;
}

export default function UserMessage({ content }: UserMessageProps) {
    return (
        <Box sx={{ alignSelf: 'flex-end', mb: 2, maxWidth: '85%' }}>
            <Paper sx={{
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                p: 1.5,
                borderRadius: '16px 16px 0 16px',
                boxShadow: 2,
            }}>
                <Typography variant="body2">{content}</Typography>
            </Paper>
        </Box>
    );
}
