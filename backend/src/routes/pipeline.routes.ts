import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { pipelineController } from '../controllers/pipeline.controller';
import { UserRole, PipelineType } from '../constants';
import { pipelineRouter as router } from './index';
import { prisma } from '../lib/prisma';

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
// Create pipeline
router.post(
  '/',
  authorize(UserRole.EDITOR),
  asyncHandler(async (req, res) => {
    if (!req.user) {
      res.status(401).json({ message: 'Not authenticated' });
      return;
    }

    const { name, type, config } = req.body;

    const pipeline = await pipelineController.createPipeline({
      name,
      type: type === 'jenkins' ? PipelineType.JENKINS : type === 'github-actions' ? PipelineType.GITHUB_ACTIONS : PipelineType.CUSTOM,
      config: JSON.stringify(config || {})
    }, req.user.id);

    // Strip credentials from config for response if needed
    // controller already returns safe config

    res.status(201).json(pipeline);
  })
);

// Update pipeline
// Update pipeline
router.put(
  '/:id',
  authorize(UserRole.EDITOR),
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
// Delete pipeline
router.delete(
  '/:id',
  authorize(UserRole.EDITOR),
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
// Start pipeline
router.post(
  '/:id/start',
  authorize(UserRole.EDITOR),
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

    const runs = await prisma.testRun.findMany({
      where: { pipelineId: req.params.id, userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { results: true }
    });

    const statusMap: Record<string, string> = {
      'PASSED': 'success',
      'FAILED': 'failed',
      'RUNNING': 'running',
      'PENDING': 'pending'
    };

    const formattedRuns = runs.map(run => {
      // Count failed results
      const failed = run.results?.filter(r => r.status === 'FAILED').length || 0;
      return {
        id: run.id,
        status: statusMap[run.status] || 'pending',
        startTime: run.startedAt?.toISOString() || run.createdAt.toISOString(),
        endTime: run.completedAt?.toISOString() || run.createdAt.toISOString(),
        duration: run.duration || 0,
        errorCount: failed
      };
    });

    res.json(formattedRuns);
  })
);

// Schedule pipeline
// Schedule pipeline
router.post(
  '/:id/schedule',
  authorize(UserRole.EDITOR),
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