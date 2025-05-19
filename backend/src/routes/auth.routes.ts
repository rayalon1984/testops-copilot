import { Router } from 'express';
import { asyncHandler } from '@/middleware/errorHandler';
import { AuthenticationError } from '@/middleware/errorHandler';
import { validateLoginInput, validateRegisterInput } from '@/middleware/validation';
import { AuthController } from '@/controllers/auth.controller';

const router: Router = Router();
const authController = new AuthController();

// @route   POST /api/v1/auth/register
// @desc    Register a new user
// @access  Public
router.post(
  '/register',
  validateRegisterInput,
  asyncHandler(async (req, res) => {
    const user = await authController.register(req.body);
    res.status(201).json({
      success: true,
      data: user
    });
  })
);

// @route   POST /api/v1/auth/login
// @desc    Login user and return JWT token
// @access  Public
router.post(
  '/login',
  validateLoginInput,
  asyncHandler(async (req, res) => {
    const { token, user } = await authController.login(req.body);
    res.status(200).json({
      success: true,
      token,
      data: user
    });
  })
);

// @route   POST /api/v1/auth/refresh-token
// @desc    Refresh JWT token
// @access  Private
router.post(
  '/refresh-token',
  asyncHandler(async (req, res) => {
    const token = await authController.refreshToken(req.body.refreshToken);
    res.status(200).json({
      success: true,
      token
    });
  })
);

// @route   POST /api/v1/auth/logout
// @desc    Logout user / clear cookie
// @access  Private
router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    await authController.logout(req.user.id);
    res.status(200).json({
      success: true,
      message: 'User logged out successfully'
    });
  })
);

// @route   GET /api/v1/auth/me
// @desc    Get current logged in user
// @access  Private
router.get(
  '/me',
  asyncHandler(async (req, res) => {
    const user = await authController.getCurrentUser(req.user.id);
    res.status(200).json({
      success: true,
      data: user
    });
  })
);

// @route   PUT /api/v1/auth/update-password
// @desc    Update user password
// @access  Private
router.put(
  '/update-password',
  asyncHandler(async (req, res) => {
    await authController.updatePassword(req.user.id, req.body);
    res.status(200).json({
      success: true,
      message: 'Password updated successfully'
    });
  })
);

// @route   POST /api/v1/auth/forgot-password
// @desc    Forgot password
// @access  Public
router.post(
  '/forgot-password',
  asyncHandler(async (req, res) => {
    await authController.forgotPassword(req.body.email);
    res.status(200).json({
      success: true,
      message: 'Password reset email sent'
    });
  })
);

// @route   PUT /api/v1/auth/reset-password/:resetToken
// @desc    Reset password
// @access  Public
router.put(
  '/reset-password/:resetToken',
  asyncHandler(async (req, res) => {
    await authController.resetPassword(req.params.resetToken, req.body.password);
    res.status(200).json({
      success: true,
      message: 'Password reset successful'
    });
  })
);

export { router as authRoutes };