/**
 * CardHeaderV2 — Shared emoji + bold title header for V2 cards.
 *
 * Matches the README screenshot: large emoji, bold title, optional status chip.
 */

import { Box, Typography } from '@mui/material';
import StatusChip from '../shared/StatusChip';

interface CardHeaderV2Props {
    emoji: string;
    title: string;
    chip?: { label: string; status: string };
}

export default function CardHeaderV2({ emoji, title, chip }: CardHeaderV2Props) {
    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Typography sx={{ fontSize: '1.2rem', lineHeight: 1 }} aria-hidden="true">
                {emoji}
            </Typography>
            <Typography
                variant="subtitle1"
                fontWeight={700}
                color="text.primary"
                sx={{ flex: 1, overflowWrap: 'break-word', wordBreak: 'break-word' }}
            >
                {title}
            </Typography>
            {chip && <StatusChip status={chip.status} />}
        </Box>
    );
}
