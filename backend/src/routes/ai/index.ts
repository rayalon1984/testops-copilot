/**
 * AI API Routes — Composed from sub-modules.
 *
 * Previously 778 lines in a single file. Now split into:
 *   - config.ts  — Health, personas, autonomy, provider config
 *   - analysis.ts — RCA, categorization, summarization, enrichment, costs
 *   - chat.ts    — SSE chat, session CRUD, action confirmation
 */

import { Router, IRouter } from 'express';
import { authenticate } from '../../middleware/auth';
import configRoutes from './config';
import analysisRoutes from './analysis';
import chatRoutes from './chat';

const router: IRouter = Router();

// All AI routes require authentication
router.use(authenticate);

// Mount sub-modules (all under /api/v1/ai/*)
router.use(configRoutes);
router.use(analysisRoutes);
router.use(chatRoutes);

export default router;
