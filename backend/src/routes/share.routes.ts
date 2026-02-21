/**
 * Share Routes
 *
 * Endpoints for creating and viewing shared AI analysis links.
 * POST /shares — create a share (authenticated)
 * GET /shares/:token — view a share (public, no auth)
 * POST /shares/:token/email — email a share to someone (authenticated)
 */

import { Router, Request, Response } from 'express';
import { createShare, getShareByToken, shareViaEmail } from '../services/share.service';
import { authenticate } from '../middleware/auth';
import { validateCreateShare, validateEmailShare } from '../middleware/validation';
import { logger } from '../utils/logger';

const router = Router();

/**
 * POST /api/v1/shares
 * Create a new shared analysis link. Requires authentication.
 */
router.post('/', authenticate, validateCreateShare, async (req: Request, res: Response) => {
    try {
        const user = req.user;
        const { title, content, persona, toolSummary, sessionId, expiresInDays } = req.body;

        if (!title || !content) {
            return res.status(400).json({ error: 'title and content are required' });
        }

        const result = await createShare({
            userId: user?.id || 'anonymous',
            title,
            content,
            persona,
            toolSummary,
            sessionId,
            expiresInDays,
        });

        return res.status(201).json({ data: result });
    } catch (error) {
        logger.error('[ShareRoute] Create failed:', error);
        return res.status(500).json({ error: 'Failed to create share' });
    }
});

/**
 * GET /api/v1/shares/:token
 * View a shared analysis. Public — no authentication required.
 * Returns 404 if expired or not found.
 */
router.get('/:token', async (req: Request, res: Response) => {
    try {
        const token = req.params.token as string;
        const share = await getShareByToken(token);

        if (!share) {
            return res.status(404).json({ error: 'Share not found or expired' });
        }

        return res.json({ data: share });
    } catch (error) {
        logger.error('[ShareRoute] Get failed:', error);
        return res.status(500).json({ error: 'Failed to retrieve share' });
    }
});

/**
 * POST /api/v1/shares/:token/email
 * Email a shared analysis to a recipient. Requires authentication.
 */
router.post('/:token/email', authenticate, validateEmailShare, async (req: Request, res: Response) => {
    try {
        const token = req.params.token as string;
        const { recipientEmail } = req.body;
        const user = req.user;

        if (!recipientEmail) {
            return res.status(400).json({ error: 'recipientEmail is required' });
        }

        const share = await getShareByToken(token);
        if (!share) {
            return res.status(404).json({ error: 'Share not found or expired' });
        }

        const appUrl = process.env.APP_URL || 'http://localhost:5173';
        const shareUrl = `${appUrl}/shared/${token}`;

        const sent = await shareViaEmail(
            shareUrl,
            share.title,
            share.content,
            recipientEmail,
            user?.firstName || user?.email,
        );

        if (!sent) {
            return res.status(503).json({ error: 'Email service not configured or send failed' });
        }

        return res.json({ data: { sent: true } });
    } catch (error) {
        logger.error('[ShareRoute] Email failed:', error);
        return res.status(500).json({ error: 'Failed to send email' });
    }
});

export default router;
