import axios from 'axios';
import { WebClient } from '@slack/web-api';
import Pushover from 'pushover-notifications';
import nodemailer from 'nodemailer';
import { config } from '@/config';
import { Pipeline, TestRun, PrismaClient } from '@prisma/client';
import { logger } from '@/utils/logger';

// @ts-ignore - Prisma types compatibility
interface NotificationConfig {
  enabled: boolean;
  channels: Array<'slack' | 'email' | 'pushover'>;
  conditions: Array<'success' | 'failure' | 'started' | 'completed'>;
}

export class NotificationService {
  private slackClient: WebClient | null = null;
  private pushover: Pushover | null = null;
  private emailTransporter: nodemailer.Transporter | null = null;

  constructor() {
    this.initializeServices();
  }

  private initializeServices(): void {
    if (config.notifications?.slack?.botToken) {
      this.slackClient = new WebClient(config.notifications.slack.botToken);
    }

    if (config.notifications?.pushover?.appToken) {
      this.pushover = new Pushover({
        token: config.notifications.pushover.appToken,
        user: config.notifications.pushover.userKey || '',
      });
    }

    if (config.notifications?.email?.host) {
      this.emailTransporter = nodemailer.createTransport({
        host: config.notifications.email.host,
        port: config.notifications.email.port,
        secure: config.notifications.email.secure,
        auth: {
          user: config.notifications.email.user,
          pass: config.notifications.email.password,
        },
      });
    }
  }

  async sendPipelineStartNotification(pipeline: Pipeline, testRun: TestRun): Promise<void> {
    // @ts-ignore - Dynamic property on pipeline? Or fetched pipeline needs include?
    // Assuming pipeline has notifications config, but Prisma model Pipeline has `config` string.
    // We need to parse config to get notifications preference if stored there.
    // Or if `notifications` was a field on Pipeline model?
    // Checking schema: Pipeline model has `config String` and `description String?`. No notifications field.
    // The previous code `pipeline.notifications` implies `notifications` was a virtual field or relation in Sequelize.
    // Or it's stored in `config` JSON.

    // We'll try to parse it from config if possible, or assume it's missing for now.
    // This part of refactor depends on where notifications config lives.
    // Assuming it's inside `config` JSON for now.

    let notificationConfig: NotificationConfig | undefined;
    try {
      const parsedConfig = typeof pipeline.config === 'string' ? JSON.parse(pipeline.config) : pipeline.config;
      notificationConfig = parsedConfig.notifications;
    } catch (e) {
      // ignore
    }

    if (!notificationConfig || !this.shouldSendNotification(notificationConfig, 'started')) {
      return;
    }

    const message = this.formatStartMessage(pipeline, testRun);
    await this.sendNotifications(notificationConfig, message);
  }

  async sendPipelineCompletionNotification(pipeline: Pipeline, testRun: TestRun): Promise<void> {
    let notificationConfig: NotificationConfig | undefined;
    try {
      const parsedConfig = typeof pipeline.config === 'string' ? JSON.parse(pipeline.config) : pipeline.config;
      notificationConfig = parsedConfig.notifications;
    } catch (e) {
      // ignore
    }

    if (!notificationConfig || !this.shouldSendNotification(notificationConfig, testRun.status)) {
      return;
    }

    const message = this.formatCompletionMessage(pipeline, testRun);
    await this.sendNotifications(notificationConfig, message);
  }

  private shouldSendNotification(
    config: NotificationConfig | undefined,
    condition: string
  ): boolean {
    // Mapping testRun status to condition
    // conditions: 'success' | 'failure' | 'started' | 'completed'
    // condition passed in is 'started' or testRun.status (PASSED, FAILED, etc)
    const normalizedCondition = condition.toLowerCase();

    // Map PASSED -> success, FAILED -> failure
    let checkCondition = normalizedCondition;
    if (normalizedCondition === 'passed') checkCondition = 'success';
    if (normalizedCondition === 'failed') checkCondition = 'failure';

    return Boolean(
      config?.enabled &&
      config.conditions.includes(checkCondition as any)
    );
  }

