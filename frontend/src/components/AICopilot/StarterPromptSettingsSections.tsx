/**
 * StarterPromptSettingsSections — Sub-components extracted from StarterPromptSettings.
 *
 * PinnedPromptsList  — "Your Pinned Prompts" reorder/delete list
 * RoleCatalogList    — "Prompts for Your Role" pin-toggle list
 * CustomPromptForm   — "Add Custom Prompt" text fields + action buttons
 */

import {
    Box, Typography, Button, IconButton, TextField,
    List, ListItem, ListItemText, ListItemSecondaryAction,
} from '@mui/material';
import PushPinIcon from '@mui/icons-material/PushPin';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';

import type { PinnedPromptEntry, StarterPrompt } from '../../hooks/api/useStarterPrompts';

const MAX_LABEL_LENGTH = 40;
const MAX_PROMPT_LENGTH = 200;

// ─── PinnedPromptsList ──────────────────────────────────────────

interface PinnedPromptsListProps {
    pins: PinnedPromptEntry[];
    onMove: (index: number, direction: 'up' | 'down') => void;
    onRemove: (index: number) => void;
}

export function PinnedPromptsList({ pins, onMove, onRemove }: PinnedPromptsListProps) {
    if (pins.length === 0) return null;

    return (
        <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                Your Pinned Prompts
            </Typography>
            <List dense disablePadding>
                {pins.map((pin, index) => (
                    <ListItem
                        key={`pin-${index}`}
                        sx={{
                            border: 1,
                            borderColor: 'divider',
                            borderRadius: 1,
                            mb: 0.5,
                            pl: 1,
                        }}
                    >
                        <PushPinIcon sx={{ fontSize: 14, color: 'primary.main', mr: 1, transform: 'rotate(45deg)' }} />
                        <ListItemText
                            primary={pin.label}
                            secondary={pin.prompt.length > 60 ? `${pin.prompt.slice(0, 60)}...` : pin.prompt}
                            primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                            secondaryTypographyProps={{ variant: 'caption' }}
                        />
                        <ListItemSecondaryAction>
                            <IconButton
                                size="small"
                                disabled={index === 0}
                                onClick={() => onMove(index, 'up')}
                            >
                                <ArrowUpwardIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                            <IconButton
                                size="small"
                                disabled={index === pins.length - 1}
                                onClick={() => onMove(index, 'down')}
                            >
                                <ArrowDownwardIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                            <IconButton
                                size="small"
                                onClick={() => onRemove(index)}
                            >
                                <DeleteIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                        </ListItemSecondaryAction>
                    </ListItem>
                ))}
            </List>
        </Box>
    );
}

// ─── RoleCatalogList ────────────────────────────────────────────

interface RoleCatalogListProps {
    rolePrompts: StarterPrompt[];
    catalogLoading: boolean;
    isPinned: (id: string) => boolean;
    onTogglePin: (prompt: StarterPrompt) => void;
}

export function RoleCatalogList({ rolePrompts, catalogLoading, isPinned, onTogglePin }: RoleCatalogListProps) {
    return (
        <>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                Prompts for Your Role
            </Typography>

            {catalogLoading ? (
                <Typography variant="caption" color="text.disabled">Loading catalog...</Typography>
            ) : (
                <List dense disablePadding>
                    {rolePrompts.map((prompt) => (
                        <ListItem
                            key={prompt.id}
                            sx={{
                                borderRadius: 1,
                                mb: 0.5,
                                cursor: 'pointer',
                                opacity: isPinned(prompt.id) ? 0.6 : 1,
                                '&:hover': { bgcolor: 'action.selected' },
                            }}
                            onClick={() => onTogglePin(prompt)}
                        >
                            {isPinned(prompt.id) ? (
                                <PushPinIcon sx={{ fontSize: 14, color: 'primary.main', mr: 1, transform: 'rotate(45deg)' }} />
                            ) : (
                                <PushPinOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled', mr: 1 }} />
                            )}
                            <ListItemText
                                primary={prompt.label}
                                secondary={prompt.category}
                                primaryTypographyProps={{ variant: 'body2' }}
                                secondaryTypographyProps={{ variant: 'caption' }}
                            />
                        </ListItem>
                    ))}
                </List>
            )}
        </>
    );
}

// ─── CustomPromptForm ───────────────────────────────────────────

interface CustomPromptFormProps {
    addingCustom: boolean;
    onSetAddingCustom: (v: boolean) => void;
    customLabel: string;
    onSetCustomLabel: (v: string) => void;
    customPrompt: string;
    onSetCustomPrompt: (v: string) => void;
    onAdd: () => void;
    pinsAtMax: boolean;
}

export function CustomPromptForm({
    addingCustom,
    onSetAddingCustom,
    customLabel,
    onSetCustomLabel,
    customPrompt,
    onSetCustomPrompt,
    onAdd,
    pinsAtMax,
}: CustomPromptFormProps) {
    if (!addingCustom) {
        return (
            <Button
                size="small"
                startIcon={<AddIcon />}
                disabled={pinsAtMax}
                onClick={() => onSetAddingCustom(true)}
                sx={{ mt: 0.5 }}
            >
                Add custom prompt
            </Button>
        );
    }

    return (
        <Box sx={{ mt: 1 }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                Add Custom Prompt
            </Typography>
            <TextField
                fullWidth
                size="small"
                label="Label"
                placeholder="e.g. My team's tests"
                value={customLabel}
                onChange={(e) => onSetCustomLabel(e.target.value.slice(0, MAX_LABEL_LENGTH))}
                helperText={`${customLabel.length}/${MAX_LABEL_LENGTH}`}
                sx={{ mb: 1 }}
            />
            <TextField
                fullWidth
                size="small"
                label="Prompt"
                placeholder="e.g. Show recent failures in the auth-service pipeline"
                value={customPrompt}
                onChange={(e) => onSetCustomPrompt(e.target.value.slice(0, MAX_PROMPT_LENGTH))}
                helperText={`${customPrompt.length}/${MAX_PROMPT_LENGTH}`}
                multiline
                minRows={2}
                sx={{ mb: 1 }}
            />
            <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                    size="small"
                    variant="contained"
                    disabled={!customLabel.trim() || !customPrompt.trim() || pinsAtMax}
                    onClick={onAdd}
                >
                    Add
                </Button>
                <Button size="small" onClick={() => onSetAddingCustom(false)}>
                    Cancel
                </Button>
            </Box>
        </Box>
    );
}
