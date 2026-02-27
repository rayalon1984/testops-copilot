import { z } from 'zod';
import { validate } from './validate';

export const aiConfigUpdateSchema = z.object({
  provider: z.enum(['anthropic', 'openai', 'google', 'azure', 'openrouter', 'bedrock', 'mock']),
  model: z.string().min(1, 'Model is required'),
  apiKey: z.string().optional(),
  extraConfig: z.record(z.string(), z.unknown()).optional(),
});

export const aiAutonomySchema = z.object({
  autonomyLevel: z.enum(['conservative', 'balanced', 'autonomous']),
});

export const chatMessageSchema = z.object({
  message: z.string().min(1, 'Message is required'),
  sessionId: z.string().optional(),
  history: z.array(z.object({
    role: z.string(),
    content: z.string(),
  })).optional(),
});

export const confirmActionSchema = z.object({
  actionId: z.string().min(1, 'Action ID is required'),
  approved: z.boolean(),
});

export const validateAIConfigUpdate = validate(aiConfigUpdateSchema);
export const validateAIAutonomy = validate(aiAutonomySchema);
export const validateChatMessage = validate(chatMessageSchema);
export const validateConfirmAction = validate(confirmActionSchema);
