import { asyncHandler } from '../middleware/errorHandler';
import { authenticate, authorize } from '../middleware/auth';
import { validateNotificationPreferences, validateChannelVerification, validateBroadcastNotification, validateGlobalNotificationSettings } from '../middleware/validation';
import { NotificationController } from '../controllers/notification.controller';
import { UserRole } from '../constants';
import { notificationRouter as router } from './routers';
import { prisma } from '../lib/prisma';

const notificationController = new NotificationController();

/**
 * Map Prisma Notification to frontend contract.
 * DB uses `read`; frontend expects `delivered` + `timestamp`.
 */
function toNotificationDTO(n: { id: string; type: string; title: string; message: string; read: boolean; testRunId: string | null; createdAt: Date }) {
  return {
    id: n.id,
    testRunId: n.testRunId || '',
    pipelineName: n.title,
    type: n.type,
    status: n.type.toUpperCase(),
    message: n.message,
    timestamp: n.createdAt.toISOString(),
    delivered: n.read,
  };
}

// @route   GET /api/v1/notifications
// @desc    Get all notifications for user
// @access  Private
router.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.status(200).json(notifications.map(toNotificationDTO));
  })
);

// @route   GET /api/v1/notifications/undelivered
// @desc    Get undelivered (unread) notifications
// @access  Private
router.get(
  '/undelivered',
  authenticate,
  asyncHandler(async (req, res) => {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user!.id, read: false },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.status(200).json(notifications.map(toNotificationDTO));
  })
);

// @route   PATCH /api/v1/notifications/:id/delivered
// @desc    Mark notification as delivered (read)
// @access  Private
router.patch(
  '/:id/delivered',
  authenticate,
  asyncHandler(async (req, res) => {
    const notificationId = String(req.params.id);
    const userId = String(req.user!.id);
    await prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { read: true },
    });
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
    const notificationId = String(req.params.id);
    const userId = String(req.user!.id);
    await prisma.notification.deleteMany({
      where: { id: notificationId, userId },
    });
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
    await prisma.notification.deleteMany({ where: { userId: req.user!.id } });
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
  validateChannelVerification,
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
  validateBroadcastNotification,
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
  validateGlobalNotificationSettings,
  asyncHandler(async (req, res) => {
    const settings = await notificationController.updateGlobalSettings(req.body);
    res.status(200).json({
      success: true,
      data: settings
    });
  })
);