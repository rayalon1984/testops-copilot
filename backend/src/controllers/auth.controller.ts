import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '@/config';
import { User, UserAttributes } from '@/models/user.model';
import { AuthenticationError, NotFoundError } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';

interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: 'admin' | 'user';
}

interface LoginInput {
  email: string;
  password: string;
}

interface TokenPayload {
  id: string;
  email: string;
  role: string;
}

export class AuthController {
  private generateToken(payload: TokenPayload): string {
    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    });
  }

  private generateRefreshToken(payload: TokenPayload): string {
    return jwt.sign(payload, config.jwt.refreshSecret, {
      expiresIn: config.jwt.refreshExpiresIn,
    });
  }

  async register(input: RegisterInput): Promise<UserAttributes> {
    const { email, password, firstName, lastName, role = 'user' } = input;

    // Check if user already exists
    const existingUser = await User.findOne({ 
      where: { email },
      scope: 'withPassword'
    });
    
    if (existingUser) {
      throw new AuthenticationError('User already exists');
    }

    // Hash password
    const salt = await bcrypt.genSalt(config.security.bcryptSaltRounds);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = await User.create({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role,
    });

    logger.info(`New user registered: ${user.email}`);
    return user.get({ plain: true });
  }

  async login(input: LoginInput): Promise<{ token: string; user: UserAttributes }> {
    const { email, password } = input;

    // Find user
    const user = await User.findOne({ 
      where: { email },
      scope: ['withPassword', 'withRefreshToken']
    });
    
    if (!user) {
      throw new AuthenticationError('Invalid credentials');
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new AuthenticationError('Invalid credentials');
    }

    // Generate tokens
    const tokenPayload: TokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    const token = this.generateToken(tokenPayload);
    const refreshToken = this.generateRefreshToken(tokenPayload);

    // Save refresh token to user
    await user.update({ refreshToken });

    logger.info(`User logged in: ${user.email}`);
    return { token, user: user.get({ plain: true }) };
  }

  async refreshToken(refreshToken: string): Promise<string> {
    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret) as TokenPayload;

      // Find user
      const user = await User.findOne({ 
        where: { id: decoded.id },
        scope: 'withRefreshToken'
      });
      
      if (!user || user.refreshToken !== refreshToken) {
        throw new AuthenticationError('Invalid refresh token');
      }

      // Generate new access token
      const tokenPayload: TokenPayload = {
        id: user.id,
        email: user.email,
        role: user.role,
      };

      return this.generateToken(tokenPayload);
    } catch (error) {
      throw new AuthenticationError('Invalid refresh token');
    }
  }

  async logout(userId: string): Promise<void> {
    const user = await User.findOne({ 
      where: { id: userId },
      scope: 'withRefreshToken'
    });
    
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Clear refresh token
    await user.update({ refreshToken: null });

    logger.info(`User logged out: ${user.email}`);
  }

  async getCurrentUser(userId: string): Promise<UserAttributes> {
    const user = await User.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return user.get({ plain: true });
  }

  async updatePassword(userId: string, input: { currentPassword: string; newPassword: string }): Promise<void> {
    const { currentPassword, newPassword } = input;

    // Find user
    const user = await User.findOne({ 
      where: { id: userId },
      scope: 'withPassword'
    });
    
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      throw new AuthenticationError('Current password is incorrect');
    }

    // Hash new password
    const salt = await bcrypt.genSalt(config.security.bcryptSaltRounds);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    await user.update({ password: hashedPassword });

    logger.info(`Password updated for user: ${user.email}`);
  }

  async forgotPassword(email: string): Promise<void> {
    // Find user
    const user = await User.findOne({ 
      where: { email },
      scope: 'withResetToken'
    });
    
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedResetToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    // Save reset token to user
    await user.update({
      passwordResetToken: hashedResetToken,
      passwordResetExpires: new Date(Date.now() + 3600000) // 1 hour
    });

    // TODO: Send reset email
    logger.info(`Password reset requested for user: ${user.email}`);
  }

  async resetPassword(resetToken: string, newPassword: string): Promise<void> {
    // Hash token
    const hashedResetToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    // Find user with valid reset token
    const user = await User.findOne({
      where: {
        passwordResetToken: hashedResetToken,
        passwordResetExpires: {
          [Symbol.for('gt')]: new Date()
        }
      },
      scope: ['withPassword', 'withResetToken']
    });

    if (!user) {
      throw new AuthenticationError('Invalid or expired reset token');
    }

    // Hash new password
    const salt = await bcrypt.genSalt(config.security.bcryptSaltRounds);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password and clear reset token
    await user.update({
      password: hashedPassword,
      passwordResetToken: null,
      passwordResetExpires: null
    });

    logger.info(`Password reset completed for user: ${user.email}`);
  }
}