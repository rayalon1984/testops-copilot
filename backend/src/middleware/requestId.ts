/**
 * Request ID Middleware
 *
 * Assigns a unique correlation ID to every request for log tracing.
 * - Reuses X-Request-ID from upstream proxy/load balancer if present
 * - Generates a new UUIDv4 otherwise (Node 18+ crypto.randomUUID)
 * - Sets X-Request-ID on the response for client-side correlation
 */

import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

// UUID v4 pattern: 8-4-4-4-12 hex characters
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers['x-request-id'] as string | undefined;

  // Only trust well-formed UUIDs from upstream to prevent header injection
  const requestId = incoming && UUID_RE.test(incoming) ? incoming : randomUUID();

  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
}
