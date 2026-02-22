/**
 * Shared router instances — extracted from index.ts to break circular
 * dependencies between route registration files and the route index.
 */
import { Router, IRouter } from 'express';

export const authRouter: IRouter = Router();
export const pipelineRouter: IRouter = Router();
export const testRunRouter: IRouter = Router();
export const notificationRouter: IRouter = Router();
