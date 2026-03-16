/**
 * AI Chat Routes — SSE chat, session CRUD, action confirmation.
 *
 * Split from the monolithic ai/index.ts for navigability.
 */

import { Router, Request, Response } from 'express';
import { handleChatStream } from '../../services/ai/AIChatService';
import * as chatSession from '../../services/ai/ChatSessionService';
import * as confirmation from '../../services/ai/ConfirmationService';
import { toolRegistry } from '../../services/ai/tools';
import { ToolResult } from '../../services/ai/tools/types';
import { getConfigManager } from '../../services/ai/config';
import { getMockToolResult } from '../../services/ai/mock-tool-results';
import { getUserAutonomyLevel } from '../../services/ai/autonomy.service';
import { createProviderForUser } from '../../services/ai/user-provider-config.service';
import { validateChatMessage, validateConfirmAction } from '../../middleware/validation';
import { logger } from '../../utils/logger';

const router = Router();

// ─── SSE Chat ───

router.post('/chat', validateChatMessage, async (req: Request, res: Response): Promise<void> => {
  try {
    const { message, sessionId, history, uiContext } = req.body;

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'message is required and must be a string' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const user = req.user;

    // Fetch user's autonomy preference
    let autonomyLevel: 'conservative' | 'balanced' | 'autonomous' = 'balanced';
    if (user?.id) {
      try {
        autonomyLevel = await getUserAutonomyLevel(user.id);
      } catch {
        // Fall through to default
      }
    }

    // Resolve per-user AI provider (if configured)
    let providerOverride: import('../../services/ai/providers/base.provider').BaseProvider | undefined;
    let providerName: string | undefined;
    if (user?.id) {
      try {
        const result = await createProviderForUser(user.id);
        if (result) {
          providerOverride = result.provider;
          providerName = result.providerName;
        }
      } catch (err) {
        logger.warn('[AIChat] Failed to load per-user provider, using global:', err);
      }
    }

    await handleChatStream(
      {
        message,
        sessionId,
        userId: user?.id || 'anonymous',
        userRole: user?.role || 'viewer',
        history: history || [],
        autonomyLevel,
        uiContext: typeof uiContext === 'string' ? uiContext : undefined,
        providerOverride,
        providerName,
      },
      res,
    );

    if (!res.writableEnded) res.end();
  } catch (error) {
    logger.error('[AIChat] Chat endpoint failed:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Chat failed', message: error instanceof Error ? error.message : 'Unknown error' });
      return;
    }
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ type: 'error', data: 'Internal server error' })}\n\n`);
      res.end();
    }
  }
});

// ─── Session CRUD ───

router.get('/sessions', async (req: Request, res: Response): Promise<void> => {
  try {
    const sessions = await chatSession.getUserSessions(req.user?.id || '');
    res.json({ data: sessions });
  } catch {
    res.status(500).json({ error: 'Failed to list sessions' });
  }
});

router.get('/sessions/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const session = await chatSession.getSessionWithMessages(req.params.id as string, req.user?.id || '');
    if (!session) { res.status(404).json({ error: 'Session not found' }); return; }
    res.json({ data: session });
  } catch {
    res.status(500).json({ error: 'Failed to get session' });
  }
});

router.post('/sessions', async (req: Request, res: Response): Promise<void> => {
  try {
    const session = await chatSession.createSession({ userId: req.user?.id || '', title: req.body.title });
    res.status(201).json({ data: session });
  } catch {
    res.status(500).json({ error: 'Failed to create session' });
  }
});

router.delete('/sessions/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    await chatSession.deleteSession(req.params.id as string, req.user?.id || '');
    res.json({ message: 'Session deleted' });
  } catch {
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

// ─── Action Confirmation ───

router.post('/confirm', validateConfirmAction, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    const { actionId, approved } = req.body;

    if (!actionId || typeof approved !== 'boolean') {
      res.status(400).json({ error: 'actionId (string) and approved (boolean) are required' });
      return;
    }

    const result = await confirmation.resolveAction(actionId, user?.id || '', approved);

    let toolResult: ToolResult | { success: boolean; error: string } | null = null;
    if (approved) {
      const tool = toolRegistry.get(result.toolName);
      if (tool) {
        try {
          const mockResult = getConfigManager().getProvider() === 'mock'
            ? getMockToolResult(result.toolName, result.parameters)
            : null;

          const executionResult = mockResult || await tool.execute(result.parameters, {
            userId: user?.id || '',
            userRole: user?.role || 'viewer',
            sessionId: result.sessionId,
          });
          toolResult = executionResult;

          await chatSession.saveMessage({
            sessionId: result.sessionId,
            role: 'user',
            content: `Tool result for ${tool.name}:\n${JSON.stringify(executionResult.data ?? executionResult.error, null, 2)}\n\nAction confirmed and executed by user.`,
            toolName: tool.name,
          });

          logger.info(`[AI] Executed confirmed tool ${tool.name} for session ${result.sessionId}`);
        } catch (err) {
          logger.error(`[AI] Failed to execute confirmed tool ${tool.name}:`, err);
          toolResult = { success: false, error: 'Tool execution failed after confirmation' };
        }
      } else {
        logger.warn(`[AI] Confirmed tool ${result.toolName} not found in registry`);
      }
    } else {
      await chatSession.saveMessage({
        sessionId: result.sessionId,
        role: 'user',
        content: `User denied the action for ${result.toolName}.`,
        toolName: result.toolName,
      });
    }

    res.json({ data: result, toolResult });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to resolve action';
    res.status(400).json({ error: message });
  }
});

router.get('/sessions/:id/pending', async (req: Request, res: Response): Promise<void> => {
  try {
    const actions = await confirmation.getSessionPendingActions(req.params.id as string);
    res.json({ data: actions });
  } catch {
    res.status(500).json({ error: 'Failed to get pending actions' });
  }
});

export default router;
