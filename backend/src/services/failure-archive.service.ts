/**
 * Failure Archive Service
 * Handles failure CRUD, search, insights, and similarity matching.
 *
 * Collaborative RCA features (locking, revisions, comments, activity feed)
 * are in ./failure-collaboration.service.ts
 *
 * Fingerprinting/similarity utilities are in ./failure-fingerprint.ts
 */

import { prisma } from '../lib/prisma';
import { auditService } from './audit.service';
import {
  FailureArchive,
  CreateFailureArchiveInput,
  DocumentRCAInput,
  SearchFailuresQuery,
  SimilarFailure,
  FailureInsights,
  FailureStatus,
  FailureSeverity
} from '../types/failure-archive';

// Re-export fingerprinting utilities so existing callers still work
export {
  generateFailureSignature,
  normalizeErrorMessage,
  normalizeStackTrace,
  calculateSimilarity,
  levenshteinDistance,
} from './failure-fingerprint';

// Re-export collaboration functions so the controller import stays unchanged
import * as collaboration from './failure-collaboration.service';
import {
  generateFailureSignature,
  normalizeErrorMessage,
  calculateSimilarity,
} from './failure-fingerprint';

export class FailureArchiveService {
  // ─── Fingerprinting (delegated) ──────────────────────────────
  static generateFailureSignature = generateFailureSignature;

  // ─── CRUD / Lifecycle ────────────────────────────────────────

  /**
   * Create a new failure archive entry
   */
  static async createFailure(input: CreateFailureArchiveInput, userId: string, context?: { ip?: string; userAgent?: string }): Promise<FailureArchive> {
    // Check if similar failure exists based on testName and errorMessage
    const existing = await prisma.failureArchive.findFirst({
      where: {
        testName: input.testName,
        errorMessage: input.errorMessage
      }
    });

    if (existing) {
      // Update existing entry
      return prisma.failureArchive.update({
        where: { id: existing.id },
        data: {
          lastOccurrence: new Date(),
          occurrenceCount: { increment: 1 },
          resolved: false // Reopen if it occurs again
        }
      }) as unknown as FailureArchive;
    }

    // Create new entry
    const failure = await prisma.failureArchive.create({
      data: {
        ...input,
        tags: input.tags?.join(',') || null,
        severity: input.severity || FailureSeverity.MEDIUM,
        resolved: false,
        occurrenceCount: 1,
      }
    }) as unknown as FailureArchive;

    // Audit Log
    void auditService.log(
      'FAILURE_CREATE',
      'FailureArchive',
      failure.id,
      userId,
      { testName: failure.testName },
      context
    );

    return failure;
  }

  /**
   * Document root cause analysis for a failure
   */
  static async documentRCA(input: DocumentRCAInput, userId: string, context?: { ip?: string; userAgent?: string }): Promise<FailureArchive> {
    const updateData: Record<string, unknown> = {
      rootCause: input.rootCause,
      solution: input.solution,
      prevention: input.prevention,
      rcaDocumented: true,
      tags: input.tags?.join(',')
    };

    if (input.jiraIssueKey) {
      updateData.relatedJiraIssue = input.jiraIssueKey;
    }

    if (input.timeToResolve) {
      updateData.resolvedAt = new Date();
      updateData.resolved = true;
    }

    const failure = await prisma.failureArchive.update({
      where: { id: input.id },
      data: updateData
    }) as unknown as FailureArchive;

    // Audit Log
    void auditService.log(
      'FAILURE_RCA_UPDATE',
      'FailureArchive',
      failure.id,
      userId,
      { rootCause: input.rootCause },
      context
    );

    return failure;
  }

  /**
   * Find similar failures using multiple matching strategies
   */
  static async findSimilarFailures(
    testName: string,
    errorMessage: string,
    stackTrace?: string,
    limit: number = 5
  ): Promise<SimilarFailure[]> {
    const results: SimilarFailure[] = [];

    // 1. Exact match (testName + exact error)
    const exactMatches = await prisma.failureArchive.findMany({
      where: {
        testName,
        errorMessage,
        rcaDocumented: true
      },
      orderBy: { lastOccurrence: 'desc' },
      take: limit
    });

    results.push(...exactMatches.map(f => ({
      failure: f as unknown as FailureArchive,
      similarity: 1.0,
      matchType: 'exact' as const,
      matchReason: 'Exact error match'
    })));

    // 2. Fuzzy match — same test name, similar normalized error message
    if (results.length < limit) {
      const exactIds = new Set(exactMatches.map(f => f.id));
      const candidates = await prisma.failureArchive.findMany({
        where: {
          testName,
          rcaDocumented: true,
          id: { notIn: [...exactIds] },
        },
        orderBy: { lastOccurrence: 'desc' },
        take: limit * 3, // Fetch extra to score and filter
      });

      const normalizedInput = normalizeErrorMessage(errorMessage);
      const fuzzy: SimilarFailure[] = [];

      for (const candidate of candidates) {
        const normalizedCandidate = normalizeErrorMessage(candidate.errorMessage);
        const similarity = calculateSimilarity(normalizedInput, normalizedCandidate);
        if (similarity >= 0.6) {
          fuzzy.push({
            failure: candidate as unknown as FailureArchive,
            similarity,
            matchType: 'fuzzy' as const,
            matchReason: `Normalized error similarity: ${(similarity * 100).toFixed(0)}%`,
          });
        }
      }

      // Sort by similarity descending, take remaining slots
      fuzzy.sort((a, b) => b.similarity - a.similarity);
      results.push(...fuzzy.slice(0, limit - results.length));
    }

    return results;
  }

