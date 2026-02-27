import { z } from 'zod';
import { validate } from './validate';

export const createShareSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
  persona: z.string().optional(),
  toolSummary: z.string().optional(),
  sessionId: z.string().optional(),
  expiresInDays: z.number().positive().optional(),
});

export const emailShareSchema = z.object({
  recipientEmail: z.string().email('Invalid email address'),
});

export const validateCreateShare = validate(createShareSchema);
export const validateEmailShare = validate(emailShareSchema);
