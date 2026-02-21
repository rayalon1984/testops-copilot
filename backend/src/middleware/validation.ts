import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError } from './errorHandler';

// User registration schema
const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
      'Password must contain at least one uppercase letter, one lowercase letter, one number and one special character'
    ),
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
}).strict();

// User login schema
const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// Password update schema
const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
      'Password must contain at least one uppercase letter, one lowercase letter, one number and one special character'
    ),
});

// Password reset schema
const resetPasswordSchema = z.object({
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
      'Password must contain at least one uppercase letter, one lowercase letter, one number and one special character'
    ),
});

// Forgot password schema
const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

// Notification preferences validation schema
const notificationPreferencesSchema = z.object({
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

// Channel verification schema (strict config fields per channel type)
const channelVerificationSchema = z.object({
  type: z.enum(['email', 'slack', 'pushover']),
  config: z.object({
    address: z.string().optional(),
    channel: z.string().optional(),
    webhookUrl: z.string().url().optional(),
    deviceKey: z.string().optional(),
  }).strict(),
});

// Broadcast notification schema
const broadcastNotificationSchema = z.object({
  message: z.string().min(1, 'Message is required'),
  channels: z.array(z.enum(['email', 'slack', 'pushover'])).min(1, 'At least one channel is required'),
  userGroups: z.array(z.string()).optional(),
});

// Global notification settings schema
const globalNotificationSettingsSchema = z.object({
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

// Pipeline validation schema
const pipelineSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  description: z.string().optional(),
  type: z.enum(['jenkins', 'github-actions', 'custom']),
  config: z.object({
    url: z.string().url('Invalid URL'),
    credentials: z.object({
      username: z.string().min(1, 'Username is required'),
      apiToken: z.string().min(1, 'API token is required'),
    }),
    repository: z.string().optional(),
    branch: z.string().optional(),
    triggers: z.array(z.enum(['push', 'pull_request', 'schedule', 'manual'])).optional(),
    schedule: z.string().optional(), // Cron expression
  }),
  notifications: z.object({
    enabled: z.boolean(),
    channels: z.array(z.enum(['slack', 'email', 'pushover'])),
    conditions: z.array(z.enum(['success', 'failure', 'started', 'completed'])),
  }).optional(),
  timeout: z.number().min(0).optional(),
  retryCount: z.number().min(0).max(5).optional(),
  tags: z.array(z.string()).optional(),
});

// Test run validation schema
const testRunSchema = z.object({
  pipelineId: z.string().uuid(),
  branch: z.string().optional(),
  parameters: z.record(z.string(), z.any()).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  timeout: z.number().min(0).optional(),
});

// Schedule validation schema
const scheduleSchema = z.object({
  cronExpression: z.string(),
  timezone: z.string().optional(),
  enabled: z.boolean(),
  parameters: z.record(z.string(), z.any()).optional(),
});

// Pipeline metrics query validation schema
const metricsQuerySchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  groupBy: z.enum(['day', 'week', 'month']).optional(),
  tags: z.array(z.string()).optional(),
});

// ── Sprint 7B: New schemas for previously unvalidated endpoints ──

// Pipeline create (matches actual API contract — simpler than full pipelineSchema)
const createPipelineSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['jenkins', 'github-actions', 'custom']),
  config: z.record(z.string(), z.unknown()).optional(),
});

// Pipeline update (all optional)
const updatePipelineSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(['jenkins', 'github-actions', 'custom']).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  status: z.string().optional(),
});

// Pipeline schedule (route sends { schedule: "cron" })
const pipelineScheduleSchema = z.object({
  schedule: z.string().min(1, 'Schedule is required'),
});

// AI provider config update
const aiConfigUpdateSchema = z.object({
  provider: z.enum(['anthropic', 'openai', 'google', 'azure', 'openrouter', 'bedrock', 'mock']),
  model: z.string().min(1, 'Model is required'),
  apiKey: z.string().optional(),
  extraConfig: z.record(z.string(), z.unknown()).optional(),
});

