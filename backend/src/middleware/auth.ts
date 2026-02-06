import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { config } from '../config';
import { tokenBlacklist } from '../services/tokenBlacklist.service';
import { AuthenticationError, AuthorizationError } from './errorHandler';
import { TokenPayload, User } from '../types/user';
import { UserRole, JWT_CONFIG, ERROR_MESSAGES } from '../constants';

export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    const token = extractTokenFromHeader(req);
    if (!token) {
      throw new AuthenticationError(ERROR_MESSAGES.UNAUTHORIZED);
    }

    // Check if token has been revoked
    if (await tokenBlacklist.isBlacklisted(token)) {
      throw new AuthenticationError(ERROR_MESSAGES.INVALID_TOKEN);
    }

    const decoded = jwt.verify(token, config.jwt.secret, {
      ...JWT_CONFIG,
      algorithms: [JWT_CONFIG.algorithm]
    }) as TokenPayload;

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });

    if (!user) {
      throw new AuthenticationError(ERROR_MESSAGES.INVALID_TOKEN);
    }

    req.user = user as User;
    req.token = token;
    req.tokenPayload = decoded;

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      next(new AuthenticationError(ERROR_MESSAGES.TOKEN_EXPIRED));
    } else if (error instanceof jwt.JsonWebTokenError) {
      next(new AuthenticationError(ERROR_MESSAGES.INVALID_TOKEN));
    } else {
      next(error);
    }
  }
};

export const authorize = (...roles: UserRole[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AuthenticationError(ERROR_MESSAGES.UNAUTHORIZED));
    }

    if (!roles.includes(req.user.role as UserRole)) {
      return next(
        new AuthorizationError(
          `Role ${req.user.role} is not authorized to access this resource`
        )
      );
    }

    next();
  };
};

export const refreshToken = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    const token = extractTokenFromHeader(req);
    if (!token) {
      throw new AuthenticationError(ERROR_MESSAGES.UNAUTHORIZED);
    }

    const decoded = jwt.verify(token, config.jwt.refreshSecret, {
      ...JWT_CONFIG,
      algorithms: [JWT_CONFIG.algorithm]
    }) as TokenPayload;

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });

    if (!user) {
      throw new AuthenticationError(ERROR_MESSAGES.INVALID_TOKEN);
    }

    req.user = user as User;
    req.tokenPayload = decoded;

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      next(new AuthenticationError(ERROR_MESSAGES.TOKEN_EXPIRED));
    } else if (error instanceof jwt.JsonWebTokenError) {
      next(new AuthenticationError(ERROR_MESSAGES.INVALID_TOKEN));
    } else {
      next(error);
    }
  }
};

const extractTokenFromHeader = (req: Request): string | undefined => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return undefined;
};