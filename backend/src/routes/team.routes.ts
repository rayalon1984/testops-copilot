/**
 * Team Routes
 * All team workspace endpoints.
 */

import { Router, type Router as RouterType } from 'express';
import { TeamController } from '../controllers/team.controller';
import { authenticate, authorize } from '../middleware/auth';
import { asMiddleware } from '../types/middleware';
import { UserRole } from '../constants';

const router: RouterType = Router();

// All team routes require authentication
router.use(authenticate);

// Team CRUD
router.post('/', authorize(UserRole.EDITOR), asMiddleware(TeamController.createTeam));
router.get('/', asMiddleware(TeamController.listTeams));
router.get('/:teamId', asMiddleware(TeamController.getTeam));
router.put('/:teamId', authorize(UserRole.EDITOR), asMiddleware(TeamController.updateTeam));
router.delete('/:teamId', authorize(UserRole.ADMIN), asMiddleware(TeamController.deleteTeam));

// Member management
router.get('/:teamId/members', asMiddleware(TeamController.getMembers));
router.post('/:teamId/members', authorize(UserRole.EDITOR), asMiddleware(TeamController.addMember));
router.delete('/:teamId/members/:userId', authorize(UserRole.EDITOR), asMiddleware(TeamController.removeMember));
router.put('/:teamId/members/:userId/role', authorize(UserRole.EDITOR), asMiddleware(TeamController.updateMemberRole));

// Pipeline scoping
router.get('/:teamId/pipelines', asMiddleware(TeamController.getTeamPipelines));
router.post('/:teamId/pipelines/:pipelineId', authorize(UserRole.EDITOR), asMiddleware(TeamController.assignPipeline));

// Dashboard configs
router.get('/:teamId/dashboards', asMiddleware(TeamController.listDashboards));
router.post('/:teamId/dashboards', authorize(UserRole.EDITOR), asMiddleware(TeamController.createDashboard));
router.put('/:teamId/dashboards/:dashboardId', authorize(UserRole.EDITOR), asMiddleware(TeamController.updateDashboard));
router.delete('/:teamId/dashboards/:dashboardId', authorize(UserRole.EDITOR), asMiddleware(TeamController.deleteDashboard));

export default router;
