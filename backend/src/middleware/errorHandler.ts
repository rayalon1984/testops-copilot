import { Request, Response, NextFunction } from 'express';
import { AppError, logger } from '@/utils/logger';
import { config } from '@/config';

interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code?: string;
    stack?: string;
  };
}

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Set default error values
  const statusCode = (err as AppError).statusCode || 500;
  const message = err.message || 'Internal Server Error';

  // Log the error
  logger.error('Error:', {
    path: req.path,
    method: req.method,
    statusCode,
    message: err.message,
    stack: err.stack,
    body: req.body,
    query: req.query,
    params: req.params,
  });

  // Prepare error response
  const errorResponse: ErrorResponse = {
    success: false,
    error: {
      message,
    },
  };

  // Add error code if available
  if ((err as any).code) {
    errorResponse.error.code = (err as any).code;
  }

  // Include stack trace in development
  if (config.env === 'development') {
    errorResponse.error.stack = err.stack;
  }

  // Send error response
  res.status(statusCode).json(errorResponse);
};

export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const err = new AppError(`Cannot ${req.method} ${req.path}`, 404);
  next(err);
};

// Async handler wrapper to eliminate try-catch blocks
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Validation error handler
export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400);
    this.name = 'ValidationError';
  }
}

// Database error handler
export class DatabaseError extends AppError {
  constructor(message: string) {
    super(message, 500);
    this.name = 'DatabaseError';
  }
}

// Authentication error handler
export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401);
    this.name = 'AuthenticationError';
  }
}

// Authorization error handler
export class AuthorizationError extends AppError {
  constructor(message: string = 'Not authorized') {
    super(message, 403);
    this.name = 'AuthorizationError';
  }
}

// Not found error handler
export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404);
    this.name = 'NotFoundError';
  }
}

// Rate limit error handler
export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests') {
    super(message, 429);
    this.name = 'RateLimitError';
  }
}

// Integration error handler
export class IntegrationError extends AppError {
  constructor(service: string, message: string) {
    super(`${service} integration error: ${message}`, 502);
    this.name = 'IntegrationError';
  }
}