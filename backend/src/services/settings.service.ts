import { prisma } from '../lib/prisma';
import { NotFoundError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export interface Settings {
  notifications: {
    slack: { enabled: boolean; webhookUrl: string };
    email: { enabled: boolean; recipients: string[] };
  };
  cicd: {
    jenkins: { enabled: boolean; url: string; username: string; apiToken: string };
    github: { enabled: boolean; apiToken: string; repositories: string[] };
  };
  general: {
    autoRefresh: boolean;
    refreshInterval: number;
    theme: 'light' | 'dark';
  };
}

const DEFAULT_SETTINGS: Settings = {
  notifications: {
    slack: { enabled: false, webhookUrl: '' },
    email: { enabled: false, recipients: [] },
  },
  cicd: {
    jenkins: { enabled: false, url: '', username: '', apiToken: '' },
    github: { enabled: false, apiToken: '', repositories: [] },
  },
  general: {
    autoRefresh: false,
    refreshInterval: 30,
    theme: 'dark',
  },
};

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] !== null &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      typeof target[key] === 'object' &&
      target[key] !== null &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(
        target[key] as Record<string, unknown>,
        source[key] as Record<string, unknown>,
      );
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

class SettingsServiceImpl {
  async getSettings(userId: string): Promise<Settings> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User not found');

    const stored = (user.settings ?? {}) as Record<string, unknown>;
    return deepMerge(
      DEFAULT_SETTINGS as unknown as Record<string, unknown>,
      stored,
    ) as unknown as Settings;
  }

  async updateSettings(userId: string, partial: Record<string, unknown>): Promise<Settings> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User not found');

    const existing = (user.settings ?? {}) as Record<string, unknown>;
    const merged = deepMerge(existing, partial);

    await prisma.user.update({
      where: { id: userId },
      data: { settings: merged },
    });

    logger.info(`Settings updated for user ${userId}`);

    return deepMerge(
      DEFAULT_SETTINGS as unknown as Record<string, unknown>,
      merged,
    ) as unknown as Settings;
  }
}

export const settingsService = new SettingsServiceImpl();
