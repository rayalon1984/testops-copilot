import { Router } from 'express';
import { asyncHandler } from '@/middleware/errorHandler';
import { authenticate, authorize } from '@/middleware/auth';
import { validateTestRunInput } from '@/middleware/validation';
import { TestRunController } from '@/controllers/testRun.controller';
import { UserRole } from '@/constants';

const router: Router = Router();
const testRunController = new TestRunController();

// Apply authentication middleware to all routes
router.use(authenticate);

// @route   GET /api/v1/test-runs
// @desc    Get all test runs (with filters)
// @access  Private
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const testRuns = await testRunController.getAllTestRuns(
      req.user!.id,
      req.query
    );
    res.status(200).json({
      success: true,
      data: testRuns
    });
  })
);

// @route   GET /api/v1/test-runs/:id
// @desc    Get test run by ID
// @access  Private
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const testRun = await testRunController.getTestRunById(
      req.params.id,
      req.user!.id
    );
    res.status(200).json({
      success: true,
      data: testRun
    });
  })
);

// @route   POST /api/v1/test-runs
// @desc    Create new test run
// @access  Private
router.post(
  '/',
  validateTestRunInput,
  asyncHandler(async (req, res) => {
    const testRun = await testRunController.createTestRun(
      req.body,
      req.user!.id
    );
    res.status(201).json({
      success: true,
      data: testRun
    });
  })
);

// @route   PUT /api/v1/test-runs/:id/cancel
// @desc    Cancel test run
// @access  Private
router.put(
  '/:id/cancel',
  asyncHandler(async (req, res) => {
    const testRun = await testRunController.cancelTestRun(
      req.params.id,
      req.user!.id
    );
    res.status(200).json({
      success: true,
      data: testRun
    });
  })
);

// @route   PUT /api/v1/test-runs/:id/retry
// @desc    Retry failed test run
// @access  Private
router.put(
  '/:id/retry',
  asyncHandler(async (req, res) => {
    const testRun = await testRunController.retryTestRun(
      req.params.id,
      req.user!.id
    );
    res.status(200).json({
      success: true,
      data: testRun
    });
  })
);

// @route   GET /api/v1/test-runs/:id/logs
// @desc    Get test run logs
// @access  Private
router.get(
  '/:id/logs',
  asyncHandler(async (req, res) => {
    const logs = await testRunController.getTestRunLogs(
      req.params.id,
      req.user!.id
    );
    res.status(200).json({
      success: true,
      data: logs
    });
  })
);

// @route   GET /api/v1/test-runs/:id/artifacts
// @desc    Get test run artifacts
// @access  Private
router.get(
  '/:id/artifacts',
  asyncHandler(async (req, res) => {
    const artifacts = await testRunController.getTestRunArtifacts(
      req.params.id,
      req.user!.id
    );
    res.status(200).json({
      success: true,
      data: artifacts
    });
  })
);

// Admin only routes
router.use(authorize(UserRole.ADMIN));

// @route   GET /api/v1/test-runs/metrics/system
// @desc    Get system-wide test metrics
// @access  Admin
router.get(
  '/metrics/system',
  asyncHandler(async (req, res) => {
    const metrics = await testRunController.getSystemMetrics();
    res.status(200).json({
      success: true,
      data: metrics
    });
  })
);

// @route   DELETE /api/v1/test-runs/:id
// @desc    Delete test run
// @access  Admin
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await testRunController.deleteTestRun(req.params.id);
    res.status(200).json({
      success: true,
      message: 'Test run deleted successfully'
    });
  })
);

export { router as testRunRoutes };