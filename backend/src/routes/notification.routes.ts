import { Router } from 'express';
import { asyncHandler } from '@/middleware/errorHandler';
import { authenticate, authorize } from '@/middleware/auth';
import { validateNotificationPreferences } from '@/middleware/validation';
import { NotificationController } from '@/controllers/notification.controller';

const router: Router = Router();
const notificationController = new NotificationController();

// Apply authentication middleware to all routes
router.use(authenticate);

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
router.use(authorize('admin'));

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

export { router as notificationRoutes };