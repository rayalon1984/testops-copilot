import {
  CircuitBreaker,
  CircuitOpenError,
  TimeoutError,
  withRetry,
  withTimeout,
  withResilience,
  circuitBreakers,
  getAllCircuitBreakerStatuses,
} from '../resilience';

// Silence logger during tests
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// ─── CircuitBreaker ──────────────────────────────────────────────────

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker('test-service', {
      failureThreshold: 3,
      resetTimeoutMs: 100, // Short for fast tests
      halfOpenSuccessThreshold: 1,
    });
  });

  it('starts in CLOSED state', () => {
    expect(breaker.getStatus().state).toBe('CLOSED');
    expect(breaker.getStatus().failures).toBe(0);
  });

  it('allows calls through when CLOSED', async () => {
    const result = await breaker.execute(() => Promise.resolve('ok'));
    expect(result).toBe('ok');
  });

  it('resets failure count on success', async () => {
    // 2 failures (below threshold)
    for (let i = 0; i < 2; i++) {
      await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow('fail');
    }
    expect(breaker.getStatus().failures).toBe(2);

    // Success resets
    await breaker.execute(() => Promise.resolve('ok'));
    expect(breaker.getStatus().failures).toBe(0);
  });

  it('transitions to OPEN after reaching failure threshold', async () => {
    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();
    }

    expect(breaker.getStatus().state).toBe('OPEN');
    expect(breaker.getStatus().failures).toBe(3);
  });

  it('rejects calls immediately when OPEN', async () => {
    // Trip the breaker
    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();
    }

    // Next call should throw CircuitOpenError without calling the fn
    const fn = jest.fn();
    await expect(breaker.execute(fn)).rejects.toThrow(CircuitOpenError);
    expect(fn).not.toHaveBeenCalled();
  });

  it('CircuitOpenError contains service name and retry info', async () => {
    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();
    }

    try {
      await breaker.execute(() => Promise.resolve('ok'));
    } catch (error) {
      expect(error).toBeInstanceOf(CircuitOpenError);
      expect((error as CircuitOpenError).serviceName).toBe('test-service');
      expect((error as CircuitOpenError).retryAfterMs).toBeGreaterThan(0);
    }
  });

  it('transitions to HALF_OPEN after reset timeout', async () => {
    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();
    }
    expect(breaker.getStatus().state).toBe('OPEN');

    // Wait for reset timeout
    await sleep(150);

    // Next call should be attempted (HALF_OPEN)
    const result = await breaker.execute(() => Promise.resolve('recovered'));
    expect(result).toBe('recovered');
    expect(breaker.getStatus().state).toBe('CLOSED');
  });

  it('re-opens on failure in HALF_OPEN state', async () => {
    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();
    }

    // Wait for reset
    await sleep(150);

    // Fail again in HALF_OPEN
    await expect(breaker.execute(() => Promise.reject(new Error('still broken')))).rejects.toThrow();
    expect(breaker.getStatus().state).toBe('OPEN');
  });

  it('reset() restores CLOSED state', async () => {
    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();
    }
    expect(breaker.getStatus().state).toBe('OPEN');

    breaker.reset();
    expect(breaker.getStatus().state).toBe('CLOSED');
    expect(breaker.getStatus().failures).toBe(0);
  });

  it('getStatus() returns complete status', async () => {
    const status = breaker.getStatus();
    expect(status).toEqual({
      name: 'test-service',
      state: 'CLOSED',
      failures: 0,
      lastFailureTime: null,
      nextRetryTime: null,
    });
  });

  it('getStatus() includes lastFailureTime when circuit is OPEN', async () => {
    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();
    }

    const status = breaker.getStatus();
    expect(status.state).toBe('OPEN');
    expect(status.lastFailureTime).not.toBeNull();
    expect(status.nextRetryTime).not.toBeNull();
  });
});

// ─── withRetry ───────────────────────────────────────────────────────

