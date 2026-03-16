/**
 * Per-User AI Provider Configuration Service
 *
 * Each user can store their own AI credentials. When present, the user's
 * config is used instead of the global singleton. Encryption reuses the
 * same AES-256-GCM helpers from provider-config.service.ts.
 */

import { prisma } from '@/lib/prisma';
import { AIProviderName } from './types';
import {
    encryptApiKey,
    decryptApiKey,
    getProviderConfig,
    PROVIDER_MODELS,
    ProviderConfigPublic,
    ProviderConfigUpdate,
    testProviderConnection,
} from './provider-config.service';
import { providerRegistry } from './providers/registry';
import { BaseProvider, ProviderConfig } from './providers/base.provider';
import { logger } from '@/utils/logger';

// Re-export for convenience
export { testProviderConnection, PROVIDER_MODELS };

export interface UserProviderConfigPublic extends ProviderConfigPublic {
    isPersonal: boolean;
}

// ─── CRUD ───

export async function getUserProviderConfig(userId: string): Promise<UserProviderConfigPublic> {
    const row = await prisma.userAIConfig.findUnique({ where: { userId } });

    if (!row) {
        const global = await getProviderConfig();
        return { ...global, isPersonal: false };
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
        isPersonal: true,
    };
}

export async function updateUserProviderConfig(
    userId: string,
    update: ProviderConfigUpdate,
): Promise<UserProviderConfigPublic> {
    const encryptedKey = update.apiKey ? encryptApiKey(update.apiKey) : undefined;

    await prisma.userAIConfig.upsert({
        where: { userId },
        create: {
            userId,
            provider: update.provider,
            model: update.model,
            apiKey: encryptedKey,
            extraConfig: update.extraConfig ? JSON.stringify(update.extraConfig) : null,
        },
        update: {
            provider: update.provider,
            model: update.model,
            ...(encryptedKey !== undefined ? { apiKey: encryptedKey } : {}),
            extraConfig: update.extraConfig ? JSON.stringify(update.extraConfig) : undefined,
        },
    });

    logger.info(`[UserProviderConfig] User ${userId} updated config to ${update.provider}/${update.model}`);
    return getUserProviderConfig(userId);
}

export async function deleteUserProviderConfig(userId: string): Promise<void> {
    await prisma.userAIConfig.deleteMany({ where: { userId } });
    logger.info(`[UserProviderConfig] User ${userId} deleted personal config, reverting to global`);
}

// ─── Provider factory ───

export async function createProviderForUser(
    userId: string,
): Promise<{ provider: BaseProvider; providerName: AIProviderName } | null> {
    const row = await prisma.userAIConfig.findUnique({ where: { userId } });
    if (!row) return null;

    const providerName = row.provider as AIProviderName;
    const apiKey = row.apiKey ? decryptApiKey(row.apiKey) : '';
    const extra: Record<string, string> = row.extraConfig ? JSON.parse(row.extraConfig) : {};

    const config: ProviderConfig & Record<string, unknown> = {
        apiKey: providerName === 'mock' ? 'mock-key' : apiKey,
        model: row.model,
        maxTokens: 4096,
        temperature: 0.3,
        timeout: 60000,
    };

    switch (providerName) {
        case 'azure':
            config.endpoint = extra.endpoint || '';
            config.deploymentName = extra.deploymentName || row.model;
            break;
        case 'openrouter':
            config.siteUrl = extra.siteUrl || '';
            config.appName = extra.appName || 'TestOps Copilot';
            break;
        case 'bedrock':
            config.region = extra.region || 'us-east-1';
            config.accessKeyId = extra.accessKeyId;
            config.secretAccessKey = extra.secretAccessKey;
            config.embeddingModel = extra.embeddingModel;
            break;
    }

    const provider = providerRegistry.createFresh(providerName, config);
    return { provider, providerName };
}
