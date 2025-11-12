import { UserRole } from './prisma-types';

export { UserRole };

export interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserResponse {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: UserRole;
}

export interface CreateUserDTO {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role?: UserRole;
}

export interface UpdateUserDTO {
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: UserRole;
}

export interface UpdatePasswordDTO {
  currentPassword: string;
  newPassword: string;
}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface TokenPayload {
  userId: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface JwtConfig {
  secret: string;
  expiresIn: string | number;
}

export interface RefreshTokenConfig extends JwtConfig {
  refreshSecret: string;
  refreshExpiresIn: string | number;
}