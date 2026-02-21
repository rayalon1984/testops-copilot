// Mock Redis before importing the service (Redis import triggers config Zod validation)
jest.mock('@/lib/redis', () => ({
  redis: {
    set: jest.fn().mockRejectedValue(new Error('Redis unavailable')),
    exists: jest.fn().mockRejectedValue(new Error('Redis unavailable')),
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { tokenBlacklist } from '../tokenBlacklist.service';
import { redis } from '@/lib/redis';

describe('TokenBlacklistService', () => {
  afterAll(() => {
    tokenBlacklist.destroy();
  });

  beforeEach(() => {
    // Clear the in-memory fallback between tests
    (tokenBlacklist as any).fallback.clear();
  });

  describe('add (fallback mode)', () => {
    it('should add a token to the fallback blacklist when Redis is unavailable', async () => {
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
      await tokenBlacklist.add('active-token', 300000);
      const result = await tokenBlacklist.isBlacklisted('active-token');
      expect(result).toBe(true);
    });

    it('should return false for a token whose blacklist entry has expired', async () => {
      (tokenBlacklist as any).fallback.set('expired-token', Date.now() - 1000);

      const result = await tokenBlacklist.isBlacklisted('expired-token');
      expect(result).toBe(false);
    });

    it('should remove an expired token from the fallback on access', async () => {
      (tokenBlacklist as any).fallback.set('expired-token-2', Date.now() - 1000);

      await tokenBlacklist.isBlacklisted('expired-token-2');

      expect((tokenBlacklist as any).fallback.has('expired-token-2')).toBe(false);
    });
  });

  describe('Redis integration', () => {
    it('should try Redis first, then fall back to in-memory', async () => {
      await tokenBlacklist.add('redis-test', 60000);

      // Redis was called (even though it failed)
      expect(redis.set).toHaveBeenCalled();

      // Token was still stored in fallback
      expect(await tokenBlacklist.isBlacklisted('redis-test')).toBe(true);
    });

    it('should use Redis exists when available', async () => {
      // Make Redis return that the key exists
      (redis.exists as jest.Mock).mockResolvedValueOnce(1);

      const result = await tokenBlacklist.isBlacklisted('redis-token');
      expect(result).toBe(true);
      expect(redis.exists).toHaveBeenCalledWith('token:blacklist:redis-token');
    });
  });

  describe('destroy', () => {
    it('should not throw when called', () => {
      expect(() => {
        tokenBlacklist.destroy();
      }).not.toThrow();
    });
  });
});
