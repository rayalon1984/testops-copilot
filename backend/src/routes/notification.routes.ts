import { asyncHandler } from '../middleware/errorHandler';
import { authenticate, authorize } from '../middleware/auth';
import { validateNotificationPreferences } from '../middleware/validation';
import { NotificationController } from '../controllers/notification.controller';
import { UserRole } from '../constants';
import { notificationRouter as router } from './index';

const notificationController = new NotificationController();

// @route   GET /api/v1/notifications
// @desc    Get all notifications for user
// @access  Private
router.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    // Return mock notifications for demo
    const mockNotifications = [
      {
        id: '1',
        testRunId: 'run-1',
        pipelineName: 'E2E Test Suite - Production',
        type: 'failure',
        status: 'FAILED',
        message: 'Critical test failure detected in production pipeline - 12 tests failing',
        timestamp: new Date(Date.now() - 2 * 3600000).toISOString(),
        delivered: false
      },
      {
        id: '2',
        testRunId: 'run-2',
        pipelineName: 'API Integration Tests',
        type: 'success',
        status: 'PASSED',
        message: 'All tests passed successfully - 245 tests completed',
        timestamp: new Date(Date.now() - 5 * 3600000).toISOString(),
        delivered: true
      },
      {
        id: '3',
        testRunId: 'run-3',
        pipelineName: 'Security Scan Pipeline',
        type: 'warning',
        status: 'WARNING',
        message: 'Flaky test detected - investigate intermittent failures in auth module',
        timestamp: new Date(Date.now() - 8 * 3600000).toISOString(),
        delivered: false
      },
      {
        id: '4',
        testRunId: 'run-4',
        pipelineName: 'Performance Tests',
        type: 'warning',
        status: 'WARNING',
        message: 'Performance degradation detected - response time increased by 25%',
        timestamp: new Date(Date.now() - 12 * 3600000).toISOString(),
        delivered: true
      },
      {
        id: '5',
        testRunId: 'run-5',
        pipelineName: 'Mobile App Tests - iOS',
        type: 'failure',
        status: 'FAILED',
        message: 'Database migration failed in staging environment',
        timestamp: new Date(Date.now() - 24 * 3600000).toISOString(),
        delivered: false
      },
      {
        id: '6',
        testRunId: 'run-6',
        pipelineName: 'Visual Regression Tests',
        type: 'success',
        status: 'PASSED',
        message: 'Visual regression tests passed - UI unchanged',
        timestamp: new Date(Date.now() - 36 * 3600000).toISOString(),
        delivered: true
      },
    ];
    res.status(200).json(mockNotifications);
  })
);

// @route   GET /api/v1/notifications/undelivered
// @desc    Get undelivered notifications
// @access  Private
router.get(
  '/undelivered',
  asyncHandler(async (req, res) => {
    // Return mock undelivered notifications
    const mockNotifications = [
      {
        id: '1',
        testRunId: 'run-1',
        pipelineName: 'E2E Test Suite - Production',
        type: 'failure',
        status: 'FAILED',
        message: 'Critical test failure detected in production pipeline - 12 tests failing',
        timestamp: new Date(Date.now() - 2 * 3600000).toISOString(),
        delivered: false
      },
      {
        id: '3',
        testRunId: 'run-3',
        pipelineName: 'Security Scan Pipeline',
        type: 'warning',
        status: 'WARNING',
        message: 'Flaky test detected - investigate intermittent failures',
        timestamp: new Date(Date.now() - 8 * 3600000).toISOString(),
        delivered: false
      },
    ];
    res.status(200).json(mockNotifications);
  })
);

// @route   PATCH /api/v1/notifications/:id/delivered
// @desc    Mark notification as delivered
// @access  Private
router.patch(
  '/:id/delivered',
  asyncHandler(async (req, res) => {
    res.status(200).json({ success: true, message: 'Notification marked as delivered' });
  })
);

// @route   DELETE /api/v1/notifications/:id
// @desc    Delete a notification
// @access  Private
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    res.status(200).json({ success: true, message: 'Notification deleted' });
  })
);

// @route   GET /api/v1/notifications/preferences
// @desc    Get user notification preferences
// @access  Private
router.get(
  '/preferences',
  asyncHandler(async (req, res) => {
    const preferences = await notificationController.getPreferences(req.user!.id);
    res.status(200).json({
      success: true,
      data: preferences
    });
  })
);

// @route   PUT /api/v1/notifications/preferences
// @desc    Update user notification preferences
// @access  Private
router.put(
  '/preferences',
  validateNotificationPreferences,
  asyncHandler(async (req, res) => {
    const preferences = await notificationController.updatePreferences(
      req.user!.id,
      req.body
    );
    res.status(200).json({
      success: true,
      data: preferences
    });
  })
);

// @route   POST /api/v1/notifications/test
// @desc    Send test notification
// @access  Private
router.post(
  '/test',
  asyncHandler(async (req, res) => {
    await notificationController.sendTestNotification(req.user!.id);
    res.status(200).json({
      success: true,
      message: 'Test notification sent successfully'
    });
  })
);

// @route   GET /api/v1/notifications/channels
// @desc    Get available notification channels
// @access  Private
router.get(
  '/channels',
  asyncHandler(async (req, res) => {
    const channels = await notificationController.getAvailableChannels();
    res.status(200).json({
      success: true,
      data: channels
    });
  })
);

// @route   POST /api/v1/notifications/channels/verify
// @desc    Verify notification channel settings
// @access  Private
router.post(
  '/channels/verify',
  asyncHandler(async (req, res) => {
    const result = await notificationController.verifyChannel(
      req.user!.id,
      req.body
    );
    res.status(200).json({
      success: true,
      data: result
    });
  })
);

// @route   GET /api/v1/notifications/history
// @desc    Get notification history
// @access  Private
router.get(
  '/history',
  asyncHandler(async (req, res) => {
    const history = await notificationController.getNotificationHistory(
      req.user!.id,
      req.query
    );
    res.status(200).json({
      success: true,
      data: history
    });
  })
);

// Admin only routes
router.use(authorize(UserRole.ADMIN));

// @route   GET /api/v1/notifications/metrics
// @desc    Get notification delivery metrics
// @access  Admin
router.get(
  '/metrics',
  asyncHandler(async (req, res) => {
    const metrics = await notificationController.getDeliveryMetrics();
    res.status(200).json({
      success: true,
      data: metrics
    });
  })
);

// @route   POST /api/v1/notifications/broadcast
// @desc    Send broadcast notification to all users
// @access  Admin
router.post(
  '/broadcast',
  asyncHandler(async (req, res) => {
    await notificationController.sendBroadcastNotification(req.body);
    res.status(200).json({
      success: true,
      message: 'Broadcast notification sent successfully'
    });
  })
);

// @route   GET /api/v1/notifications/settings
// @desc    Get global notification settings
// @access  Admin
router.get(
  '/settings',
  asyncHandler(async (req, res) => {
    const settings = await notificationController.getGlobalSettings();
    res.status(200).json({
      success: true,
      data: settings
    });
  })
);

// @route   PUT /api/v1/notifications/settings
// @desc    Update global notification settings
// @access  Admin
router.put(
  '/settings',
  asyncHandler(async (req, res) => {
    const settings = await notificationController.updateGlobalSettings(req.body);
    res.status(200).json({
      success: true,
      data: settings
    });
  })
);