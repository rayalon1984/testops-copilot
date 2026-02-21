/**
 * Failure Archive Routes
 */

import { Router, type Router as RouterType } from 'express';
import { FailureArchiveController } from '../controllers/failure-archive.controller';
import { PredictionController } from '../controllers/prediction.controller';
import { authenticate, authorize } from '../middleware/auth';
import { asMiddleware } from '../types/middleware';
import { UserRole } from '../constants';

const router: RouterType = Router();

// All failure archive routes require authentication
router.use(authenticate);

// Create failure archive entry
router.post('/', authorize(UserRole.EDITOR), asMiddleware(FailureArchiveController.createFailure));

// Static routes BEFORE /:id to avoid Express matching them as params
router.get('/search', asMiddleware(FailureArchiveController.searchFailures));
router.get('/insights', asMiddleware(FailureArchiveController.getInsights));
router.post('/find-similar', asMiddleware(FailureArchiveController.findSimilar));

// Prediction endpoints
router.get('/trends', asMiddleware(PredictionController.getTrends));
router.get('/predictions', asMiddleware(PredictionController.getPredictions));
router.get('/anomalies', asMiddleware(PredictionController.getAnomalies));

// Parameterized routes (must come after static routes)
router.get('/:id', asMiddleware(FailureArchiveController.getById));
router.put('/:id/document-rca', authorize(UserRole.EDITOR), asMiddleware(FailureArchiveController.documentRCA));
router.put('/:id/resolve', authorize(UserRole.EDITOR), asMiddleware(FailureArchiveController.markResolved));

// Collaborative RCA routes
router.get('/:id/revisions', asMiddleware(FailureArchiveController.getRevisions));
router.post('/:id/comments', authorize(UserRole.EDITOR), asMiddleware(FailureArchiveController.addComment));
router.get('/:id/comments', asMiddleware(FailureArchiveController.getComments));
router.delete('/:id/comments/:commentId', authorize(UserRole.EDITOR), asMiddleware(FailureArchiveController.deleteComment));
router.get('/:id/activity', asMiddleware(FailureArchiveController.getActivityFeed));

export default router;
