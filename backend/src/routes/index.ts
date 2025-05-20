import { Application, Router, IRouter } from 'express';
import { jiraController } from '../controllers/jira.controller';

// Create and export routers
export const pipelineRouter: IRouter = Router();
export const testRunRouter: IRouter = Router();
export const notificationRouter: IRouter = Router();

// Import route handlers
import './pipeline.routes';
import './testRun.routes';
import './notification.routes';

export function registerRoutes(app: Application): void {
  // API routes
  app.use('/api/v1/pipelines', pipelineRouter);
  app.use('/api/v1/test-runs', testRunRouter);
  app.use('/api/v1/notifications', notificationRouter);
  app.use('/api/v1/jira', jiraController);
}

export default registerRoutes;