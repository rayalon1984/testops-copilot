import { z } from 'zod';
import { validate } from './validate';

export const notificationPreferencesSchema = z.object({
  email: z.object({
    enabled: z.boolean(),
    address: z.string().email('Invalid email address'),
    digest: z.boolean(),
    digestFrequency: z.enum(['daily', 'weekly']),
  }).optional(),
  slack: z.object({
    enabled: z.boolean(),
    channel: z.string().min(1, 'Channel name is required'),
    mentions: z.array(z.string()),
  }).optional(),
  pushover: z.object({
    enabled: z.boolean(),
    deviceGroups: z.array(z.string()),
    priority: z.number().min(-2).max(2),
  }).optional(),
  conditions: z.object({
    pipelineStart: z.boolean(),
    pipelineSuccess: z.boolean(),
    pipelineFailure: z.boolean(),
    testFlaky: z.boolean(),
    coverageDecrease: z.boolean(),
  }),
});

export const channelVerificationSchema = z.object({
  type: z.enum(['email', 'slack', 'pushover']),
  config: z.object({
    address: z.string().optional(),
    channel: z.string().optional(),
    webhookUrl: z.string().url().optional(),
    deviceKey: z.string().optional(),
  }).strict(),
});

export const broadcastNotificationSchema = z.object({
  message: z.string().min(1, 'Message is required'),
  channels: z.array(z.enum(['email', 'slack', 'pushover'])).min(1, 'At least one channel is required'),
  userGroups: z.array(z.string()).optional(),
});

export const globalNotificationSettingsSchema = z.object({
  defaultChannels: z.array(z.enum(['email', 'slack', 'pushover'])),
  rateLimits: z.object({
    perUser: z.number().min(0),
    perChannel: z.number().min(0),
  }),
  retryConfig: z.object({
    maxAttempts: z.number().min(1),
    backoffMs: z.number().min(0),
  }),
  templates: z.record(z.string(), z.string()),
});

export const validateNotificationPreferences = validate(notificationPreferencesSchema);
export const validateChannelVerification = validate(channelVerificationSchema);
export const validateBroadcastNotification = validate(broadcastNotificationSchema);
export const validateGlobalNotificationSettings = validate(globalNotificationSettingsSchema);

export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;
export type ChannelVerification = z.infer<typeof channelVerificationSchema>;
export type BroadcastNotification = z.infer<typeof broadcastNotificationSchema>;
export type GlobalNotificationSettings = z.infer<typeof globalNotificationSettingsSchema>;
