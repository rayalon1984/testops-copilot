import { asyncHandler } from '../middleware/errorHandler';
import { authenticate } from '../middleware/auth';
import { testRunRouter as router } from './index';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// @route   GET /api/v1/test-runs
// @desc    Get all test runs (with filters)
// @access  Private
router.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    if (!req.user) {
      res.status(401).json({ message: 'Not authenticated' });
      return;
    }

    // Get test runs from database with pipeline info
    const testRuns = await prisma.testRun.findMany({
      where: { userId: req.user.id },
      include: { pipeline: true },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    // Transform to frontend format
    const formattedRuns = testRuns.map(run => {
      const results = typeof run.results === 'string' ? JSON.parse(run.results) : run.results;
      const failed = (results as any)?.failed || 0;

      // Map status
      const statusMap: Record<string, string> = {
        'PASSED': 'success',
        'FAILED': 'failed',
        'RUNNING': 'running',
        'PENDING': 'pending'
      };

      return {
        id: run.id,
        pipelineId: run.pipelineId,
        pipelineName: run.pipeline?.name || 'Unknown Pipeline',
        status: statusMap[run.status] || 'pending',
        startTime: run.startTime?.toISOString() || run.createdAt.toISOString(),
        endTime: run.endTime?.toISOString() || run.createdAt.toISOString(),
        duration: run.duration || 0,
        errorCount: failed,
        screenshots: []
      };
    });

    res.status(200).json(formattedRuns);
  })
);

// @route   GET /api/v1/test-runs/:id
// @desc    Get test run by ID
// @access  Private
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    if (!req.user) {
      res.status(401).json({ message: 'Not authenticated' });
      return;
    }

    const testRun = await prisma.testRun.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: { pipeline: true }
    });

    if (!testRun) {
      res.status(404).json({ message: 'Test run not found' });
      return;
    }

    const results = typeof testRun.results === 'string' ? JSON.parse(testRun.results) : testRun.results;
    const statusMap: Record<string, string> = {
      'PASSED': 'success',
      'FAILED': 'failed',
      'RUNNING': 'running',
      'PENDING': 'pending'
    };

    res.status(200).json({
      id: testRun.id,
      pipelineId: testRun.pipelineId,
      pipelineName: testRun.pipeline?.name || 'Unknown Pipeline',
      status: statusMap[testRun.status] || 'pending',
      startTime: testRun.startTime?.toISOString() || testRun.createdAt.toISOString(),
      endTime: testRun.endTime?.toISOString() || testRun.createdAt.toISOString(),
      duration: testRun.duration || 0,
      errorCount: (results as any)?.failed || 0,
      errorLogs: testRun.error ? [testRun.error] : [],
      screenshots: []
    });
  })
);