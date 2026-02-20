/**
 * Slack Events API Adapter
 *
 * Receives messages from Slack via the Events API webhook,
 * maps Slack users to internal users, routes through
 * PersonaRouter → AIChatService (buffered), and replies
 * using Block Kit formatting.
 *
 * Webhook endpoint: POST /api/v1/channels/slack/events
 */

import crypto from 'crypto';
import { Request, Response } from 'express';
import { handleChatBuffered, ChatRequest } from '../ai/AIChatService';
import { formatAsBlocks, formatAsPlainText } from './slack-formatter';
import { getChannelUserMapping } from './channel-user-mapping';
import { logger } from '@/utils/logger';

// ─── Slack Signature Verification ───

/**
 * Verify that the incoming request is genuinely from Slack.
 * Uses HMAC-SHA256 with the signing secret.
 */
export function verifySlackSignature(
    signingSecret: string,
    signature: string,
    timestamp: string,
    body: string,
): boolean {
    // Reject requests older than 5 minutes (replay protection)
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - parseInt(timestamp, 10)) > 300) {
        return false;
    }

    const sigBasestring = `v0:${timestamp}:${body}`;
    const hmac = crypto.createHmac('sha256', signingSecret);
    hmac.update(sigBasestring);
    const computed = `v0=${hmac.digest('hex')}`;

    return crypto.timingSafeEqual(
        Buffer.from(computed),
        Buffer.from(signature),
    );
}

// ─── Slack Event Types ───

interface SlackEvent {
    type: string;
    user?: string;
    text?: string;
    channel?: string;
    ts?: string;
    thread_ts?: string;
    bot_id?: string;
}

interface SlackEventPayload {
    type: string;
    token?: string;
    challenge?: string;
    event?: SlackEvent;
    team_id?: string;
}

// ─── Event Handler ───

/**
 * Handle incoming Slack Events API webhook.
 * Supports: url_verification (handshake), event_callback (messages).
 */
export async function handleSlackEvent(req: Request, res: Response): Promise<void> {
    const payload = req.body as SlackEventPayload;

    // 1. URL verification challenge (Slack app setup handshake)
    if (payload.type === 'url_verification') {
        res.json({ challenge: payload.challenge });
        return;
    }

    // 2. Event callback
    if (payload.type === 'event_callback' && payload.event) {
        // Acknowledge immediately (Slack requires < 3s response)
        res.status(200).send();

        // Process asynchronously
        processSlackMessage(payload.event).catch(err => {
            logger.error('[SlackAdapter] Failed to process message:', err);
        });
        return;
    }

    res.status(200).send();
}

/**
 * Process an incoming Slack message event.
 */
async function processSlackMessage(event: SlackEvent): Promise<void> {
    // Ignore bot messages (prevent infinite loops)
    if (event.bot_id || !event.text || !event.channel || !event.user) {
        return;
    }

    // Only handle 'message' type events
    if (event.type !== 'message') {
        return;
    }

    const slackUserId = event.user;
    const text = event.text.trim();
    const channel = event.channel;
    const threadTs = event.thread_ts || event.ts; // Reply in thread

    if (!text) return;

    logger.info(`[SlackAdapter] Message from ${slackUserId} in ${channel}: ${text.slice(0, 80)}...`);

    // Map Slack user → internal user
    const mapping = await getChannelUserMapping('slack', slackUserId);
    if (!mapping) {
        await postSlackMessage(channel, threadTs, {
            text: 'Your Slack account is not linked to a TestOps user. Please link your account in TestOps Settings > Integrations.',
        });
        return;
    }

    // Build chat request
    const chatReq: ChatRequest = {
        message: text,
        userId: mapping.userId,
        userRole: mapping.userRole || 'engineer',
        sessionId: `slack-${channel}-${slackUserId}`,
    };

    try {
        // Run the buffered chat (PersonaRouter → ReAct loop → answer)
        const response = await handleChatBuffered(chatReq);

        // Format and post
        const blocks = formatAsBlocks(response);
        const fallbackText = formatAsPlainText(response);

        await postSlackMessage(channel, threadTs, {
            text: fallbackText,
            blocks,
        });
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`[SlackAdapter] Chat failed for ${slackUserId}:`, error);

        await postSlackMessage(channel, threadTs, {
            text: `Sorry, I encountered an error: ${msg}`,
        });
    }
}

// ─── Slack API Client ───

interface PostMessageOptions {
    text: string;
    blocks?: unknown[];
}

/**
 * Post a message to a Slack channel using the Web API.
 */
async function postSlackMessage(
    channel: string,
    threadTs: string | undefined,
    options: PostMessageOptions,
): Promise<void> {
    const botToken = process.env.SLACK_BOT_TOKEN;
    if (!botToken) {
        logger.error('[SlackAdapter] SLACK_BOT_TOKEN not configured');
        return;
    }

    try {
        const body: Record<string, unknown> = {
            channel,
            text: options.text,
        };

        if (options.blocks) {
            body.blocks = options.blocks;
        }

        if (threadTs) {
            body.thread_ts = threadTs;
        }

        const response = await fetch('https://slack.com/api/chat.postMessage', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${botToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        const data = await response.json() as { ok: boolean; error?: string };
        if (!data.ok) {
            logger.error(`[SlackAdapter] Slack API error: ${data.error}`);
        }
    } catch (error) {
        logger.error('[SlackAdapter] Failed to post message:', error);
    }
}
