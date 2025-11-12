import { sequelize } from '@/database';
import { User } from '@/models/user.model';
import { NotificationPreference } from '@/models/notificationPreference.model';
import { NotificationHistory } from '@/models/notificationHistory.model';
import { NotFoundError } from '@/middleware/errorHandler';
import { NotificationService } from '@/services/notification.service';
import { logger } from '@/utils/logger';

interface NotificationPreferences {
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

interface NotificationFilters {
  startDate?: string;
  endDate?: string;
  channel?: string;
  status?: string;
  type?: string;
}

export class NotificationController {
  private notificationService: NotificationService;

  constructor() {
    this.notificationService = new NotificationService();
  }

  async getPreferences(userId: string): Promise<NotificationPreferences> {
    const preferences = await NotificationPreference.findOne({
      where: { userId },
    });

    if (!preferences) {
      // Return default preferences
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

    return preferences.preferences;
  }

  async updatePreferences(userId: string, preferences: NotificationPreferences): Promise<NotificationPreferences> {
    const [preference] = await NotificationPreference.upsert({
      userId,
      preferences,
    });

    logger.info(`Updated notification preferences for user: ${userId}`);
    return preference.preferences;
  }

  async sendTestNotification(userId: string): Promise<void> {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const preferences = await this.getPreferences(userId);
    const testMessage = 'This is a test notification from TestOps Companion';

    // @ts-expect-error - Private method access needed for testing
    await this.notificationService.sendNotifications({
      enabled: true,
      channels: Object.keys(preferences).filter(
        channel => channel !== 'conditions' && preferences[channel]?.enabled
      ) as Array<'slack' | 'email' | 'pushover'>,
      message: testMessage,
      userId,
    });

    // @ts-expect-error - Sequelize model type compatibility
    await NotificationHistory.create({
      userId,
      type: 'test',
      message: testMessage,
      status: 'sent',
    });

    logger.info(`Test notification sent to user: ${userId}`);
  }

  async getAvailableChannels(): Promise<Array<{
    id: string;
    name: string;
    description: string;
    configSchema: any;
    enabled: boolean;
  }>> {
    return [
      {
        id: 'email',
        name: 'Email',
        description: 'Send notifications via email',
        configSchema: {
          address: 'string',
          digest: 'boolean',
          digestFrequency: ['daily', 'weekly'],
        },
        enabled: true,
      },
      {
        id: 'slack',
        name: 'Slack',
        description: 'Send notifications to Slack channels',
        configSchema: {
          channel: 'string',
          mentions: 'array',
        },
        enabled: true,
      },
      {
        id: 'pushover',
        name: 'Pushover',
        description: 'Send notifications via Pushover',
        configSchema: {
          deviceGroups: 'array',
          priority: 'number',
        },
        enabled: true,
      },
    ];
  }

  async verifyChannel(userId: string, channelConfig: any): Promise<{
    valid: boolean;
    message?: string;
  }> {
    try {
      // @ts-expect-error - Method exists but not in type definition
      await this.notificationService.verifyChannelConfig(channelConfig);
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        message: (error as Error).message,
      };
    }
  }

  async getNotificationHistory(userId: string, filters: NotificationFilters): Promise<NotificationHistory[]> {
    const where: any = { userId };

    if (filters.channel) {
      where.channel = filters.channel;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.$gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.createdAt.$lte = new Date(filters.endDate);
      }
    }

    return NotificationHistory.findAll({
      where,
      order: [['createdAt', 'DESC']],
    });
  }

  async getDeliveryMetrics(): Promise<any> {
    const [
      totalNotifications,
      successfulDeliveries,
      failedDeliveries,
      channelStats,
    ] = await Promise.all([
      NotificationHistory.count(),
      NotificationHistory.count({ where: { status: 'sent' } }),
      NotificationHistory.count({ where: { status: 'failed' } }),
      this.getChannelStats(),
    ]);

    return {
      totalNotifications,
      successfulDeliveries,
      failedDeliveries,
      deliveryRate: (successfulDeliveries / totalNotifications) * 100,
      channelStats,
    };
  }

  private async getChannelStats(): Promise<any> {
    const stats = await NotificationHistory.findAll({
      attributes: [
        'channel',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('AVG', sequelize.col('deliveryTime')), 'avgDeliveryTime'],
      ],
      group: ['channel'],
    });

    return stats.reduce((acc, stat) => {
      acc[stat.channel] = {
        count: stat.get('count'),
        avgDeliveryTime: stat.get('avgDeliveryTime'),
      };
      return acc;
    }, {});
  }

  async sendBroadcastNotification(data: {
    message: string;
    channels: string[];
    userGroups?: string[];
  }): Promise<void> {
    const users = await User.findAll({
      where: data.userGroups ? { role: data.userGroups } : {},
    });

    for (const user of users) {
      // @ts-expect-error - Private method access needed for broadcasting
      await this.notificationService.sendNotifications({
        enabled: true,
        channels: data.channels as Array<'slack' | 'email' | 'pushover'>,
        message: data.message,
        userId: user.id,
      });

      // @ts-expect-error - Sequelize model type compatibility
      await NotificationHistory.create({
        userId: user.id,
        type: 'broadcast',
        message: data.message,
        status: 'sent',
      });
    }

    logger.info(`Broadcast notification sent to ${users.length} users`);
  }

  async getGlobalSettings(): Promise<any> {
    // TODO: Implement global notification settings
    return {};
  }

  async updateGlobalSettings(settings: any): Promise<any> {
    // TODO: Implement global notification settings update
    return settings;
  }
}