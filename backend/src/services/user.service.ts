/**
 * UserService — User data access and auth business logic.
 *
 * Extracted from auth.controller.ts to enforce the thin-controller pattern.
 * All Prisma user queries, password hashing, token generation, and audit
 * logging live here.
 */

import bcrypt from 'bcryptjs';
import { config } from '../config';
import { prisma } from '../lib/prisma';
import { JwtService } from './jwt.service';
import { tokenBlacklist } from './tokenBlacklist.service';
import { auditService } from './audit.service';
import { AuthenticationError, NotFoundError } from '../middleware/errorHandler';
import { ERROR_MESSAGES, UserRole } from '../constants';
import {
  CreateUserDTO,
  LoginDTO,
  UpdatePasswordDTO,
  TokenPayload,
  UserResponse,
} from '../types/user';

export interface AuditContext {
  ip: string;
  userAgent: string;
}

export interface AuthResult {
  user: UserResponse;
  accessToken: string;
  refreshToken: string;
}

class UserService {
  async register(data: CreateUserDTO, context?: AuditContext): Promise<AuthResult> {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });

    if (existing) {
      void auditService.log(
        'AUTH_REGISTER_FAILURE', 'User', 'N/A', 'anonymous',
        { email: data.email, reason: 'Email already registered' }, context,
      );
      throw new AuthenticationError('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(data.password, config.security.bcryptSaltRounds);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        password: hashedPassword,
        role: UserRole.USER,
      },
    });

    void auditService.log(
      'AUTH_REGISTER_SUCCESS', 'User', user.id, user.id,
      { email: user.email }, context,
    );

    const payload: TokenPayload = { userId: user.id, role: user.role as UserRole };
    return { user: this.toResponse(user), ...JwtService.generateTokenPair(payload) };
  }

  async login(data: LoginDTO, context?: AuditContext): Promise<AuthResult> {
    const user = await prisma.user.findUnique({ where: { email: data.email } });

    if (!user) {
      void auditService.log(
        'AUTH_LOGIN_FAILURE', 'User', 'N/A', 'anonymous',
        { email: data.email, reason: 'User not found' }, context,
      );
      throw new AuthenticationError(ERROR_MESSAGES.INVALID_CREDENTIALS);
    }

    const isValid = await bcrypt.compare(data.password, user.password);
    if (!isValid) {
      void auditService.log(
        'AUTH_LOGIN_FAILURE', 'User', user.id, user.id,
        { email: data.email, reason: 'Invalid password' }, context,
      );
      throw new AuthenticationError(ERROR_MESSAGES.INVALID_CREDENTIALS);
    }

    try {
      await auditService.log(
        'AUTH_LOGIN_SUCCESS', 'User', user.id, user.id,
        { email: user.email }, context,
      );
    } catch {
      // Non-critical — don't fail login if audit fails
    }

    const payload: TokenPayload = { userId: user.id, role: user.role as UserRole };
    return { user: this.toResponse(user), ...JwtService.generateTokenPair(payload) };
  }

  async logout(userId: string, token?: string, context?: AuditContext): Promise<void> {
    if (token) {
      const maxTTL = 24 * 60 * 60 * 1000;
      await tokenBlacklist.add(token, maxTTL);
    }

    await prisma.user.update({
      where: { id: userId },
      data: { updatedAt: new Date() },
    });

    void auditService.log('AUTH_LOGOUT', 'User', userId, userId, {}, context);
  }

  async getCurrentUser(userId: string): Promise<UserResponse> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User not found');
    return this.toResponse(user);
  }

  async updatePassword(userId: string, data: UpdatePasswordDTO): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User not found');

    const isValid = await bcrypt.compare(data.currentPassword, user.password);
    if (!isValid) throw new AuthenticationError('Current password is incorrect');

    const hashed = await bcrypt.hash(data.newPassword, config.security.bcryptSaltRounds);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashed },
    });
  }

  async ssoCallback(
    user: { id: string; email: string; role: string; firstName?: string | null; lastName?: string | null } | undefined,
    context?: AuditContext,
  ): Promise<AuthResult> {
    if (!user) {
      void auditService.log(
        'AUTH_SSO_FAILURE', 'User', 'N/A', 'anonymous',
        { reason: 'SSO authentication failed' }, context,
      );
      throw new AuthenticationError('SSO authentication failed');
    }

    void auditService.log(
      'AUTH_SSO_SUCCESS', 'User', user.id, user.id,
      { email: user.email, provider: 'SAML' }, context,
    );

    const payload: TokenPayload = { userId: user.id, role: user.role as UserRole };
    return { user: this.toResponse(user), ...JwtService.generateTokenPair(payload) };
  }

  // ─── Private ───

  private toResponse(user: { id: string; email: string; firstName?: string | null; lastName?: string | null; role: string }): UserResponse {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName ?? null,
      lastName: user.lastName ?? null,
      role: user.role as UserRole,
    };
  }
}

export const userService = new UserService();