// AI autonomy preference
const aiAutonomySchema = z.object({
  autonomyLevel: z.enum(['conservative', 'balanced', 'autonomous']),
});

// AI chat message
const chatMessageSchema = z.object({
  message: z.string().min(1, 'Message is required'),
  sessionId: z.string().optional(),
  history: z.array(z.object({
    role: z.string(),
    content: z.string(),
  })).optional(),
});

// AI action confirmation
const confirmActionSchema = z.object({
  actionId: z.string().min(1, 'Action ID is required'),
  approved: z.boolean(),
});

// Share creation
const createShareSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
  persona: z.string().optional(),
  toolSummary: z.string().optional(),
  sessionId: z.string().optional(),
  expiresInDays: z.number().positive().optional(),
});

// Share email
const emailShareSchema = z.object({
  recipientEmail: z.string().email('Invalid email address'),
});

// Validation middleware factory
const validate = (schema: z.ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        next(new ValidationError(error.errors[0].message));
      } else {
        next(error);
      }
    }
  };
};

// Export validation middlewares
export const validateRegisterInput = validate(registerSchema);
export const validateLoginInput = validate(loginSchema);
export const validateUpdatePasswordInput = validate(updatePasswordSchema);
export const validateResetPasswordInput = validate(resetPasswordSchema);
export const validateForgotPasswordInput = validate(forgotPasswordSchema);
export const validatePipelineInput = validate(pipelineSchema);
export const validateTestRunInput = validate(testRunSchema);
export const validateScheduleInput = validate(scheduleSchema);
export const validateMetricsQuery = validate(metricsQuerySchema);
export const validateNotificationPreferences = validate(notificationPreferencesSchema);
export const validateChannelVerification = validate(channelVerificationSchema);
export const validateBroadcastNotification = validate(broadcastNotificationSchema);
export const validateGlobalNotificationSettings = validate(globalNotificationSettingsSchema);

// Sprint 7B exports
export const validateCreatePipeline = validate(createPipelineSchema);
export const validateUpdatePipeline = validate(updatePipelineSchema);
export const validatePipelineSchedule = validate(pipelineScheduleSchema);
export const validateAIConfigUpdate = validate(aiConfigUpdateSchema);
export const validateAIAutonomy = validate(aiAutonomySchema);
export const validateChatMessage = validate(chatMessageSchema);
export const validateConfirmAction = validate(confirmActionSchema);
export const validateCreateShare = validate(createShareSchema);
export const validateEmailShare = validate(emailShareSchema);

// Export schemas for reuse
export const schemas = {
  register: registerSchema,
  login: loginSchema,
  updatePassword: updatePasswordSchema,
  resetPassword: resetPasswordSchema,
  forgotPassword: forgotPasswordSchema,
  pipeline: pipelineSchema,
  createPipeline: createPipelineSchema,
  updatePipeline: updatePipelineSchema,
  pipelineSchedule: pipelineScheduleSchema,
  testRun: testRunSchema,
  schedule: scheduleSchema,
  metricsQuery: metricsQuerySchema,
  notificationPreferences: notificationPreferencesSchema,
  channelVerification: channelVerificationSchema,
  broadcastNotification: broadcastNotificationSchema,
  globalNotificationSettings: globalNotificationSettingsSchema,
  aiConfigUpdate: aiConfigUpdateSchema,
  aiAutonomy: aiAutonomySchema,
  chatMessage: chatMessageSchema,
  confirmAction: confirmActionSchema,
  createShare: createShareSchema,
  emailShare: emailShareSchema,
};

// Type definitions
export type User = z.infer<typeof registerSchema>;
export type Pipeline = z.infer<typeof pipelineSchema>;
export type TestRun = z.infer<typeof testRunSchema>;
export type Schedule = z.infer<typeof scheduleSchema>;
export type MetricsQuery = z.infer<typeof metricsQuerySchema>;
export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;
export type ChannelVerification = z.infer<typeof channelVerificationSchema>;
export type BroadcastNotification = z.infer<typeof broadcastNotificationSchema>;
export type GlobalNotificationSettings = z.infer<typeof globalNotificationSettingsSchema>;