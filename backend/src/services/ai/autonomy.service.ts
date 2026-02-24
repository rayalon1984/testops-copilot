/**
 * Autonomy Service — User autonomy preference persistence.
 *
 * Encapsulates DB access for user autonomy level so routes
 * never import prisma directly.
 */

import { prisma } from '../../lib/prisma';
import { AutonomyLevel } from '@prisma/client';

const VALID_AUTONOMY_LEVELS: readonly AutonomyLevel[] = ['conservative', 'balanced', 'autonomous'] as const;

export type { AutonomyLevel };

export async function getUserAutonomyLevel(userId: string): Promise<AutonomyLevel> {
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { autonomyLevel: true },
  });

  const level = dbUser?.autonomyLevel;
  if (level && VALID_AUTONOMY_LEVELS.includes(level)) {
    return level;
  }
  return AutonomyLevel.balanced;
}

export async function setUserAutonomyLevel(userId: string, autonomyLevel: AutonomyLevel): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { autonomyLevel },
  });
}
