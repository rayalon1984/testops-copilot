import { Router } from 'express';
import authRoutes from './auth.routes';
import pipelineRoutes from './pipeline.routes';
import testRunRoutes from './testRun.routes';
import notificationRoutes from './notification.routes';
import { notFoundHandler } from '@/middleware/errorHandler';

const router = Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Server is healthy',
    timestamp: new Date().toISOString(),
  });
});

// API Documentation endpoint
router.get('/docs', (req, res) => {
  res.redirect('/api-docs');
});

// Mount routes
router.use('/auth', authRoutes);
router.use('/pipelines', pipelineRoutes);
router.use('/test-runs', testRunRoutes);
router.use('/notifications', notificationRoutes);

// Handle 404 routes
router.use(notFoundHandler);

export default router;