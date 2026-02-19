/**
 * Team Service
 * Handles team CRUD, member management, pipeline scoping, and role checks.
 */

import { prisma } from '../lib/prisma';
import {
  TeamRole,
  TEAM_ROLE_HIERARCHY,
  CreateTeamInput,
  UpdateTeamInput,
  TeamWithRole,
} from '../types/team';

export class TeamService {
  /**
   * Create a new team. The creator becomes the OWNER.
   */
  static async createTeam(input: CreateTeamInput, userId: string) {
    // Check slug uniqueness
    const existing = await prisma.team.findUnique({ where: { slug: input.slug } });
    if (existing) {
      const err = new Error(`Team slug "${input.slug}" is already taken`);
      (err as unknown as Record<string, number>).statusCode = 409;
      throw err;
    }

    return prisma.$transaction(async (tx) => {
      const team = await tx.team.create({
        data: {
          name: input.name,
          slug: input.slug,
          description: input.description || null,
          createdBy: userId,
        },
      });

      await tx.teamMember.create({
        data: {
          teamId: team.id,
          userId,
          role: TeamRole.OWNER,
        },
      });

      return team;
    });
  }

  /**
   * List teams the user belongs to, with their role and member count.
   */
  static async listUserTeams(userId: string): Promise<TeamWithRole[]> {
    const memberships = await prisma.teamMember.findMany({
      where: { userId },
      include: {
        team: {
          include: { _count: { select: { members: true } } },
        },
      },
    });

    return memberships.map((m) => ({
      id: m.team.id,
      name: m.team.name,
      slug: m.team.slug,
      description: m.team.description,
      createdBy: m.team.createdBy,
      createdAt: m.team.createdAt,
      updatedAt: m.team.updatedAt,
      role: m.role,
      memberCount: m.team._count.members,
    }));
  }

  /**
   * Get team by ID (includes members).
   */
  static async getTeamById(teamId: string) {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: true,
        _count: { select: { members: true, pipelines: true } },
      },
    });
    if (!team) {
      const err = new Error('Team not found');
      (err as unknown as Record<string, number>).statusCode = 404;
      throw err;
    }
    return team;
  }

  /**
   * Update team details. Requires ADMIN+ role.
   */
  static async updateTeam(teamId: string, input: UpdateTeamInput, userId: string) {
    await this.requireTeamRole(teamId, userId, TeamRole.ADMIN);

    return prisma.team.update({
      where: { id: teamId },
      data: {
        ...(input.name && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
      },
    });
  }

  /**
   * Delete team. Requires OWNER role or global ADMIN.
   */
  static async deleteTeam(teamId: string, userId: string, isGlobalAdmin: boolean) {
    if (!isGlobalAdmin) {
      await this.requireTeamRole(teamId, userId, TeamRole.OWNER);
    }

    await prisma.team.delete({ where: { id: teamId } });
  }

  // ─── Member Management ──────────────────────────────────────

  /**
   * Get team members.
   */
  static async getMembers(teamId: string) {
    return prisma.teamMember.findMany({
      where: { teamId },
      orderBy: { joinedAt: 'asc' },
    });
  }

  /**
   * Add a member to the team.
   */
  static async addMember(
    teamId: string,
    targetUserId: string,
    role: TeamRole = TeamRole.MEMBER,
    actorUserId: string,
  ) {
    await this.requireTeamRole(teamId, actorUserId, TeamRole.ADMIN);

    // Check if already a member
    const existing = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: targetUserId } },
    });
    if (existing) {
      const err = new Error('User is already a member of this team');
      (err as unknown as Record<string, number>).statusCode = 409;
      throw err;
    }

    // Verify user exists
    const user = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) {
      const err = new Error('User not found');
      (err as unknown as Record<string, number>).statusCode = 404;
      throw err;
    }

    return prisma.teamMember.create({
      data: { teamId, userId: targetUserId, role },
    });
  }

  /**
   * Remove a member from the team.
   */
  static async removeMember(teamId: string, targetUserId: string, actorUserId: string) {
    await this.requireTeamRole(teamId, actorUserId, TeamRole.ADMIN);

    // Cannot remove the OWNER
    const target = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: targetUserId } },
    });
    if (!target) {
      const err = new Error('User is not a member of this team');
      (err as unknown as Record<string, number>).statusCode = 404;
      throw err;
    }
    if (target.role === TeamRole.OWNER) {
      const err = new Error('Cannot remove the team owner');
      (err as unknown as Record<string, number>).statusCode = 403;
      throw err;
    }

    await prisma.teamMember.delete({
      where: { teamId_userId: { teamId, userId: targetUserId } },
    });
  }

  /**
   * Update a member's role.
   */
  static async updateMemberRole(
    teamId: string,
    targetUserId: string,
    newRole: TeamRole,
    actorUserId: string,
  ) {
    await this.requireTeamRole(teamId, actorUserId, TeamRole.ADMIN);

    // Cannot change OWNER role via this method
    const target = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: targetUserId } },
    });
    if (!target) {
      const err = new Error('User is not a member of this team');
      (err as unknown as Record<string, number>).statusCode = 404;
      throw err;
    }
    if (target.role === TeamRole.OWNER || newRole === TeamRole.OWNER) {
      const err = new Error('Cannot change to/from OWNER role');
      (err as unknown as Record<string, number>).statusCode = 403;
      throw err;
    }

    return prisma.teamMember.update({
      where: { teamId_userId: { teamId, userId: targetUserId } },
      data: { role: newRole },
    });
  }

  // ─── Pipeline Scoping ───────────────────────────────────────

  /**
   * Get pipelines for a team.
   */
  static async getTeamPipelines(teamId: string) {
    return prisma.pipeline.findMany({
      where: { teamId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Assign a pipeline to a team.
   */
  static async assignPipeline(teamId: string, pipelineId: string, actorUserId: string) {
    await this.requireTeamRole(teamId, actorUserId, TeamRole.MEMBER);

    return prisma.pipeline.update({
      where: { id: pipelineId },
      data: { teamId },
    });
  }

  // ─── Role Checks ────────────────────────────────────────────

  /**
   * Check if a user has the required team role (or higher).
   * Global ADMINs always pass.
   */
  static async requireTeamRole(
    teamId: string,
    userId: string,
    requiredRole: TeamRole,
  ): Promise<void> {
    const member = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });

    if (!member) {
      const err = new Error('You are not a member of this team');
      (err as unknown as Record<string, number>).statusCode = 403;
      throw err;
    }

    const userLevel = TEAM_ROLE_HIERARCHY[member.role] ?? 0;
    const requiredLevel = TEAM_ROLE_HIERARCHY[requiredRole] ?? 0;

    if (userLevel < requiredLevel) {
      const err = new Error(`Requires ${requiredRole} role or higher`);
      (err as unknown as Record<string, number>).statusCode = 403;
      throw err;
    }
  }
}
