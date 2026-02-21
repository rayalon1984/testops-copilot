/**
 * PersonaRouter — Two-Tier Query Classifier for Virtual Team Routing
 *
 * Routes user queries to the right team persona before fulfillment.
 * Tier 1: Keyword rules (zero cost, <1ms)
 * Tier 2: LLM micro-classification fallback (~200 tokens)
 *
 * Follows the routing rubric in specs/team/TEAM_SELECTION.md:
 *   Security → AI_ARCHITECT → DATA_ENGINEER → UX_DESIGNER →
 *   PERFORMANCE_ENGINEER → TEST_ENGINEER → DEVOPS_ENGINEER →
 *   AI_PRODUCT_MANAGER → SENIOR_ENGINEER (default)
 */

import { getAIManager } from './manager';
import { logger } from '@/utils/logger';

// ─── Types ───

export interface PersonaSelection {
    /** Internal key, e.g. "TEST_ENGINEER" */
    persona: string;
    /** Human-readable, e.g. "Test Engineer" */
    displayName: string;
    /** 0-1 confidence score */
    confidence: number;
    /** Short explanation, e.g. "Query mentions flaky tests" */
    reasoning: string;
    /** Which classifier tier produced the result */
    tier: 'keyword' | 'llm';
}

// ─── Keyword Rules ───

interface PersonaRule {
    persona: string;
    displayName: string;
    /** Each sub-array is an AND group — all words must appear (case-insensitive). */
    keywords: string[][];
    description: string;
}

/**
 * Ordered to match the TEAM_SELECTION.md priority rubric.
 * First match wins (highest-priority persona first).
 */
const PERSONA_RULES: PersonaRule[] = [
    {
        persona: 'SECURITY_ENGINEER',
        displayName: 'Security Engineer',
        keywords: [
            ['auth'], ['authentication'], ['authorization'],
            ['permission'], ['secret'], ['vulnerability'],
            ['cve'], ['security'], ['xss'], ['csrf'], ['injection'],
            ['token', 'leak'], ['credential'], ['oauth'], ['saml'],
            ['oidc'], ['rbac'], ['role', 'access'], ['api', 'key'],
            ['encrypt'], ['password'], ['sso'], ['mfa'],
        ],
        description: 'Authentication, authorization, secrets, security posture',
    },
    {
        persona: 'AI_ARCHITECT',
        displayName: 'AI Architect',
        keywords: [
            ['ai', 'config'], ['ai', 'provider'], ['model', 'switch'],
            ['tool', 'policy'], ['ai', 'architect'], ['prompt', 'engineering'],
            ['llm', 'config'], ['bedrock'], ['anthropic', 'key'],
            ['openai', 'key'], ['switch', 'provider'], ['ai', 'model'],
            ['persona', 'routing'], ['ai', 'cost'], ['ai', 'budget'],
        ],
        description: 'AI configuration, provider selection, tool behavior',
    },
    {
        persona: 'DATA_ENGINEER',
        displayName: 'Data Engineer',
        keywords: [
            ['schema'], ['migration'], ['database'],
            ['query', 'slow'], ['data', 'integrity'], ['prisma'],
            ['sql'], ['index', 'missing'], ['table'], ['column'],
            ['foreign', 'key'], ['relation'], ['data', 'model'],
            ['backup'], ['restore'], ['etl'],
        ],
        description: 'Database, schema, migrations, data integrity',
    },
    {
        persona: 'UX_DESIGNER',
        displayName: 'UX Designer',
        keywords: [
            ['ux'], ['user experience'], ['ui', 'design'],
            ['layout'], ['accessibility'], ['a11y'],
            ['responsive'], ['design', 'system'], ['dark', 'mode'],
            ['theme'], ['component', 'design'], ['wireframe'],
            ['usability'], ['cognitive', 'load'],
        ],
        description: 'UX flows, interaction design, visual hierarchy, accessibility',
    },
    {
        persona: 'PERFORMANCE_ENGINEER',
        displayName: 'Performance Engineer',
        keywords: [
            ['slow'], ['latency'], ['timeout'], ['performance'],
            ['throughput'], ['profiling'], ['memory', 'leak'],
            ['cpu'], ['bottleneck'], ['load', 'test'],
            ['benchmark'], ['optimization'], ['cache', 'hit'],
            ['p95'], ['p99'], ['response', 'time'],
        ],
        description: 'Performance, latency, throughput, profiling',
    },
    {
        persona: 'TEST_ENGINEER',
        displayName: 'Test Engineer',
        keywords: [
            ['flaky', 'test'], ['flaky'], ['test', 'fail'],
            ['coverage'], ['ci', 'broken'], ['test', 'skip'],
            ['test', 'strategy'], ['regression'], ['test', 'suite'],
            ['e2e', 'test'], ['unit', 'test'], ['integration', 'test'],
            ['test', 'result'], ['assertion'], ['test', 'run'],
            ['spec', 'fail'], ['jest'], ['cypress'], ['playwright'],
            ['selenium'], ['test', 'report'], ['failed', 'test'],
            ['pass', 'rate'], ['test', 'status'], ['broken', 'test'],
            ['quarantine'], ['test', 'data'], ['fixture'],
            ['mock', 'test'], ['stub'], ['test', 'case'],
            ['smoke', 'test'], ['sanity', 'test'],
        ],
        description: 'Test failures, flaky tests, CI quality, test coverage',
    },
    {
        persona: 'DEVOPS_ENGINEER',
        displayName: 'DevOps Engineer',
        keywords: [
            ['pipeline'], ['deploy'], ['docker'],
            ['jenkins', 'build'], ['ci', 'cd'], ['ci/cd'],
            ['kubernetes'], ['k8s'], ['helm'],
            ['github', 'action'], ['build', 'fail'],
            ['jenkins'], ['circleci'], ['gitlab', 'ci'],
            ['artifact'], ['container'], ['devops'],
            ['infrastructure'], ['terraform'], ['ansible'],
            ['build', 'log'], ['pipeline', 'status'],
            ['deployment'], ['rollback'], ['release'],
        ],
        description: 'Pipelines, deployments, Docker, CI/CD, build infrastructure',
    },
    {
        persona: 'AI_PRODUCT_MANAGER',
        displayName: 'Product Manager',
        keywords: [
            ['what can'], ['help me'], ['feature'],
            ['roadmap'], ['capability'], ['what', 'do'],
            ['how', 'use'], ['getting', 'started'],
            ['onboarding'], ['use case'], ['what', 'tool'],
            ['tell me about'], ['show me'], ['how does'],
            ['what is'], ['can you'], ['tutorial'],
            ['guide'], ['demo'], ['walkthrough'],
        ],
        description: 'Product capabilities, feature discovery, what the system can do',
    },
];

