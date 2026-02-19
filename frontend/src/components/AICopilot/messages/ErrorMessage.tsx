/**
 * ErrorMessage — Red error display.
 */

import { Box, Paper, Typography, alpha } from '@mui/material';

interface ErrorMessageProps {
    content: string;
}

export default function ErrorMessage({ content }: ErrorMessageProps) {
    return (
        <Box sx={{ mb: 2 }}>
            <Paper sx={{
                bgcolor: (theme) => alpha(theme.palette.error.main, 0.1),
                color: 'error.main',
                p: 1.5,
                borderRadius: 2,
            }}>
                <Typography variant="caption">Error: {content}</Typography>
            </Paper>
        </Box>
    );
}