describe('withRetry', () => {
  it('returns result on first try success', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, { maxRetries: 2, baseDelayMs: 10 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on retryable error and succeeds', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(makeNetworkError('ECONNRESET'))
      .mockResolvedValue('recovered');

    const result = await withRetry(fn, { maxRetries: 2, baseDelayMs: 10 });
    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries up to maxRetries times', async () => {
    const fn = jest.fn().mockRejectedValue(makeNetworkError('ECONNREFUSED'));

    await expect(withRetry(fn, { maxRetries: 3, baseDelayMs: 10 })).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
  });

  it('does not retry non-retryable errors', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('Validation failed'));

    await expect(withRetry(fn, { maxRetries: 3, baseDelayMs: 10 })).rejects.toThrow('Validation failed');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on 5xx HTTP status', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce({ status: 503 })
      .mockResolvedValue('ok');

    const result = await withRetry(fn, { maxRetries: 2, baseDelayMs: 10 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries on 429 rate limit', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce({ status: 429 })
      .mockResolvedValue('ok');

    const result = await withRetry(fn, { maxRetries: 2, baseDelayMs: 10 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does not retry on 4xx (non-429) status', async () => {
    const fn = jest.fn().mockRejectedValue({ status: 404 });

    await expect(withRetry(fn, { maxRetries: 3, baseDelayMs: 10 })).rejects.toEqual({ status: 404 });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('supports custom shouldRetry predicate', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('retryable'))
      .mockResolvedValue('ok');

    const result = await withRetry(fn, {
      maxRetries: 2,
      baseDelayMs: 10,
      shouldRetry: (e) => e instanceof Error && e.message === 'retryable',
    });

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

// ─── withTimeout ─────────────────────────────────────────────────────

describe('withTimeout', () => {
  it('returns result when function completes before timeout', async () => {
    const result = await withTimeout(
      () => Promise.resolve('fast'),
      1000,
      'test-op',
    );
    expect(result).toBe('fast');
  });

  it('throws TimeoutError when function exceeds timeout', async () => {
    await expect(
      withTimeout(
        () => sleep(500),
        50,
        'slow-op',
      ),
    ).rejects.toThrow(TimeoutError);
  });

  it('TimeoutError contains operation name and timeout duration', async () => {
    try {
      await withTimeout(() => sleep(500), 50, 'my-operation');
    } catch (error) {
      expect(error).toBeInstanceOf(TimeoutError);
      expect((error as TimeoutError).message).toContain('my-operation');
      expect((error as TimeoutError).timeoutMs).toBe(50);
    }
  });

  it('propagates errors from the wrapped function', async () => {
    await expect(
      withTimeout(
        () => Promise.reject(new Error('inner error')),
        1000,
      ),
    ).rejects.toThrow('inner error');
  });
});

// ─── withResilience (composed) ───────────────────────────────────────

describe('withResilience', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker('composed-test', {
      failureThreshold: 2,
      resetTimeoutMs: 100,
    });
  });

  it('composes circuit breaker + retry + timeout', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(makeNetworkError('ECONNRESET'))
      .mockResolvedValue('ok');

    const result = await withResilience(fn, {
      circuitBreaker: breaker,
      retry: { maxRetries: 2, baseDelayMs: 10 },
      timeoutMs: 5000,
      label: 'test-call',
    });

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('works with only circuit breaker', async () => {
    const result = await withResilience(
      () => Promise.resolve('ok'),
      { circuitBreaker: breaker },
    );
    expect(result).toBe('ok');
  });

  it('works with only retry', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(makeNetworkError('ECONNRESET'))
      .mockResolvedValue('ok');

    const result = await withResilience(fn, {
      retry: { maxRetries: 1, baseDelayMs: 10 },
    });
    expect(result).toBe('ok');
  });

  it('works with only timeout', async () => {
    const result = await withResilience(
      () => Promise.resolve('fast'),
      { timeoutMs: 1000 },
    );
    expect(result).toBe('fast');
  });

  it('circuit breaker wraps retry (failures during retry count toward breaker)', async () => {
    const fn = jest.fn().mockRejectedValue(makeNetworkError('ECONNREFUSED'));

    // First call: retries exhaust, failure #1 on circuit
    await expect(withResilience(fn, {
      circuitBreaker: breaker,
      retry: { maxRetries: 1, baseDelayMs: 10 },
    })).rejects.toThrow();

    // Second call: retries exhaust, failure #2 → circuit opens
    await expect(withResilience(fn, {
      circuitBreaker: breaker,
      retry: { maxRetries: 1, baseDelayMs: 10 },
    })).rejects.toThrow();

    expect(breaker.getStatus().state).toBe('OPEN');
  });
});

// ─── Pre-configured breakers ─────────────────────────────────────────

describe('circuitBreakers', () => {
  afterEach(() => {
    // Reset all breakers after each test
    Object.values(circuitBreakers).forEach(cb => cb.reset());
  });

  it('has breakers for github, jira, jenkins, confluence, xray', () => {
    expect(circuitBreakers.github).toBeInstanceOf(CircuitBreaker);
    expect(circuitBreakers.jira).toBeInstanceOf(CircuitBreaker);
    expect(circuitBreakers.jenkins).toBeInstanceOf(CircuitBreaker);
    expect(circuitBreakers.confluence).toBeInstanceOf(CircuitBreaker);
    expect(circuitBreakers.xray).toBeInstanceOf(CircuitBreaker);
  });

  it('getAllCircuitBreakerStatuses() returns all breaker states', () => {
    const statuses = getAllCircuitBreakerStatuses();
    expect(statuses).toHaveLength(6);

    const names = statuses.map(s => s.name);
    expect(names).toContain('github');
    expect(names).toContain('jira');
    expect(names).toContain('jenkins');
    expect(names).toContain('confluence');
    expect(names).toContain('xray');
    expect(names).toContain('azureDevOps');

    statuses.forEach(s => {
      expect(s.state).toBe('CLOSED');
      expect(s.failures).toBe(0);
    });
  });
});

// ─── Helpers ─────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function makeNetworkError(code: string): NodeJS.ErrnoException {
  const error = new Error(`connect ${code}`) as NodeJS.ErrnoException;
  error.code = code;
  return error;
}
