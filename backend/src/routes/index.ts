import { Application, Router, IRouter } from 'express';
import { jiraController } from '../controllers/jira.controller';
import failureArchiveRouter from './failure-archive.routes';
import mondayRouter from './monday.routes';
import metricsRouter from './metrics.routes';
import dashboardRouter from './dashboard.routes';
import flakyTestRouter from './flaky-test.routes';
import testImpactRouter from './test-impact.routes';
import teamRouter from './team.routes';
import aiRouter from './ai';
import channelRouter from './channel.routes';
import shareRouter from './share.routes';
import { MetricsController } from '../controllers/metrics.controller';
import { authenticate } from '../middleware/auth';

// Create and export routers
export const authRouter: IRouter = Router();
export const pipelineRouter: IRouter = Router();
export const testRunRouter: IRouter = Router();
export const notificationRouter: IRouter = Router();

// Import route handlers
import './auth.routes';
import './pipeline.routes';
import './testRun.routes';
import './notification.routes';

export function registerRoutes(app: Application): void {
  // Prometheus metrics endpoint (requires authentication)
  app.get('/metrics', authenticate, MetricsController.getPrometheusMetrics);

  // API routes
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/dashboard', dashboardRouter);
  app.use('/api/v1/pipelines', pipelineRouter);
  app.use('/api/v1/test-runs', testRunRouter);
  app.use('/api/v1/notifications', notificationRouter);
  app.use('/api/v1/jira', jiraController);
  app.use('/api/v1/failure-archive', failureArchiveRouter);
  app.use('/api/v1/monday', mondayRouter);
  app.use('/api/v1/metrics', metricsRouter);
  app.use('/api/v1/tests', flakyTestRouter);
  app.use('/api/v1/ci', testImpactRouter);
  app.use('/api/v1/teams', teamRouter);
  app.use('/api/v1/ai', aiRouter);
  app.use('/api/v1/channels', channelRouter);
  app.use('/api/v1/shares', shareRouter);
}

export default registerRoutes;