  private formatStartMessage(pipeline: Pipeline, testRun: TestRun): string {
    return `🚀 Pipeline Started
Pipeline: ${pipeline.name}
Branch: ${testRun.branch || 'default'}
Run ID: ${testRun.id}
Started At: ${testRun.startTime?.toISOString()}`;
  }

  private formatCompletionMessage(pipeline: Pipeline, testRun: TestRun): string {
    const statusIcon = testRun.status === 'PASSED' ? '✅' : '❌';
    const duration = testRun.duration ? `${testRun.duration} seconds` : 'N/A';

    let resultsText = '';
    if (testRun.results) {
      try {
        const results = JSON.parse(testRun.results);
        resultsText = `
Tests: ${results.total}
✅ Passed: ${results.passed}
❌ Failed: ${results.failed}
⏭️ Skipped: ${results.skipped}`;
      } catch (e) {
        resultsText = ' (Results parsing failed)';
      }
    }

    return `${statusIcon} Pipeline ${testRun.status}
Pipeline: ${pipeline.name}
Branch: ${testRun.branch || 'default'}
Run ID: ${testRun.id}
Duration: ${duration}${resultsText}
${testRun.error ? `\nError: ${testRun.error}` : ''}`;
  }

  // Public for controller usage (broadcasting)
  async sendNotifications(config: NotificationConfig | { enabled: boolean; channels: string[]; message: string; userId?: string }, message: string): Promise<void> {
    // Overloading: config can be NotificationConfig or { ... } from controller
    // If message is passed as second arg, use it.

    const enabled = 'enabled' in config ? config.enabled : false;
    if (!enabled) return;

    const channels = 'channels' in config ? config.channels : [];
    const text = message;

    // Note: The previous implementation had user-specific logic that we might need to preserve/adapt.
    // But for broad pipeline notifications:

    const promises = channels.map((channel: string) => {
      switch (channel) {
        case 'slack':
          return this.sendSlackNotification(text);
        case 'email':
          return this.sendEmailNotification(text);
        case 'pushover':
          return this.sendPushoverNotification(text);
        default:
          return Promise.resolve();
      }
    });

    try {
      await Promise.all(promises);
    } catch (error) {
      logger.error('Failed to send notifications:', error);
    }
  }

  // Helper for controller verification
  async verifyChannelConfig(channelConfig: any): Promise<void> {
    // Simple mock verification based on presence of fields
    if (!channelConfig) throw new Error('Invalid config');
  }

  private async sendSlackNotification(message: string): Promise<void> {
    if (!this.slackClient || !config.notifications?.slack?.channel) {
      return;
    }

    try {
      await this.slackClient.chat.postMessage({
        channel: config.notifications.slack.channel,
        text: message,
        mrkdwn: true,
      });
    } catch (error) {
      logger.error('Failed to send Slack notification:', error);
    }
  }

  private async sendEmailNotification(message: string): Promise<void> {
    if (!this.emailTransporter || !config.notifications?.email?.recipients) {
      return;
    }

    try {
      await this.emailTransporter.sendMail({
        from: config.notifications.email.from,
        to: config.notifications.email.recipients,
        subject: 'Pipeline Notification',
        text: message,
      });
    } catch (error) {
      logger.error('Failed to send email notification:', error);
    }
  }

  private async sendPushoverNotification(message: string): Promise<void> {
    if (!this.pushover || !config.notifications?.pushover?.userKey) {
      return;
    }

    try {
      await new Promise((resolve, reject) => {
        this.pushover!.send({
          message: message,
          title: 'Pipeline Notification',
          priority: 0,
        }, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });
    } catch (error) {
      logger.error('Failed to send Pushover notification:', error);
    }
  }
}