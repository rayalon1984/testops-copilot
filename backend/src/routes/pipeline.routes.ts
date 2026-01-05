import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { pipelineController } from '../controllers/pipeline.controller';
import { UserRole } from '../constants';
import { pipelineRouter as router } from './index';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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

    const { name, type, config } = req.body;

    const pipeline = await prisma.pipeline.create({
      data: {
        name,
        type: type === 'jenkins' ? 'JENKINS' : type === 'github-actions' ? 'GITHUB_ACTIONS' : 'CUSTOM',
        // status: 'PENDING', // Removed as not in Prod schema
        config: JSON.stringify(config || {}),
        // userId: req.user.id, // Removed as not in Prod schema? Wait. Dev had userId?
        // Checking schema.dev: Pipeline has NO userId (I removed it).
        // Checking schema.prod: Pipeline has NO userId.
        // So create line 58 userId: req.user.id MUST BE REMOVED.
      }
    });

    res.status(201).json({
      id: pipeline.id,
      name: pipeline.name,
      type: type,
      status: 'pending',
      lastRun: new Date().toISOString(),
      successRate: 0,
      config: config || {}
    });
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

    await prisma.pipeline.delete({
      where: { id: req.params.id }
    });

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

    const runs = await prisma.testRun.findMany({
      where: { pipelineId: req.params.id, userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    const statusMap: Record<string, string> = {
      'PASSED': 'success',
      'FAILED': 'failed',
      'RUNNING': 'running',
      'PENDING': 'pending'
    };

    const formattedRuns = runs.map(run => {
      // const results = typeof run.results === 'string' ? JSON.parse(run.results) : run.results;
      const failed = run.failed || 0;
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