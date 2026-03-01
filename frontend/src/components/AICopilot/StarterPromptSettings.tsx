/**
 * StarterPromptSettings — Popover/dialog for customizing starter prompts.
 *
 * Users can pin/unpin prompts from their role catalog, add custom prompts,
 * reorder pins, and reset to defaults.
 */

import { useState, useEffect, useCallback } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Box, Typography, Button, IconButton, TextField,
    List, ListItem, ListItemText, ListItemSecondaryAction,
    Chip, Divider, Alert,
} from '@mui/material';
import PushPinIcon from '@mui/icons-material/PushPin';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import {
    useStarterPromptCatalog,
    useSavePinnedPrompts,
    useResetPinnedPrompts,
    useStarterPrompts,
    type PinnedPromptEntry,
    type StarterPrompt,
} from '../../hooks/api/useStarterPrompts';

const MAX_PINS = 4;
const MAX_LABEL_LENGTH = 40;
const MAX_PROMPT_LENGTH = 200;

interface StarterPromptSettingsProps {
    open: boolean;
    onClose: () => void;
}

export default function StarterPromptSettings({ open, onClose }: StarterPromptSettingsProps) {
    const { data: catalog, isLoading: catalogLoading } = useStarterPromptCatalog();
    const { data: currentPrompts } = useStarterPrompts();
    const saveMutation = useSavePinnedPrompts();
    const resetMutation = useResetPinnedPrompts();

    // Local editing state
    const [pins, setPins] = useState<PinnedPromptEntry[]>([]);
    const [addingCustom, setAddingCustom] = useState(false);
    const [customLabel, setCustomLabel] = useState('');
    const [customPrompt, setCustomPrompt] = useState('');

    // Sync local state from current prompts when dialog opens
    useEffect(() => {
        if (open && currentPrompts) {
            const currentPins = currentPrompts
                .filter(p => p.pinned)
                .map(p => ({ id: p.id.startsWith('custom-') ? undefined : p.id, label: p.label, prompt: p.prompt }));
            setPins(currentPins);
        }
    }, [open, currentPrompts]);

    const isPinned = useCallback((promptId: string) => {
        return pins.some(p => p.id === promptId);
    }, [pins]);

    const togglePin = useCallback((prompt: StarterPrompt) => {
        setPins(prev => {
            const existing = prev.findIndex(p => p.id === prompt.id);
            if (existing >= 0) {
                // Unpin
                return prev.filter((_, i) => i !== existing);
            }
            if (prev.length >= MAX_PINS) return prev; // Can't add more
            // Pin
            return [...prev, { id: prompt.id, label: prompt.label, prompt: prompt.prompt }];
        });
    }, []);

    const addCustomPrompt = useCallback(() => {
        if (!customLabel.trim() || !customPrompt.trim()) return;
        if (pins.length >= MAX_PINS) return;

        setPins(prev => [...prev, { label: customLabel.trim(), prompt: customPrompt.trim() }]);
        setCustomLabel('');
        setCustomPrompt('');
        setAddingCustom(false);
    }, [customLabel, customPrompt, pins.length]);

    const removePin = useCallback((index: number) => {
        setPins(prev => prev.filter((_, i) => i !== index));
    }, []);

    const movePin = useCallback((index: number, direction: 'up' | 'down') => {
        setPins(prev => {
            const newPins = [...prev];
            const targetIndex = direction === 'up' ? index - 1 : index + 1;
            if (targetIndex < 0 || targetIndex >= newPins.length) return prev;
            [newPins[index], newPins[targetIndex]] = [newPins[targetIndex], newPins[index]];
            return newPins;
        });
    }, []);

    const handleSave = async () => {
        await saveMutation.mutateAsync(pins);
        onClose();
    };

    const handleReset = async () => {
        await resetMutation.mutateAsync();
        setPins([]);
        onClose();
    };

    const rolePrompts = catalog?.rolePrompts ?? [];

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{ sx: { borderRadius: 3 } }}
        >
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="h6" fontWeight={600}>
                    Customize Starter Prompts
                </Typography>
                <Chip
                    label={`${pins.length}/${MAX_PINS} pinned`}
                    size="small"
                    color={pins.length >= MAX_PINS ? 'warning' : 'default'}
                />
            </DialogTitle>

            <DialogContent dividers>
                {/* Pinned prompts section */}
                {pins.length > 0 && (
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
                                            onClick={() => movePin(index, 'up')}
                                        >
                                            <ArrowUpwardIcon sx={{ fontSize: 14 }} />
                                        </IconButton>
                                        <IconButton
                                            size="small"
                                            disabled={index === pins.length - 1}
                                            onClick={() => movePin(index, 'down')}
                                        >
                                            <ArrowDownwardIcon sx={{ fontSize: 14 }} />
                                        </IconButton>
                                        <IconButton
                                            size="small"
                                            onClick={() => removePin(index)}
                                        >
                                            <DeleteIcon sx={{ fontSize: 14 }} />
                                        </IconButton>
                                    </ListItemSecondaryAction>
                                </ListItem>
                            ))}
                        </List>
                    </Box>
                )}

                <Divider sx={{ my: 1.5 }} />

                {/* Role catalog section */}
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
                                onClick={() => togglePin(prompt)}
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

                <Divider sx={{ my: 1.5 }} />

                {/* Custom prompt section */}
                {addingCustom ? (
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
                            onChange={(e) => setCustomLabel(e.target.value.slice(0, MAX_LABEL_LENGTH))}
                            helperText={`${customLabel.length}/${MAX_LABEL_LENGTH}`}
                            sx={{ mb: 1 }}
                        />
                        <TextField
                            fullWidth
                            size="small"
                            label="Prompt"
                            placeholder="e.g. Show recent failures in the auth-service pipeline"
                            value={customPrompt}
                            onChange={(e) => setCustomPrompt(e.target.value.slice(0, MAX_PROMPT_LENGTH))}
                            helperText={`${customPrompt.length}/${MAX_PROMPT_LENGTH}`}
                            multiline
                            minRows={2}
                            sx={{ mb: 1 }}
                        />
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button
                                size="small"
                                variant="contained"
                                disabled={!customLabel.trim() || !customPrompt.trim() || pins.length >= MAX_PINS}
                                onClick={addCustomPrompt}
                            >
                                Add
                            </Button>
                            <Button size="small" onClick={() => setAddingCustom(false)}>
                                Cancel
                            </Button>
                        </Box>
                    </Box>
                ) : (
                    <Button
                        size="small"
                        startIcon={<AddIcon />}
                        disabled={pins.length >= MAX_PINS}
                        onClick={() => setAddingCustom(true)}
                        sx={{ mt: 0.5 }}
                    >
                        Add custom prompt
                    </Button>
                )}

                {pins.length >= MAX_PINS && (
                    <Alert severity="info" sx={{ mt: 1.5, py: 0 }}>
                        Maximum {MAX_PINS} pinned prompts. Remove one to add another.
                    </Alert>
                )}
            </DialogContent>

            <DialogActions sx={{ justifyContent: 'space-between', px: 3, py: 1.5 }}>
                <Button
                    size="small"
                    color="inherit"
                    startIcon={<RestartAltIcon />}
                    onClick={handleReset}
                    disabled={resetMutation.isPending}
                >
                    Reset to defaults
                </Button>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button size="small" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        size="small"
                        variant="contained"
                        onClick={handleSave}
                        disabled={saveMutation.isPending}
                    >
                        {saveMutation.isPending ? 'Saving...' : 'Save'}
                    </Button>
                </Box>
            </DialogActions>
        </Dialog>
    );
}
