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
    // Return mock notifications for demo - EXPANDED TO 18 NOTIFICATIONS
    const mockNotifications = [
      {
        id: '1',
        testRunId: 'run-1',
        pipelineName: 'E2E Test Suite - Production',
        type: 'failure',
        status: 'FAILED',
        message: 'Critical test failure detected in production pipeline - 12 tests failing',
        timestamp: new Date(Date.now() - 1 * 3600000).toISOString(),
        delivered: false
      },
      {
        id: '2',
        testRunId: 'run-2',
        pipelineName: 'API Integration Tests',
        type: 'success',
        status: 'PASSED',
        message: 'All tests passed successfully - 245 tests completed',
        timestamp: new Date(Date.now() - 3 * 3600000).toISOString(),
        delivered: true
      },
      {
        id: '3',
        testRunId: 'run-3',
        pipelineName: 'Security Scan Pipeline',
        type: 'warning',
        status: 'WARNING',
        message: 'Flaky test detected - investigate intermittent failures in auth module',
        timestamp: new Date(Date.now() - 5 * 3600000).toISOString(),
        delivered: false
      },
      {
        id: '4',
        testRunId: 'run-4',
        pipelineName: 'Performance Tests',
        type: 'warning',
        status: 'WARNING',
        message: 'Performance degradation detected - response time increased by 25%',
        timestamp: new Date(Date.now() - 8 * 3600000).toISOString(),
        delivered: true
      },
      {
        id: '5',
        testRunId: 'run-5',
        pipelineName: 'Mobile App Tests - iOS',
        type: 'failure',
        status: 'FAILED',
        message: 'Database migration failed in staging environment',
        timestamp: new Date(Date.now() - 12 * 3600000).toISOString(),
        delivered: false
      },
      {
        id: '6',
        testRunId: 'run-6',
        pipelineName: 'Visual Regression Tests',
        type: 'success',
        status: 'PASSED',
        message: 'Visual regression tests passed - UI unchanged',
        timestamp: new Date(Date.now() - 18 * 3600000).toISOString(),
        delivered: true
      },
      {
        id: '7',
        testRunId: 'run-7',
        pipelineName: 'Unit Tests - Backend',
        type: 'failure',
        status: 'FAILED',
        message: 'Authentication service tests failing - 5 out of 89 tests failed',
        timestamp: new Date(Date.now() - 24 * 3600000).toISOString(),
        delivered: false
      },
      {
        id: '8',
        testRunId: 'run-8',
        pipelineName: 'Database Migration Tests',
        type: 'success',
        status: 'PASSED',
        message: 'All migration scripts executed successfully',
        timestamp: new Date(Date.now() - 30 * 3600000).toISOString(),
        delivered: true
      },
      {
        id: '9',
        testRunId: 'run-9',
        pipelineName: 'Smoke Tests - Staging',
        type: 'warning',
        status: 'WARNING',
        message: 'Slow response times detected in user registration endpoint',
        timestamp: new Date(Date.now() - 36 * 3600000).toISOString(),
        delivered: false
      },
      {
        id: '10',
        testRunId: 'run-10',
        pipelineName: 'Mobile App Tests - Android',
        type: 'failure',
        status: 'FAILED',
        message: 'UI rendering issues on Android 12 devices',
        timestamp: new Date(Date.now() - 42 * 3600000).toISOString(),
        delivered: true
      },
      {
        id: '11',
        testRunId: 'run-11',
        pipelineName: 'Accessibility Tests',
        type: 'warning',
        status: 'WARNING',
        message: '15 WCAG compliance violations found in checkout flow',
        timestamp: new Date(Date.now() - 48 * 3600000).toISOString(),
        delivered: false
      },
      {
        id: '12',
        testRunId: 'run-12',
        pipelineName: 'Unit Tests - Frontend',
        type: 'success',
        status: 'PASSED',
        message: 'All 567 React component tests passed',
        timestamp: new Date(Date.now() - 54 * 3600000).toISOString(),
        delivered: true
      },
      {
        id: '13',
        testRunId: 'run-13',
        pipelineName: 'E2E Test Suite - Production',
        type: 'failure',
        status: 'FAILED',
        message: 'Payment processing tests failing - Stripe API integration broken',
        timestamp: new Date(Date.now() - 60 * 3600000).toISOString(),
        delivered: false
      },
      {
        id: '14',
        testRunId: 'run-14',
        pipelineName: 'Security Scan Pipeline',
        type: 'warning',
        status: 'WARNING',
        message: '3 high-severity vulnerabilities detected in dependencies',
        timestamp: new Date(Date.now() - 66 * 3600000).toISOString(),
        delivered: true
      },
      {
        id: '15',
        testRunId: 'run-15',
        pipelineName: 'Performance Tests',
        type: 'success',
        status: 'PASSED',
        message: 'Load tests completed - system stable under 10k concurrent users',
        timestamp: new Date(Date.now() - 72 * 3600000).toISOString(),
        delivered: false
      },
      {
        id: '16',
        testRunId: 'run-16',
        pipelineName: 'API Integration Tests',
        type: 'failure',
        status: 'FAILED',
        message: 'Third-party API integration failing - rate limit exceeded',
        timestamp: new Date(Date.now() - 78 * 3600000).toISOString(),
        delivered: true
      },
      {
        id: '17',
        testRunId: 'run-17',
        pipelineName: 'Visual Regression Tests',
        type: 'warning',
        status: 'WARNING',
        message: 'UI changes detected in 8 components - review screenshots',
        timestamp: new Date(Date.now() - 84 * 3600000).toISOString(),
        delivered: false
      },
      {
        id: '18',
        testRunId: 'run-18',
        pipelineName: 'Smoke Tests - Staging',
        type: 'success',
        status: 'PASSED',
        message: 'Staging deployment verified - all smoke tests passed',
        timestamp: new Date(Date.now() - 90 * 3600000).toISOString(),
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
  authenticate,
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
  authenticate,
  asyncHandler(async (req, res) => {
    res.status(200).json({ success: true, message: 'Notification marked as delivered' });
  })
);

// @route   DELETE /api/v1/notifications/:id
// @desc    Delete a notification
// @access  Private
router.delete(
  '/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    res.status(200).json({ success: true, message: 'Notification deleted' });
  })
);

// @route   DELETE /api/v1/notifications
// @desc    Delete all notifications for the current user
// @access  Private
router.delete(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    // When notification persistence is implemented, this will call:
    // await prisma.notification.deleteMany({ where: { userId: req.user!.id } });
    res.status(200).json({ success: true, message: 'All notifications cleared' });
  })
);

// @route   GET /api/v1/notifications/preferences
// @desc    Get user notification preferences
// @access  Private
router.get(
  '/preferences',
  authenticate,
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
  authenticate,
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
  authenticate,
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
  authenticate,
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
  authenticate,
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
  authenticate,
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