import { Request, Response, NextFunction, RequestHandler } from 'express';
import {
  ApiError,
  ValidationError,
  NotFoundError,
  AuthenticationError,
  AuthorizationError
} from '../types/error';
import { logger } from '../utils/logger';
import { config } from '../config';

export {
  ApiError,
  ValidationError,
  NotFoundError,
  AuthenticationError,
  AuthorizationError
};

type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<any>;

export const asyncHandler = (fn: AsyncRequestHandler): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export const errorHandler = (
  err: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const isDevelopment = config.env === 'development';

  // Log the error (redact sensitive fields from body)
  const redactSensitive = (body: Record<string, unknown> | undefined) => {
    if (!body) return undefined;
    const sensitiveFields = ['password', 'currentPassword', 'newPassword', 'apiToken', 'token', 'secret', 'refreshToken'];
    const redacted = { ...body };
    for (const field of sensitiveFields) {
      if (field in redacted) {
        redacted[field] = '[REDACTED]';
      }
    }
    return redacted;
  };

  logger.error('API Error:', {
    url: req.url,
    method: req.method,
    statusCode: err.statusCode,
    message: err.message,
    stack: isDevelopment ? err.stack : undefined,
    body: isDevelopment ? redactSensitive(req.body) : undefined,
    params: isDevelopment ? req.params : undefined,
    query: isDevelopment ? req.query : undefined
  });

  // Send error response
  res.status(err.statusCode || 500).json({
    status: 'error',
    message: err.message || 'Internal Server Error',
    ...(isDevelopment && {
      stack: err.stack,
      details: err
    })
  });

  next();
};

export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const err = new NotFoundError(`Resource not found: ${req.originalUrl}`);
  next(err);
};

export const methodNotAllowedHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const err = new ApiError(
    405,
    `Method ${req.method} not allowed for ${req.originalUrl}`
  );
  next(err);
};

export const validationErrorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err.name === 'ValidationError') {
    res.status(400).json({
      status: 'error',
      message: 'Validation Error',
      errors: err.message
    });
  } else {
    next(err);
  }
};