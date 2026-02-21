/**
 * Resilience utilities for external service calls.
 *
 * Provides circuit breaker, retry with exponential backoff, and timeout
 * enforcement for integration points (GitHub, Jira, Jenkins, Confluence).
 *
 * Usage:
 *   const breaker = new CircuitBreaker('github', { failureThreshold: 5 });
 *   const result = await breaker.execute(() => octokit.repos.get(...));
 */

import { logger } from '../utils/logger';

// ─── Types ────────────────────────────────────────────────────────────

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  /** Number of consecutive failures before opening the circuit (default: 5) */
  failureThreshold: number;
  /** Time in ms before attempting to close an open circuit (default: 30000) */
  resetTimeoutMs: number;
  /** Number of successful calls in HALF_OPEN to close the circuit (default: 1) */
  halfOpenSuccessThreshold: number;
}

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 2) */
  maxRetries: number;
  /** Initial delay in ms before first retry (default: 1000) */
  baseDelayMs: number;
  /** Maximum delay in ms between retries (default: 10000) */
  maxDelayMs: number;
  /** Whether to retry on the given error. Defaults to retrying on network/5xx errors only. */
  shouldRetry?: (error: unknown) => boolean;
}

export interface CircuitBreakerStatus {
  name: string;
  state: CircuitState;
  failures: number;
  lastFailureTime: string | null;
  nextRetryTime: string | null;
}

// ─── Default retry predicate ─────────────────────────────────────────

function isRetryableError(error: unknown): boolean {
  if (!error) return false;

  // Network errors (ECONNREFUSED, ECONNRESET, ETIMEDOUT, etc.)
  if (error instanceof Error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code && ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN'].includes(code)) {
      return true;
    }
  }

  // HTTP 5xx or 429 (rate limited)
  const status = (error as { status?: number }).status
    ?? (error as { response?: { status?: number } }).response?.status;
  if (status !== undefined) {
    return status >= 500 || status === 429;
  }

  // Timeout errors from AbortController
  if (error instanceof DOMException && error.name === 'AbortError') {
    return true;
  }

  return false;
}

// ─── CircuitBreaker ──────────────────────────────────────────────────

const DEFAULT_CB_OPTIONS: CircuitBreakerOptions = {
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
  halfOpenSuccessThreshold: 1,
};

export class CircuitBreaker {
  readonly name: string;
  private readonly opts: CircuitBreakerOptions;

  private state: CircuitState = 'CLOSED';
  private failures = 0;
  private halfOpenSuccesses = 0;
  private lastFailureTime: number | null = null;

  constructor(name: string, options?: Partial<CircuitBreakerOptions>) {
    this.name = name;
    this.opts = { ...DEFAULT_CB_OPTIONS, ...options };
  }

  /**
   * Execute a function through the circuit breaker.
   * Throws CircuitOpenError if the circuit is open and reset timeout hasn't elapsed.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.transitionTo('HALF_OPEN');
      } else {
        throw new CircuitOpenError(this.name, this.remainingResetMs());
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  /** Current circuit state snapshot for health reporting. */
  getStatus(): CircuitBreakerStatus {
    return {
      name: this.name,
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime ? new Date(this.lastFailureTime).toISOString() : null,
      nextRetryTime: this.state === 'OPEN' && this.lastFailureTime
        ? new Date(this.lastFailureTime + this.opts.resetTimeoutMs).toISOString()
        : null,
    };
  }

  /** Reset the circuit to closed state (e.g., for testing or manual recovery). */
  reset(): void {
    this.transitionTo('CLOSED');
    this.failures = 0;
    this.halfOpenSuccesses = 0;
    this.lastFailureTime = null;
  }

  // ── Internal ──

