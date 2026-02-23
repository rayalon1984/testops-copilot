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

    const formattedRuns = await testRunService.getFormattedTestRuns(req.user.id);
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

    const formatted = await testRunService.getFormattedTestRunById(req.params.id as string, req.user.id);
    res.status(200).json(formatted);
  })
);
