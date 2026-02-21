import { Request, Response, NextFunction } from 'express';
import { asyncHandler, errorHandler } from '../errorHandler';
import {
  ApiError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
} from '../../types/error';

// Mock the config module - use @/ path alias which resolves to src/config.ts
jest.mock('@/config', () => ({
  __esModule: true,
  config: {
    env: 'development',
    log: {
      level: 'error',
      format: 'combined',
    },
  },
}));

// Mock the logger to prevent console output during tests
jest.mock('@/utils/logger', () => ({
  __esModule: true,
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Import the mocked config so we can change values between tests
import { config } from '@/config';

/**
 * Helper to create mock Express request, response, and next objects
 */
function createMocks() {
  const req = {
    url: '/api/v1/test',
    method: 'GET',
    body: {},
    params: {},
    query: {},
    originalUrl: '/api/v1/test',
  } as unknown as Request;

  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;

  const next: NextFunction = jest.fn();

  return { req, res, next };
}

describe('asyncHandler', () => {
  it('should call the wrapped async function with req, res, next', async () => {
    const { req, res, next } = createMocks();
    const mockHandler = jest.fn().mockResolvedValue(undefined);

    const wrapped = asyncHandler(mockHandler);
    await wrapped(req, res, next);

    expect(mockHandler).toHaveBeenCalledWith(req, res, next);
  });

  it('should pass errors from rejected promises to next()', async () => {
    const { req, res, next } = createMocks();
    const testError = new Error('async failure');
    const mockHandler = jest.fn().mockRejectedValue(testError);

    const wrapped = asyncHandler(mockHandler);
    await wrapped(req, res, next);

    expect(next).toHaveBeenCalledWith(testError);
  });

  it('should pass thrown errors to next()', async () => {
    const { req, res, next } = createMocks();
    const testError = new ApiError(400, 'bad request');
    const mockHandler = jest.fn().mockImplementation(async () => {
      throw testError;
    });

    const wrapped = asyncHandler(mockHandler);
    await wrapped(req, res, next);

    expect(next).toHaveBeenCalledWith(testError);
  });

  it('should not call next() with an error when the handler succeeds', async () => {
    const { req, res, next } = createMocks();
    const mockHandler = jest.fn().mockResolvedValue(undefined);

    const wrapped = asyncHandler(mockHandler);
    await wrapped(req, res, next);

    // next should not have been called with an error argument
    // (it may or may not be called at all depending on handler logic)
    if ((next as jest.Mock).mock.calls.length > 0) {
      expect((next as jest.Mock).mock.calls[0][0]).toBeUndefined();
    }
  });
});

describe('errorHandler', () => {
  beforeEach(() => {
    // Reset to development mode before each test
    (config as any).env = 'development';
  });

  describe('status codes', () => {
    it('should return 400 for ValidationError', () => {
      const { req, res, next } = createMocks();
      const err = new ValidationError('Invalid input');

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
          message: 'Invalid input',
        })
      );
    });

    it('should return 401 for AuthenticationError', () => {
      const { req, res, next } = createMocks();
      const err = new AuthenticationError('Invalid token');

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
          message: 'Invalid token',
        })
      );
    });

    it('should return 403 for AuthorizationError', () => {
      const { req, res, next } = createMocks();
      const err = new AuthorizationError('Insufficient permissions');

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
          message: 'Insufficient permissions',
        })
      );
    });

    it('should return 404 for NotFoundError', () => {
      const { req, res, next } = createMocks();
      const err = new NotFoundError('Resource not found');

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
          message: 'Resource not found',
        })
      );
    });

    it('should return the custom statusCode for a generic ApiError', () => {
      const { req, res, next } = createMocks();
      const err = new ApiError(429, 'Rate limit exceeded');

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
          message: 'Rate limit exceeded',
        })
      );
    });

    it('should default to 500 when statusCode is not set', () => {
      const { req, res, next } = createMocks();
      const err = new Error('Unknown error') as ApiError;
      // Simulate an error without statusCode
      (err as any).statusCode = undefined;

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('development mode', () => {
    beforeEach(() => {
      (config as any).env = 'development';
    });

    it('should include stack trace in development mode', () => {
      const { req, res, next } = createMocks();
      const err = new ApiError(500, 'Server error');

      errorHandler(err, req, res, next);

      const jsonCall = (res.json as jest.Mock).mock.calls[0][0];
      expect(jsonCall).toHaveProperty('stack');
      expect(typeof jsonCall.stack).toBe('string');
    });

    it('should include details in development mode', () => {
      const { req, res, next } = createMocks();
      const err = new ApiError(400, 'Bad request');

      errorHandler(err, req, res, next);

      const jsonCall = (res.json as jest.Mock).mock.calls[0][0];
      expect(jsonCall).toHaveProperty('details');
    });
  });

  describe('production mode', () => {
    beforeEach(() => {
      (config as any).env = 'production';
    });

    it('should NOT include stack trace in production mode', () => {
      const { req, res, next } = createMocks();
      const err = new ApiError(500, 'Server error');

      errorHandler(err, req, res, next);

      const jsonCall = (res.json as jest.Mock).mock.calls[0][0];
      expect(jsonCall).not.toHaveProperty('stack');
    });

    it('should NOT include details in production mode', () => {
      const { req, res, next } = createMocks();
      const err = new ApiError(400, 'Bad request');

      errorHandler(err, req, res, next);

      const jsonCall = (res.json as jest.Mock).mock.calls[0][0];
      expect(jsonCall).not.toHaveProperty('details');
    });

    it('should still include status and message in production mode', () => {
      const { req, res, next } = createMocks();
      const err = new NotFoundError('Page not found');

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Page not found',
      });
    });
  });

  describe('next() invocation', () => {
    it('should NOT call next() after sending the error response', () => {
      const { req, res, next } = createMocks();
      const err = new ApiError(500, 'Test error');

      errorHandler(err, req, res, next);

      expect(next).not.toHaveBeenCalled();
    });
  });
});
