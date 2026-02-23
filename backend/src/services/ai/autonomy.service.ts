/**
 * Autonomy Service — User autonomy preference persistence.
 *
 * Encapsulates DB access for user autonomy level so routes
 * never import prisma directly.
 */

import { prisma } from '../../lib/prisma';

const VALID_AUTONOMY_LEVELS = ['conservative', 'balanced', 'autonomous'] as const;
type AutonomyLevel = typeof VALID_AUTONOMY_LEVELS[number];

export async function getUserAutonomyLevel(userId: string): Promise<AutonomyLevel> {
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { autonomyLevel: true },
  });

  const level = dbUser?.autonomyLevel;
  if (level && VALID_AUTONOMY_LEVELS.includes(level as AutonomyLevel)) {
    return level as AutonomyLevel;
  }
  return 'balanced';
}

export async function setUserAutonomyLevel(userId: string, autonomyLevel: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { autonomyLevel },
  });
}
