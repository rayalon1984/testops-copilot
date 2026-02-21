/**
 * ProviderPicker — In-chat AI provider configuration popover.
 *
 * Shows current provider as a clickable chip in the chat header.
 * Opens a popover to switch provider, model, and enter API key.
 * Supports test-connection and live hot-swap without page reload.
 */

import { useState, useEffect, useCallback } from 'react';
import {
    Box, Typography, Popover, Chip, Button, TextField,
    Select, MenuItem, InputLabel, FormControl, CircularProgress,
    IconButton, InputAdornment, Alert, useTheme,
} from '@mui/material';
import {
    Visibility, VisibilityOff,
    CheckCircle as ConnectedIcon,
    ErrorOutline as ErrorIcon,
    SwapHoriz as SwapIcon,
} from '@mui/icons-material';
import { api } from '../../api';

// ─── Provider catalog (mirrors backend PROVIDER_MODELS) ───

interface ModelEntry { id: string; label: string }
interface ProviderEntry { label: string; models: ModelEntry[] }

const PROVIDER_CATALOG: Record<string, ProviderEntry> = {
    mock: { label: 'Demo Mode', models: [{ id: 'mock-model', label: 'Mock (no API key)' }] },
    anthropic: {
        label: 'Anthropic',
        models: [
            { id: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
            { id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
            { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' },
        ],
    },
    openai: {
        label: 'OpenAI',
        models: [
            { id: 'gpt-4.1', label: 'GPT-4.1' },
            { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
            { id: 'gpt-4o', label: 'GPT-4o' },
            { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
        ],
    },
    google: {
        label: 'Google',
        models: [
            { id: 'gemini-3.0-pro', label: 'Gemini 3.0 Pro' },
            { id: 'gemini-3.0-flash', label: 'Gemini 3.0 Flash' },
        ],
    },
    azure: {
        label: 'Azure OpenAI',
        models: [
            { id: 'gpt-4.1', label: 'GPT-4.1' },
            { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
        ],
    },
    openrouter: {
        label: 'OpenRouter',
        models: [
            { id: 'anthropic/claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
            { id: 'openai/gpt-4.1', label: 'GPT-4.1' },
            { id: 'google/gemini-3.0-flash', label: 'Gemini 3.0 Flash' },
            { id: 'meta-llama/llama-4-maverick', label: 'Llama 4 Maverick' },
        ],
    },
};

const PROVIDER_ICONS: Record<string, string> = {
    mock: '\u2B21',         // hexagon
    anthropic: '\u2728',    // sparkles
    openai: '\u25CE',       // bullseye
    google: '\u25C6',       // diamond
    azure: '\u2601',        // cloud
    openrouter: '\u21C4',   // arrows
};

// ─── Types ───

interface ProviderConfig {
    provider: string;
    model: string;
    providerLabel: string;
    modelLabel: string;
    hasApiKey: boolean;
}

type TestStatus = 'idle' | 'testing' | 'success' | 'error';

// ─── Component ───

export default function ProviderPicker() {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    // Current active config (from backend)
    const [activeConfig, setActiveConfig] = useState<ProviderConfig>({
        provider: 'mock', model: 'mock-model',
        providerLabel: 'Demo Mode', modelLabel: 'Mock',
        hasApiKey: false,
    });

    // Form state
    const [provider, setProvider] = useState('mock');
    const [model, setModel] = useState('mock-model');
    const [apiKey, setApiKey] = useState('');
    const [showKey, setShowKey] = useState(false);
    const [testStatus, setTestStatus] = useState<TestStatus>('idle');
    const [testError, setTestError] = useState('');
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');

    // Popover anchor
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const open = Boolean(anchorEl);

    const fetchConfig = useCallback(async () => {
        try {
            const json = await api.get<{ data: ProviderConfig }>('/ai/config');
            setActiveConfig(json.data);
            setProvider(json.data.provider);
            setModel(json.data.model);
        } catch {
            // Silently fail — will show default
        }
    }, []);

    useEffect(() => { fetchConfig(); }, [fetchConfig]);

    // Reset model when provider changes
    useEffect(() => {
        const catalog = PROVIDER_CATALOG[provider];
        if (catalog && !catalog.models.some(m => m.id === model)) {
            setModel(catalog.models[0].id);
        }
    }, [provider, model]);

    const handleTest = async () => {
        setTestStatus('testing');
        setTestError('');
        try {
            const json = await api.post<{ data: { success: boolean; error?: string } }>('/ai/config/test', { provider, model, apiKey });
            if (json.data?.success) {
                setTestStatus('success');
            } else {
                setTestStatus('error');
                setTestError(json.data?.error || 'Connection failed');
            }
        } catch (err) {
            setTestStatus('error');
            setTestError(err instanceof Error ? err.message : 'Network error');
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setSaveError('');
        try {
            const json = await api.put<{ data: ProviderConfig }>('/ai/config', { provider, model, apiKey: apiKey || undefined });
            setActiveConfig(json.data);
            setApiKey('');
            setTestStatus('idle');
            setAnchorEl(null);
        } catch (err) {
            setSaveError(err instanceof Error ? err.message : 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    const catalog = PROVIDER_CATALOG[provider] || PROVIDER_CATALOG.mock;
    const needsKey = provider !== 'mock';
    const canSave = provider === 'mock' || activeConfig.hasApiKey || !!apiKey;
    const isChanged = provider !== activeConfig.provider || model !== activeConfig.model || !!apiKey;

    return (
        <>
            {/* Clickable provider badge */}
            <Chip
                icon={<span style={{ fontSize: '0.85rem' }}>{PROVIDER_ICONS[activeConfig.provider] || '\u2B21'}</span>}
                label={activeConfig.provider === 'mock'
                    ? 'Demo'
                    : `${activeConfig.providerLabel} \u00B7 ${activeConfig.modelLabel}`
                }
                size="small"
                variant="outlined"
                onClick={(e) => setAnchorEl(e.currentTarget)}
                sx={{
                    cursor: 'pointer',
                    fontSize: '0.7rem',
                    height: 26,
                    borderColor: activeConfig.provider === 'mock'
                        ? 'text.disabled'
                        : 'primary.main',
                    color: activeConfig.provider === 'mock'
                        ? 'text.secondary'
                        : 'primary.main',
                    '& .MuiChip-icon': { ml: 0.5 },
                    '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' },
                }}
            />

            {/* Configuration popover */}
            <Popover
                open={open}
                anchorEl={anchorEl}
                onClose={() => { setAnchorEl(null); setTestStatus('idle'); setTestError(''); setSaveError(''); }}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                slotProps={{ paper: { sx: { width: 320, p: 2.5, mt: 0.5, borderRadius: 2 } } }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <SwapIcon fontSize="small" color="primary" />
                    <Typography variant="subtitle2" fontWeight={600}>AI Provider</Typography>
                </Box>

                {/* Provider selector */}
                <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
                    <InputLabel>Provider</InputLabel>
                    <Select
                        value={provider}
                        label="Provider"
                        onChange={(e) => { setProvider(e.target.value); setTestStatus('idle'); }}
                    >
                        {Object.entries(PROVIDER_CATALOG).map(([key, entry]) => (
                            <MenuItem key={key} value={key}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <span style={{ fontSize: '0.85rem' }}>{PROVIDER_ICONS[key]}</span>
                                    {entry.label}
                                </Box>
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                {/* Model selector */}
                <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
                    <InputLabel>Model</InputLabel>
                    <Select
                        value={model}
                        label="Model"
                        onChange={(e) => { setModel(e.target.value); setTestStatus('idle'); }}
                    >
                        {catalog.models.map((m) => (
                            <MenuItem key={m.id} value={m.id}>{m.label}</MenuItem>
                        ))}
                    </Select>
                </FormControl>

                {/* API key field (hidden for mock) */}
                {needsKey && (
                    <TextField
                        fullWidth
                        size="small"
                        label="API Key"
                        type={showKey ? 'text' : 'password'}
                        value={apiKey}
                        onChange={(e) => { setApiKey(e.target.value); setTestStatus('idle'); }}
                        placeholder={activeConfig.hasApiKey && activeConfig.provider === provider
                            ? 'Using stored key (enter new to replace)'
                            : 'sk-...'}
                        sx={{ mb: 1.5 }}
                        InputProps={{
                            endAdornment: (
                                <InputAdornment position="end">
                                    <IconButton
                                        size="small"
                                        onClick={() => setShowKey(!showKey)}
                                        edge="end"
                                    >
                                        {showKey ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                                    </IconButton>
                                </InputAdornment>
                            ),
                        }}
                    />
                )}

                {/* Test connection status */}
                {testStatus === 'success' && (
                    <Alert severity="success" sx={{ mb: 1.5, py: 0 }} icon={<ConnectedIcon fontSize="small" />}>
                        Connected
                    </Alert>
                )}
                {testStatus === 'error' && (
                    <Alert severity="error" sx={{ mb: 1.5, py: 0 }} icon={<ErrorIcon fontSize="small" />}>
                        {testError}
                    </Alert>
                )}
                {saveError && (
                    <Alert severity="error" sx={{ mb: 1.5, py: 0 }}>
                        {saveError}
                    </Alert>
                )}

                {/* Actions */}
                <Box sx={{ display: 'flex', gap: 1 }}>
                    {needsKey && (
                        <Button
                            size="small"
                            variant="outlined"
                            onClick={handleTest}
                            disabled={testStatus === 'testing' || (!apiKey && !activeConfig.hasApiKey)}
                            sx={{ flex: 1, textTransform: 'none', fontSize: '0.8rem' }}
                        >
                            {testStatus === 'testing'
                                ? <CircularProgress size={16} sx={{ mr: 0.5 }} />
                                : null}
                            Test
                        </Button>
                    )}
                    <Button
                        size="small"
                        variant="contained"
                        onClick={handleSave}
                        disabled={saving || !canSave || !isChanged}
                        sx={{ flex: 1, textTransform: 'none', fontSize: '0.8rem' }}
                    >
                        {saving
                            ? <CircularProgress size={16} sx={{ mr: 0.5, color: 'inherit' }} />
                            : null}
                        Activate
                    </Button>
                </Box>

                <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1.5, textAlign: 'center', fontSize: '0.65rem' }}>
                    Keys are encrypted at rest. Switch providers instantly.
                </Typography>
            </Popover>
        </>
    );
}
