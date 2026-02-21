/**
 * Slack Block Kit Formatter
 *
 * Converts BufferedChatResponse into Slack Block Kit JSON
 * for posting via chat.postMessage.
 */

import { BufferedChatResponse } from '../ai/AIChatService';

interface SlackBlock {
    type: string;
    text?: { type: string; text: string; emoji?: boolean };
    elements?: unknown[];
    fields?: { type: string; text: string }[];
    accessory?: unknown;
    block_id?: string;
}

/**
 * Format a buffered chat response as Slack Block Kit blocks.
 */
export function formatAsBlocks(response: BufferedChatResponse): SlackBlock[] {
    const blocks: SlackBlock[] = [];

    // Persona context — subtle domain label (not "person handling")
    if (response.persona.persona !== 'SENIOR_ENGINEER') {
        blocks.push({
            type: 'context',
            elements: [
                { type: 'mrkdwn', text: `_${response.persona.displayName}_` },
            ],
        });
    }

    // Tool call summaries as compact context blocks
    if (response.toolCalls.length > 0) {
        const toolSummaries = response.toolCalls
            .map(tc => `*${tc.name}*: ${truncate(tc.summary, 100)}`)
            .join('\n');

        blocks.push({
            type: 'context',
            elements: [
                { type: 'mrkdwn', text: toolSummaries },
            ],
        });

        blocks.push({ type: 'divider' });
    }

    // Main answer
    blocks.push({
        type: 'section',
        text: {
            type: 'mrkdwn',
            text: truncate(response.answer, 3000), // Slack limit per block
        },
    });

    // Pending confirmation warning
    if (response.pendingConfirmation) {
        blocks.push({ type: 'divider' });
        blocks.push({
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `:warning: *Pending approval:* \`${response.pendingConfirmation.tool}\`\nPlease approve this action in the <${getWebAppUrl()}|TestOps web UI>.`,
            },
        });
    }

    return blocks;
}

/**
 * Format a simple text-only fallback (for notifications or DMs without Block Kit).
 */
export function formatAsPlainText(response: BufferedChatResponse): string {
    const parts: string[] = [];

    if (response.persona.persona !== 'SENIOR_ENGINEER') {
        parts.push(`[${response.persona.displayName}]`);
    }

    if (response.toolCalls.length > 0) {
        const tools = response.toolCalls.map(tc => tc.name).join(', ');
        parts.push(`Tools used: ${tools}`);
    }

    parts.push(response.answer);

    if (response.pendingConfirmation) {
        parts.push(`\n⚠️ Pending approval: ${response.pendingConfirmation.tool} — approve in the web UI.`);
    }

    return parts.join('\n');
}

function truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
}

function getWebAppUrl(): string {
    return process.env.APP_URL || 'http://localhost:5173';
}
