import { WebClient } from '@slack/web-api';
import Pushover from 'pushover-notifications';
import nodemailer from 'nodemailer';
import { config } from '@/config';
import { Pipeline, TestRun } from '@prisma/client';
import { logger } from '@/utils/logger';

interface NotificationConfig {
  enabled: boolean;
  channels: Array<'slack' | 'email' | 'pushover'>;
  conditions: Array<'success' | 'failure' | 'started' | 'completed'>;
}

interface TestRunWithResults extends TestRun {
  results?: Array<{ status: string }> | string;
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
    let notificationConfig: NotificationConfig | undefined;
    try {
      const parsedConfig = typeof pipeline.config === 'string' ? JSON.parse(pipeline.config) : pipeline.config;
      notificationConfig = parsedConfig.notifications;
    } catch (e) {
      // Intentionally ignoring parse errors - notifications are optional and shouldn't break pipeline execution
    }

    if (!notificationConfig || !this.shouldSendNotification(notificationConfig, 'started')) {
      return;
    }

    const message = this.formatStartMessage(pipeline, testRun);
    await this.sendNotifications(notificationConfig, message, { pipeline, testRun });
  }

  async sendPipelineCompletionNotification(pipeline: Pipeline, testRun: TestRun): Promise<void> {
    let notificationConfig: NotificationConfig | undefined;
    try {
      const parsedConfig = typeof pipeline.config === 'string' ? JSON.parse(pipeline.config) : pipeline.config;
      notificationConfig = parsedConfig.notifications;
    } catch (e) {
      // Intentionally ignoring parse errors - notifications are optional and shouldn't break pipeline execution
    }

    if (!notificationConfig || !this.shouldSendNotification(notificationConfig, testRun.status)) {
      return;
    }

    const message = this.formatCompletionMessage(pipeline, testRun);
    await this.sendNotifications(notificationConfig, message, { pipeline, testRun });
  }

  private shouldSendNotification(
    config: NotificationConfig | undefined,
    condition: string
  ): boolean {
    const normalizedCondition = condition.toLowerCase();
    let checkCondition = normalizedCondition;
    if (normalizedCondition === 'passed') checkCondition = 'success';
    if (normalizedCondition === 'failed') checkCondition = 'failure';

    return Boolean(
      config?.enabled &&
      config.conditions.includes(checkCondition as 'success' | 'failure' | 'started' | 'completed')
    );
  }

  private formatStartMessage(pipeline: Pipeline, testRun: TestRunWithResults): string {
    return `🚀 Pipeline Started\nPipeline: ${pipeline.name}\nBranch: ${testRun.branch || 'default'}\nRun ID: ${testRun.id}\nStarted At: ${testRun.startedAt?.toISOString()}`;
  }

  private formatCompletionMessage(pipeline: Pipeline, testRun: TestRun): string {
    const statusIcon = testRun.status === 'PASSED' ? '✅' : '❌';
    const duration = testRun.duration ? `${testRun.duration}s` : 'N/A';
    return `${statusIcon} Pipeline ${testRun.status}\nPipeline: ${pipeline.name}\nBranch: ${testRun.branch || 'default'}\nDuration: ${duration}`;
  }

  // Public for controller usage (broadcasting)
  async sendNotifications(
    config: NotificationConfig | { enabled: boolean; channels: string[]; message?: string; userId?: string },
    message: string,
    context?: { pipeline?: Pipeline; testRun?: TestRunWithResults }
  ): Promise<void> {
    const enabled = 'enabled' in config ? config.enabled : false;
    if (!enabled) return;

    const channels = 'channels' in config ? config.channels : [];

    const promises = channels.map((channel: string) => {
      switch (channel) {
        case 'slack':
          return this.sendSlackNotification(message, context);
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

  async verifyChannelConfig(channelConfig: unknown): Promise<void> {
    if (!channelConfig) throw new Error('Invalid config');
  }

  private async sendSlackNotification(message: string, context?: { pipeline?: Pipeline; testRun?: TestRunWithResults }): Promise<void> {
    if (!this.slackClient || !config.notifications?.slack?.channel) {
      return;
    }

    try {
      // If we have context, build rich blocks
      if (context?.pipeline && context?.testRun) {
        const { pipeline, testRun } = context;
        const isSuccess = testRun.status === 'PASSED';
        const _color = isSuccess ? '#10b981' : '#ef4444'; // Green or Red
        const statusText = isSuccess ? 'SUCCESS' : 'FAILURE';
        const duration = testRun.duration ? `${testRun.duration}s` : 'N/A';

        let statsField = '*Stats:* N/A';
        // Check for results relation from production schema
        if (testRun.results && Array.isArray(testRun.results)) {
          const passed = testRun.results.filter((r: { status: string }) => r.status === 'PASSED').length;
          const failed = testRun.results.filter((r: { status: string }) => r.status === 'FAILED').length;
          const skipped = testRun.results.filter((r: { status: string }) => r.status === 'SKIPPED').length;
          statsField = `*Stats:* ✅ ${passed} | ❌ ${failed} | ⏭️ ${skipped}`;
        } else if (testRun.results && typeof testRun.results === 'string') {
          // Fallback for string-based results (dev schema or old data)
          try {
            const r = JSON.parse(testRun.results);
            statsField = `*Stats:* ✅ ${r.passed} | ❌ ${r.failed} | ⏭️ ${r.skipped}`;
          } catch (e) {
            // Intentionally ignoring parse errors - invalid results format should fallback to 'N/A'
          }
        }

        await this.slackClient.chat.postMessage({
          channel: config.notifications.slack.channel,
          text: message, // Fallback
          blocks: [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: `${isSuccess ? '✅' : '❌'} Pipeline ${statusText}: ${pipeline.name}`,
                emoji: true
              }
            },
            {
              type: 'section',
              fields: [
                { type: 'mrkdwn', text: `*Branch:*\n${testRun.branch || 'default'}` },
                { type: 'mrkdwn', text: `*Duration:*\n${duration}` },
                { type: 'mrkdwn', text: `*Run ID:*\n\`${testRun.id.substring(0, 8)}\`` },
                { type: 'mrkdwn', text: statsField }
              ]
            },
            {
              type: 'actions',
              elements: [
                {
                  type: 'button',
                  text: { type: 'plain_text', text: 'View Test Run' },
                  url: `${config.api.prefix.replace('/api/v1', '')}/test-runs/${testRun.id}`,
                  style: isSuccess ? 'primary' : 'danger'
                },
                {
                  type: 'button',
                  text: { type: 'plain_text', text: 'Download Logs' },
                  url: `${config.api.prefix.replace('/api/v1', '')}/api/v1/test-runs/${testRun.id}/logs/download`
                }
              ]
            }
          ]
        });
      } else {
        // Fallback to simple text
        await this.slackClient.chat.postMessage({
          channel: config.notifications.slack.channel,
          text: message,
          mrkdwn: true,
        });
      }
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