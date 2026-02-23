/**
 * CSRF Protection Middleware
 *
 * Double-submit cookie pattern using csrf-csrf.
 * - Sets an HMAC-signed CSRF token in a cookie
 * - Validates X-CSRF-Token header on state-changing requests (POST/PUT/PATCH/DELETE)
 * - Skips webhook routes that use their own signature verification
 */

import { doubleCsrf } from 'csrf-csrf';
import { Request, Response } from 'express';
import { config } from '../config';

const {
  doubleCsrfProtection,
  generateCsrfToken,
} = doubleCsrf({
  getSecret: () => config.security.csrfSecret,
  getSessionIdentifier: (req) => req.session?.id ?? '',
  cookieName: '__csrf',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'strict',
    secure: config.security.secureCookie,
    path: '/',
  },
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token'] as string,
  errorConfig: {
    statusCode: 403,
    message: 'CSRF token validation failed',
    code: 'CSRF_INVALID',
  },
  skipCsrfProtection: (req: Request) => {
    // Webhook endpoints use their own signature verification (Slack HMAC, Teams JWT)
    if (req.path.startsWith('/api/v1/channels/')) return true;
    return false;
  },
});

/**
 * GET /api/v1/csrf-token
 * Returns a fresh CSRF token for the frontend to use in X-CSRF-Token header.
 */
function csrfTokenHandler(req: Request, res: Response): void {
  const token = generateCsrfToken(req, res);
  res.json({ token });
}

export { doubleCsrfProtection, csrfTokenHandler };
