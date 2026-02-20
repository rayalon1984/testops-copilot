/**
 * AI Provider Configuration Service
 *
 * Manages runtime AI provider configuration stored in the database.
 * API keys are encrypted at rest using AES-256-GCM.
 * Supports hot-swapping the active provider without server restart.
 */

import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { AIProviderName } from './types';
import { getConfigManager } from './config';
import { providerRegistry } from './providers/registry';
import { getAIManager } from './manager';
import { logger } from '@/utils/logger';

// ─── Encryption ───

const ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_SECRET = process.env.AI_CONFIG_ENCRYPTION_KEY || 'testops-companion-default-enc-key';

function deriveKey(): Buffer {
    return crypto.scryptSync(ENCRYPTION_SECRET, 'testops-ai-salt', 32);
}

export function encryptApiKey(plaintext: string): string {
    const iv = crypto.randomBytes(16);
    const key = deriveKey();
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decryptApiKey(ciphertext: string): string {
    const [ivHex, authTagHex, encrypted] = ciphertext.split(':');
    if (!ivHex || !authTagHex || !encrypted) {
        throw new Error('Invalid encrypted key format');
    }
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const key = deriveKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

// ─── Provider model catalogs (shared with frontend) ───

export const PROVIDER_MODELS: Record<string, { label: string; models: { id: string; label: string }[] }> = {
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
            { id: 'us.anthropic.claude-opus-4-20250514-v1:0', label: 'Claude Opus 4 (Bedrock)' },
            { id: 'anthropic.claude-sonnet-4-5-20250514-v1:0', label: 'Claude Sonnet 4.5 (Bedrock)' },
            { id: 'anthropic.claude-haiku-4-5-20250514-v1:0', label: 'Claude Haiku 4.5 (Bedrock)' },
        ],
    },
};

// ─── Public DTOs ───

export interface ProviderConfigPublic {
    provider: string;
    model: string;
    providerLabel: string;
    modelLabel: string;
    hasApiKey: boolean;
    extraConfig?: Record<string, string>;
    updatedAt: string | null;
}

export interface ProviderConfigUpdate {
    provider: AIProviderName;
    model: string;
    apiKey?: string;        // plaintext — encrypted before storage
    extraConfig?: Record<string, string>; // azure endpoint, etc.
}

// ─── CRUD ───

const SINGLETON_ID = 'singleton';

/**
 * Get the current provider configuration (safe — no secrets).
 */
export async function getProviderConfig(): Promise<ProviderConfigPublic> {
    const row = await prisma.aIProviderConfig.findUnique({ where: { id: SINGLETON_ID } });

    if (!row) {
        // No DB config → return current env-based defaults
        const cm = getConfigManager();
        const provider = cm.getProvider();
        const model = cm.getModel();
        const catalog = PROVIDER_MODELS[provider] || PROVIDER_MODELS.mock;
        const modelEntry = catalog.models.find(m => m.id === model) || catalog.models[0];

        return {
            provider,
            model,
            providerLabel: catalog.label,
            modelLabel: modelEntry?.label || model,
            hasApiKey: provider === 'mock' || !!cm.getApiKeyForProvider(provider),
            updatedAt: null,
        };
    }

    const catalog = PROVIDER_MODELS[row.provider] || PROVIDER_MODELS.mock;
    const modelEntry = catalog.models.find(m => m.id === row.model) || catalog.models[0];

    return {
        provider: row.provider,
        model: row.model,
        providerLabel: catalog.label,
        modelLabel: modelEntry?.label || row.model,
        hasApiKey: row.provider === 'mock' || !!row.apiKey,
        extraConfig: row.extraConfig ? JSON.parse(row.extraConfig) : undefined,
        updatedAt: row.updatedAt.toISOString(),
    };
}

/**
 * Update provider configuration + hot-swap the active provider.
 */
export async function updateProviderConfig(
    update: ProviderConfigUpdate,
    userId: string,
): Promise<ProviderConfigPublic> {
    const encryptedKey = update.apiKey ? encryptApiKey(update.apiKey) : undefined;

    // Upsert the singleton row
    const row = await prisma.aIProviderConfig.upsert({
        where: { id: SINGLETON_ID },
        create: {
            id: SINGLETON_ID,
            provider: update.provider,
            model: update.model,
            apiKey: encryptedKey,
            extraConfig: update.extraConfig ? JSON.stringify(update.extraConfig) : null,
            updatedBy: userId,
        },
        update: {
            provider: update.provider,
            model: update.model,
            // Only overwrite key if a new one was provided
            ...(encryptedKey !== undefined ? { apiKey: encryptedKey } : {}),
            extraConfig: update.extraConfig ? JSON.stringify(update.extraConfig) : undefined,
            updatedBy: userId,
        },
    });

    // Hot-swap the active provider
    await applyProviderConfig(row.provider as AIProviderName, row.model, update.apiKey, update.extraConfig);

    logger.info(`[ProviderConfig] Provider updated to ${row.provider}/${row.model} by ${userId}`);

    return getProviderConfig();
}

/**
 * Test a provider connection without saving.
 */
