/**
 * Self-Healing Service — Unit Tests
 *
 * Covers: rule matching (regex, keyword, signature), built-in patterns,
 * circuit-breaker logic, and evaluation flow.
 */

import { SelfHealingService } from '../self-healing.service';

// ── matchRule (pure function — no DB) ──────────────────────

describe('SelfHealingService.matchRule', () => {
  const makeRule = (overrides: Partial<{ pattern: string; patternType: string; name: string }> = {}) => ({
    pattern: '(ETIMEDOUT|ECONNRESET)',
    patternType: 'regex',
    name: 'Test Rule',
    ...overrides,
  });

  describe('regex matching', () => {
    it('matches raw error message against regex pattern', () => {
      const rule = makeRule({ pattern: '(ETIMEDOUT|ECONNRESET|socket hang up)' });
      const result = SelfHealingService.matchRule(rule, 'Error: connect ETIMEDOUT 10.0.0.1:443');
      expect(result).not.toBeNull();
      expect(result!.confidence).toBe(1.0);
      expect(result!.reason).toContain('Regex match');
    });

    it('matches case-insensitively', () => {
      const rule = makeRule({ pattern: '(etimedout|econnreset)' });
      const result = SelfHealingService.matchRule(rule, 'Error: connect ETIMEDOUT');
      expect(result).not.toBeNull();
      expect(result!.confidence).toBe(1.0);
    });

    it('returns null for non-matching regex', () => {
      const rule = makeRule({ pattern: '(ETIMEDOUT|ECONNRESET)' });
      const result = SelfHealingService.matchRule(rule, 'TypeError: Cannot read property "x" of null');
      expect(result).toBeNull();
    });

    it('handles invalid regex gracefully', () => {
      const rule = makeRule({ pattern: '[invalid(' });
      const result = SelfHealingService.matchRule(rule, 'some error');
      expect(result).toBeNull();
    });

    it('matches normalized error when raw does not match', () => {
      // The normalized version strips UUIDs, which might let a pattern match
      const rule = makeRule({ pattern: 'timeout', patternType: 'regex' });
      const result = SelfHealingService.matchRule(rule, 'Error: timeout after 5000ms for request abc-123');
      expect(result).not.toBeNull();
    });
  });

  describe('keyword matching', () => {
    it('matches when all keywords are present', () => {
      const rule = makeRule({ pattern: 'timeout,connection', patternType: 'keyword', name: 'KW Rule' });
      const result = SelfHealingService.matchRule(rule, 'connection timeout after 5000ms');
      expect(result).not.toBeNull();
      expect(result!.confidence).toBe(1.0);
      expect(result!.reason).toContain('All keywords matched');
    });

    it('matches with partial keywords (>= 50%)', () => {
      const rule = makeRule({ pattern: 'timeout,connection,ssl,proxy', patternType: 'keyword', name: 'KW Rule' });
      const result = SelfHealingService.matchRule(rule, 'connection timeout error');
      expect(result).not.toBeNull();
      expect(result!.confidence).toBe(0.5);
    });

    it('returns null when fewer than 50% keywords match', () => {
      const rule = makeRule({ pattern: 'timeout,connection,ssl,proxy', patternType: 'keyword' });
      const result = SelfHealingService.matchRule(rule, 'ssl certificate expired');
      expect(result).toBeNull();
    });

    it('is case-insensitive', () => {
      const rule = makeRule({ pattern: 'TIMEOUT,CONNECTION', patternType: 'keyword', name: 'KW' });
      const result = SelfHealingService.matchRule(rule, 'Connection timeout');
      expect(result).not.toBeNull();
    });
  });

  describe('signature matching', () => {
    it('matches similar signatures (>= 60% similarity)', () => {
      const rule = makeRule({
        pattern: 'connection timeout after',
        patternType: 'signature',
        name: 'Sig Rule',
      });
      const result = SelfHealingService.matchRule(rule, 'connection timeout after 5000ms');
      expect(result).not.toBeNull();
      expect(result!.confidence).toBeGreaterThanOrEqual(0.6);
      expect(result!.reason).toContain('Signature similarity');
    });

    it('returns null for dissimilar signatures', () => {
      const rule = makeRule({
        pattern: 'connection timeout after',
        patternType: 'signature',
      });
      const result = SelfHealingService.matchRule(rule, 'null pointer exception in UserService.getById');
      expect(result).toBeNull();
    });
  });

  describe('unknown pattern type', () => {
    it('returns null for unsupported pattern types', () => {
      const rule = makeRule({ patternType: 'unknown' });
      const result = SelfHealingService.matchRule(rule, 'any error');
      expect(result).toBeNull();
    });
  });
});

