import { Request, Response } from 'express';
import { authRouter as router } from './index';
import { AuthController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { validateRegisterInput, validateLoginInput } from '../middleware/validation';
import { JwtService } from '../services/jwt.service';
import { tokenBlacklist } from '../services/tokenBlacklist.service';
import { LoginDTO, CreateUserDTO, UpdatePasswordDTO } from '../types/user';

interface TypedRequest<T> extends Request {
  body: T;
}

const authController = new AuthController();

// Register new user
router.post(
  '/register',
  validateRegisterInput,
  asyncHandler(async (req: TypedRequest<CreateUserDTO>, res: Response) => {
    const { user, accessToken, refreshToken } = await authController.register(req.body);

    // Set refresh token in HTTP-only cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.status(201).json({ data: { user, accessToken } });
  })
);

// Login user
router.post(
  '/login',
  validateLoginInput,
  asyncHandler(async (req: TypedRequest<LoginDTO>, res: Response) => {
    const { user, accessToken, refreshToken } = await authController.login(req.body);

    // Set refresh token in HTTP-only cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({ data: { user, accessToken } });
  })
);

// Logout user
router.post(
  '/logout',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (req.user) {
      await authController.logout(req.user.id, req.token);
    }
    
    res.clearCookie('refreshToken');
    res.json({ message: 'Logged out successfully' });
  })
);

// Refresh access token
router.post(
  '/refresh',
  asyncHandler(async (req: Request, res: Response) => {
    const refreshToken = req.cookies?.refreshToken;
    
    if (!refreshToken) {
      res.status(401).json({ message: 'Refresh token not found' });
      return;
    }

    const tokens = JwtService.refreshTokens(refreshToken);

    // Blacklist old refresh token to prevent reuse
    const maxTTL = 7 * 24 * 60 * 60 * 1000;
    await tokenBlacklist.add(refreshToken, maxTTL);

    // Set new refresh token in HTTP-only cookie
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({ accessToken: tokens.accessToken });
  })
);

// Get current user
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      res.status(401).json({ message: 'Not authenticated' });
      return;
    }

    const user = await authController.getCurrentUser(req.user.id);
    res.json({ data: { user } });
  })
);

// Update password
router.put(
  '/password',
  authenticate,
  asyncHandler(async (req: TypedRequest<UpdatePasswordDTO>, res: Response) => {
    if (!req.user) {
      res.status(401).json({ message: 'Not authenticated' });
      return;
    }

    await authController.updatePassword(req.user.id, req.body);
    res.json({ message: 'Password updated successfully' });
  })
);

// Routes are registered to the authRouter imported from index