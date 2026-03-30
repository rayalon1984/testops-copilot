import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { validateCreatePipeline, validateUpdatePipeline, validatePipelineSchedule } from '../middleware/validation';
import { pipelineController } from '../controllers/pipeline.controller';
import { UserRole, PipelineType } from '../constants';
import { pipelineRouter as router } from './routers';

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

    const pipeline = await pipelineController.getPipeline(req.params.id as string, req.user.id);
    res.json(pipeline);
  })
);

// Create pipeline
router.post(
  '/',
  authorize(UserRole.EDITOR),
  validateCreatePipeline,
  asyncHandler(async (req, res) => {
    if (!req.user) {
      res.status(401).json({ message: 'Not authenticated' });
      return;
    }

    const { name, type, config } = req.body;

    const pipeline = await pipelineController.createPipeline({
      name,
      type: type === 'jenkins' ? PipelineType.JENKINS : type === 'github-actions' ? PipelineType.GITHUB_ACTIONS : PipelineType.CUSTOM,
      config: config || {}
    }, req.user.id);

    // Strip credentials from config for response if needed
    // controller already returns safe config

    res.status(201).json(pipeline);
  })
);

// Update pipeline
router.put(
  '/:id',
  authorize(UserRole.EDITOR),
  validateUpdatePipeline,
  asyncHandler(async (req, res) => {
    if (!req.user) {
      res.status(401).json({ message: 'Not authenticated' });
      return;
    }

    const pipeline = await pipelineController.updatePipeline(
      req.params.id as string,
      req.body,
      req.user.id
    );
    res.json(pipeline);
  })
);

// Delete pipeline
// Delete pipeline
router.delete(
  '/:id',
  authorize(UserRole.EDITOR),
  asyncHandler(async (req, res) => {
    if (!req.user) {
      res.status(401).json({ message: 'Not authenticated' });
      return;
    }

    await pipelineController.deletePipeline(req.params.id as string, req.user.id);

    res.status(204).send();
  })
);

// Start pipeline
// Start pipeline
router.post(
  '/:id/start',
  authorize(UserRole.EDITOR),
  asyncHandler(async (req, res) => {
    if (!req.user) {
      res.status(401).json({ message: 'Not authenticated' });
      return;
    }

    const testRun = await pipelineController.startPipeline(req.params.id as string, req.user.id);
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

    const runs = await pipelineController.getTestRuns(req.params.id as string, req.user.id);
    res.json(runs);
  })
);

// Schedule pipeline
router.post(
  '/:id/schedule',
  authorize(UserRole.EDITOR),
  validatePipelineSchedule,
  asyncHandler(async (req, res) => {
    if (!req.user) {
      res.status(401).json({ message: 'Not authenticated' });
      return;
    }

    await pipelineController.schedulePipeline(
      req.params.id as string,
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

    const tests = await pipelineController.getFailedTests(req.params.id as string, req.user.id);
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

    const tests = await pipelineController.getFlakeyTests(req.params.id as string, req.user.id);
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