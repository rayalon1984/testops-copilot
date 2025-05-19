import axios from 'axios';
import { WebClient } from '@slack/web-api';
import Pushover from 'pushover-notifications';
import nodemailer from 'nodemailer';
import { config } from '@/config';
import { Pipeline } from '@/models/pipeline.model';
import { TestRun } from '@/models/testRun.model';
import { logger } from '@/utils/logger';

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
    // Initialize Slack client if configured
    if (config.notifications?.slack?.botToken) {
      this.slackClient = new WebClient(config.notifications.slack.botToken);
    }

    // Initialize Pushover client if configured
    if (config.notifications?.pushover?.appToken) {
      this.pushover = new Pushover({
        token: config.notifications.pushover.appToken,
      });
    }

    // Initialize email transporter if configured
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
    const notificationConfig = pipeline.notifications;
    if (!this.shouldSendNotification(notificationConfig, 'started')) {
      return;
    }

    const message = this.formatStartMessage(pipeline, testRun);
    await this.sendNotifications(notificationConfig, message);
  }

  async sendPipelineCompletionNotification(pipeline: Pipeline, testRun: TestRun): Promise<void> {
    const notificationConfig = pipeline.notifications;
    if (!this.shouldSendNotification(notificationConfig, testRun.status)) {
      return;
    }

    const message = this.formatCompletionMessage(pipeline, testRun);
    await this.sendNotifications(notificationConfig, message);
  }

  private shouldSendNotification(
    config: NotificationConfig | undefined,
    condition: string
  ): boolean {
    return Boolean(
      config?.enabled &&
      config.conditions.includes(condition as any)
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
    const status = testRun.status === 'success' ? '✅' : '❌';
    const duration = testRun.duration ? `${testRun.duration} seconds` : 'N/A';
    const results = testRun.results ? `
Tests: ${testRun.results.total}
✅ Passed: ${testRun.results.passed}
❌ Failed: ${testRun.results.failed}
⏭️ Skipped: ${testRun.results.skipped}
🔄 Flaky: ${testRun.results.flaky}` : '';

    return `${status} Pipeline ${testRun.status.toUpperCase()}
Pipeline: ${pipeline.name}
Branch: ${testRun.branch || 'default'}
Run ID: ${testRun.id}
Duration: ${duration}${results}
${testRun.error ? `\nError: ${testRun.error}` : ''}`;
  }

  private async sendNotifications(config: NotificationConfig | undefined, message: string): Promise<void> {
    if (!config?.enabled) return;

    const promises = config.channels.map(channel => {
      switch (channel) {
        case 'slack':
          return this.sendSlackNotification(message);
        case 'email':
          return this.sendEmailNotification(message);
        case 'pushover':
          return this.sendPushoverNotification(message);
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
          user: config.notifications!.pushover!.userKey!,
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