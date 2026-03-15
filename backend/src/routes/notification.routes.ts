import { asyncHandler } from '../middleware/errorHandler';
import { authenticate, authorize } from '../middleware/auth';
import { validateNotificationPreferences, validateChannelVerification, validateBroadcastNotification, validateGlobalNotificationSettings } from '../middleware/validation';
import { NotificationController } from '../controllers/notification.controller';
import { UserRole } from '../constants';
import { notificationRouter as router } from './routers';

const notificationController = new NotificationController();

// @route   GET /api/v1/notifications
// @desc    Get all notifications for user
// @access  Private
router.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const notifications = await notificationController.getUserNotifications(req.user!.id);
    res.status(200).json(notifications);
  })
);

// @route   GET /api/v1/notifications/undelivered
// @desc    Get undelivered (unread) notifications
// @access  Private
router.get(
  '/undelivered',
  authenticate,
  asyncHandler(async (req, res) => {
    const notifications = await notificationController.getUndeliveredNotifications(req.user!.id);
    res.status(200).json(notifications);
  })
);

// @route   GET /api/v1/notifications/unread
// @desc    Alias for /undelivered — used by frontend badge polling
// @access  Private
router.get(
  '/unread',
  authenticate,
  asyncHandler(async (req, res) => {
    const notifications = await notificationController.getUndeliveredNotifications(req.user!.id);
    res.status(200).json(notifications);
  })
);

// @route   POST /api/v1/notifications/mark-all-read
// @desc    Mark all notifications as read for the current user
// @access  Private
router.post(
  '/mark-all-read',
  authenticate,
  asyncHandler(async (req, res) => {
    await notificationController.markAllAsRead(req.user!.id);
    res.status(200).json({ success: true, message: 'All notifications marked as read' });
  })
);

// @route   PATCH /api/v1/notifications/:id/delivered
// @desc    Mark notification as delivered (read)
// @access  Private
router.patch(
  '/:id/delivered',
  authenticate,
  asyncHandler(async (req, res) => {
    await notificationController.markAsDelivered(String(req.params.id), String(req.user!.id));
    res.status(200).json({ success: true, message: 'Notification marked as delivered' });
  })
);

// @route   PATCH /api/v1/notifications/:id/read
// @desc    Alias for /:id/delivered — used by frontend useMarkNotificationAsRead
// @access  Private
router.patch(
  '/:id/read',
  authenticate,
  asyncHandler(async (req, res) => {
    await notificationController.markAsDelivered(String(req.params.id), String(req.user!.id));
    res.status(200).json({ success: true, message: 'Notification marked as read' });
  })
);

// @route   DELETE /api/v1/notifications/:id
// @desc    Delete a notification
// @access  Private
router.delete(
  '/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    await notificationController.deleteNotification(String(req.params.id), String(req.user!.id));
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
    await notificationController.deleteAllNotifications(req.user!.id);
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
