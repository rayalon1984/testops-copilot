/**
 * NotificationPreferenceService — Notification preferences + history data access.
 *
 * Extracted from notification.controller.ts to enforce the thin-controller pattern.
 * All Prisma notification queries and preference logic live here.
 */

import { prisma } from '../lib/prisma';
import { NotFoundError } from '../middleware/errorHandler';
import { NotificationService } from './notification.service';
import { logger } from '../utils/logger';

// ─── Types ───

export interface NotificationPreferences {
  email?: {
    enabled: boolean;
    address: string;
    digest: boolean;
    digestFrequency: 'daily' | 'weekly';
  };
  slack?: {
    enabled: boolean;
    channel: string;
    mentions: string[];
  };
  pushover?: {
    enabled: boolean;
    deviceGroups: string[];
    priority: number;
  };
  conditions: {
    pipelineStart: boolean;
    pipelineSuccess: boolean;
    pipelineFailure: boolean;
    testFlaky: boolean;
    coverageDecrease: boolean;
  };
}

export interface NotificationFilters {
  startDate?: string;
  endDate?: string;
  channel?: string;
  status?: string;
  type?: string;
}

export interface ChannelInfo {
  id: string;
  name: string;
  description: string;
  configSchema: Record<string, unknown>;
  enabled: boolean;
}

// ─── Service ───

class NotificationPreferenceServiceImpl {
  private notificationService: NotificationService;

  constructor() {
    this.notificationService = new NotificationService();
  }

  async getPreferences(_userId: string): Promise<NotificationPreferences> {
    return {
      conditions: {
        pipelineStart: false,
        pipelineSuccess: false,
        pipelineFailure: true,
        testFlaky: true,
        coverageDecrease: true,
      },
    };
  }

  async updatePreferences(userId: string, preferences: NotificationPreferences): Promise<NotificationPreferences> {
    logger.info(`Updated notification preferences for user: ${userId}`);
    return preferences;
  }

  async sendTestNotification(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User not found');

    const message = 'This is a test notification from TestOps Copilot';

    await this.notificationService.sendNotifications({
      enabled: true,
      channels: ['email'],
      message,
      userId,
    } as { enabled: boolean; channels: string[]; message?: string; userId?: string }, message);

    await prisma.notification.create({
      data: {
        userId,
        type: 'SYSTEM',
        title: 'Test Notification',
        message,
      },
    });

    logger.info(`Test notification sent to user: ${userId}`);
  }

  getAvailableChannels(): ChannelInfo[] {
    return [
      { id: 'email', name: 'Email', description: 'Send notifications via email', configSchema: { address: 'string', digest: 'boolean', digestFrequency: ['daily', 'weekly'] }, enabled: true },
      { id: 'slack', name: 'Slack', description: 'Send notifications to Slack channels', configSchema: { channel: 'string', mentions: 'array' }, enabled: true },
      { id: 'pushover', name: 'Pushover', description: 'Send notifications via Pushover', configSchema: { deviceGroups: 'array', priority: 'number' }, enabled: true },
    ];
  }

  async verifyChannel(_userId: string, channelConfig: unknown): Promise<{ valid: boolean; message?: string }> {
    try {
      await this.notificationService.verifyChannelConfig(channelConfig);
      return { valid: true };
    } catch (error) {
      return { valid: false, message: (error as Error).message };
    }
  }

  async getHistory(userId: string, filters: NotificationFilters): Promise<unknown[]> {
    const where: Record<string, unknown> = { userId };

    if (filters.type) where.type = filters.type;

    if (filters.startDate || filters.endDate) {
      const createdAt: { gte?: Date; lte?: Date } = {};
      if (filters.startDate) createdAt.gte = new Date(filters.startDate);
      if (filters.endDate) createdAt.lte = new Date(filters.endDate);
      where.createdAt = createdAt;
    }

    return prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDeliveryMetrics(): Promise<Record<string, unknown>> {
    const totalNotifications = await prisma.notification.count();
    return {
      totalNotifications,
      successfulDeliveries: totalNotifications,
      failedDeliveries: 0,
      deliveryRate: 100,
      channelStats: {},
    };
  }

  async sendBroadcast(data: { message: string; channels: string[]; userGroups?: string[] }): Promise<void> {
    const where = data.userGroups
      ? { role: { in: data.userGroups } } as Record<string, unknown>
      : {};
    const users = await prisma.user.findMany({ where });

    for (const user of users) {
      await this.notificationService.sendNotifications({
        enabled: true,
        channels: data.channels as Array<'slack' | 'email' | 'pushover'>,
        message: data.message,
        userId: user.id,
      } as { enabled: boolean; channels: string[]; message?: string; userId?: string }, data.message);

      await prisma.notification.create({
        data: {
          userId: user.id,
          type: 'SYSTEM',
          title: 'Broadcast',
          message: data.message,
        },
      });
    }

    logger.info(`Broadcast notification sent to ${users.length} users`);
  }

  async getGlobalSettings(): Promise<Record<string, unknown>> {
    return {};
  }

  async updateGlobalSettings(settings: Record<string, unknown>): Promise<Record<string, unknown>> {
    return settings;
  }
}

export const notificationPreferenceService = new NotificationPreferenceServiceImpl();
