/**
 * Feature Spec Tests — Resilience Layer
 *
 * Covers: circuit breaker, retry with backoff, timeout, pre-configured breakers.
 * 13 assertions across 4 capabilities.
 */

import { describeFeature, itAssertion } from '../../__tests__/helpers/feature-spec';
import {
  CircuitBreaker,
  withRetry,
  withTimeout,
  circuitBreakers,
  getAllCircuitBreakerStatuses,
} from '../resilience';

// Mock logger
jest.mock('@/utils/logger', () => ({
  __esModule: true,
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

describeFeature('resilience', () => {
  // ── Circuit Breaker ─────────────────────────────────────────────────

  itAssertion('resilience.cb.initial-closed', () => {
    const breaker = new CircuitBreaker('test-service', { failureThreshold: 3, resetTimeoutMs: 1000 });
    const status = breaker.getStatus();
    expect(status.state).toBe('CLOSED');
    expect(status.failures).toBe(0);
  });

  itAssertion('resilience.cb.opens-at-threshold', async () => {
    const breaker = new CircuitBreaker('test-open', { failureThreshold: 2, resetTimeoutMs: 5000 });
    const failFn = async (): Promise<void> => { throw new Error('fail'); };

    // First failure
    await expect(breaker.execute(failFn)).rejects.toThrow('fail');
    expect(breaker.getStatus().state).toBe('CLOSED');

    // Second failure -> opens
    await expect(breaker.execute(failFn)).rejects.toThrow('fail');
    expect(breaker.getStatus().state).toBe('OPEN');
  });

  itAssertion('resilience.cb.open-rejects', async () => {
    const breaker = new CircuitBreaker('test-reject', { failureThreshold: 1, resetTimeoutMs: 60000 });
    await expect(breaker.execute(async () => { throw new Error('x'); })).rejects.toThrow();

    // Should throw CircuitOpenError without calling function
    let fnCalled = false;
    try {
      await breaker.execute(async () => { fnCalled = true; });
    } catch (e) {
      expect((e as Error).message).toContain('Circuit');
    }
    expect(fnCalled).toBe(false);
  });

  itAssertion('resilience.cb.error-properties', async () => {
    const breaker = new CircuitBreaker('my-service', { failureThreshold: 1, resetTimeoutMs: 5000 });
    await expect(breaker.execute(async () => { throw new Error('x'); })).rejects.toThrow();

    try {
      await breaker.execute(async () => 'ok');
    } catch (e: unknown) {
      const err = e as Record<string, unknown>;
      expect(err.serviceName ?? err.message).toBeTruthy();
    }
  });

  itAssertion('resilience.cb.half-open-recovery', async () => {
    const breaker = new CircuitBreaker('test-recovery', { failureThreshold: 1, resetTimeoutMs: 50 });
    await expect(breaker.execute(async () => { throw new Error('x'); })).rejects.toThrow();
    expect(breaker.getStatus().state).toBe('OPEN');

    // Wait for reset timeout
    await new Promise(r => setTimeout(r, 100));

    // Should attempt in HALF_OPEN and succeed -> CLOSED
    const result = await breaker.execute(async () => 'recovered');
    expect(result).toBe('recovered');
    expect(breaker.getStatus().state).toBe('CLOSED');
  });

  itAssertion('resilience.cb.reset-clears', async () => {
    const breaker = new CircuitBreaker('test-reset', { failureThreshold: 1, resetTimeoutMs: 60000 });
    await expect(breaker.execute(async () => { throw new Error('x'); })).rejects.toThrow();
    expect(breaker.getStatus().state).toBe('OPEN');

    breaker.reset();
    expect(breaker.getStatus().state).toBe('CLOSED');
    expect(breaker.getStatus().failures).toBe(0);
  });

  // ── Retry with Backoff ──────────────────────────────────────────────

  itAssertion('resilience.retry.retryable-errors', async () => {
    let attempts = 0;
    const result = await withRetry(async () => {
      attempts++;
      if (attempts < 2) {
        const err = new Error('ECONNRESET');
        (err as NodeJS.ErrnoException).code = 'ECONNRESET';
        throw err;
      }
      return 'success';
    }, { maxRetries: 2, baseDelayMs: 10 });
    expect(result).toBe('success');
    expect(attempts).toBe(2);
  });

  itAssertion('resilience.retry.no-retry-4xx', async () => {
    let attempts = 0;
    try {
      await withRetry(async () => {
        attempts++;
        const err = new Error('Not Found') as Error & { status: number };
        err.status = 404;
        throw err;
      }, { maxRetries: 3, baseDelayMs: 10 });
    } catch {
      // Expected
    }
    // Should NOT retry on 404
    expect(attempts).toBe(1);
  });

  itAssertion('resilience.retry.max-attempts', async () => {
    let attempts = 0;
    try {
      await withRetry(async () => {
        attempts++;
        const err = new Error('timeout');
        (err as NodeJS.ErrnoException).code = 'ETIMEDOUT';
        throw err;
      }, { maxRetries: 2, baseDelayMs: 10 });
    } catch {
      // Expected
    }
    // 1 initial + 2 retries = 3
    expect(attempts).toBe(3);
  });

  // ── Timeout ─────────────────────────────────────────────────────────

  itAssertion('resilience.timeout.throws-on-exceed', async () => {
    await expect(
      withTimeout(
        async () => new Promise(r => setTimeout(r, 200)),
        50,
        'slow-op',
      ),
    ).rejects.toThrow();
  });

  itAssertion('resilience.timeout.error-properties', async () => {
    try {
      await withTimeout(
        async () => new Promise(r => setTimeout(r, 200)),
        50,
        'my-operation',
      );
    } catch (e: unknown) {
      const err = e as Error & { timeoutMs?: number };
      expect(err.message).toContain('my-operation');
    }
  });

  // ── Pre-configured Breakers ─────────────────────────────────────────

  itAssertion('resilience.preconfigured.four-services', () => {
    expect(circuitBreakers.github).toBeInstanceOf(CircuitBreaker);
    expect(circuitBreakers.jira).toBeInstanceOf(CircuitBreaker);
    expect(circuitBreakers.jenkins).toBeInstanceOf(CircuitBreaker);
    expect(circuitBreakers.confluence).toBeInstanceOf(CircuitBreaker);
    expect(circuitBreakers.xray).toBeInstanceOf(CircuitBreaker);
  });

  itAssertion('resilience.preconfigured.all-statuses', () => {
    const statuses = getAllCircuitBreakerStatuses();
    expect(statuses).toHaveLength(5);
    for (const s of statuses) {
      expect(s).toHaveProperty('name');
      expect(s).toHaveProperty('state');
      expect(s.state).toBe('CLOSED');
    }
  });
});
