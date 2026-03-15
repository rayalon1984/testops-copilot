import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { settingsService } from '../services/settings.service';

const updateSettingsSchema = z.object({
  notifications: z.object({
    slack: z.object({ enabled: z.boolean(), webhookUrl: z.string() }).partial(),
    email: z.object({ enabled: z.boolean(), recipients: z.array(z.string()) }).partial(),
  }).partial().optional(),
  cicd: z.object({
    jenkins: z.object({ enabled: z.boolean(), url: z.string(), username: z.string(), apiToken: z.string() }).partial(),
    github: z.object({ enabled: z.boolean(), apiToken: z.string(), repositories: z.array(z.string()) }).partial(),
  }).partial().optional(),
  general: z.object({
    autoRefresh: z.boolean(),
    refreshInterval: z.number().int().min(5).max(3600),
    theme: z.enum(['light', 'dark']),
  }).partial().optional(),
}).strict();

export class SettingsController {
  static async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const settings = await settingsService.getSettings(req.user!.id);
      res.json(settings);
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = updateSettingsSchema.parse(req.body);
      const settings = await settingsService.updateSettings(req.user!.id, parsed as Record<string, unknown>);
      res.json(settings);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
        return;
      }
      next(error);
    }
  }
}
