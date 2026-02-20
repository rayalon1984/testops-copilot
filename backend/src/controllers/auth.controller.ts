import bcrypt from 'bcrypt';
import { config } from '../config';
import { prisma } from '../lib/prisma';
import { JwtService } from '../services/jwt.service';
import { tokenBlacklist } from '../services/tokenBlacklist.service';
import { AuthenticationError, NotFoundError } from '../middleware/errorHandler';
import { ERROR_MESSAGES, UserRole } from '../constants';
import {
  CreateUserDTO,
  LoginDTO,
  UpdatePasswordDTO,
  TokenPayload,
  UserResponse
} from '../types/user';
import { auditService } from '../services/audit.service';

// Helper interface for audit context
export interface AuditContext {
  ip: string;
  userAgent: string;
}

export class AuthController {
  async register(data: CreateUserDTO, context?: AuditContext) {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email }
    });

    if (existingUser) {
      void auditService.log(
        'AUTH_REGISTER_FAILURE',
        'User',
        'N/A',
        'anonymous',
        { email: data.email, reason: 'Email already registered' },
        context
      );
      throw new AuthenticationError('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(
      data.password,
      config.security.bcryptSaltRounds
    );

    const user = await prisma.user.create({
      data: {
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        password: hashedPassword,
        role: UserRole.USER
      }
    });

    void auditService.log(
      'AUTH_REGISTER_SUCCESS',
      'User',
      user.id,
      user.id,
      { email: user.email },
      context
    );

    const tokenPayload: TokenPayload = {
      userId: user.id,
      role: user.role as UserRole
    };

    return {
      user: this.mapUserToResponse(user),
      ...JwtService.generateTokenPair(tokenPayload)
    };
  }

  async login(data: LoginDTO, context?: AuditContext) {
    const user = await prisma.user.findUnique({
      where: { email: data.email }
    });

    if (!user) {
      void auditService.log(
        'AUTH_LOGIN_FAILURE',
        'User',
        'N/A',
        'anonymous',
        { email: data.email, reason: 'User not found' },
        context
      );
      throw new AuthenticationError(ERROR_MESSAGES.INVALID_CREDENTIALS);
    }

    console.log('[DEBUG] AuthController: comparing password');
    const isValidPassword = await bcrypt.compare(data.password, user.password);
    console.log('[DEBUG] AuthController: password valid', isValidPassword);

    if (!isValidPassword) {
      void auditService.log(
        'AUTH_LOGIN_FAILURE',
        'User',
        user.id,
        user.id,
        { email: data.email, reason: 'Invalid password' },
        context
      );
      throw new AuthenticationError(ERROR_MESSAGES.INVALID_CREDENTIALS);
    }

    console.log('[DEBUG] AuthController: logging audit');
    try {
      await auditService.log(
        'AUTH_LOGIN_SUCCESS',
        'User',
        user.id,
        user.id,
        { email: user.email },
        context
      );
    } catch (e) {
      console.error('[DEBUG] Audit log failed', e);
    }

    const tokenPayload: TokenPayload = {
      userId: user.id,
      role: user.role as UserRole
    };

    console.log('[DEBUG] AuthController: generating tokens');
    const tokens = JwtService.generateTokenPair(tokenPayload);
    console.log('[DEBUG] AuthController: tokens generated');

    return {
      user: this.mapUserToResponse(user),
      ...tokens
    };
  }

  async logout(userId: string, token?: string, context?: AuditContext): Promise<void> {
    // Blacklist the current token so it can't be reused
    if (token) {
      // Blacklist for the remaining lifetime of the token (24h max)
      const maxTTL = 24 * 60 * 60 * 1000;
      await tokenBlacklist.add(token, maxTTL);
    }

    await prisma.user.update({
      where: { id: userId },
      data: { updatedAt: new Date() }
    });

    void auditService.log(
      'AUTH_LOGOUT',
      'User',
      userId,
      userId,
      {},
      context
    );
  }

  async getCurrentUser(userId: string): Promise<UserResponse> {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return this.mapUserToResponse(user);
  }

  async updatePassword(userId: string, data: UpdatePasswordDTO): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    const isValidPassword = await bcrypt.compare(
      data.currentPassword,
      user.password
    );

    if (!isValidPassword) {
      throw new AuthenticationError('Current password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(
      data.newPassword,
      config.security.bcryptSaltRounds
    );

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });
  }

  async ssoCallback(user: { id: string; email: string; role: string; firstName?: string | null; lastName?: string | null } | undefined, context?: AuditContext) {
    if (!user) {
      void auditService.log(
        'AUTH_SSO_FAILURE',
        'User',
        'N/A',
        'anonymous',
        { reason: 'SSO authentication failed' },
        context
      );
      throw new AuthenticationError('SSO authentication failed');
    }

    void auditService.log(
      'AUTH_SSO_SUCCESS',
      'User',
      user.id,
      user.id,
      { email: user.email, provider: 'SAML' },
      context
    );

    const tokenPayload: TokenPayload = {
      userId: user.id,
      role: user.role as UserRole
    };

    return {
      user: this.mapUserToResponse(user),
      ...JwtService.generateTokenPair(tokenPayload)
    };
  }

  private mapUserToResponse(user: { id: string; email: string; firstName?: string | null; lastName?: string | null; role: string }): UserResponse {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName ?? null,
      lastName: user.lastName ?? null,
      role: user.role as UserRole
    };
  }
}

export const authController = new AuthController();