/**
 * Healing Routes
 * Self-healing pipeline management endpoints.
 */

import { Router, type Router as RouterType } from 'express';
import { HealingController } from '../controllers/healing.controller';
import { authenticate, authorize } from '../middleware/auth';
import { asMiddleware } from '../types/middleware';
import { UserRole } from '../constants';

const router: RouterType = Router();

// All healing routes require authentication
router.use(authenticate);

// Rules CRUD
router.get('/rules', asMiddleware(HealingController.getRules));
router.get('/rules/:ruleId', asMiddleware(HealingController.getRule));
router.post('/rules', authorize(UserRole.EDITOR), asMiddleware(HealingController.createRule));
router.put('/rules/:ruleId', authorize(UserRole.EDITOR), asMiddleware(HealingController.updateRule));
router.patch('/rules/:ruleId/toggle', authorize(UserRole.EDITOR), asMiddleware(HealingController.toggleRule));
router.delete('/rules/:ruleId', authorize(UserRole.ADMIN), asMiddleware(HealingController.deleteRule));

// Evaluation & Execution
router.post('/evaluate', authorize(UserRole.EDITOR), asMiddleware(HealingController.evaluate));
router.post('/execute', authorize(UserRole.EDITOR), asMiddleware(HealingController.execute));

// Events & Stats
router.get('/events', asMiddleware(HealingController.getEvents));
router.get('/stats', asMiddleware(HealingController.getStats));

// Seed built-in rules
router.post('/seed', authorize(UserRole.ADMIN), asMiddleware(HealingController.seedRules));

export default router;
