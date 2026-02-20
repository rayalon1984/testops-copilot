import { Request, Response } from 'express';

// Mock config to avoid Zod env validation at module load time
jest.mock('@/config', () => ({
  __esModule: true,
  config: {
    env: 'test',
    jwt: { secret: 'test-secret', refreshSecret: 'test-refresh-secret' },
    log: { level: 'error', format: 'combined' },
  },
}));

// Mock dependencies that auth.ts imports
jest.mock('../../lib/prisma', () => ({ prisma: {} }));
jest.mock('../../services/tokenBlacklist.service', () => ({
  tokenBlacklist: { isBlacklisted: jest.fn().mockResolvedValue(false) },
}));

import { hasRole, authorize } from '../auth';
import { UserRole } from '../../constants';
import { AuthenticationError, AuthorizationError } from '../errorHandler';

describe('RBAC Middleware', () => {
    describe('hasRole helper', () => {
        it('should return true if user role is higher or equal to required role', () => {
            expect(hasRole(UserRole.ADMIN, UserRole.EDITOR)).toBe(true);
            expect(hasRole(UserRole.EDITOR, UserRole.VIEWER)).toBe(true);
            expect(hasRole(UserRole.ADMIN, UserRole.ADMIN)).toBe(true);
        });

        it('should return false if user role is lower than required role', () => {
            expect(hasRole(UserRole.VIEWER, UserRole.EDITOR)).toBe(false);
            expect(hasRole(UserRole.EDITOR, UserRole.ADMIN)).toBe(false);
        });
    });

    describe('authorize middleware', () => {
        let mockReq: Partial<Request>;
        let mockRes: Partial<Response>;
        let next: jest.Mock;

        beforeEach(() => {
            mockReq = {
                user: {
                    id: '1',
                    email: 'test@example.com',
                    role: UserRole.VIEWER,
                    firstName: 'Test',
                    lastName: 'User',
                    createdAt: new Date(),
                    updatedAt: new Date()
                } as any
            };
            mockRes = {};
            next = jest.fn();
        });

        it('should call next() if user has required role', () => {
            mockReq.user!.role = UserRole.EDITOR;
            const middleware = authorize(UserRole.VIEWER);
            middleware(mockReq as Request, mockRes as Response, next);
            expect(next).toHaveBeenCalledWith();
        });

        it('should call next() with AuthorizationError if user does not have required role', () => {
            mockReq.user!.role = UserRole.VIEWER;
            const middleware = authorize(UserRole.EDITOR);
            middleware(mockReq as Request, mockRes as Response, next);
            expect(next).toHaveBeenCalledWith(expect.any(AuthorizationError));
        });

        it('should call next() with AuthenticationError if user is not authenticated', () => {
            mockReq.user = undefined;
            const middleware = authorize(UserRole.VIEWER);
            middleware(mockReq as Request, mockRes as Response, next);
            expect(next).toHaveBeenCalledWith(expect.any(AuthenticationError));
        });
    });
});
