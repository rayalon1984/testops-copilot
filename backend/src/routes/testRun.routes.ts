import { asyncHandler } from '../middleware/errorHandler';
import { authenticate } from '../middleware/auth';
import { testRunRouter as router } from './routers';
import { TestRunService } from '../services/testRun.service';

const testRunService = new TestRunService();

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

    const filters = {
      pipelineId: req.query.pipelineId as string,
      status: req.query.status as string,
      branch: req.query.branch as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
      page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      search: req.query.search as string,
    };

    const { data, total } = await testRunService.getAllTestRuns(req.user.id, filters);
    res.status(200).json({ data, total, page: filters.page || 1, limit: filters.limit || 50 });
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

    const formatted = await testRunService.getFormattedTestRunById(req.params.id as string, req.user.id);
    res.status(200).json(formatted);
  })
);
