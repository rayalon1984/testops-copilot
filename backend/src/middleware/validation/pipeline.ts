import { z } from 'zod';
import { validate } from './validate';

export const pipelineSchema = z.object({
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
    schedule: z.string().optional(),
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

export const createPipelineSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['jenkins', 'github-actions', 'custom']),
  config: z.record(z.string(), z.unknown()).optional(),
});

export const updatePipelineSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(['jenkins', 'github-actions', 'custom']).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  status: z.string().optional(),
});

export const pipelineScheduleSchema = z.object({
  schedule: z.string().min(1, 'Schedule is required'),
});

export const validatePipelineInput = validate(pipelineSchema);
export const validateCreatePipeline = validate(createPipelineSchema);
export const validateUpdatePipeline = validate(updatePipelineSchema);
export const validatePipelineSchedule = validate(pipelineScheduleSchema);

export type Pipeline = z.infer<typeof pipelineSchema>;
