/**
 * useCardAnalytics — Lightweight analytics hook for AI Copilot cards.
 *
 * Tracks:
 * - Card render events (which cards appear and how often)
 * - Section expand/collapse toggles
 * - Action button clicks
 * - Confirmation approve/deny decisions
 *
 * Events are buffered and flushed to the backend in batches.
 * Falls back to console.debug in dev mode if no analytics endpoint is configured.
 */

import { useCallback, useRef, useEffect } from 'react';
import { api } from '../../../../api';

export interface CardAnalyticsEvent {
    type: 'card_render' | 'card_expand' | 'card_action' | 'confirmation_decision';
    card: string;
    /** Tool name (e.g. 'jira_get', 'github_create_pr') */
    tool?: string;
    /** Action label or expand section name */
    action?: string;
    /** Extra context (e.g. 'approved', 'denied', userRole) */
    meta?: Record<string, string | number | boolean>;
    timestamp: number;
}

const FLUSH_INTERVAL_MS = 10_000; // Flush every 10 seconds
const MAX_BUFFER_SIZE = 50;

let eventBuffer: CardAnalyticsEvent[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;

function flushEvents() {
    if (eventBuffer.length === 0) return;

    const batch = [...eventBuffer];
    eventBuffer = [];

    // Fire-and-forget POST to analytics endpoint
    api.post('/analytics/card-events', { events: batch }).catch(() => {
        // Silently fail — analytics should never break UX
        if (import.meta.env.DEV) {
            // eslint-disable-next-line no-console
            console.debug('[CardAnalytics] Flush failed, events:', batch.length);
        }
    });
}

function enqueue(event: CardAnalyticsEvent) {
    eventBuffer.push(event);

    if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.debug('[CardAnalytics]', event.type, event.card, event.action || '');
    }

    // Flush if buffer is full
    if (eventBuffer.length >= MAX_BUFFER_SIZE) {
        flushEvents();
    }

    // Start interval timer if not running
    if (!flushTimer) {
        flushTimer = setInterval(flushEvents, FLUSH_INTERVAL_MS);
    }
}

// Flush on page unload
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', flushEvents);
}

/**
 * Hook that returns analytics tracking functions scoped to a specific card.
 */
export function useCardAnalytics(cardName: string, toolName?: string) {
    const hasFiredRender = useRef(false);

    // Track card render (once per mount)
    useEffect(() => {
        if (!hasFiredRender.current) {
            hasFiredRender.current = true;
            enqueue({
                type: 'card_render',
                card: cardName,
                tool: toolName,
                timestamp: Date.now(),
            });
        }
    }, [cardName, toolName]);

    const trackExpand = useCallback((sectionLabel: string, expanded: boolean) => {
        enqueue({
            type: 'card_expand',
            card: cardName,
            tool: toolName,
            action: sectionLabel,
            meta: { expanded },
            timestamp: Date.now(),
        });
    }, [cardName, toolName]);

    const trackAction = useCallback((actionLabel: string, meta?: Record<string, string | number | boolean>) => {
        enqueue({
            type: 'card_action',
            card: cardName,
            tool: toolName,
            action: actionLabel,
            meta,
            timestamp: Date.now(),
        });
    }, [cardName, toolName]);

    const trackConfirmation = useCallback((decision: 'approved' | 'denied', userRole: string) => {
        enqueue({
            type: 'confirmation_decision',
            card: cardName,
            tool: toolName,
            action: decision,
            meta: { userRole },
            timestamp: Date.now(),
        });
    }, [cardName, toolName]);

    return { trackExpand, trackAction, trackConfirmation };
}
