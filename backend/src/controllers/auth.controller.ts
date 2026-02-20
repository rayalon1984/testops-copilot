/**
 * AuthController — Thin HTTP adapter.
 *
 * Delegates all user CRUD, auth logic, and audit logging to UserService.
 * No Prisma imports allowed here.
 */

import { userService, AuditContext } from '../services/user.service';
import {
  CreateUserDTO,
  LoginDTO,
  UpdatePasswordDTO,
  UserResponse,
} from '../types/user';

export { AuditContext };

export class AuthController {
  async register(data: CreateUserDTO, context?: AuditContext) {
    return userService.register(data, context);
  }

  async login(data: LoginDTO, context?: AuditContext) {
    return userService.login(data, context);
  }

  async logout(userId: string, token?: string, context?: AuditContext): Promise<void> {
    return userService.logout(userId, token, context);
  }

  async getCurrentUser(userId: string): Promise<UserResponse> {
    return userService.getCurrentUser(userId);
  }

  async updatePassword(userId: string, data: UpdatePasswordDTO): Promise<void> {
    return userService.updatePassword(userId, data);
  }

  async ssoCallback(
    user: { id: string; email: string; role: string; firstName?: string | null; lastName?: string | null } | undefined,
    context?: AuditContext,
  ) {
    return userService.ssoCallback(user, context);
  }
}

export const authController = new AuthController();
