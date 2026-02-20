/**
 * Teams Adaptive Card Formatter
 *
 * Converts BufferedChatResponse into Microsoft Adaptive Card JSON
 * for posting via the Bot Framework reply API.
 */

import { BufferedChatResponse } from '../ai/AIChatService';

interface AdaptiveCard {
    type: string;
    $schema: string;
    version: string;
    body: AdaptiveCardElement[];
    actions?: AdaptiveCardAction[];
}

interface AdaptiveCardElement {
    type: string;
    text?: string;
    wrap?: boolean;
    size?: string;
    weight?: string;
    color?: string;
    spacing?: string;
    isSubtle?: boolean;
    separator?: boolean;
    items?: AdaptiveCardElement[];
    columns?: Array<{ type: string; width: string; items: AdaptiveCardElement[] }>;
}

interface AdaptiveCardAction {
    type: string;
    title: string;
    url?: string;
}

/**
 * Format a buffered chat response as a Teams Adaptive Card.
 */
export function formatAsAdaptiveCard(response: BufferedChatResponse): AdaptiveCard {
    const body: AdaptiveCardElement[] = [];

    // Persona context — subtle header
    if (response.persona.persona !== 'SENIOR_ENGINEER') {
        body.push({
            type: 'TextBlock',
            text: response.persona.displayName,
            size: 'Small',
            weight: 'Lighter',
            color: 'Accent',
            isSubtle: true,
        });
    }

    // Tool call summaries
    if (response.toolCalls.length > 0) {
        const toolText = response.toolCalls
            .map(tc => `**${tc.name}**: ${truncate(tc.summary, 100)}`)
            .join('\n\n');

        body.push({
            type: 'TextBlock',
            text: toolText,
            wrap: true,
            size: 'Small',
            isSubtle: true,
        });

        body.push({
            type: 'TextBlock',
            text: '',
            separator: true,
        });
    }

    // Main answer — split into chunks if very long (Adaptive Card limit)
    const answerChunks = splitText(response.answer, 15000);
    for (const chunk of answerChunks) {
        body.push({
            type: 'TextBlock',
            text: chunk,
            wrap: true,
        });
    }

    // Pending confirmation warning
    if (response.pendingConfirmation) {
        body.push({
            type: 'TextBlock',
            text: '',
            separator: true,
        });
        body.push({
            type: 'TextBlock',
            text: `⚠️ **Pending approval:** \`${response.pendingConfirmation.tool}\`\nPlease approve this action in the TestOps web UI.`,
            wrap: true,
            color: 'Warning',
        });
    }

    // Build card with optional "Open in Dashboard" action
    const actions: AdaptiveCardAction[] = [
        {
            type: 'Action.OpenUrl',
            title: 'Open in Dashboard',
            url: getWebAppUrl(),
        },
    ];

    return {
        type: 'AdaptiveCard',
        $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
        version: '1.5',
        body,
        actions,
    };
}

/**
 * Format a simple text-only fallback.
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

function splitText(text: string, maxChunkLength: number): string[] {
    if (text.length <= maxChunkLength) return [text];

    const chunks: string[] = [];
    let remaining = text;
    while (remaining.length > 0) {
        if (remaining.length <= maxChunkLength) {
            chunks.push(remaining);
            break;
        }
        // Try to split at a paragraph or sentence boundary
        let splitIdx = remaining.lastIndexOf('\n\n', maxChunkLength);
        if (splitIdx < maxChunkLength * 0.3) {
            splitIdx = remaining.lastIndexOf('\n', maxChunkLength);
        }
        if (splitIdx < maxChunkLength * 0.3) {
            splitIdx = maxChunkLength;
        }
        chunks.push(remaining.slice(0, splitIdx));
        remaining = remaining.slice(splitIdx).trimStart();
    }
    return chunks;
}

function getWebAppUrl(): string {
    return process.env.APP_URL || 'http://localhost:5173';
}
