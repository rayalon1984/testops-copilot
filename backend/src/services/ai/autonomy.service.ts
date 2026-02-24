/**
 * Autonomy Service — User autonomy preference persistence.
 *
 * Encapsulates DB access for user autonomy level so routes
 * never import prisma directly.
 *
 * Note: autonomyLevel is a String in the SQLite dev schema but an enum
 * in the PostgreSQL production schema.  We keep a local union type and
 * use a targeted cast so the code typechecks against both generated clients.
 */

import { prisma } from '../../lib/prisma';

const VALID_AUTONOMY_LEVELS = ['conservative', 'balanced', 'autonomous'] as const;
export type AutonomyLevel = typeof VALID_AUTONOMY_LEVELS[number];

export function isValidAutonomyLevel(value: unknown): value is AutonomyLevel {
  return typeof value === 'string' && VALID_AUTONOMY_LEVELS.includes(value as AutonomyLevel);
}

export async function getUserAutonomyLevel(userId: string): Promise<AutonomyLevel> {
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { autonomyLevel: true },
  });

  const level = dbUser?.autonomyLevel;
  if (isValidAutonomyLevel(level)) {
    return level;
  }
  return 'balanced';
}

export async function setUserAutonomyLevel(userId: string, autonomyLevel: AutonomyLevel): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dual-schema compat (String in SQLite, enum in PostgreSQL)
    data: { autonomyLevel: autonomyLevel as any },
  });
}
