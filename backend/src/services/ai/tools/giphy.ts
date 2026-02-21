/**
 * Giphy Tool — Phase 1 (read-only)
 *
 * Searches Giphy for contextual, work-appropriate GIFs.
 * Content rating enforced at G-rated only.
 * Deduplication ring buffer prevents repeat GIFs within a session.
 *
 * See specs/AUTONOMOUS_AI_SPEC.md § Feature 3.
 */

import { Tool, ToolResult, ToolContext } from './types';
import { logger } from '@/utils/logger';

/** Curated search terms per event context */
const SEARCH_TERMS: Record<string, string[]> = {
    pipeline_broken: ['this is fine fire', 'everything is fine', 'debug mode', 'houston we have a problem'],
    all_tests_passed: ['celebration', 'success dance', 'high five', 'nailed it', 'thumbs up'],
    fix_merged: ['ship it', 'mission accomplished', 'mic drop', 'smooth sailing'],
    flaky_test_detected: ['suspicious', 'hmm interesting', 'detective', 'something fishy'],
    env_down: ['waiting patiently', 'any day now', 'loading', 'coffee break'],
    investigation_complete: ['case closed', 'mystery solved', 'sherlock', 'found it'],
    first_time_user: ['welcome', 'hello there', 'nice to meet you'],
    long_running_task: ['patience', 'almost there', 'hang in there'],
};

/** Session ring buffer: tracks last 20 GIF IDs per session to prevent repeats */
const sessionGifHistory = new Map<string, string[]>();
const MAX_HISTORY = 20;

function recordGif(sessionId: string, gifId: string): void {
    const history = sessionGifHistory.get(sessionId) || [];
    history.push(gifId);
    if (history.length > MAX_HISTORY) history.shift();
    sessionGifHistory.set(sessionId, history);
}

function isRecentlyUsed(sessionId: string, gifId: string): boolean {
    const history = sessionGifHistory.get(sessionId) || [];
    return history.includes(gifId);
}

export const giphySearchTool: Tool = {
    name: 'giphy_search',
    description: 'Search for a contextual, work-appropriate GIF to add personality to status messages. Returns G-rated GIFs only.',
    category: 'dashboard' as Tool['category'],
    requiresConfirmation: false,
    parameters: [
        {
            name: 'query',
            type: 'string',
            description: 'Search query or event type (e.g. "celebration", "pipeline_broken", "all_tests_passed").',
            required: true,
        },
        {
            name: 'limit',
            type: 'number',
            description: 'Number of results to return (default 3, max 5).',
            required: false,
            default: 3,
        },
    ],

    async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
        try {
            const query = args.query as string;
            const limit = Math.min((args.limit as number) || 3, 5);

            // If query matches a curated event, pick a random search term
            const curatedTerms = SEARCH_TERMS[query.toLowerCase().replace(/\s+/g, '_')];
            const searchQuery = curatedTerms
                ? curatedTerms[Math.floor(Math.random() * curatedTerms.length)]
                : query;

            // Check if Giphy API key is configured
            const apiKey = process.env.GIPHY_API_KEY;
            const giphyEnabled = process.env.GIPHY_ENABLED !== 'false';

            if (!giphyEnabled) {
                return {
                    success: true,
                    data: { gifs: [], fallbackEmoji: getFallbackEmoji(query), disabled: true },
                    summary: 'Giphy is disabled. Using emoji fallback.',
                };
            }

            if (!apiKey) {
                return {
                    success: true,
                    data: { gifs: [], fallbackEmoji: getFallbackEmoji(query), noApiKey: true },
                    summary: 'Giphy API key not configured. Using emoji fallback.',
                };
            }

            const rating = process.env.GIPHY_RATING || 'g';
            const url = `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(searchQuery)}&limit=${limit + 5}&rating=${rating}&lang=en`;

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Giphy API error: ${response.status}`);
            }

            const json = await response.json() as {
                data: Array<{
                    id: string;
                    title: string;
                    images: {
                        fixed_width: { url: string; width: string; height: string };
                        fixed_width_small: { url: string; width: string; height: string };
                    };
                    url: string;
                }>;
            };

            // Filter out recently used GIFs, then take the requested limit
            const freshGifs = json.data
                .filter(gif => !isRecentlyUsed(context.sessionId, gif.id))
                .slice(0, limit)
                .map(gif => ({
                    id: gif.id,
                    title: gif.title,
                    url: gif.images.fixed_width.url,
                    thumbnailUrl: gif.images.fixed_width_small.url,
                    width: Number(gif.images.fixed_width.width),
                    height: Number(gif.images.fixed_width.height),
                    giphyUrl: gif.url,
                }));

            // Record used GIFs in session ring buffer
            for (const gif of freshGifs) {
                recordGif(context.sessionId, gif.id);
            }

            const selected = freshGifs[0] || null;
            logger.info(`[giphy_search] Found ${freshGifs.length} GIFs for "${searchQuery}"`);

            return {
                success: true,
                data: {
                    gifs: freshGifs,
                    selected,
                    query: searchQuery,
                    attribution: 'Powered by GIPHY',
                },
                summary: selected
                    ? `Found GIF: "${selected.title}" for "${searchQuery}"`
                    : `No fresh GIFs found for "${searchQuery}"`,
            };
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            logger.error(`[giphy_search] Failed:`, error);

            // Graceful fallback to emoji
            const query = args.query as string;
            return {
                success: true,
                data: { gifs: [], fallbackEmoji: getFallbackEmoji(query), error: msg },
                summary: `Giphy unavailable, using emoji fallback.`,
            };
        }
    },
};

/** Emoji fallback when Giphy is unavailable or disabled */
function getFallbackEmoji(context: string): string {
    const map: Record<string, string> = {
        pipeline_broken: '\uD83D\uDD25',
        all_tests_passed: '\uD83C\uDF89',
        fix_merged: '\uD83D\uDE80',
        flaky_test_detected: '\uD83E\uDD14',
        env_down: '\u2615',
        investigation_complete: '\uD83D\uDD0D',
        celebration: '\uD83C\uDF8A',
        success: '\u2705',
        failure: '\u274C',
    };
    const key = context.toLowerCase().replace(/\s+/g, '_');
    return map[key] || '\uD83D\uDCAC';
}
