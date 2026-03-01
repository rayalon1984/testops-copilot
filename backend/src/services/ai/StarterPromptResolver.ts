/**
 * StarterPromptResolver — Resolves the 4 starter prompts for a user.
 *
 * Merge order:  user pins  →  context signals (Tier 2)  →  role defaults
 * Always returns exactly 4 prompts.
 */

import { prisma } from '../../lib/prisma';
import { getCatalogForRole, getPromptById, type StarterPrompt } from './starterPromptCatalog';
import { logger } from '../../utils/logger';

const MAX_PROMPTS = 4;

export interface ResolvedPrompt extends StarterPrompt {
  pinned: boolean;
  source: 'pin' | 'context' | 'role';
}

export interface PinnedPromptEntry {
  id?: string;         // Catalog ID (for catalog prompts)
  label: string;
  prompt: string;
}

// ─── Context Signals (Tier 2) ──────────────────────────────────

interface ContextSignal {
  condition: () => Promise<boolean>;
  prompt: StarterPrompt;
}

/**
 * Build context-aware prompt signals based on live system state.
 * Each signal has a condition that's checked at resolve time.
 */
function getContextSignals(): ContextSignal[] {
  return [
    {
      // If there are recently failed test runs (last hour)
      condition: async () => {
        try {
          const recentFailed = await prisma.testRun.count({
            where: {
              status: 'FAILED',
              completedAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
            },
          });
          return recentFailed > 0;
        } catch { return false; }
      },
      prompt: {
        id: 'ctx-recent-failures',
        label: 'New failures detected',
        prompt: 'There are recent test failures in the last hour. Analyze them and suggest fixes.',
        icon: 'NotificationsActive',
        category: 'context',
      },
    },
    {
      // If there are quarantined tests pending review
      condition: async () => {
        try {
          const quarantined = await prisma.quarantinedTest.count({
            where: { status: 'quarantined' },
          });
          return quarantined >= 3;
        } catch { return false; }
      },
      prompt: {
        id: 'ctx-quarantine-review',
        label: 'Quarantine needs review',
        prompt: 'There are quarantined tests that may be ready for reinstatement. Review them.',
        icon: 'Shield',
        category: 'context',
      },
    },
    {
      // If many test runs failed in the last 24h
      condition: async () => {
        try {
          const failedRuns = await prisma.testRun.count({
            where: {
              status: 'FAILED',
              completedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
            },
          });
          return failedRuns >= 5;
        } catch { return false; }
      },
      prompt: {
        id: 'ctx-pipeline-failed',
        label: 'Pipeline failures trending',
        prompt: 'Multiple pipeline failures in the last 24 hours. Investigate the pattern and suggest recovery steps.',
        icon: 'Error',
        category: 'context',
      },
    },
  ];
}

// ─── Resolver ──────────────────────────────────────────────────

/**
 * Parse pinned prompts from the user's stored JSON.
 */
function parsePinnedPrompts(raw: string | null): PinnedPromptEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p: unknown): p is PinnedPromptEntry =>
        typeof p === 'object' && p !== null &&
        typeof (p as PinnedPromptEntry).label === 'string' &&
        typeof (p as PinnedPromptEntry).prompt === 'string',
    );
  } catch {
    return [];
  }
}

/**
 * Resolve starter prompts for a given user.
 *
 * Priority: user pins → context signals → role defaults.
 * Always returns exactly MAX_PROMPTS items.
 */
export async function resolveStarterPrompts(
  userId: string,
  userRole: string,
): Promise<ResolvedPrompt[]> {
  const result: ResolvedPrompt[] = [];
  const usedIds = new Set<string>();

  // 1. Fetch user's pinned prompts
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { pinnedStarterPrompts: true },
    });

    const pins = parsePinnedPrompts(user?.pinnedStarterPrompts ?? null);

    for (const pin of pins) {
      if (result.length >= MAX_PROMPTS) break;

      // If pin references a catalog ID, resolve it
      if (pin.id) {
        const catalogPrompt = getPromptById(pin.id);
        if (catalogPrompt) {
          result.push({ ...catalogPrompt, pinned: true, source: 'pin' });
          usedIds.add(catalogPrompt.id);
          continue;
        }
      }

      // Custom prompt (user-created)
      result.push({
        id: `custom-${result.length}`,
        label: pin.label,
        prompt: pin.prompt,
        pinned: true,
        source: 'pin',
      });
    }
  } catch (err) {
    logger.warn('[StarterPrompts] Failed to load user pins, falling back to defaults:', err);
  }

  // 2. Check context signals (Tier 2)
  if (result.length < MAX_PROMPTS) {
    const signals = getContextSignals();
    for (const signal of signals) {
      if (result.length >= MAX_PROMPTS) break;
      if (usedIds.has(signal.prompt.id)) continue;

      try {
        const matches = await signal.condition();
        if (matches) {
          result.push({ ...signal.prompt, pinned: false, source: 'context' });
          usedIds.add(signal.prompt.id);
        }
      } catch {
        // Skip failed signals silently
      }
    }
  }

  // 3. Fill remaining slots with role defaults
  if (result.length < MAX_PROMPTS) {
    const roleDefaults = getCatalogForRole(userRole, MAX_PROMPTS * 2);
    for (const prompt of roleDefaults) {
      if (result.length >= MAX_PROMPTS) break;
      if (usedIds.has(prompt.id)) continue;
      result.push({ ...prompt, pinned: false, source: 'role' });
      usedIds.add(prompt.id);
    }
  }

  return result;
}

/**
 * Save user's pinned starter prompts.
 */
export async function savePinnedPrompts(
  userId: string,
  pins: PinnedPromptEntry[],
): Promise<void> {
  const trimmed = pins.slice(0, MAX_PROMPTS);
  const json = trimmed.length > 0 ? JSON.stringify(trimmed) : null;

  await prisma.user.update({
    where: { id: userId },
    data: { pinnedStarterPrompts: json as string | null },
  });
}