  private onSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.halfOpenSuccesses++;
      if (this.halfOpenSuccesses >= this.opts.halfOpenSuccessThreshold) {
        this.transitionTo('CLOSED');
        this.failures = 0;
        this.halfOpenSuccesses = 0;
        this.lastFailureTime = null;
      }
    } else if (this.state === 'CLOSED') {
      // Reset failure count on success (consecutive failure tracking)
      this.failures = 0;
    }
  }

  private onFailure(error: unknown): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.state === 'HALF_OPEN') {
      // Any failure in half-open immediately re-opens
      this.transitionTo('OPEN');
      this.halfOpenSuccesses = 0;
    } else if (this.state === 'CLOSED' && this.failures >= this.opts.failureThreshold) {
      this.transitionTo('OPEN');
    }

    const msg = error instanceof Error ? error.message : String(error);
    logger.warn(`[CircuitBreaker:${this.name}] Failure #${this.failures}: ${msg}`);
  }

  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return true;
    return Date.now() - this.lastFailureTime >= this.opts.resetTimeoutMs;
  }

  private remainingResetMs(): number {
    if (!this.lastFailureTime) return 0;
    return Math.max(0, (this.lastFailureTime + this.opts.resetTimeoutMs) - Date.now());
  }

  private transitionTo(newState: CircuitState): void {
    if (this.state === newState) return;
    logger.info(`[CircuitBreaker:${this.name}] ${this.state} → ${newState}`);
    this.state = newState;
  }
}

// ─── CircuitOpenError ────────────────────────────────────────────────

export class CircuitOpenError extends Error {
  readonly serviceName: string;
  readonly retryAfterMs: number;

  constructor(serviceName: string, retryAfterMs: number) {
    super(`Circuit breaker for ${serviceName} is OPEN. Retry after ${Math.ceil(retryAfterMs / 1000)}s.`);
    this.name = 'CircuitOpenError';
    this.serviceName = serviceName;
    this.retryAfterMs = retryAfterMs;
  }
}

// ─── Retry with exponential backoff ──────────────────────────────────

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 2,
  baseDelayMs: 1000,
  maxDelayMs: 10_000,
  shouldRetry: isRetryableError,
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: Partial<RetryOptions>,
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt >= opts.maxRetries || !opts.shouldRetry!(error)) {
        throw error;
      }

      const delay = Math.min(
        opts.baseDelayMs * Math.pow(2, attempt),
        opts.maxDelayMs,
      );
      // Add jitter (±25%) to prevent thundering herd
      const jitter = delay * (0.75 + Math.random() * 0.5);

      logger.debug(`[Retry] Attempt ${attempt + 1}/${opts.maxRetries} failed, retrying in ${Math.round(jitter)}ms`);
      await sleep(jitter);
    }
  }

  throw lastError;
}

// ─── Timeout wrapper ─────────────────────────────────────────────────

export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  label?: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new TimeoutError(label || 'operation', timeoutMs));
    }, timeoutMs);

    fn().then(
      (result) => { clearTimeout(timer); resolve(result); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

export class TimeoutError extends Error {
  readonly timeoutMs: number;

  constructor(operation: string, timeoutMs: number) {
    super(`${operation} timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

// ─── Composed resilience wrapper ─────────────────────────────────────

export interface ResilienceOptions {
  circuitBreaker?: CircuitBreaker;
  retry?: Partial<RetryOptions>;
  timeoutMs?: number;
  label?: string;
}

/**
 * Compose circuit breaker + retry + timeout in one call.
 *
 *   await withResilience(() => octokit.repos.get(...), {
 *     circuitBreaker: githubBreaker,
 *     retry: { maxRetries: 2 },
 *     timeoutMs: 10_000,
 *   });
 */
export async function withResilience<T>(
  fn: () => Promise<T>,
  options: ResilienceOptions,
): Promise<T> {
  const { circuitBreaker, retry, timeoutMs, label } = options;

  const withTimeoutFn = timeoutMs
    ? () => withTimeout(fn, timeoutMs, label)
    : fn;

  const withRetryFn = retry
    ? () => withRetry(withTimeoutFn, retry)
    : withTimeoutFn;

  return circuitBreaker
    ? circuitBreaker.execute(withRetryFn)
    : withRetryFn();
}

// ─── Pre-configured breakers for external services ───────────────────

export const circuitBreakers = {
  github: new CircuitBreaker('github', {
    failureThreshold: 5,
    resetTimeoutMs: 30_000,
  }),
  jira: new CircuitBreaker('jira', {
    failureThreshold: 5,
    resetTimeoutMs: 30_000,
  }),
  jenkins: new CircuitBreaker('jenkins', {
    failureThreshold: 3,
    resetTimeoutMs: 60_000,
  }),
  confluence: new CircuitBreaker('confluence', {
    failureThreshold: 5,
    resetTimeoutMs: 30_000,
  }),
} as const;

/** Snapshot of all circuit breaker states (for /health/full). */
export function getAllCircuitBreakerStatuses(): CircuitBreakerStatus[] {
  return Object.values(circuitBreakers).map(cb => cb.getStatus());
}

// ─── Helpers ─────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
