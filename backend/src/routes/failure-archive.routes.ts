/**
 * Failure Archive Routes
 */

import { Router, type Router as RouterType } from 'express';
import { FailureArchiveController } from '../controllers/failure-archive.controller';
import { asMiddleware } from '../types/middleware';

const router: RouterType = Router();

// Create failure archive entry
router.post('/', asMiddleware(FailureArchiveController.createFailure));

// Document RCA
router.put('/:id/document-rca', asMiddleware(FailureArchiveController.documentRCA));

// Get failure by ID
router.get('/:id', asMiddleware(FailureArchiveController.getById));

// Search failures
router.get('/search', asMiddleware(FailureArchiveController.searchFailures));

// Find similar failures
router.post('/find-similar', asMiddleware(FailureArchiveController.findSimilar));

// Get insights
router.get('/insights', asMiddleware(FailureArchiveController.getInsights));

// Mark as resolved
router.put('/:id/resolve', asMiddleware(FailureArchiveController.markResolved));

// Detect patterns
router.post('/detect-patterns', asMiddleware(FailureArchiveController.detectPatterns));

export default router;
