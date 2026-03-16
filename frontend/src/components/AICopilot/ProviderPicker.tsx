/**
 * ProviderPicker — In-chat AI provider configuration popover.
 *
 * Shows current provider as a clickable chip in the chat header.
 * Opens a popover to switch provider, model, and enter API key.
 * Supports test-connection and live hot-swap without page reload.
 */

import { useState, useEffect } from 'react';
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
import {
    useMyProviderConfig,
    useTestMyProviderConnection,
    useSaveMyProviderConfig,
    useDeleteMyProviderConfig,
} from '../../hooks/api';
import type { ProviderConfig } from '../../hooks/api';

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
    bedrock: {
        label: 'AWS Bedrock',
        models: [
            { id: 'eu.anthropic.claude-opus-4-6-v1', label: 'Claude Opus 4.6 (Bedrock)' },
            { id: 'eu.anthropic.claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (Bedrock)' },
            { id: 'eu.anthropic.claude-sonnet-4-5-20250929-v1:0', label: 'Claude Sonnet 4.5 (Bedrock)' },
            { id: 'eu.anthropic.claude-haiku-4-5-20251001-v1:0', label: 'Claude Haiku 4.5 (Bedrock)' },
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
    bedrock: '\u2B22',      // hexagon (AWS)
};

// ─── Types ───

type TestStatus = 'idle' | 'testing' | 'success' | 'error';

const DEFAULT_CONFIG: ProviderConfig = {
    provider: 'mock', model: 'mock-model',
    providerLabel: 'Demo Mode', modelLabel: 'Mock',
    hasApiKey: false,
};

// ─── Sub-components ───

/** Providers that work without an API key (mock = demo, bedrock = IAM role auth on AWS) */
const NO_KEY_PROVIDERS = new Set(['mock', 'bedrock']);

function ProviderPopoverBody({ provider, setProvider, model, setModel, catalog, needsKey, isBedrock, apiKey, setApiKey, bedrockRegion, setBedrockRegion, bedrockAccessKeyId, setBedrockAccessKeyId, bedrockSecretAccessKey, setBedrockSecretAccessKey, showKey, setShowKey, activeConfig, testStatus, setTestStatus, testError, saveError, handleTest, handleSave, saving, canSave, isChanged }: {
    provider: string; setProvider: (v: string) => void; model: string; setModel: (v: string) => void;
    catalog: ProviderEntry; needsKey: boolean; isBedrock: boolean;
    apiKey: string; setApiKey: (v: string) => void;
    bedrockRegion: string; setBedrockRegion: (v: string) => void;
    bedrockAccessKeyId: string; setBedrockAccessKeyId: (v: string) => void;
    bedrockSecretAccessKey: string; setBedrockSecretAccessKey: (v: string) => void;
    showKey: boolean; setShowKey: (v: boolean) => void; activeConfig: ProviderConfig;
    testStatus: TestStatus; setTestStatus: (v: TestStatus) => void; testError: string; saveError: string;
    handleTest: () => void; handleSave: () => void; saving: boolean; canSave: boolean; isChanged: boolean;
}) {
    return (
        <>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <SwapIcon fontSize="small" color="primary" />
                <Typography variant="subtitle2" fontWeight={600}>AI Provider</Typography>
            </Box>

            <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
                <InputLabel>Provider</InputLabel>
                <Select value={provider} label="Provider" onChange={(e) => { setProvider(e.target.value); setTestStatus('idle'); }}>
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

            <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
                <InputLabel>Model</InputLabel>
                <Select value={model} label="Model" onChange={(e) => { setModel(e.target.value); setTestStatus('idle'); }}>
                    {catalog.models.map((m) => (
                        <MenuItem key={m.id} value={m.id}>{m.label}</MenuItem>
                    ))}
                </Select>
            </FormControl>

            {needsKey && (
                <TextField
                    fullWidth size="small" label="API Key" type={showKey ? 'text' : 'password'}
                    value={apiKey} onChange={(e) => { setApiKey(e.target.value); setTestStatus('idle'); }}
                    placeholder={activeConfig.hasApiKey && activeConfig.provider === provider ? 'Using stored key (enter new to replace)' : 'sk-...'}
                    sx={{ mb: 1.5 }}
                    InputProps={{
                        endAdornment: (
                            <InputAdornment position="end">
                                <IconButton size="small" onClick={() => setShowKey(!showKey)} edge="end">
                                    {showKey ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                                </IconButton>
                            </InputAdornment>
                        ),
                    }}
                />
            )}

            {isBedrock && (
                <>
                    <TextField
                        fullWidth size="small" label="AWS Region"
                        value={bedrockRegion} onChange={(e) => { setBedrockRegion(e.target.value); setTestStatus('idle'); }}
                        placeholder="eu-west-1"
                        sx={{ mb: 1.5 }}
                    />
                    <Alert severity="info" sx={{ mb: 1.5, py: 0, fontSize: '0.75rem' }}>
                        On AWS VMs, IAM role auth is used automatically. Only fill credentials below for non-AWS environments.
                    </Alert>
                    <TextField
                        fullWidth size="small" label="Access Key ID (optional)"
                        value={bedrockAccessKeyId} onChange={(e) => { setBedrockAccessKeyId(e.target.value); setTestStatus('idle'); }}
                        placeholder="AKIA..."
                        sx={{ mb: 1.5 }}
                    />
                    <TextField
                        fullWidth size="small" label="Secret Access Key (optional)" type={showKey ? 'text' : 'password'}
                        value={bedrockSecretAccessKey} onChange={(e) => { setBedrockSecretAccessKey(e.target.value); setTestStatus('idle'); }}
                        placeholder="Leave empty for IAM role auth"
                        sx={{ mb: 1.5 }}
                        InputProps={{
                            endAdornment: (
                                <InputAdornment position="end">
                                    <IconButton size="small" onClick={() => setShowKey(!showKey)} edge="end">
                                        {showKey ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                                    </IconButton>
                                </InputAdornment>
                            ),
                        }}
                    />
                </>
            )}

            {testStatus === 'success' && (
                <Alert severity="success" sx={{ mb: 1.5, py: 0 }} icon={<ConnectedIcon fontSize="small" />}>Connected</Alert>
            )}
            {testStatus === 'error' && (
                <Alert severity="error" sx={{ mb: 1.5, py: 0 }} icon={<ErrorIcon fontSize="small" />}>{testError}</Alert>
            )}
            {saveError && (
                <Alert severity="error" sx={{ mb: 1.5, py: 0 }}>{saveError}</Alert>
            )}

            <Box sx={{ display: 'flex', gap: 1 }}>
                <Button size="small" variant="outlined" onClick={handleTest} disabled={testStatus === 'testing' || (needsKey && !apiKey && !activeConfig.hasApiKey)} sx={{ flex: 1, textTransform: 'none', fontSize: '0.8rem' }}>
                    {testStatus === 'testing' ? <CircularProgress size={16} sx={{ mr: 0.5 }} /> : null}
                    Test
                </Button>
                <Button size="small" variant="contained" onClick={handleSave} disabled={saving || !canSave || !isChanged} sx={{ flex: 1, textTransform: 'none', fontSize: '0.8rem' }}>
                    {saving ? <CircularProgress size={16} sx={{ mr: 0.5, color: 'inherit' }} /> : null}
                    Activate
                </Button>
            </Box>

            <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1.5, textAlign: 'center', fontSize: '0.65rem' }}>
                Keys are encrypted at rest. Switch providers instantly.
            </Typography>
        </>
    );
}

// ─── Component ───

export default function ProviderPicker() {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    // Server state via React Query (per-user config)
    const { data: activeConfig = DEFAULT_CONFIG } = useMyProviderConfig();
    const testMutation = useTestMyProviderConnection();
    const saveMutation = useSaveMyProviderConfig();
    const deleteMutation = useDeleteMyProviderConfig();

    // Form state (local UI)
    const [provider, setProvider] = useState('mock');
    const [model, setModel] = useState('mock-model');
    const [apiKey, setApiKey] = useState('');
    const [showKey, setShowKey] = useState(false);
    const [testStatus, setTestStatus] = useState<TestStatus>('idle');
    const [testError, setTestError] = useState('');
    const [saveError, setSaveError] = useState('');

    // Bedrock-specific fields
    const [bedrockRegion, setBedrockRegion] = useState('eu-west-1');
    const [bedrockAccessKeyId, setBedrockAccessKeyId] = useState('');
    const [bedrockSecretAccessKey, setBedrockSecretAccessKey] = useState('');

    // Popover anchor
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const open = Boolean(anchorEl);

    // Sync form when server config changes
    useEffect(() => {
        if (activeConfig) {
            setProvider(activeConfig.provider);
            setModel(activeConfig.model);
            if (activeConfig.extraConfig?.region) setBedrockRegion(activeConfig.extraConfig.region);
        }
    }, [activeConfig]);

    // Reset model when provider changes
    useEffect(() => {
        const catalog = PROVIDER_CATALOG[provider];
        if (catalog && !catalog.models.some(m => m.id === model)) {
            setModel(catalog.models[0].id);
        }
    }, [provider, model]);

    const isBedrock = provider === 'bedrock';

    /** Build extraConfig for providers that need it */
    const buildExtraConfig = (): Record<string, string> | undefined => {
        if (!isBedrock) return undefined;
        const extra: Record<string, string> = { region: bedrockRegion };
        if (bedrockAccessKeyId) extra.accessKeyId = bedrockAccessKeyId;
        if (bedrockSecretAccessKey) extra.secretAccessKey = bedrockSecretAccessKey;
        return extra;
    };

    const handleTest = () => {
        setTestStatus('testing');
        setTestError('');
        testMutation.mutate({ provider, model, apiKey: apiKey || 'bedrock-iam-auth', extraConfig: buildExtraConfig() }, {
            onSuccess: (data) => {
                if (data?.success) {
                    setTestStatus('success');
                } else {
                    setTestStatus('error');
                    setTestError(data?.error || 'Connection failed');
                }
            },
            onError: (err) => {
                setTestStatus('error');
                setTestError(err instanceof Error ? err.message : 'Network error');
            },
        });
    };

    const handleSave = () => {
        setSaveError('');
        saveMutation.mutate({ provider, model, apiKey: apiKey || undefined, extraConfig: buildExtraConfig() }, {
            onSuccess: () => {
                setApiKey('');
                setBedrockAccessKeyId('');
                setBedrockSecretAccessKey('');
                setTestStatus('idle');
                setAnchorEl(null);
            },
            onError: (err) => {
                setSaveError(err instanceof Error ? err.message : 'Save failed');
            },
        });
    };

    const handleReset = () => {
        setSaveError('');
        deleteMutation.mutate(undefined, {
            onSuccess: () => {
                setApiKey('');
                setBedrockAccessKeyId('');
                setBedrockSecretAccessKey('');
                setTestStatus('idle');
                setAnchorEl(null);
            },
            onError: (err) => {
                setSaveError(err instanceof Error ? err.message : 'Reset failed');
            },
        });
    };

    const catalog = PROVIDER_CATALOG[provider] || PROVIDER_CATALOG.mock;
    const needsKey = !NO_KEY_PROVIDERS.has(provider);
    const canSave = NO_KEY_PROVIDERS.has(provider) || activeConfig.hasApiKey || !!apiKey;
    const isChanged = provider !== activeConfig.provider || model !== activeConfig.model || !!apiKey || (isBedrock && (!!bedrockAccessKeyId || !!bedrockSecretAccessKey));

    return (
        <>
            {/* Clickable provider badge */}
            <Chip
                icon={<span style={{ fontSize: '0.85rem' }}>{PROVIDER_ICONS[activeConfig.provider] || '\u2B21'}</span>}
                label={activeConfig.provider === 'mock'
                    ? 'Demo'
                    : activeConfig.modelLabel.replace(/\s*\(Bedrock\)/, '')
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
                <ProviderPopoverBody
                    provider={provider} setProvider={setProvider} model={model} setModel={setModel}
                    catalog={catalog} needsKey={needsKey} isBedrock={isBedrock}
                    apiKey={apiKey} setApiKey={setApiKey}
                    bedrockRegion={bedrockRegion} setBedrockRegion={setBedrockRegion}
                    bedrockAccessKeyId={bedrockAccessKeyId} setBedrockAccessKeyId={setBedrockAccessKeyId}
                    bedrockSecretAccessKey={bedrockSecretAccessKey} setBedrockSecretAccessKey={setBedrockSecretAccessKey}
                    showKey={showKey} setShowKey={setShowKey} activeConfig={activeConfig}
                    testStatus={testStatus} setTestStatus={setTestStatus} testError={testError} saveError={saveError}
                    handleTest={handleTest} handleSave={handleSave} saving={saveMutation.isPending} canSave={canSave} isChanged={isChanged}
                />

                {activeConfig.isPersonal && (
                    <Button
                        size="small"
                        color="warning"
                        onClick={handleReset}
                        disabled={deleteMutation.isPending}
                        sx={{ mt: 1, textTransform: 'none', fontSize: '0.75rem', width: '100%' }}
                    >
                        {deleteMutation.isPending ? <CircularProgress size={14} sx={{ mr: 0.5 }} /> : null}
                        Reset to system default
                    </Button>
                )}

                <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.5, textAlign: 'center', fontSize: '0.6rem' }}>
                    {activeConfig.isPersonal ? 'Personal config' : 'Using system default'}
                </Typography>
            </Popover>
        </>
    );
}