const DEFAULT_PERSONA: PersonaSelection = {
    persona: 'SENIOR_ENGINEER',
    displayName: 'Senior Engineer',
    confidence: 0.5,
    reasoning: 'No specialist match — routed to generalist',
    tier: 'keyword',
};

// ─── Tier 1: Keyword Matching ───

function matchKeywordRules(message: string): PersonaSelection | null {
    const lower = message.toLowerCase();

    for (const rule of PERSONA_RULES) {
        for (const group of rule.keywords) {
            const allMatch = group.every(word => lower.includes(word));
            if (allMatch) {
                return {
                    persona: rule.persona,
                    displayName: rule.displayName,
                    confidence: 0.85,
                    reasoning: `Query matches keyword group: [${group.join(', ')}]`,
                    tier: 'keyword',
                };
            }
        }
    }

    return null;
}

// ─── Tier 2: LLM Micro-Classification ───

const CLASSIFICATION_PROMPT = `You are a query classifier for a TestOps platform's virtual team.
Classify the user's query into exactly ONE persona from this list:

- SECURITY_ENGINEER: auth, secrets, vulnerabilities, security posture
- AI_ARCHITECT: AI config, provider selection, LLM behavior, tool policy
- DATA_ENGINEER: database, schema, migrations, query performance, data integrity
- UX_DESIGNER: UI/UX flows, design, accessibility, visual hierarchy
- PERFORMANCE_ENGINEER: latency, throughput, profiling, load testing, memory
- TEST_ENGINEER: test failures, flaky tests, coverage, CI quality, test strategy
- DEVOPS_ENGINEER: pipelines, deployments, Docker, CI/CD, build infra
- AI_PRODUCT_MANAGER: feature discovery, capabilities, roadmap, getting started
- SENIOR_ENGINEER: general implementation, operational, anything else

Respond with ONLY a JSON object (no markdown, no explanation):
{"persona": "PERSONA_KEY", "confidence": 0.0-1.0, "reasoning": "brief explanation"}`;

