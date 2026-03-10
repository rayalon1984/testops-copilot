/**
 * CI Authentication Middleware
 *
 * Provides an alternative authentication path for CI/CD pipelines.
 * Accepts either:
 * 1. Standard JWT Bearer token (existing auth flow)
 * 2. X-CI-Token header with a pre-configured API key (CI pipeline flow)
 *
 * The CI token is configured via the CI_API_TOKEN environment variable.
 * This avoids requiring CI pipelines to manage JWT token refresh flows.
 */

import { Request, Response, NextFunction } from 'express';
import { authenticate } from './auth';
import { AuthenticationError } from './errorHandler';
import { logger } from '../utils/logger';

const CI_TOKEN_HEADER = 'x-ci-token';

/**
 * Middleware that accepts either JWT Bearer or CI API token.
 * Falls through to JWT auth if no CI token is present.
 */
export function ciAuthenticate(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const ciToken = req.headers[CI_TOKEN_HEADER] as string | undefined;
  const configuredToken = process.env.CI_API_TOKEN;

  // If CI token header is present, validate it
  if (ciToken) {
    if (!configuredToken) {
      logger.warn('[CI-Auth] CI_API_TOKEN not configured — rejecting CI token request');
      next(new AuthenticationError('CI authentication not configured'));
      return;
    }

    // Constant-time comparison to prevent timing attacks
    if (!timingSafeEqual(ciToken, configuredToken)) {
      logger.warn('[CI-Auth] Invalid CI token received');
      next(new AuthenticationError('Invalid CI token'));
      return;
    }

    logger.info('[CI-Auth] Authenticated via CI token');

    // Set a minimal user context for CI requests
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req as any).user = {
      id: 'ci-service-account',
      email: 'ci@testops-copilot.internal',
      role: 'VIEWER',
      name: 'CI Service Account',
    };

    next();
    return;
  }

  // No CI token — fall through to standard JWT authentication
  authenticate(req, res, next);
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
