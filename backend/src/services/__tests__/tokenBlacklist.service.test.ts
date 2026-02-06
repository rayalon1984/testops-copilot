import { tokenBlacklist } from '../tokenBlacklist.service';

// Mock the logger to prevent console output during tests
jest.mock('@/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('TokenBlacklistService', () => {
  afterAll(() => {
    // Clean up the interval timer to prevent open handles
    tokenBlacklist.destroy();
  });

  beforeEach(() => {
    // Reset the internal blacklist state between tests by destroying and
    // relying on the exported singleton. We access the private map via
    // bracket notation for test purposes.
    (tokenBlacklist as any).blacklist.clear();
  });

  describe('add', () => {
    it('should add a token to the blacklist', async () => {
      await tokenBlacklist.add('test-token-1', 60000);

      const isBlacklisted = await tokenBlacklist.isBlacklisted('test-token-1');
      expect(isBlacklisted).toBe(true);
    });

    it('should support adding multiple tokens', async () => {
      await tokenBlacklist.add('token-a', 60000);
      await tokenBlacklist.add('token-b', 60000);

      expect(await tokenBlacklist.isBlacklisted('token-a')).toBe(true);
      expect(await tokenBlacklist.isBlacklisted('token-b')).toBe(true);
    });
  });

  describe('isBlacklisted', () => {
    it('should return false for a token that was never added', async () => {
      const result = await tokenBlacklist.isBlacklisted('non-existent-token');
      expect(result).toBe(false);
    });

    it('should return true for a token that has been added and is not expired', async () => {
      await tokenBlacklist.add('active-token', 300000); // 5 minutes

      const result = await tokenBlacklist.isBlacklisted('active-token');
      expect(result).toBe(true);
    });

    it('should return false for a token whose blacklist entry has expired', async () => {
      // Add a token that expired 1 second ago (negative TTL effectively)
      // We manipulate the internal map directly for this edge case
      (tokenBlacklist as any).blacklist.set('expired-token', Date.now() - 1000);

      const result = await tokenBlacklist.isBlacklisted('expired-token');
      expect(result).toBe(false);
    });

    it('should remove an expired token from the blacklist on access', async () => {
      (tokenBlacklist as any).blacklist.set('expired-token-2', Date.now() - 1000);

      // First call should detect expiry and remove it
      await tokenBlacklist.isBlacklisted('expired-token-2');

      // Verify it was removed from the internal map
      expect((tokenBlacklist as any).blacklist.has('expired-token-2')).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('should remove expired tokens during cleanup', () => {
      const now = Date.now();

      // Add expired tokens directly to the internal map
      (tokenBlacklist as any).blacklist.set('expired-1', now - 5000);
      (tokenBlacklist as any).blacklist.set('expired-2', now - 10000);
      // Add a valid token
      (tokenBlacklist as any).blacklist.set('valid-1', now + 60000);

      // Call the private cleanup method
      (tokenBlacklist as any).cleanup();

      // Expired tokens should be removed
      expect((tokenBlacklist as any).blacklist.has('expired-1')).toBe(false);
      expect((tokenBlacklist as any).blacklist.has('expired-2')).toBe(false);
      // Valid token should still exist
      expect((tokenBlacklist as any).blacklist.has('valid-1')).toBe(true);
    });

    it('should not remove tokens that have not yet expired', () => {
      const now = Date.now();

      (tokenBlacklist as any).blacklist.set('future-token', now + 300000);

      (tokenBlacklist as any).cleanup();

      expect((tokenBlacklist as any).blacklist.has('future-token')).toBe(true);
    });

    it('should handle an empty blacklist without errors', () => {
      (tokenBlacklist as any).blacklist.clear();

      expect(() => {
        (tokenBlacklist as any).cleanup();
      }).not.toThrow();
    });
  });

  describe('destroy', () => {
    it('should clear the cleanup interval without throwing', () => {
      // Create a separate instance to test destroy without affecting the singleton
      // We just ensure calling destroy does not throw
      expect(() => {
        tokenBlacklist.destroy();
      }).not.toThrow();
    });
  });
});
