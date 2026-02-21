/**
 * Failure Archive Service
 * Handles root cause analysis storage, retrieval, and smart matching
 */

import { prisma } from '../lib/prisma';
import { auditService } from './audit.service';
import crypto from 'crypto';
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

export class FailureArchiveService {
  /**
   * Generate a unique signature for failure pattern matching
   */
  static generateFailureSignature(
    testName: string,
    errorMessage: string,
    stackTrace?: string
  ): string {
    const normalizedError = this.normalizeErrorMessage(errorMessage);
    const stackHash = stackTrace
      ? crypto.createHash('md5').update(this.normalizeStackTrace(stackTrace)).digest('hex').substring(0, 8)
      : 'nostk';
    const testHash = crypto.createHash('md5').update(testName).digest('hex').substring(0, 8);

    return `${testHash}:${normalizedError}:${stackHash}`;
  }

  /**
   * Normalize error messages by removing variable parts
   */
  private static normalizeErrorMessage(error: string): string {
    return error
      .toLowerCase()
      // Remove timestamps
      .replace(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?Z?/g, 'TIMESTAMP')
      // Remove UUIDs
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, 'UUID')
      // Remove IDs
      .replace(/id[=:\s]+[\w-]+/gi, 'id=ID')
      // Remove line numbers
      .replace(/line \d+/gi, 'line X')
      .replace(/:\d+:\d+/g, ':X:X')
      // Remove memory addresses
      .replace(/0x[0-9a-f]+/gi, '0xADDR')
      // Trim and collapse whitespace
      .trim()
      .replace(/\s+/g, ' ')
      .substring(0, 100); // Take first 100 chars for signature
  }

  /**
   * Normalize stack traces for comparison
   */
  private static normalizeStackTrace(stackTrace: string): string {
    return stackTrace
      .split('\n')
      .slice(0, 5) // Only look at top 5 stack frames
      .map(line =>
        line
          .replace(/:\d+:\d+/g, ':X:X')
          .replace(/\([^)]+\)/g, '()')
          .trim()
      )
      .join('\n');
  }

  /**
   * Calculate string similarity (Levenshtein distance based)
   */
  private static calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Levenshtein distance algorithm
   */
  private static levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

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

    // 2. Fuzzy match (same test, similar error) not fully implemented 
    // to keep it simple and type-safe for now. 

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
      // where.tags = { hasSome: query.tags }; // SQLite/Prod tags is String, use contains?
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
        // include: { jiraIssue: true } // Removed include, Prod doesn't have relation defined THIS way potentially?
        // Prod schema: NO relation field 'jiraIssue' on FailureArchive. It has 'relatedJiraIssue' string.
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
      // resolvedFailures, // timeToResolve not present
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
      // Raw query for most common
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
      recentPatterns: [] // Removed patterns
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
      // include: { jiraIssue: true } // Removed
    }) as unknown as FailureArchive | null;
  }

  // ─── Collaborative RCA: Optimistic Locking ──────────────────

  /**
   * Document RCA with optimistic locking. Creates a revision snapshot of the old state.
   */
  static async documentRCAWithLocking(
    id: string,
    input: {
      rootCause: string;
      solution?: string;
      prevention?: string;
      tags?: string[];
      expectedVersion: number;
      editSummary?: string;
    },
    userId: string,
  ): Promise<FailureArchive> {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.failureArchive.findUnique({ where: { id } });
      if (!existing) throw new Error('Failure archive entry not found');

      if (existing.rcaVersion !== input.expectedVersion) {
        const err = new Error('Conflict: RCA was modified by another user. Reload and try again.');
        (err as unknown as Record<string, number>).statusCode = 409;
        throw err;
      }

      // Snapshot old state as a revision
      await tx.rCARevision.create({
        data: {
          failureArchiveId: id,
          version: existing.rcaVersion,
          rootCause: existing.rootCause,
          solution: existing.solution,
          prevention: existing.prevention,
          tags: existing.tags,
          editedBy: userId,
          editSummary: input.editSummary || null,
        },
      });

      // Update with new data
      const updated = await tx.failureArchive.update({
        where: { id },
        data: {
          rootCause: input.rootCause,
          solution: input.solution || null,
          prevention: input.prevention || null,
          tags: input.tags?.join(',') || existing.tags,
          rcaDocumented: true,
          rcaVersion: { increment: 1 },
        },
      });

      return updated as unknown as FailureArchive;
    });
  }

  // ─── Collaborative RCA: Revisions ───────────────────────────

  static async getRCARevisions(failureArchiveId: string): Promise<unknown[]> {
    return prisma.rCARevision.findMany({
      where: { failureArchiveId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── Collaborative RCA: Comments ────────────────────────────

  static async addComment(
    failureArchiveId: string,
    userId: string,
    content: string,
  ): Promise<unknown> {
    // Verify the failure exists
    const exists = await prisma.failureArchive.findUnique({
      where: { id: failureArchiveId },
      select: { id: true },
    });
    if (!exists) throw new Error('Failure archive entry not found');

    return prisma.failureComment.create({
      data: { failureArchiveId, userId, content },
    });
  }

  static async getComments(
    failureArchiveId: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<{ comments: unknown[]; total: number }> {
    const [comments, total] = await Promise.all([
      prisma.failureComment.findMany({
        where: { failureArchiveId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.failureComment.count({ where: { failureArchiveId } }),
    ]);
    return { comments, total };
  }

  static async deleteComment(commentId: string, userId: string): Promise<void> {
    const comment = await prisma.failureComment.findUnique({ where: { id: commentId } });
    if (!comment) throw new Error('Comment not found');
    if (comment.userId !== userId) {
      const err = new Error('Not authorized to delete this comment');
      (err as unknown as Record<string, number>).statusCode = 403;
      throw err;
    }
    await prisma.failureComment.delete({ where: { id: commentId } });
  }

  // ─── Collaborative RCA: Activity Feed ───────────────────────

  static async getActivityFeed(
    failureArchiveId: string,
    limit: number = 30,
  ): Promise<Array<{ type: string; timestamp: string; userId: string; content: string }>> {
    const [revisions, comments] = await Promise.all([
      prisma.rCARevision.findMany({
        where: { failureArchiveId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.failureComment.findMany({
        where: { failureArchiveId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
    ]);

    const feed = [
      ...revisions.map(r => ({
        type: 'revision' as const,
        timestamp: r.createdAt.toISOString(),
        userId: r.editedBy,
        content: r.editSummary || `Updated RCA (v${r.version} → v${r.version + 1})`,
      })),
      ...comments.map(c => ({
        type: 'comment' as const,
        timestamp: c.createdAt.toISOString(),
        userId: c.userId,
        content: c.content,
      })),
    ];

    // Sort by timestamp descending, take limit
    return feed
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }
}
