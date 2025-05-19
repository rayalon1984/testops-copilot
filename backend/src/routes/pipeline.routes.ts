import { Router } from 'express';
import { asyncHandler } from '@/middleware/errorHandler';
import { authenticate, authorize } from '@/middleware/auth';
import { validatePipelineInput } from '@/middleware/validation';
import { PipelineController } from '@/controllers/pipeline.controller';

const router: Router = Router();
const pipelineController = new PipelineController();

// Apply authentication middleware to all routes
router.use(authenticate);

// @route   GET /api/v1/pipelines
// @desc    Get all pipelines
// @access  Private
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const pipelines = await pipelineController.getAllPipelines(req.user!.id);
    res.status(200).json({
      success: true,
      data: pipelines
    });
  })
);

// @route   GET /api/v1/pipelines/:id
// @desc    Get pipeline by ID
// @access  Private
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const pipeline = await pipelineController.getPipelineById(req.params.id, req.user!.id);
    res.status(200).json({
      success: true,
      data: pipeline
    });
  })
);

// @route   POST /api/v1/pipelines
// @desc    Create new pipeline
// @access  Private
router.post(
  '/',
  validatePipelineInput,
  asyncHandler(async (req, res) => {
    const pipeline = await pipelineController.createPipeline(req.body, req.user!.id);
    res.status(201).json({
      success: true,
      data: pipeline
    });
  })
);

// @route   PUT /api/v1/pipelines/:id
// @desc    Update pipeline
// @access  Private
router.put(
  '/:id',
  validatePipelineInput,
  asyncHandler(async (req, res) => {
    const pipeline = await pipelineController.updatePipeline(req.params.id, req.body, req.user!.id);
    res.status(200).json({
      success: true,
      data: pipeline
    });
  })
);

// @route   DELETE /api/v1/pipelines/:id
// @desc    Delete pipeline
// @access  Private
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await pipelineController.deletePipeline(req.params.id, req.user!.id);
    res.status(200).json({
      success: true,
      message: 'Pipeline deleted successfully'
    });
  })
);

// @route   POST /api/v1/pipelines/:id/run
// @desc    Run pipeline
// @access  Private
router.post(
  '/:id/run',
  asyncHandler(async (req, res) => {
    const result = await pipelineController.runPipeline(req.params.id, req.user!.id);
    res.status(200).json({
      success: true,
      data: result
    });
  })
);

// @route   GET /api/v1/pipelines/:id/runs
// @desc    Get pipeline run history
// @access  Private
router.get(
  '/:id/runs',
  asyncHandler(async (req, res) => {
    const runs = await pipelineController.getPipelineRuns(req.params.id, req.user!.id);
    res.status(200).json({
      success: true,
      data: runs
    });
  })
);

// @route   POST /api/v1/pipelines/:id/schedule
// @desc    Schedule pipeline
// @access  Private
router.post(
  '/:id/schedule',
  asyncHandler(async (req, res) => {
    const schedule = await pipelineController.schedulePipeline(req.params.id, req.body, req.user!.id);
    res.status(200).json({
      success: true,
      data: schedule
    });
  })
);

// @route   GET /api/v1/pipelines/:id/metrics
// @desc    Get pipeline metrics
// @access  Private
router.get(
  '/:id/metrics',
  asyncHandler(async (req, res) => {
    const metrics = await pipelineController.getPipelineMetrics(req.params.id, req.user!.id);
    res.status(200).json({
      success: true,
      data: metrics
    });
  })
);

// Admin only routes
router.use(authorize('admin'));

// @route   GET /api/v1/pipelines/system/metrics
// @desc    Get system-wide pipeline metrics
// @access  Admin
router.get(
  '/system/metrics',
  asyncHandler(async (req, res) => {
    const metrics = await pipelineController.getSystemMetrics();
    res.status(200).json({
      success: true,
      data: metrics
    });
  })
);

export { router as pipelineRoutes };