/**
 * Team Controller
 * HTTP handlers for team, member, and pipeline endpoints.
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { TeamService } from '../services/team.service';
import { DashboardConfigService } from '../services/dashboard-config.service';
import { TeamRole } from '../types/team';

const createTeamSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().max(500).optional(),
});

const updateTeamSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
});

const addMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']).optional(),
});

const updateRoleSchema = z.object({
  role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']),
});

const createDashboardSchema = z.object({
  name: z.string().min(1).max(100),
  layout: z.string(),
  isDefault: z.boolean().optional(),
});

const updateDashboardSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  layout: z.string().optional(),
  isDefault: z.boolean().optional(),
});

export class TeamController {
  // ─── Team CRUD ──────────────────────────────────────────────

  static async createTeam(req: Request, res: Response): Promise<void> {
    try {
      const data = createTeamSchema.parse(req.body);
      const userId = String(req.user!.id);
      const team = await TeamService.createTeam(data, userId);
      res.status(201).json({ success: true, data: team });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
        return;
      }
      const statusCode = (error as Record<string, number>).statusCode || 500;
      const msg = error instanceof Error ? error.message : 'Unknown error';
      res.status(statusCode).json({ error: msg });
    }
  }

  static async listTeams(req: Request, res: Response): Promise<void> {
    try {
      const userId = String(req.user!.id);
      const teams = await TeamService.listUserTeams(userId);
      res.json({ success: true, data: teams });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: msg });
    }
  }

  static async getTeam(req: Request, res: Response): Promise<void> {
    try {
      const teamId = String(req.params.teamId);
      const team = await TeamService.getTeamById(teamId);
      res.json({ success: true, data: team });
    } catch (error) {
      const statusCode = (error as Record<string, number>).statusCode || 500;
      const msg = error instanceof Error ? error.message : 'Unknown error';
      res.status(statusCode).json({ error: msg });
    }
  }

  static async updateTeam(req: Request, res: Response): Promise<void> {
    try {
      const teamId = String(req.params.teamId);
      const userId = String(req.user!.id);
      const data = updateTeamSchema.parse(req.body);
      const team = await TeamService.updateTeam(teamId, data, userId);
      res.json({ success: true, data: team });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
        return;
      }
      const statusCode = (error as Record<string, number>).statusCode || 500;
      const msg = error instanceof Error ? error.message : 'Unknown error';
      res.status(statusCode).json({ error: msg });
    }
  }

  static async deleteTeam(req: Request, res: Response): Promise<void> {
    try {
      const teamId = String(req.params.teamId);
      const userId = String(req.user!.id);
      const isGlobalAdmin = req.user!.role === 'ADMIN';
      await TeamService.deleteTeam(teamId, userId, isGlobalAdmin);
      res.json({ success: true, message: 'Team deleted' });
    } catch (error) {
      const statusCode = (error as Record<string, number>).statusCode || 500;
      const msg = error instanceof Error ? error.message : 'Unknown error';
      res.status(statusCode).json({ error: msg });
    }
  }

  // ─── Member Management ──────────────────────────────────────

  static async getMembers(req: Request, res: Response): Promise<void> {
    try {
      const teamId = String(req.params.teamId);
      const members = await TeamService.getMembers(teamId);
      res.json({ success: true, data: members });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: msg });
    }
  }

  static async addMember(req: Request, res: Response): Promise<void> {
    try {
      const teamId = String(req.params.teamId);
      const actorUserId = String(req.user!.id);
      const data = addMemberSchema.parse(req.body);
      const member = await TeamService.addMember(
        teamId,
        data.userId,
        (data.role as TeamRole) || TeamRole.MEMBER,
        actorUserId,
      );
      res.status(201).json({ success: true, data: member });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
        return;
      }
      const statusCode = (error as Record<string, number>).statusCode || 500;
      const msg = error instanceof Error ? error.message : 'Unknown error';
      res.status(statusCode).json({ error: msg });
    }
  }

  static async removeMember(req: Request, res: Response): Promise<void> {
    try {
      const teamId = String(req.params.teamId);
      const targetUserId = String(req.params.userId);
      const actorUserId = String(req.user!.id);
      await TeamService.removeMember(teamId, targetUserId, actorUserId);
      res.json({ success: true, message: 'Member removed' });
    } catch (error) {
      const statusCode = (error as Record<string, number>).statusCode || 500;
      const msg = error instanceof Error ? error.message : 'Unknown error';
      res.status(statusCode).json({ error: msg });
    }
  }

  static async updateMemberRole(req: Request, res: Response): Promise<void> {
    try {
      const teamId = String(req.params.teamId);
      const targetUserId = String(req.params.userId);
      const actorUserId = String(req.user!.id);
      const { role } = updateRoleSchema.parse(req.body);
      const member = await TeamService.updateMemberRole(
        teamId,
        targetUserId,
        role as TeamRole,
        actorUserId,
      );
      res.json({ success: true, data: member });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
        return;
      }
      const statusCode = (error as Record<string, number>).statusCode || 500;
      const msg = error instanceof Error ? error.message : 'Unknown error';
      res.status(statusCode).json({ error: msg });
    }
  }

  // ─── Pipeline Scoping ───────────────────────────────────────

  static async getTeamPipelines(req: Request, res: Response): Promise<void> {
    try {
      const teamId = String(req.params.teamId);
      const pipelines = await TeamService.getTeamPipelines(teamId);
      res.json({ success: true, data: pipelines });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: msg });
    }
  }

  static async assignPipeline(req: Request, res: Response): Promise<void> {
    try {
      const teamId = String(req.params.teamId);
      const pipelineId = String(req.params.pipelineId);
      const actorUserId = String(req.user!.id);
      const pipeline = await TeamService.assignPipeline(teamId, pipelineId, actorUserId);
      res.json({ success: true, data: pipeline });
    } catch (error) {
      const statusCode = (error as Record<string, number>).statusCode || 500;
      const msg = error instanceof Error ? error.message : 'Unknown error';
      res.status(statusCode).json({ error: msg });
    }
  }

  // ─── Dashboard Config ───────────────────────────────────────

  static async createDashboard(req: Request, res: Response): Promise<void> {
    try {
      const userId = String(req.user!.id);
      const teamId = req.params.teamId ? String(req.params.teamId) : undefined;
      const data = createDashboardSchema.parse(req.body);
      const dashboard = await DashboardConfigService.create(
        { ...data, teamId },
        userId,
      );
      res.status(201).json({ success: true, data: dashboard });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
        return;
      }
      const msg = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: msg });
    }
  }

  static async listDashboards(req: Request, res: Response): Promise<void> {
    try {
      const userId = String(req.user!.id);
      const teamId = req.params.teamId ? String(req.params.teamId) : undefined;
      const dashboards = await DashboardConfigService.list(userId, teamId);
      res.json({ success: true, data: dashboards });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: msg });
    }
  }

  static async updateDashboard(req: Request, res: Response): Promise<void> {
    try {
      const dashboardId = String(req.params.dashboardId);
      const userId = String(req.user!.id);
      const data = updateDashboardSchema.parse(req.body);
      const dashboard = await DashboardConfigService.update(dashboardId, data, userId);
      res.json({ success: true, data: dashboard });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
        return;
      }
      const statusCode = (error as Record<string, number>).statusCode || 500;
      const msg = error instanceof Error ? error.message : 'Unknown error';
      res.status(statusCode).json({ error: msg });
    }
  }

  static async deleteDashboard(req: Request, res: Response): Promise<void> {
    try {
      const dashboardId = String(req.params.dashboardId);
      const userId = String(req.user!.id);
      await DashboardConfigService.remove(dashboardId, userId);
      res.json({ success: true, message: 'Dashboard deleted' });
    } catch (error) {
      const statusCode = (error as Record<string, number>).statusCode || 500;
      const msg = error instanceof Error ? error.message : 'Unknown error';
      res.status(statusCode).json({ error: msg });
    }
  }
}
