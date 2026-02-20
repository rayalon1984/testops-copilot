import { asyncHandler } from '../middleware/errorHandler';
import { authenticate } from '../middleware/auth';
import { testRunRouter as router } from './index';
import { prisma } from '../lib/prisma';

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
      include: { pipeline: true, results: true },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    // Transform to frontend format
    const formattedRuns = testRuns.map(run => {
      // Handle legacy string results or new relation (if included) - code assumes results is loaded if needed or falls back
      // Since include: { pipeline: true } only, results might be missing?
      // But typically we don't return full results in list view.
      // Let's use metadata counters if available or default to 0

      // Count from included results (Dev schema doesn't have failed/passed columns)
      const failed = run.results?.filter((r: { status: string }) => r.status === 'FAILED').length || 0;

      // Map status
      const statusMap: Record<string, string> = {
        'PASSED': 'success',
        'FAILED': 'failed',
        'RUNNING': 'running',
        'PENDING': 'pending',
        'SKIPPED': 'skipped',
        'FLAKY': 'flaky'
      };

      return {
        id: run.id,
        pipelineId: run.pipelineId,
        pipelineName: run.pipeline?.name || 'Unknown Pipeline',
        status: statusMap[run.status] || 'pending',
        startTime: run.startedAt?.toISOString() || run.createdAt.toISOString(),
        endTime: run.completedAt?.toISOString() || run.createdAt.toISOString(),
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
      where: { id: req.params.id as string, userId: req.user.id },
      include: { pipeline: true, results: true }
    });

    if (!testRun) {
      res.status(404).json({ message: 'Test run not found' });
      return;
    }

    const failed = testRun.results?.filter((r: { status: string }) => r.status === 'FAILED').length || 0;
    const statusMap: Record<string, string> = {
      'PASSED': 'success',
      'FAILED': 'failed',
      'RUNNING': 'running',
      'PENDING': 'pending',
      'SKIPPED': 'skipped',
      'FLAKY': 'flaky'
    };

    const error = testRun.error || null;

    res.status(200).json({
      id: testRun.id,
      pipelineId: testRun.pipelineId,
      pipelineName: testRun.pipeline?.name || 'Unknown Pipeline',
      status: statusMap[testRun.status] || 'pending',
      startTime: testRun.startedAt?.toISOString() || testRun.createdAt.toISOString(),
      endTime: testRun.completedAt?.toISOString() || testRun.createdAt.toISOString(),
      duration: testRun.duration || 0,
      errorCount: failed,
      errorLogs: error ? [error] : [],
      screenshots: []
    });
  })
);