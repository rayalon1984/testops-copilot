import { z } from 'zod';
import { validate } from './validate';

export const testRunSchema = z.object({
  pipelineId: z.string().uuid(),
  branch: z.string().optional(),
  parameters: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  timeout: z.number().min(0).optional(),
});

export const scheduleSchema = z.object({
  cronExpression: z.string(),
  timezone: z.string().optional(),
  enabled: z.boolean(),
  parameters: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
});

export const metricsQuerySchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  groupBy: z.enum(['day', 'week', 'month']).optional(),
  tags: z.array(z.string()).optional(),
});

export const validateTestRunInput = validate(testRunSchema);
export const validateScheduleInput = validate(scheduleSchema);
export const validateMetricsQuery = validate(metricsQuerySchema);

export type TestRun = z.infer<typeof testRunSchema>;
export type Schedule = z.infer<typeof scheduleSchema>;
export type MetricsQuery = z.infer<typeof metricsQuerySchema>;
