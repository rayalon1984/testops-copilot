/**
 * StarterPromptSettings — Popover/dialog for customizing starter prompts.
 *
 * Users can pin/unpin prompts from their role catalog, add custom prompts,
 * reorder pins, and reset to defaults.
 */

import { useState, useEffect, useCallback } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Box, Typography, Button,
    Chip, Divider, Alert,
} from '@mui/material';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import {
    useStarterPromptCatalog,
    useSavePinnedPrompts,
    useResetPinnedPrompts,
    useStarterPrompts,
    type PinnedPromptEntry,
    type StarterPrompt,
} from '../../hooks/api/useStarterPrompts';
import { PinnedPromptsList, RoleCatalogList, CustomPromptForm } from './StarterPromptSettingsSections';

const MAX_PINS = 4;

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

    const isPinned = useCallback(
        (promptId: string) => pins.some(p => p.id === promptId), [pins],
    );

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

    const removePin = useCallback((index: number) => setPins(prev => prev.filter((_, i) => i !== index)), []);

    const movePin = useCallback((index: number, direction: 'up' | 'down') => {
        setPins(prev => {
            const newPins = [...prev];
            const targetIndex = direction === 'up' ? index - 1 : index + 1;
            if (targetIndex < 0 || targetIndex >= newPins.length) return prev;
            [newPins[index], newPins[targetIndex]] = [newPins[targetIndex], newPins[index]];
            return newPins;
        });
    }, []);

    const handleSave = async () => { await saveMutation.mutateAsync(pins); onClose(); };
    const handleReset = async () => { await resetMutation.mutateAsync(); setPins([]); onClose(); };
    const rolePrompts = catalog?.rolePrompts ?? [];
    const pinsAtMax = pins.length >= MAX_PINS;

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
                    color={pinsAtMax ? 'warning' : 'default'}
                />
            </DialogTitle>

            <DialogContent dividers>
                <PinnedPromptsList pins={pins} onMove={movePin} onRemove={removePin} />

                <Divider sx={{ my: 1.5 }} />

                <RoleCatalogList
                    rolePrompts={rolePrompts}
                    catalogLoading={catalogLoading}
                    isPinned={isPinned}
                    onTogglePin={togglePin}
                />

                <Divider sx={{ my: 1.5 }} />

                <CustomPromptForm
                    addingCustom={addingCustom}
                    onSetAddingCustom={setAddingCustom}
                    customLabel={customLabel}
                    onSetCustomLabel={setCustomLabel}
                    customPrompt={customPrompt}
                    onSetCustomPrompt={setCustomPrompt}
                    onAdd={addCustomPrompt}
                    pinsAtMax={pinsAtMax}
                />

                {pinsAtMax && (
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
