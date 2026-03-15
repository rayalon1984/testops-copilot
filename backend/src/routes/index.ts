import { Application } from 'express';
import { jiraController } from '../controllers/jira.controller';
import { xrayController } from '../controllers/xray.controller';
import { azureDevOpsController } from '../controllers/azuredevops.controller';
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
import healingRouter from './healing.routes';
import webhookRouter from './webhook.routes';
import settingsRouter from './settings.routes';
import { MetricsController } from '../controllers/metrics.controller';
import { authenticate } from '../middleware/auth';

// Shared router instances (extracted to avoid circular deps)
import { authRouter, pipelineRouter, testRunRouter, notificationRouter } from './routers';
export { authRouter, pipelineRouter, testRunRouter, notificationRouter };

// Import route handlers (side-effect: registers routes on the shared routers)
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
  app.use('/api/v1/xray', xrayController);
  app.use('/api/v1/failure-archive', failureArchiveRouter);
  app.use('/api/v1/monday', mondayRouter);
  app.use('/api/v1/metrics', metricsRouter);
  app.use('/api/v1/tests', flakyTestRouter);
  app.use('/api/v1/ci', testImpactRouter);
  app.use('/api/v1/teams', teamRouter);
  app.use('/api/v1/ai', aiRouter);
  app.use('/api/v1/channels', channelRouter);
  app.use('/api/v1/shares', shareRouter);
  app.use('/api/v1/healing', healingRouter);
  app.use('/api/v1/webhooks', webhookRouter);
  app.use('/api/v1/settings', settingsRouter);
  app.use('/api/v1/azure-devops', azureDevOpsController);
}

export default registerRoutes;