export async function testProviderConnection(
    provider: AIProviderName,
    model: string,
    apiKey: string,
    extraConfig?: Record<string, string>,
): Promise<{ success: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
        const config: Record<string, unknown> = {
            apiKey: provider === 'mock' ? 'mock-key' : apiKey,
            model,
            maxTokens: 32,
            temperature: 0,
            timeout: 15000,
        };

        if (provider === 'azure') {
            config.endpoint = extraConfig?.endpoint || '';
            config.deploymentName = extraConfig?.deploymentName || model;
        }
        if (provider === 'openrouter') {
            config.siteUrl = extraConfig?.siteUrl || '';
            config.appName = extraConfig?.appName || 'TestOps Companion';
        }
        if (provider === 'bedrock') {
            config.region = extraConfig?.region || 'us-east-1';
            config.accessKeyId = extraConfig?.accessKeyId;
            config.secretAccessKey = extraConfig?.secretAccessKey;
        }

        const instance = providerRegistry.getProvider(provider, config as unknown as import('./providers/base.provider').ProviderConfig);
        const healthy = await instance.healthCheck();

        // Clear this test instance from cache so it doesn't interfere
        providerRegistry.clearCache();

        return {
            success: healthy,
            latencyMs: Date.now() - start,
            error: healthy ? undefined : 'Health check returned false',
        };
    } catch (err) {
        providerRegistry.clearCache();
        return {
            success: false,
            latencyMs: Date.now() - start,
            error: err instanceof Error ? err.message : 'Connection test failed',
        };
    }
}

/**
 * Load DB-stored config on server startup and apply if present.
 */
export async function loadProviderConfigFromDB(): Promise<void> {
    try {
        const row = await prisma.aIProviderConfig.findUnique({ where: { id: SINGLETON_ID } });
        if (!row || row.provider === 'mock') {
            logger.info('[ProviderConfig] No DB config or mock — using env-based config');
            return;
        }

        const apiKey = row.apiKey ? decryptApiKey(row.apiKey) : '';
        const extra = row.extraConfig ? JSON.parse(row.extraConfig) : undefined;

        await applyProviderConfig(row.provider as AIProviderName, row.model, apiKey, extra);
        logger.info(`[ProviderConfig] Loaded DB config: ${row.provider}/${row.model}`);
    } catch (err) {
        logger.warn('[ProviderConfig] Failed to load DB config, falling back to env:', err);
    }
}

// ─── Internal hot-swap ───

async function applyProviderConfig(
    provider: AIProviderName,
    model: string,
    apiKey?: string,
    extraConfig?: Record<string, string>,
): Promise<void> {
    const cm = getConfigManager();

    // Build the override for the config manager
    const secretsKey = getSecretsKeyForProvider(provider);
    const secretsOverride: Record<string, string> = {};
    if (apiKey && secretsKey) {
        secretsOverride[secretsKey] = apiKey;
    }
    if (provider === 'azure' && extraConfig) {
        if (extraConfig.endpoint) secretsOverride.azureOpenaiEndpoint = extraConfig.endpoint;
        if (extraConfig.deploymentName) secretsOverride.azureDeploymentName = extraConfig.deploymentName;
    }
    if (provider === 'openrouter' && extraConfig) {
        if (extraConfig.siteUrl) secretsOverride.openrouterSiteUrl = extraConfig.siteUrl;
        if (extraConfig.appName) secretsOverride.openrouterAppName = extraConfig.appName;
    }
    if (provider === 'bedrock' && extraConfig) {
        if (extraConfig.region) secretsOverride.bedrockRegion = extraConfig.region;
        if (extraConfig.accessKeyId) secretsOverride.bedrockAccessKeyId = extraConfig.accessKeyId;
        if (extraConfig.secretAccessKey) secretsOverride.bedrockSecretAccessKey = extraConfig.secretAccessKey;
    }

    // Apply runtime override to config manager
    cm.applyRuntimeOverride({
        enabled: true,
        provider,
        model,
        providerSecrets: secretsOverride as Partial<import('./types').AIConfig['providerSecrets']>,
    });

    // Clear cached provider instances so next request creates a fresh one
    providerRegistry.clearCache();

    // Force AIManager to rebuild its provider reference
    try {
        const manager = getAIManager();
        // Use internal accessors to hot-swap provider — AIManager exposes these for runtime reconfiguration
        const managerInternal = manager as unknown as { provider: import('./providers/base.provider').BaseProvider; configManager: import('./config').AIConfigManager };
        managerInternal.provider = providerRegistry.createFromConfig(cm);
        managerInternal.configManager = cm;
    } catch {
        // AIManager may not be initialized yet (startup path)
    }
}

function getSecretsKeyForProvider(provider: AIProviderName): string | null {
    const map: Record<string, string> = {
        anthropic: 'anthropicApiKey',
        openai: 'openaiApiKey',
        google: 'googleApiKey',
        azure: 'azureOpenaiKey',
        openrouter: 'openrouterApiKey',
        bedrock: 'bedrockAccessKeyId',
    };
    return map[provider] || null;
}
