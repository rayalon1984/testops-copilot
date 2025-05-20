import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { pipelineController } from '../controllers/pipeline.controller';
import { UserRole } from '../constants';

const router: Router = Router();

// Apply authentication to all routes
router.use(authenticate);

// List pipelines
router.get(
  '/',
  asyncHandler(async (req, res) => {
    if (!req.user) {
      res.status(401).json({ message: 'Not authenticated' });
      return;
    }

    const pipelines = await pipelineController.listPipelines(req.user.id);
    res.json(pipelines);
  })
);

// Get pipeline by ID
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!req.user) {
      res.status(401).json({ message: 'Not authenticated' });
      return;
    }

    const pipeline = await pipelineController.getPipeline(req.params.id, req.user.id);
    res.json(pipeline);
  })
);

// Create pipeline
router.post(
  '/',
  asyncHandler(async (req, res) => {
    if (!req.user) {
      res.status(401).json({ message: 'Not authenticated' });
      return;
    }

    const pipeline = await pipelineController.createPipeline(req.body, req.user.id);
    res.status(201).json(pipeline);
  })
);

// Update pipeline
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!req.user) {
      res.status(401).json({ message: 'Not authenticated' });
      return;
    }

    const pipeline = await pipelineController.updatePipeline(
      req.params.id,
      req.body,
      req.user.id
    );
    res.json(pipeline);
  })
);

// Delete pipeline
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!req.user) {
      res.status(401).json({ message: 'Not authenticated' });
      return;
    }

    await pipelineController.deletePipeline(req.params.id, req.user.id);
    res.status(204).send();
  })
);

// Start pipeline
router.post(
  '/:id/start',
  asyncHandler(async (req, res) => {
    if (!req.user) {
      res.status(401).json({ message: 'Not authenticated' });
      return;
    }

    const testRun = await pipelineController.startPipeline(req.params.id, req.user.id);
    res.json(testRun);
  })
);

// Get pipeline test runs
router.get(
  '/:id/test-runs',
  asyncHandler(async (req, res) => {
    if (!req.user) {
      res.status(401).json({ message: 'Not authenticated' });
      return;
    }

    const runs = await pipelineController.getTestRuns(req.params.id, req.user.id);
    res.json(runs);
  })
);

// Schedule pipeline
router.post(
  '/:id/schedule',
  asyncHandler(async (req, res) => {
    if (!req.user) {
      res.status(401).json({ message: 'Not authenticated' });
      return;
    }

    await pipelineController.schedulePipeline(
      req.params.id,
      req.body.schedule,
      req.user.id
    );
    res.json({ message: 'Pipeline scheduled successfully' });
  })
);

// Get failed tests
router.get(
  '/:id/failed-tests',
  asyncHandler(async (req, res) => {
    if (!req.user) {
      res.status(401).json({ message: 'Not authenticated' });
      return;
    }

    const tests = await pipelineController.getFailedTests(req.params.id, req.user.id);
    res.json(tests);
  })
);

// Get flakey tests
router.get(
  '/:id/flakey-tests',
  asyncHandler(async (req, res) => {
    if (!req.user) {
      res.status(401).json({ message: 'Not authenticated' });
      return;
    }

    const tests = await pipelineController.getFlakeyTests(req.params.id, req.user.id);
    res.json(tests);
  })
);

// Validate pipeline configuration
router.post(
  '/validate-config',
  asyncHandler(async (req, res) => {
    const result = await pipelineController.validatePipelineConfig(req.body);
    res.json(result);
  })
);

// Admin routes
router.use(authorize(UserRole.ADMIN));

export { router as pipelineRouter };