/**
 * NotificationController — Thin HTTP adapter.
 *
 * Delegates all notification preferences, history, and delivery to
 * NotificationPreferenceService. CRUD operations use prisma singleton.
 */

import { prisma } from '../lib/prisma';
import {
  notificationPreferenceService,
  NotificationPreferences,
  NotificationFilters,
} from '../services/notification-preference.service';

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  testRunId: string | null;
  createdAt: Date;
}

function toNotificationDTO(n: NotificationRow) {
  return {
    id: n.id,
    testRunId: n.testRunId || '',
    pipelineName: n.title,
    type: n.type,
    status: n.type.toUpperCase(),
    message: n.message,
    timestamp: n.createdAt.toISOString(),
    delivered: n.read,
  };
}

export class NotificationController {
  // ─── CRUD ─────────────────────────────────────────────────

  async getUserNotifications(userId: string) {
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return notifications.map(toNotificationDTO);
  }

  async getUndeliveredNotifications(userId: string) {
    const notifications = await prisma.notification.findMany({
      where: { userId, read: false },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return notifications.map(toNotificationDTO);
  }

  async markAsDelivered(notificationId: string, userId: string) {
    await prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { read: true },
    });
  }

  async deleteNotification(notificationId: string, userId: string) {
    await prisma.notification.deleteMany({
      where: { id: notificationId, userId },
    });
  }

  async deleteAllNotifications(userId: string) {
    await prisma.notification.deleteMany({ where: { userId } });
  }

  async markAllAsRead(userId: string) {
    await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  }

  // ─── Preferences & Channels ───────────────────────────────

  async getPreferences(userId: string) {
    return notificationPreferenceService.getPreferences(userId);
  }

  async updatePreferences(userId: string, preferences: NotificationPreferences) {
    return notificationPreferenceService.updatePreferences(userId, preferences);
  }

  async sendTestNotification(userId: string) {
    return notificationPreferenceService.sendTestNotification(userId);
  }

  async getAvailableChannels() {
    return notificationPreferenceService.getAvailableChannels();
  }

  async verifyChannel(userId: string, channelConfig: unknown) {
    return notificationPreferenceService.verifyChannel(userId, channelConfig);
  }

  async getNotificationHistory(userId: string, filters: NotificationFilters) {
    return notificationPreferenceService.getHistory(userId, filters);
  }

  async getDeliveryMetrics() {
    return notificationPreferenceService.getDeliveryMetrics();
  }

  async sendBroadcastNotification(data: { message: string; channels: string[]; userGroups?: string[] }) {
    return notificationPreferenceService.sendBroadcast(data);
  }

  async getGlobalSettings() {
    return notificationPreferenceService.getGlobalSettings();
  }

  async updateGlobalSettings(settings: Record<string, unknown>) {
    return notificationPreferenceService.updateGlobalSettings(settings);
  }
}
