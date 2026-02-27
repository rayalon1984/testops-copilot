/**
 * Failure Collaboration Service
 *
 * Collaborative RCA features: optimistic locking, revision history,
 * threaded comments, and activity feed.
 * Extracted from FailureArchiveService to isolate collaboration concerns
 * from core CRUD/lifecycle operations.
 */

import { prisma } from '../lib/prisma';
import { FailureArchive } from '../types/failure-archive';

// ─── Optimistic Locking ──────────────────────────────────────

/**
 * Document RCA with optimistic locking. Creates a revision snapshot of the old state.
 */
export async function documentRCAWithLocking(
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

// ─── Revisions ───────────────────────────────────────────────

export async function getRCARevisions(failureArchiveId: string): Promise<unknown[]> {
  return prisma.rCARevision.findMany({
    where: { failureArchiveId },
    orderBy: { createdAt: 'desc' },
  });
}

// ─── Comments ────────────────────────────────────────────────

export async function addComment(
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

export async function getComments(
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

export async function deleteComment(commentId: string, userId: string): Promise<void> {
  const comment = await prisma.failureComment.findUnique({ where: { id: commentId } });
  if (!comment) throw new Error('Comment not found');
  if (comment.userId !== userId) {
    const err = new Error('Not authorized to delete this comment');
    (err as unknown as Record<string, number>).statusCode = 403;
    throw err;
  }
  await prisma.failureComment.delete({ where: { id: commentId } });
}

// ─── Activity Feed ───────────────────────────────────────────

export async function getActivityFeed(
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