// ── Built-in patterns ──────────────────────────────────────

describe('SelfHealingService built-in patterns', () => {
  const patterns = SelfHealingService.getBuiltInPatterns();

  it('has at least 8 built-in patterns', () => {
    expect(patterns.length).toBeGreaterThanOrEqual(8);
  });

  it('all patterns have valid regex', () => {
    for (const p of patterns) {
      if (p.patternType === 'regex') {
        expect(() => new RegExp(p.pattern, 'i')).not.toThrow();
      }
    }
  });

  it('all patterns have confidence threshold between 0 and 1', () => {
    for (const p of patterns) {
      expect(p.confidenceThreshold).toBeGreaterThan(0);
      expect(p.confidenceThreshold).toBeLessThanOrEqual(1);
    }
  });

  it('matches Network Timeout pattern against ETIMEDOUT error', () => {
    const rule = patterns.find(p => p.name === 'Network Timeout')!;
    const result = SelfHealingService.matchRule(rule, 'Error: connect ETIMEDOUT 10.0.0.1:443');
    expect(result).not.toBeNull();
    expect(result!.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('matches Docker Rate Limit pattern', () => {
    const rule = patterns.find(p => p.name === 'Docker Rate Limit')!;
    const result = SelfHealingService.matchRule(rule, 'Error: toomanyrequests: too many requests to docker.io');
    expect(result).not.toBeNull();
  });

  it('matches npm Registry Error pattern', () => {
    const rule = patterns.find(p => p.name === 'npm Registry Error')!;
    const result = SelfHealingService.matchRule(rule, 'npm ERR! 503 Service Unavailable');
    expect(result).not.toBeNull();
  });

  it('matches Selenium Stale Element pattern', () => {
    const rule = patterns.find(p => p.name === 'Selenium Stale Element')!;
    const result = SelfHealingService.matchRule(rule, 'StaleElementReferenceException: element is not attached to the page document');
    expect(result).not.toBeNull();
  });

  it('matches DNS Resolution Failure pattern', () => {
    const rule = patterns.find(p => p.name === 'DNS Resolution Failure')!;
    const result = SelfHealingService.matchRule(rule, 'Error: getaddrinfo ENOTFOUND api.example.com');
    expect(result).not.toBeNull();
  });

  it('matches Out of Memory pattern', () => {
    const rule = patterns.find(p => p.name === 'Out of Memory')!;
    const result = SelfHealingService.matchRule(rule, 'FATAL ERROR: CALL_AND_RETRY_LAST Allocation failed - JavaScript heap out of memory');
    expect(result).not.toBeNull();
  });

  it('matches Disk Space Exhausted pattern', () => {
    const rule = patterns.find(p => p.name === 'Disk Space Exhausted')!;
    const result = SelfHealingService.matchRule(rule, 'Error: ENOSPC: no space left on device, write');
    expect(result).not.toBeNull();
  });

  it('matches Flaky Assertion Timeout pattern', () => {
    const rule = patterns.find(p => p.name === 'Flaky Assertion Timeout')!;
    const result = SelfHealingService.matchRule(rule, 'Error: Timeout - Async callback was not invoked within the 5000ms timeout');
    expect(result).not.toBeNull();
  });

  it('does NOT match unrelated errors', () => {
    for (const rule of patterns) {
      const result = SelfHealingService.matchRule(rule, 'AssertionError: expected true to be false');
      expect(result).toBeNull();
    }
  });
});
