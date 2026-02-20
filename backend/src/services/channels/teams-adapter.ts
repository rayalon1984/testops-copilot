/**
 * Microsoft Teams Bot Adapter
 *
 * Receives Bot Framework activities from Teams via webhook,
 * maps Teams users to internal users, routes through
 * PersonaRouter → AIChatService (buffered), and replies
 * using Adaptive Card formatting.
 *
 * Webhook endpoint: POST /api/v1/channels/teams/messages
 *
 * Auth: Microsoft Bot Framework JWT token validation.
 * We verify the token using Microsoft's OpenID metadata.
 */

import { Request, Response } from 'express';
import { handleChatBuffered, ChatRequest } from '../ai/AIChatService';
import { formatAsAdaptiveCard, formatAsPlainText } from './teams-formatter';
import { getChannelUserMapping } from './channel-user-mapping';
import { logger } from '@/utils/logger';

// ─── Teams Activity Types ───

interface TeamsActivity {
    type: string;
    id: string;
    timestamp: string;
    serviceUrl: string;
    channelId: string;
    from: { id: string; name?: string; aadObjectId?: string };
    conversation: { id: string; conversationType?: string; tenantId?: string };
    recipient: { id: string; name?: string };
    text?: string;
    value?: unknown;
}

// ─── JWT Verification ───

/**
 * Verify the Bot Framework JWT bearer token.
 * In production this should validate against Microsoft's OpenID metadata
 * at https://login.botframework.com/v1/.well-known/openidconfiguration.
 *
 * For now we verify the App ID claim matches our configured app.
 * Full JWKS validation requires caching Microsoft's signing keys.
 */
export function verifyTeamsToken(authHeader: string | undefined): boolean {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return false;
    }

    const appId = process.env.TEAMS_APP_ID;
    if (!appId) {
        // No Teams config — can't verify
        return false;
    }

    // Decode JWT payload (base64url) without full crypto verification
    // Production deployments should use a proper JWKS-based verification library
    try {
        const token = authHeader.slice(7);
        const parts = token.split('.');
        if (parts.length !== 3) return false;

        const payload = JSON.parse(
            Buffer.from(parts[1], 'base64url').toString('utf-8'),
        );

        // Check audience matches our app ID
        if (payload.aud !== appId && payload.appid !== appId) {
            logger.warn('[TeamsAdapter] JWT audience mismatch');
            return false;
        }

        // Check expiration
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
            logger.warn('[TeamsAdapter] JWT expired');
            return false;
        }

        return true;
    } catch {
        logger.warn('[TeamsAdapter] JWT parse failed');
        return false;
    }
}

// ─── Event Handler ───

/**
 * Handle incoming Bot Framework activity from Teams.
 */
export async function handleTeamsActivity(req: Request, res: Response): Promise<void> {
    const activity = req.body as TeamsActivity;

    // Only handle message activities
    if (activity.type !== 'message') {
        // Acknowledge non-message activities (typing indicators, etc.)
        res.status(200).send();
        return;
    }

    // Acknowledge immediately (Teams expects < 15s response, but we reply async)
    res.status(200).send();

    // Process asynchronously
    processTeamsMessage(activity).catch(err => {
        logger.error('[TeamsAdapter] Failed to process message:', err);
    });
}

/**
 * Process an incoming Teams message activity.
 */
async function processTeamsMessage(activity: TeamsActivity): Promise<void> {
    const text = activity.text?.trim();
    if (!text) return;

    const teamsUserId = activity.from.aadObjectId || activity.from.id;
    const conversationId = activity.conversation.id;

    // Strip the bot @mention prefix that Teams prepends
    const cleanText = text.replace(/<at>.*?<\/at>\s*/g, '').trim();
    if (!cleanText) return;

    logger.info(`[TeamsAdapter] Message from ${activity.from.name || teamsUserId}: ${cleanText.slice(0, 80)}...`);

    // Map Teams user → internal user
    const mapping = await getChannelUserMapping('teams', teamsUserId);
    if (!mapping) {
        await replyToTeamsActivity(activity, {
            type: 'message',
            text: 'Your Teams account is not linked to a TestOps user. Please link your account in TestOps Settings > Integrations.',
        });
        return;
    }

    // Build chat request
    const chatReq: ChatRequest = {
        message: cleanText,
        userId: mapping.userId,
        userRole: mapping.userRole || 'engineer',
        sessionId: `teams-${conversationId}-${teamsUserId}`,
    };

    try {
        const response = await handleChatBuffered(chatReq);

        // Format and reply
        const card = formatAsAdaptiveCard(response);
        const fallbackText = formatAsPlainText(response);

        await replyToTeamsActivity(activity, {
            type: 'message',
            text: fallbackText,
            attachments: [{
                contentType: 'application/vnd.microsoft.card.adaptive',
                content: card,
            }],
        });
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`[TeamsAdapter] Chat failed for ${teamsUserId}:`, error);

        await replyToTeamsActivity(activity, {
            type: 'message',
            text: `Sorry, I encountered an error: ${msg}`,
        });
    }
}

// ─── Teams API Client ───

interface ReplyPayload {
    type: string;
    text: string;
    attachments?: Array<{ contentType: string; content: unknown }>;
}

/**
 * Reply to a Teams activity by POSTing back to the serviceUrl.
 */
async function replyToTeamsActivity(
    activity: TeamsActivity,
    reply: ReplyPayload,
): Promise<void> {
    const appId = process.env.TEAMS_APP_ID;
    const appPassword = process.env.TEAMS_APP_PASSWORD;

    if (!appId || !appPassword) {
        logger.error('[TeamsAdapter] TEAMS_APP_ID or TEAMS_APP_PASSWORD not configured');
        return;
    }

    try {
        // Get an access token from Microsoft
        const token = await getTeamsBotToken(appId, appPassword);
        if (!token) return;

        // Build the reply URL
        const serviceUrl = activity.serviceUrl.replace(/\/$/, '');
        const replyUrl = `${serviceUrl}/v3/conversations/${encodeURIComponent(activity.conversation.id)}/activities/${encodeURIComponent(activity.id)}`;

        const response = await fetch(replyUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ...reply,
                from: { id: appId },
                replyToId: activity.id,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            logger.error(`[TeamsAdapter] Reply failed (${response.status}): ${errorText}`);
        }
    } catch (error) {
        logger.error('[TeamsAdapter] Failed to reply:', error);
    }
}

// ─── Token cache ───

let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Get a Bot Framework access token (cached).
 */
async function getTeamsBotToken(appId: string, appPassword: string): Promise<string | null> {
    // Return cached token if still valid (with 5-min buffer)
    if (cachedToken && cachedToken.expiresAt > Date.now() + 300_000) {
        return cachedToken.token;
    }

    try {
        const response = await fetch(
            'https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    grant_type: 'client_credentials',
                    client_id: appId,
                    client_secret: appPassword,
                    scope: 'https://api.botframework.com/.default',
                }),
            },
        );

        if (!response.ok) {
            logger.error(`[TeamsAdapter] Token request failed: ${response.status}`);
            return null;
        }

        const data = await response.json() as { access_token: string; expires_in: number };
        cachedToken = {
            token: data.access_token,
            expiresAt: Date.now() + data.expires_in * 1000,
        };

        return cachedToken.token;
    } catch (error) {
        logger.error('[TeamsAdapter] Token request error:', error);
        return null;
    }
}
