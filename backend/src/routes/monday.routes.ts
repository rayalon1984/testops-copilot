/**
 * Monday.com Routes
 *
 * API routes for Monday.com integration
 */

import { Router, type Router as RouterType } from 'express';
import { MondayController } from '../controllers/monday.controller';
import { authenticate } from '../middleware/auth';

const router: RouterType = Router();

// All Monday.com routes require authentication
router.use(authenticate);

// Board routes
router.get('/boards', MondayController.getBoards);
router.get('/boards/:boardId', MondayController.getBoard);
router.get('/boards/:boardId/items', MondayController.getItems);
router.get('/boards/:boardId/search', MondayController.searchItems);

// Item routes
router.post('/items', MondayController.createItem);
router.put('/items/:itemId', MondayController.updateItem);

// Update (comment) routes
router.post('/items/:itemId/updates', MondayController.createUpdate);

// Test failure integration
router.post('/test-failures', MondayController.createItemFromTestFailure);

// Connection testing
router.get('/test-connection', MondayController.testConnection);

export default router;
