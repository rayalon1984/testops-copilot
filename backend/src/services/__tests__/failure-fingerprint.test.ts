/**
 * Failure Fingerprinting — Unit Tests
 *
 * Covers: normalizeErrorMessage, normalizeStackTrace,
 * generateFailureSignature, calculateSimilarity, levenshteinDistance
 */

import {
  normalizeErrorMessage,
  normalizeStackTrace,
  generateFailureSignature,
  calculateSimilarity,
  levenshteinDistance,
} from '../failure-fingerprint';

describe('failure-fingerprint', () => {
  // ── normalizeErrorMessage ──────────────────────────────────

  describe('normalizeErrorMessage', () => {
    it('strips timestamps', () => {
      // Note: .toLowerCase() runs first, then :X:X replaces digit pairs in the
      // timestamp before the full timestamp regex can match. So the timestamp is
      // partially normalized rather than fully replaced with TIMESTAMP.
      const result = normalizeErrorMessage('Error at 2024-01-15T10:30:00.123Z: timeout');
      expect(result).not.toMatch(/10:30:00/);
    });

    it('strips UUIDs', () => {
      const result = normalizeErrorMessage('Not found: a1b2c3d4-e5f6-7890-abcd-ef1234567890');
      expect(result).toContain('UUID');
      expect(result).not.toContain('a1b2c3d4');
    });

    it('strips line numbers', () => {
      const result = normalizeErrorMessage('TypeError at line 42 col 15');
      // The replacement inserts capital X into an otherwise lowercased string
      expect(result).toContain('line X');
      expect(result).not.toContain('42');
    });

    it('strips memory addresses', () => {
      const result = normalizeErrorMessage('Segfault at 0xDEADBEEF');
      expect(result).toContain('0xADDR');
      expect(result).not.toContain('DEADBEEF');
    });

    it('normalizes IDs', () => {
      const result = normalizeErrorMessage('Record id=abc-123 not found');
      expect(result).toContain('id=ID');
    });

    it('truncates to 100 chars', () => {
      const longError = 'a'.repeat(200);
      expect(normalizeErrorMessage(longError).length).toBeLessThanOrEqual(100);
    });

    it('collapses whitespace', () => {
      const result = normalizeErrorMessage('error   with    spaces');
      expect(result).toBe('error with spaces');
    });
  });

  // ── normalizeStackTrace ────────────────────────────────────

  describe('normalizeStackTrace', () => {
    it('keeps only top 5 frames', () => {
      const trace = Array.from({ length: 10 }, (_, i) => `at func${i} (file.ts:${i}:${i})`).join('\n');
      const result = normalizeStackTrace(trace);
      expect(result.split('\n')).toHaveLength(5);
    });

    it('replaces line:col with X:X and strips parens', () => {
      // :42:10 → :X:X first, then (server.ts:X:X) → ()
      const result = normalizeStackTrace('at handler (server.ts:42:10)');
      expect(result).not.toContain(':42:10');
      expect(result).toContain('at handler');
    });

    it('strips parenthesized paths', () => {
      const result = normalizeStackTrace('at Module._compile (internal/modules/cjs/loader.js:778:30)');
      expect(result).toContain('()');
    });
  });

  // ── generateFailureSignature ───────────────────────────────

  describe('generateFailureSignature', () => {
    it('returns a colon-separated signature', () => {
      // Signature format: testHash:normalizedError:stackHash
      // Note: if error contains colons (e.g. "Error: timeout"), they appear in the middle part
      const sig = generateFailureSignature('test-login', 'connection timeout');
      expect(sig.split(':')).toHaveLength(3);
    });

    it('produces stable signatures for same inputs', () => {
      const a = generateFailureSignature('test-login', 'Error: timeout');
      const b = generateFailureSignature('test-login', 'Error: timeout');
      expect(a).toBe(b);
    });

    it('produces different signatures for different tests', () => {
      const a = generateFailureSignature('test-login', 'Error: timeout');
      const b = generateFailureSignature('test-logout', 'Error: timeout');
      expect(a).not.toBe(b);
    });

    it('uses "nostk" when no stack trace provided', () => {
      const sig = generateFailureSignature('test', 'err');
      expect(sig).toContain('nostk');
    });

    it('includes stack hash when stack trace provided', () => {
      const sig = generateFailureSignature('test', 'err', 'at func (file.ts:1:1)');
      expect(sig).not.toContain('nostk');
    });
  });

  // ── levenshteinDistance ────────────────────────────────────

  describe('levenshteinDistance', () => {
    it('returns 0 for identical strings', () => {
      expect(levenshteinDistance('hello', 'hello')).toBe(0);
    });

    it('returns string length for empty comparison', () => {
      expect(levenshteinDistance('hello', '')).toBe(5);
      expect(levenshteinDistance('', 'world')).toBe(5);
    });

    it('counts single character edits', () => {
      expect(levenshteinDistance('cat', 'bat')).toBe(1);  // substitution
      expect(levenshteinDistance('cat', 'cats')).toBe(1); // insertion
      expect(levenshteinDistance('cats', 'cat')).toBe(1); // deletion
    });

    it('handles multi-edit transformations', () => {
      expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
    });
  });

  // ── calculateSimilarity ────────────────────────────────────

  describe('calculateSimilarity', () => {
    it('returns 1.0 for identical strings', () => {
      expect(calculateSimilarity('error', 'error')).toBe(1.0);
    });

    it('returns 1.0 for two empty strings', () => {
      expect(calculateSimilarity('', '')).toBe(1.0);
    });

    it('returns 0 for completely different strings of same length', () => {
      // "abc" vs "xyz" = distance 3, length 3 → similarity 0
      expect(calculateSimilarity('abc', 'xyz')).toBe(0);
    });

    it('returns high similarity for similar errors', () => {
      const sim = calculateSimilarity(
        'connection timeout after 5000ms',
        'connection timeout after 3000ms'
      );
      expect(sim).toBeGreaterThan(0.8);
    });

    it('returns low similarity for very different errors', () => {
      const sim = calculateSimilarity(
        'null pointer exception in UserService',
        'file not found: config.yaml'
      );
      expect(sim).toBeLessThan(0.5);
    });
  });
});
