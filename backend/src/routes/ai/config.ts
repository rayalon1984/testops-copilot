/**
 * AI Config Routes — Health, personas, autonomy preferences, provider config.
 *
 * Split from the monolithic ai/index.ts for navigability.
 */

import { Router, Request, Response } from 'express';
import { getAIManager } from '../../services/ai';
import { authorize } from '../../middleware/auth';
import { UserRole } from '../../constants';
import * as providerConfig from '../../services/ai/provider-config.service';
import { getAvailablePersonas } from '../../services/ai/PersonaRouter';
import { prisma } from '../../lib/prisma';
import { logger } from '../../utils/logger';

const router = Router();

const VALID_AUTONOMY_LEVELS = ['conservative', 'balanced', 'autonomous'] as const;

// ─── Health ───

router.get('/health', async (_req: Request, res: Response) => {
  try {
    const aiManager = getAIManager();
    if (!aiManager.isEnabled()) {
      return res.json({ enabled: false, message: 'AI features are disabled' });
    }
    const health = await aiManager.healthCheck();
    return res.json({ enabled: true, healthy: health.healthy, services: health.services });
  } catch (error) {
    return res.status(500).json({ error: 'Health check failed', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// ─── Personas ───

router.get('/personas', (_req: Request, res: Response) => {
  return res.json({ data: getAvailablePersonas() });
});

// ─── Autonomy Preferences ───

router.get('/autonomy', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user?.id) { res.status(401).json({ error: 'Authentication required' }); return; }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { autonomyLevel: true },
    });
    res.json({ data: { autonomyLevel: dbUser?.autonomyLevel || 'balanced' } });
  } catch (error) {
    logger.error('[AI Autonomy] Failed to get preference:', error);
    res.status(500).json({ error: 'Failed to get autonomy preference' });
  }
});

router.put('/autonomy', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user?.id) { res.status(401).json({ error: 'Authentication required' }); return; }

    const { autonomyLevel } = req.body;
    if (!autonomyLevel || !VALID_AUTONOMY_LEVELS.includes(autonomyLevel)) {
      res.status(400).json({ error: `autonomyLevel must be one of: ${VALID_AUTONOMY_LEVELS.join(', ')}` });
      return;
    }

    await prisma.user.update({ where: { id: user.id }, data: { autonomyLevel } });
    logger.info(`[AI Autonomy] User ${user.id} set autonomy to ${autonomyLevel}`);
    res.json({ data: { autonomyLevel } });
  } catch (error) {
    logger.error('[AI Autonomy] Failed to update preference:', error);
    res.status(500).json({ error: 'Failed to update autonomy preference' });
  }
});

// ─── Provider Configuration ───

router.get('/config', async (_req: Request, res: Response) => {
  try {
    const config = await providerConfig.getProviderConfig();
    return res.json({ data: config, providers: providerConfig.PROVIDER_MODELS });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to get provider config', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.put('/config', authorize(UserRole.ADMIN), async (req: Request, res: Response) => {
  try {
    const { provider, model, apiKey, extraConfig } = req.body;
    if (!provider || !model) {
      return res.status(400).json({ error: 'provider and model are required' });
    }

    const validProviders = ['anthropic', 'openai', 'google', 'azure', 'openrouter', 'bedrock', 'mock'];
    if (!validProviders.includes(provider)) {
      return res.status(400).json({ error: `Invalid provider. Must be one of: ${validProviders.join(', ')}` });
    }

    if (provider !== 'mock' && provider !== 'bedrock' && !apiKey) {
      const existing = await providerConfig.getProviderConfig();
      if (!existing.hasApiKey) {
        return res.status(400).json({ error: 'API key is required for non-mock providers' });
      }
    }

    const user = req.user;
    const result = await providerConfig.updateProviderConfig(
      { provider, model, apiKey, extraConfig },
      user?.id || 'unknown',
    );
    return res.json({ data: result });
  } catch (error) {
    logger.error('[AI Config] Update failed:', error);
    return res.status(500).json({ error: 'Failed to update provider config', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.post('/config/test', async (req: Request, res: Response) => {
  try {
    const { provider, model, apiKey, extraConfig } = req.body;
    if (!provider || !model) {
      return res.status(400).json({ error: 'provider and model are required' });
    }
    if (provider !== 'mock' && !apiKey) {
      return res.status(400).json({ error: 'apiKey is required for connection test' });
    }

    const result = await providerConfig.testProviderConnection(provider, model, apiKey || 'mock-key', extraConfig);
    return res.json({ data: result });
  } catch (error) {
    return res.status(500).json({ error: 'Connection test failed', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;
