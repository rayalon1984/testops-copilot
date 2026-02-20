/**
 * Channel Integration Routes
 *
 * Webhook endpoints for external channel adapters (Slack, Teams).
 * These routes do NOT use the standard `authenticate` middleware —
 * each channel adapter performs its own signature verification.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { handleSlackEvent, verifySlackSignature } from '../services/channels/slack-adapter';
import { handleTeamsActivity, verifyTeamsToken } from '../services/channels/teams-adapter';
import { logger } from '../utils/logger';

const router = Router();

// ─── Slack Signature Verification Middleware ───

function slackSignatureMiddleware(req: Request, res: Response, next: NextFunction): void {
    const signingSecret = process.env.SLACK_SIGNING_SECRET;
    if (!signingSecret) {
        logger.warn('[SlackRoute] SLACK_SIGNING_SECRET not configured — rejecting request');
        res.status(503).json({ error: 'Slack integration not configured' });
        return;
    }

    const signature = req.headers['x-slack-signature'] as string;
    const timestamp = req.headers['x-slack-request-timestamp'] as string;

    if (!signature || !timestamp) {
        res.status(401).json({ error: 'Missing Slack signature headers' });
        return;
    }

    // req.body is already parsed as JSON by Express, but Slack verification
    // needs the raw body string. We use the rawBody set by the raw body middleware.
    const rawBody = (req as Request & { rawBody?: string }).rawBody;
    if (!rawBody) {
        // Fallback: re-serialize (less ideal but functional)
        const body = JSON.stringify(req.body);
        if (!verifySlackSignature(signingSecret, signature, timestamp, body)) {
            res.status(401).json({ error: 'Invalid Slack signature' });
            return;
        }
    } else {
        if (!verifySlackSignature(signingSecret, signature, timestamp, rawBody)) {
            res.status(401).json({ error: 'Invalid Slack signature' });
            return;
        }
    }

    next();
}

// ─── Slack Routes ───

/**
 * POST /api/v1/channels/slack/events
 * Slack Events API webhook endpoint.
 * Handles url_verification (setup handshake) and event_callback (messages).
 */
router.post('/slack/events', slackSignatureMiddleware, async (req: Request, res: Response) => {
    await handleSlackEvent(req, res);
});

// ─── Teams JWT Verification Middleware ───

function teamsAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
    const appId = process.env.TEAMS_APP_ID;
    if (!appId) {
        logger.warn('[TeamsRoute] TEAMS_APP_ID not configured — rejecting request');
        res.status(503).json({ error: 'Teams integration not configured' });
        return;
    }

    const authHeader = req.headers.authorization as string | undefined;
    if (!verifyTeamsToken(authHeader)) {
        res.status(401).json({ error: 'Invalid or missing Bot Framework token' });
        return;
    }

    next();
}

// ─── Teams Routes ───

/**
 * POST /api/v1/channels/teams/messages
 * Bot Framework messaging endpoint for Teams.
 * Handles message activities from Teams conversations.
 */
router.post('/teams/messages', teamsAuthMiddleware, async (req: Request, res: Response) => {
    await handleTeamsActivity(req, res);
});

export default router;
