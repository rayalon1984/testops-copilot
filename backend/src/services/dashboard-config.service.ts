/**
 * Dashboard Config Service
 * CRUD for saveable dashboard layouts.
 */

import { prisma } from '../lib/prisma';

export interface CreateDashboardInput {
  name: string;
  layout: string;
  teamId?: string;
  isDefault?: boolean;
}

export interface UpdateDashboardInput {
  name?: string;
  layout?: string;
  isDefault?: boolean;
}

export class DashboardConfigService {
  /**
   * Create a dashboard config.
   */
  static async create(input: CreateDashboardInput, userId: string) {
    // If setting as default, unset previous default for this user/team scope
    if (input.isDefault) {
      await prisma.dashboardConfig.updateMany({
        where: { userId, teamId: input.teamId || null, isDefault: true },
        data: { isDefault: false },
      });
    }

    return prisma.dashboardConfig.create({
      data: {
        name: input.name,
        layout: input.layout,
        userId,
        teamId: input.teamId || null,
        isDefault: input.isDefault || false,
      },
    });
  }

  /**
   * List dashboards for a user, optionally scoped to a team.
   */
  static async list(userId: string, teamId?: string) {
    return prisma.dashboardConfig.findMany({
      where: {
        OR: [
          { userId },
          ...(teamId ? [{ teamId }] : []),
        ],
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Get a single dashboard config.
   */
  static async getById(id: string) {
    return prisma.dashboardConfig.findUnique({ where: { id } });
  }

  /**
   * Update a dashboard config.
   */
  static async update(id: string, input: UpdateDashboardInput, userId: string) {
    const config = await prisma.dashboardConfig.findUnique({ where: { id } });
    if (!config) {
      const err = new Error('Dashboard config not found');
      (err as unknown as Record<string, number>).statusCode = 404;
      throw err;
    }
    if (config.userId !== userId) {
      const err = new Error('Not authorized to update this dashboard');
      (err as unknown as Record<string, number>).statusCode = 403;
      throw err;
    }

    // If setting as default, unset previous
    if (input.isDefault) {
      await prisma.dashboardConfig.updateMany({
        where: { userId, teamId: config.teamId, isDefault: true, NOT: { id } },
        data: { isDefault: false },
      });
    }

    return prisma.dashboardConfig.update({
      where: { id },
      data: {
        ...(input.name && { name: input.name }),
        ...(input.layout && { layout: input.layout }),
        ...(input.isDefault !== undefined && { isDefault: input.isDefault }),
      },
    });
  }

  /**
   * Delete a dashboard config.
   */
  static async remove(id: string, userId: string) {
    const config = await prisma.dashboardConfig.findUnique({ where: { id } });
    if (!config) {
      const err = new Error('Dashboard config not found');
      (err as unknown as Record<string, number>).statusCode = 404;
      throw err;
    }
    if (config.userId !== userId) {
      const err = new Error('Not authorized to delete this dashboard');
      (err as unknown as Record<string, number>).statusCode = 403;
      throw err;
    }

    await prisma.dashboardConfig.delete({ where: { id } });
  }
}