async function classifyWithLLM(message: string): Promise<PersonaSelection> {
    try {
        const aiManager = getAIManager();

        if (!aiManager.isInitialized() || !aiManager.isEnabled()) {
            logger.debug('[PersonaRouter] LLM not available, using default persona');
            return DEFAULT_PERSONA;
        }

        const response = await aiManager.getProvider()!.chat(
            [
                { role: 'system', content: CLASSIFICATION_PROMPT },
                { role: 'user', content: message },
            ],
            { maxTokens: 150, temperature: 0 },
        );

        const text = response.content.trim();
        // Extract JSON from response (handle possible markdown wrapping)
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            logger.warn('[PersonaRouter] LLM returned non-JSON:', text);
            return DEFAULT_PERSONA;
        }

        const parsed = JSON.parse(jsonMatch[0]);
        const persona = parsed.persona as string;
        const displayName = PERSONA_RULES.find(r => r.persona === persona)?.displayName
            || (persona === 'SENIOR_ENGINEER' ? 'Senior Engineer' : persona);

        return {
            persona,
            displayName,
            confidence: Math.min(1, Math.max(0, parsed.confidence || 0.7)),
            reasoning: parsed.reasoning || 'LLM classification',
            tier: 'llm',
        };
    } catch (error) {
        logger.warn('[PersonaRouter] LLM classification failed, using default:', error);
        return DEFAULT_PERSONA;
    }
}

// ─── In-Memory Cache (TTL-based) ───

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const routingCache = new Map<string, { result: PersonaSelection; expiresAt: number }>();

function getCachedResult(key: string): PersonaSelection | null {
    const entry = routingCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        routingCache.delete(key);
        return null;
    }
    return entry.result;
}

function setCachedResult(key: string, result: PersonaSelection): void {
    // Evict stale entries when cache grows (prevent unbounded growth)
    if (routingCache.size > 500) {
        const now = Date.now();
        for (const [k, v] of routingCache) {
            if (now > v.expiresAt) routingCache.delete(k);
        }
    }
    routingCache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
}

/**
 * Normalize message for cache key — lowercase, collapse whitespace.
 */
function normalizeForCache(message: string): string {
    return message.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 200);
}

// ─── Public API ───

/**
 * Route a user query to the appropriate team persona.
 * Tier 0 (cache) → Tier 1 (keyword) → Tier 2 (LLM fallback).
 */
export async function routeToPersona(message: string, _userRole: string): Promise<PersonaSelection> {
    const cacheKey = normalizeForCache(message);

    // Tier 0: check cache
    const cached = getCachedResult(cacheKey);
    if (cached) {
        logger.debug(`[PersonaRouter] Cache hit: ${cached.persona}`);
        return cached;
    }

    // Tier 1: keyword rules
    const keywordMatch = matchKeywordRules(message);
    if (keywordMatch) {
        logger.info(`[PersonaRouter] Tier 1 match: ${keywordMatch.persona} — ${keywordMatch.reasoning}`);
        setCachedResult(cacheKey, keywordMatch);
        return keywordMatch;
    }

    // Tier 2: LLM micro-classification
    logger.info('[PersonaRouter] No keyword match, falling back to LLM classification');
    const llmMatch = await classifyWithLLM(message);
    logger.info(`[PersonaRouter] Tier 2 result: ${llmMatch.persona} — ${llmMatch.reasoning}`);
    setCachedResult(cacheKey, llmMatch);
    return llmMatch;
}

/**
 * Get all available personas with metadata (for GET /api/v1/ai/personas).
 */
export function getAvailablePersonas() {
    const personas = PERSONA_RULES.map(rule => ({
        persona: rule.persona,
        displayName: rule.displayName,
        description: rule.description,
        autoSelectable: true,
    }));

    // Add the default persona
    personas.push({
        persona: 'SENIOR_ENGINEER',
        displayName: 'Senior Engineer',
        description: 'General implementation, operational queries, cross-cutting concerns',
        autoSelectable: true,
    });

    return personas;
}
