/**
 * Starter Prompts API — GET resolved prompts + PATCH user pins.
 */

import { Router, Request, Response } from 'express';
import { resolveStarterPrompts, savePinnedPrompts } from '../../services/ai/StarterPromptResolver';
import { getCatalogForRole, getFullCatalog } from '../../services/ai/starterPromptCatalog';
import { logger } from '../../utils/logger';

const router = Router();

// ─── GET /ai/starter-prompts — Resolved prompts for current user ─

router.get('/starter-prompts', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user?.id) { res.status(401).json({ error: 'Authentication required' }); return; }

    const prompts = await resolveStarterPrompts(user.id, user.role || 'USER');

    res.set('Cache-Control', 'private, max-age=300');
    res.json({ data: { prompts } });
  } catch (error) {
    logger.error('[StarterPrompts] Failed to resolve prompts:', error);
    res.status(500).json({ error: 'Failed to resolve starter prompts' });
  }
});

// ─── GET /ai/starter-prompts/catalog — Full catalog for settings UI ─

router.get('/starter-prompts/catalog', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user?.id) { res.status(401).json({ error: 'Authentication required' }); return; }

    const rolePrompts = getCatalogForRole(user.role || 'USER', 8);
    const fullCatalog = getFullCatalog();

    res.json({ data: { rolePrompts, fullCatalog } });
  } catch (error) {
    logger.error('[StarterPrompts] Failed to get catalog:', error);
    res.status(500).json({ error: 'Failed to get prompt catalog' });
  }
});

// ─── PATCH /ai/starter-prompts/pins — Save user pins ─

router.patch('/starter-prompts/pins', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user?.id) { res.status(401).json({ error: 'Authentication required' }); return; }

    const { pins } = req.body;

    // Validate pins array
    if (!Array.isArray(pins)) {
      res.status(400).json({ error: 'pins must be an array' });
      return;
    }

    if (pins.length > 4) {
      res.status(400).json({ error: 'Maximum 4 pinned prompts allowed' });
      return;
    }

    // Validate each pin
    for (const pin of pins) {
      if (typeof pin.label !== 'string' || pin.label.trim().length === 0 || pin.label.length > 40) {
        res.status(400).json({ error: 'Each pin must have a label (1-40 characters)' });
        return;
      }
      if (typeof pin.prompt !== 'string' || pin.prompt.trim().length === 0 || pin.prompt.length > 200) {
        res.status(400).json({ error: 'Each pin must have a prompt (1-200 characters)' });
        return;
      }
    }

    await savePinnedPrompts(user.id, pins);

    // Return updated resolved prompts
    const prompts = await resolveStarterPrompts(user.id, user.role || 'USER');
    res.json({ data: { prompts } });
  } catch (error) {
    logger.error('[StarterPrompts] Failed to save pins:', error);
    res.status(500).json({ error: 'Failed to save pinned prompts' });
  }
});

// ─── DELETE /ai/starter-prompts/pins — Reset to defaults ─

router.delete('/starter-prompts/pins', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user?.id) { res.status(401).json({ error: 'Authentication required' }); return; }

    await savePinnedPrompts(user.id, []);

    // Return role defaults
    const prompts = await resolveStarterPrompts(user.id, user.role || 'USER');
    res.json({ data: { prompts } });
  } catch (error) {
    logger.error('[StarterPrompts] Failed to reset pins:', error);
    res.status(500).json({ error: 'Failed to reset pinned prompts' });
  }
});

export default router;
