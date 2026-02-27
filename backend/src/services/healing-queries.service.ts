/**
 * Healing Queries Service — CRUD operations for healing rules, quarantine,
 * events, stats, and fix suggestions.
 *
 * Extracted from self-healing.service.ts for modularity and the
 * 600-line file-length CI gate.
 */

import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { BUILT_IN_PATTERNS } from './healing-patterns';
import type {
  CreateHealingRuleInput,
  UpdateHealingRuleInput,
  HealingEventFilters,
} from '../types/healing';

// ─── Rule CRUD ───────────────────────────────────────────

export class HealingQueriesService {
  static async getRules(): Promise<unknown[]> {
    return prisma.healingRule.findMany({
      orderBy: [{ priority: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { events: true } } },
    });
  }

  static async getRuleById(id: string): Promise<unknown> {
    const rule = await prisma.healingRule.findUnique({
      where: { id },
      include: { _count: { select: { events: true } } },
    });
    if (!rule) throw new Error('Healing rule not found');
    return rule;
  }

  static async createRule(input: CreateHealingRuleInput): Promise<unknown> {
    if (input.patternType === 'regex' || !input.patternType) {
      try {
        new RegExp(input.pattern, 'i');
      } catch {
        throw new Error(`Invalid regex pattern: ${input.pattern}`);
      }
    }

    return prisma.healingRule.create({
      data: {
        name: input.name,
        description: input.description,
        pattern: input.pattern,
        patternType: input.patternType || 'regex',
        category: input.category || 'custom',
        action: input.action || 'retry',
        maxRetries: input.maxRetries ?? 2,
        cooldownMinutes: input.cooldownMinutes ?? 60,
        confidenceThreshold: input.confidenceThreshold ?? 0.9,
        priority: input.priority ?? 50,
        isBuiltIn: false,
      },
    });
  }

  static async updateRule(id: string, input: UpdateHealingRuleInput): Promise<unknown> {
    const existing = await prisma.healingRule.findUnique({ where: { id } });
    if (!existing) throw new Error('Healing rule not found');
    if (existing.isBuiltIn && input.pattern !== undefined) {
      throw new Error('Cannot modify pattern of built-in rules');
    }

    if (input.pattern && (input.patternType === 'regex' || existing.patternType === 'regex')) {
      try {
        new RegExp(input.pattern, 'i');
      } catch {
        throw new Error(`Invalid regex pattern: ${input.pattern}`);
      }
    }

    return prisma.healingRule.update({ where: { id }, data: input });
  }

  static async toggleRule(id: string, enabled: boolean): Promise<unknown> {
    return prisma.healingRule.update({ where: { id }, data: { enabled } });
  }

  static async deleteRule(id: string): Promise<void> {
    const existing = await prisma.healingRule.findUnique({ where: { id } });
    if (!existing) throw new Error('Healing rule not found');
    if (existing.isBuiltIn) throw new Error('Cannot delete built-in rules — disable them instead');

    await prisma.healingRule.delete({ where: { id } });
  }

  // ─── Quarantine CRUD ──────────────────────────────────

  static async getQuarantinedTests(): Promise<unknown[]> {
    return prisma.quarantinedTest.findMany({
      where: { status: 'quarantined' },
      orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
    });
  }

  static async getAllQuarantinedTests(): Promise<unknown[]> {
    return prisma.quarantinedTest.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  static async quarantineTest(
    testName: string,
    reason: string,
    severity: string,
    userId: string,
    flakinessScore?: number,
  ): Promise<unknown> {
    return prisma.quarantinedTest.upsert({
      where: { testName },
      create: {
        testName,
        reason,
        severity,
        quarantinedBy: userId,
        flakinessScore: flakinessScore ?? 0,
        status: 'quarantined',
      },
      update: {
        reason,
        severity,
        status: 'quarantined',
        flakinessScore: flakinessScore ?? undefined,
        occurrenceCount: { increment: 1 },
      },
    });
  }

  static async reinstateTest(id: string): Promise<unknown> {
    const existing = await prisma.quarantinedTest.findUnique({ where: { id } });
    if (!existing) throw new Error('Quarantined test not found');

    return prisma.quarantinedTest.update({
      where: { id },
      data: { status: 'reinstated' },
    });
  }

  static async deleteQuarantinedTest(id: string): Promise<void> {
    const existing = await prisma.quarantinedTest.findUnique({ where: { id } });
    if (!existing) throw new Error('Quarantined test not found');

    await prisma.quarantinedTest.delete({ where: { id } });
  }

  static async getQuarantineStats(): Promise<{
    quarantined: number;
    reinstated: number;
    totalQuarantined: number;
  }> {
    const [quarantined, reinstated, totalQuarantined] = await Promise.all([
      prisma.quarantinedTest.count({ where: { status: 'quarantined' } }),
      prisma.quarantinedTest.count({ where: { status: 'reinstated' } }),
      prisma.quarantinedTest.count(),
    ]);

    return { quarantined, reinstated, totalQuarantined };
  }

  // ─── Events & Stats ──────────────────────────────────

  static async getEvents(filters?: HealingEventFilters): Promise<unknown[]> {
    const limit = filters?.limit ?? 50;

    return prisma.healingEvent.findMany({
      where: {
        ...(filters?.pipelineId && { pipelineId: filters.pipelineId }),
        ...(filters?.testRunId && { testRunId: filters.testRunId }),
        ...(filters?.action && { action: filters.action }),
        ...(filters?.status && { status: filters.status }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { rule: { select: { name: true, category: true } } },
    });
  }

  static async getStats(): Promise<{
    totalEvents: number;
    successfulRetries: number;
    failedRetries: number;
    skippedEvents: number;
    activeRules: number;
    retriesSavedToday: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalEvents, successfulRetries, failedRetries, skippedEvents, activeRules, retriesSavedToday] =
      await Promise.all([
        prisma.healingEvent.count(),
        prisma.healingEvent.count({ where: { action: 'retry', status: 'succeeded' } }),
        prisma.healingEvent.count({ where: { action: 'retry', status: 'failed' } }),
        prisma.healingEvent.count({ where: { status: 'skipped' } }),
        prisma.healingRule.count({ where: { enabled: true } }),
        prisma.healingEvent.count({
          where: { action: 'retry', status: 'succeeded', createdAt: { gte: today } },
        }),
      ]);

    return { totalEvents, successfulRetries, failedRetries, skippedEvents, activeRules, retriesSavedToday };
  }

  // ─── Fix Suggestions ──────────────────────────────────

  static async getFixSuggestions(limit = 20): Promise<unknown[]> {
    return prisma.healingEvent.findMany({
      where: {
        action: 'fix_pr',
        status: { in: ['succeeded', 'failed'] },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { rule: { select: { name: true, category: true } } },
    });
  }

  // ─── Seed ─────────────────────────────────────────────

  static async seedBuiltInRules(): Promise<number> {
    let seeded = 0;

    for (const pattern of BUILT_IN_PATTERNS) {
      const existing = await prisma.healingRule.findFirst({
        where: { name: pattern.name, isBuiltIn: true },
      });

      if (!existing) {
        await prisma.healingRule.create({
          data: {
            ...pattern,
            isBuiltIn: true,
            enabled: true,
          },
        });
        seeded++;
      }
    }

    if (seeded > 0) {
      logger.info(`Self-healing: seeded ${seeded} built-in rules`);
    }

    return seeded;
  }
}
