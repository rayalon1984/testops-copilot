/**
 * NotificationController — Thin HTTP adapter.
 *
 * Delegates all notification preferences, history, and delivery to
 * NotificationPreferenceService. No Prisma imports allowed here.
 */

import {
  notificationPreferenceService,
  NotificationPreferences,
  NotificationFilters,
} from '../services/notification-preference.service';

export class NotificationController {
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
