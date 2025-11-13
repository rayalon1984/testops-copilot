/**
 * Failure Archive Service
 * Handles root cause analysis storage, retrieval, and smart matching
 */

import { prisma } from '../lib/prisma';
import crypto from 'crypto';
import {
  FailureArchive,
  FailurePattern,
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
  static async createFailure(input: CreateFailureArchiveInput): Promise<FailureArchive> {
    const signature = this.generateFailureSignature(
      input.testName,
      input.errorMessage,
      input.stackTrace
    );

    // Check if similar failure exists
    const existing = await prisma.failureArchive.findFirst({
      where: { failureSignature: signature }
    });

    if (existing) {
      // Update existing entry
      return prisma.failureArchive.update({
        where: { id: existing.id },
        data: {
          lastSeenAt: new Date(),
          occurrenceCount: { increment: 1 },
          isRecurring: true
        }
      }) as unknown as FailureArchive;
    }

    // Create new entry
    return prisma.failureArchive.create({
      data: {
        ...input,
        failureSignature: signature,
        screenshots: input.screenshots || [],
        relatedDocumentation: [],
        tags: input.tags || [],
        severity: input.severity || FailureSeverity.MEDIUM,
        status: FailureStatus.NEW,
        isRecurring: false,
        isKnownIssue: false,
        occurrenceCount: 1
      }
    }) as unknown as FailureArchive;
  }

  /**
   * Document root cause analysis for a failure
   */
  static async documentRCA(input: DocumentRCAInput): Promise<FailureArchive> {
    const updateData: Record<string, unknown> = {
      rootCause: input.rootCause,
      detailedAnalysis: input.detailedAnalysis,
      solution: input.solution,
      preventionSteps: input.preventionSteps,
      workaround: input.workaround,
      relatedDocumentation: input.relatedDocumentation || [],
      status: FailureStatus.DOCUMENTED,
      resolvedBy: input.resolvedBy,
      tags: input.tags
    };

    if (input.jiraIssueKey) {
      updateData.jiraIssueKey = input.jiraIssueKey;
      // Try to link to existing Jira issue
      const jiraIssue = await prisma.jiraIssue.findUnique({
        where: { issueKey: input.jiraIssueKey }
      });
      if (jiraIssue) {
        updateData.jiraIssueId = jiraIssue.id;
      }
    }

    if (input.prUrl) {
      updateData.prUrl = input.prUrl;
    }

    if (input.timeToResolve) {
      updateData.timeToResolve = input.timeToResolve;
      updateData.resolvedAt = new Date();
      updateData.status = FailureStatus.RESOLVED;
    }

    return prisma.failureArchive.update({
      where: { id: input.id },
      data: updateData
    }) as unknown as FailureArchive;
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
    const signature = this.generateFailureSignature(testName, errorMessage, stackTrace);
    const normalizedError = this.normalizeErrorMessage(errorMessage);
    const results: SimilarFailure[] = [];

    // 1. Exact signature match (highest priority)
    const exactMatches = await prisma.failureArchive.findMany({
      where: {
        failureSignature: signature,
        status: { in: [FailureStatus.DOCUMENTED, FailureStatus.RESOLVED] }
      },
      orderBy: { lastSeenAt: 'desc' },
      take: limit
    });

    results.push(...exactMatches.map(f => ({
      failure: f as unknown as FailureArchive,
      similarity: 1.0,
      matchType: 'exact' as const,
      matchReason: 'Exact signature match - same error pattern'
    })));

    // 2. Same test, similar error (fuzzy match)
    if (results.length < limit) {
      const fuzzyMatches = await prisma.failureArchive.findMany({
        where: {
          testName,
          status: { in: [FailureStatus.DOCUMENTED, FailureStatus.RESOLVED] },
          NOT: { failureSignature: signature }
        },
        orderBy: { lastSeenAt: 'desc' },
        take: limit * 2
      });

      for (const match of fuzzyMatches) {
        const similarity = this.calculateSimilarity(
          normalizedError,
          this.normalizeErrorMessage(match.errorMessage)
        );

        if (similarity > 0.7) {
          results.push({
            failure: match as unknown as FailureArchive,
            similarity,
            matchType: 'fuzzy',
            matchReason: `${Math.round(similarity * 100)}% similar error message in same test`
          });
        }

        if (results.length >= limit) break;
      }
    }

    // 3. Pattern match
    if (results.length < limit) {
      const patterns = await prisma.failurePattern.findMany({
        where: {
          isActive: true,
          affectedTests: { has: testName }
        },
        orderBy: { confidence: 'desc' }
      });

      for (const pattern of patterns) {
        const relatedFailures = await prisma.failureArchive.findMany({
          where: {
            failureSignature: pattern.signature,
            status: { in: [FailureStatus.DOCUMENTED, FailureStatus.RESOLVED] }
          },
          orderBy: { lastSeenAt: 'desc' },
          take: 1
        });

        if (relatedFailures.length > 0) {
          results.push({
            failure: relatedFailures[0] as unknown as FailureArchive,
            similarity: pattern.confidence,
            matchType: 'pattern',
            matchReason: `Matches known pattern: ${pattern.patternName}`
          });
        }

        if (results.length >= limit) break;
      }
    }

    // Sort by similarity and return unique
    return results
      .sort((a, b) => b.similarity - a.similarity)
      .filter((v, i, a) => a.findIndex(t => t.failure.id === v.failure.id) === i)
      .slice(0, limit);
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

    if (query.status) {
      where.status = query.status;
    }

    if (query.severity) {
      where.severity = query.severity;
    }

    if (query.isRecurring !== undefined) {
      where.isRecurring = query.isRecurring;
    }

    if (query.isKnownIssue !== undefined) {
      where.isKnownIssue = query.isKnownIssue;
    }

    if (query.tags && query.tags.length > 0) {
      where.tags = { hasSome: query.tags };
    }

    if (query.startDate || query.endDate) {
      where.occurredAt = {};
      if (query.startDate) {
        (where.occurredAt as Record<string, unknown>).gte = query.startDate;
      }
      if (query.endDate) {
        (where.occurredAt as Record<string, unknown>).lte = query.endDate;
      }
    }

    const [failures, total] = await Promise.all([
      prisma.failureArchive.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        take: query.limit || 50,
        skip: query.offset || 0,
        include: {
          jiraIssue: true
        }
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
      resolvedFailures,
      commonFailures,
      recentPatterns
    ] = await Promise.all([
      prisma.failureArchive.count({
        where: { occurredAt: { gte: startDate } }
      }),
      prisma.failureArchive.count({
        where: {
          occurredAt: { gte: startDate },
          status: { in: [FailureStatus.DOCUMENTED, FailureStatus.RESOLVED] }
        }
      }),
      prisma.failureArchive.count({
        where: {
          occurredAt: { gte: startDate },
          isRecurring: true
        }
      }),
      prisma.failureArchive.findMany({
        where: {
          occurredAt: { gte: startDate },
          resolvedAt: { not: null },
          timeToResolve: { not: null }
        },
        select: { timeToResolve: true }
      }),
      prisma.$queryRaw<Array<{ testName: string; count: bigint; lastOccurrence: Date }>>`
        SELECT
          "testName",
          COUNT(*) as count,
          MAX("lastSeenAt") as "lastOccurrence"
        FROM "FailureArchive"
        WHERE "occurredAt" >= ${startDate}
        GROUP BY "testName"
        ORDER BY count DESC
        LIMIT 10
      `,
      prisma.failurePattern.findMany({
        where: {
          isActive: true,
          lastMatched: { gte: startDate }
        },
        orderBy: { matchCount: 'desc' },
        take: 5
      })
    ]);

    const averageTimeToResolve = resolvedFailures.length > 0
      ? resolvedFailures.reduce((sum, f) => sum + (f.timeToResolve || 0), 0) / resolvedFailures.length
      : 0;

    return {
      totalFailures,
      documentedCount,
      recurringCount,
      averageTimeToResolve: Math.round(averageTimeToResolve),
      mostCommonFailures: commonFailures.map(f => ({
        testName: f.testName,
        count: Number(f.count),
        lastOccurrence: f.lastOccurrence
      })),
      recentPatterns: recentPatterns as unknown as FailurePattern[]
    };
  }

  /**
   * Mark failure as resolved
   */
  static async markResolved(
    id: string,
    resolvedBy: string,
    timeToResolve?: number
  ): Promise<FailureArchive> {
    return prisma.failureArchive.update({
      where: { id },
      data: {
        status: FailureStatus.RESOLVED,
        resolvedAt: new Date(),
        resolvedBy,
        timeToResolve
      }
    }) as unknown as FailureArchive;
  }

  /**
   * Get failure by ID with related info
   */
  static async getById(id: string): Promise<FailureArchive | null> {
    return prisma.failureArchive.findUnique({
      where: { id },
      include: {
        jiraIssue: true
      }
    }) as unknown as FailureArchive | null;
  }

  /**
   * Detect and create patterns from recurring failures
   */
  static async detectPatterns(): Promise<FailurePattern[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Find failures that occurred 3+ times
    const recurringFailures = await prisma.$queryRaw<
      Array<{ failureSignature: string; count: bigint; testNames: string[] }>
    >`
      SELECT
        "failureSignature",
        COUNT(*) as count,
        array_agg(DISTINCT "testName") as "testNames"
      FROM "FailureArchive"
      WHERE "occurredAt" >= ${thirtyDaysAgo}
      GROUP BY "failureSignature"
      HAVING COUNT(*) >= 3
      ORDER BY count DESC
      LIMIT 20
    `;

    const patterns: FailurePattern[] = [];

    for (const recurring of recurringFailures) {
      const existingPattern = await prisma.failurePattern.findUnique({
        where: { signature: recurring.failureSignature }
      });

      if (existingPattern) {
        // Update existing pattern
        const updated = await prisma.failurePattern.update({
          where: { signature: recurring.failureSignature },
          data: {
            matchCount: Number(recurring.count),
            lastMatched: new Date(),
            affectedTests: recurring.testNames
          }
        });
        patterns.push(updated as unknown as FailurePattern);
      } else {
        // Create new pattern
        const sampleFailure = await prisma.failureArchive.findFirst({
          where: { failureSignature: recurring.failureSignature }
        });

        if (sampleFailure) {
          const created = await prisma.failurePattern.create({
            data: {
              signature: recurring.failureSignature,
              patternName: `Recurring: ${sampleFailure.testName}`,
              description: `Pattern detected: ${sampleFailure.errorMessage.substring(0, 200)}...`,
              affectedTests: recurring.testNames,
              matchCount: Number(recurring.count),
              confidence: 0.8,
              isActive: true
            }
          });
          patterns.push(created as unknown as FailurePattern);
        }
      }
    }

    return patterns;
  }
}