  /**
   * Search failures with filters
   */
  static async searchFailures(query: SearchFailuresQuery): Promise<{
    failures: FailureArchive[];
    total: number;
  }> {
    const where: Record<string, unknown> = {};

    if (query.testName) {
      where.testName = { contains: query.testName, mode: 'insensitive' };
    }

    if (query.errorMessage) {
      where.errorMessage = { contains: query.errorMessage, mode: 'insensitive' };
    }

    // Status mapping to 'resolved' boolean
    if (query.status) {
      if (query.status === FailureStatus.RESOLVED) {
        where.resolved = true;
      } else if (query.status === FailureStatus.NEW) {
        where.resolved = false;
      }
    }

    if (query.severity) {
      where.severity = query.severity;
    }

    // isRecurring mapping
    if (query.isRecurring !== undefined) {
      if (query.isRecurring) {
        where.occurrenceCount = { gt: 1 };
      }
    }

    if (query.tags && query.tags.length > 0) {
      // For string tags, simple contains check
      where.tags = { contains: query.tags[0] };
    }

    if (query.startDate || query.endDate) {
      where.lastOccurrence = {};
      if (query.startDate) {
        (where.lastOccurrence as Record<string, unknown>).gte = query.startDate;
      }
      if (query.endDate) {
        (where.lastOccurrence as Record<string, unknown>).lte = query.endDate;
      }
    }

    const [failures, total] = await Promise.all([
      prisma.failureArchive.findMany({
        where,
        orderBy: { lastOccurrence: 'desc' },
        take: query.limit || 50,
        skip: query.offset || 0,
      }),
      prisma.failureArchive.count({ where })
    ]);

    return {
      failures: failures as unknown as FailureArchive[],
      total
    };
  }

  /**
   * Get failure insights and statistics
   */
  static async getInsights(days: number = 30): Promise<FailureInsights> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [
      totalFailures,
      documentedCount,
      recurringCount,
      commonFailures,
    ] = await Promise.all([
      prisma.failureArchive.count({
        where: { createdAt: { gte: startDate } }
      }),
      prisma.failureArchive.count({
        where: {
          createdAt: { gte: startDate },
          rcaDocumented: true
        }
      }),
      prisma.failureArchive.count({
        where: {
          createdAt: { gte: startDate },
          occurrenceCount: { gt: 1 }
        }
      }),
      prisma.failureArchive.groupBy({
        by: ['testName'],
        _count: {
          testName: true,
        },
        _max: {
          lastOccurrence: true
        },
        orderBy: {
          _count: {
            testName: 'desc'
          }
        },
        take: 10
      })
    ]);

    return {
      totalFailures,
      documentedCount,
      recurringCount,
      averageTimeToResolve: 0, // Not tracked
      mostCommonFailures: commonFailures.map(f => ({
        testName: f.testName,
        count: f._count.testName,
        lastOccurrence: f._max.lastOccurrence || new Date()
      })),
      recentPatterns: []
    };
  }

  /**
   * Mark failure as resolved
   */
  static async markResolved(
    id: string,
    resolvedBy: string,
    userId: string,
    timeToResolve: number | undefined,
    context?: { ip?: string; userAgent?: string }
  ): Promise<FailureArchive> {
    const failure = await prisma.failureArchive.update({
      where: { id },
      data: {
        resolved: true,
        resolvedAt: new Date(),
      }
    }) as unknown as FailureArchive;

    // Audit Log
    void auditService.log(
      'FAILURE_RESOLVE',
      'FailureArchive',
      id,
      userId,
      { resolvedBy },
      context
    );

    return failure;
  }

  /**
   * Get failure by ID with related info
   */
  static async getById(id: string): Promise<FailureArchive | null> {
    return prisma.failureArchive.findUnique({
      where: { id },
    }) as unknown as FailureArchive | null;
  }

  // ─── Collaborative RCA (delegated to failure-collaboration.service.ts) ───

  static documentRCAWithLocking = collaboration.documentRCAWithLocking;
  static getRCARevisions = collaboration.getRCARevisions;
  static addComment = collaboration.addComment;
  static getComments = collaboration.getComments;
  static deleteComment = collaboration.deleteComment;
  static getActivityFeed = collaboration.getActivityFeed;
}
