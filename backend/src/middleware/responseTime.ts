/**
 * Response Time Tracking Middleware
 *
 * Records HTTP request durations for Prometheus export.
 * Uses a fixed-size circular buffer to compute p50/p95/p99 without unbounded memory.
 */

import { Request, Response, NextFunction } from 'express';

const BUFFER_SIZE = 10000;
const durations: number[] = [];
let totalRequests = 0;

/**
 * Middleware — must be registered early (before routes) so req.startTime is set.
 * On response finish, records the duration.
 */
export function recordResponseTime(req: Request, res: Response, next: NextFunction): void {
  const start = req.startTime || Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const durationSec = durationMs / 1000;
    totalRequests++;

    // Circular buffer: overwrite oldest entry
    if (durations.length < BUFFER_SIZE) {
      durations.push(durationSec);
    } else {
      durations[totalRequests % BUFFER_SIZE] = durationSec;
    }
  });

  next();
}

/**
 * Get response time percentiles from the buffer.
 * Returns { p50, p95, p99, count } in seconds.
 */
export function getResponseTimeStats(): { p50: number; p95: number; p99: number; count: number } {
  if (durations.length === 0) {
    return { p50: 0, p95: 0, p99: 0, count: 0 };
  }

  const sorted = [...durations].sort((a, b) => a - b);
  const len = sorted.length;

  return {
    p50: sorted[Math.ceil(0.5 * len) - 1],
    p95: sorted[Math.ceil(0.95 * len) - 1],
    p99: sorted[Math.ceil(0.99 * len) - 1],
    count: totalRequests,
  };
}
