import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { config } from '../config';
import { JwtService } from '../services/jwt.service';
import { AuthenticationError, NotFoundError } from '../middleware/errorHandler';
import { ERROR_MESSAGES, UserRole } from '../constants';
import {
  CreateUserDTO,
  LoginDTO,
  UpdatePasswordDTO,
  TokenPayload,
  UserResponse
} from '../types/user';

const prisma = new PrismaClient();

export class AuthController {
  async register(data: CreateUserDTO) {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email }
    });

    if (existingUser) {
      throw new AuthenticationError('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(
      data.password,
      config.security.bcryptSaltRounds
    );

    const user = await prisma.user.create({
      data: {
        ...data,
        password: hashedPassword,
        role: data.role || UserRole.USER
      }
    });

    const tokenPayload: TokenPayload = {
      userId: user.id,
      role: user.role as UserRole
    };

    return {
      user: this.mapUserToResponse(user),
      ...JwtService.generateTokenPair(tokenPayload)
    };
  }

  async login(data: LoginDTO) {
    const user = await prisma.user.findUnique({
      where: { email: data.email }
    });

    if (!user) {
      throw new AuthenticationError(ERROR_MESSAGES.INVALID_CREDENTIALS);
    }

    const isValidPassword = await bcrypt.compare(data.password, user.password);
    if (!isValidPassword) {
      throw new AuthenticationError(ERROR_MESSAGES.INVALID_CREDENTIALS);
    }

    const tokenPayload: TokenPayload = {
      userId: user.id,
      role: user.role as UserRole
    };

    return {
      user: this.mapUserToResponse(user),
      ...JwtService.generateTokenPair(tokenPayload)
    };
  }

  async logout(userId: string): Promise<void> {
    // In a real application, you might want to invalidate the token
    // by adding it to a blacklist or similar mechanism
    await prisma.user.update({
      where: { id: userId },
      data: { updatedAt: new Date() }
    });
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

  private mapUserToResponse(user: any): UserResponse {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role
    };
  }
}

export const authController = new AuthController();