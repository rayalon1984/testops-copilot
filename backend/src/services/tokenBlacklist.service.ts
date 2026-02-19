import { redis } from '../lib/redis';
import { logger } from '../utils/logger';

const KEY_PREFIX = 'token:blacklist:';

/**
 * Token Blacklist Service
 *
 * Maintains a set of revoked JWT tokens in Redis with automatic TTL expiration.
 * Falls back to in-memory Map if Redis is unavailable.
 */

class TokenBlacklistService {
  /** In-memory fallback when Redis is down */
  private fallback: Map<string, number> = new Map();
  private fallbackInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Add a token to the blacklist
   * @param token - The JWT token to blacklist
   * @param expiresInMs - Time until the token naturally expires (ms)
   */
  async add(token: string, expiresInMs: number): Promise<void> {
    const ttlSeconds = Math.ceil(expiresInMs / 1000);
    try {
      await redis.set(KEY_PREFIX + token, '1', 'EX', ttlSeconds);
      logger.debug('Token added to blacklist (Redis)');
    } catch {
      // Fallback to in-memory if Redis is unavailable
      this.ensureFallbackCleanup();
      this.fallback.set(token, Date.now() + expiresInMs);
      logger.debug('Token added to blacklist (in-memory fallback)');
    }
  }

  /**
   * Check if a token is blacklisted
   */
  async isBlacklisted(token: string): Promise<boolean> {
    try {
      const result = await redis.exists(KEY_PREFIX + token);
      if (result) return true;
    } catch {
      // Fall through to in-memory check
    }

    // Check in-memory fallback
    const expiresAt = this.fallback.get(token);
    if (!expiresAt) return false;
    if (Date.now() > expiresAt) {
      this.fallback.delete(token);
      return false;
    }
    return true;
  }

  /**
   * Start the in-memory fallback cleanup interval (only when fallback is used)
   */
  private ensureFallbackCleanup(): void {
    if (this.fallbackInterval) return;
    this.fallbackInterval = setInterval(() => {
      const now = Date.now();
      let removed = 0;
      for (const [t, exp] of this.fallback.entries()) {
        if (now > exp) {
          this.fallback.delete(t);
          removed++;
        }
      }
      if (removed > 0) {
        logger.debug(`Token blacklist fallback cleanup: removed ${removed} expired entries`);
      }
      // Stop interval when fallback is empty
      if (this.fallback.size === 0 && this.fallbackInterval) {
        clearInterval(this.fallbackInterval);
        this.fallbackInterval = null;
      }
    }, 15 * 60 * 1000);
  }

  /**
   * Shutdown cleanup resources
   */
  destroy(): void {
    if (this.fallbackInterval) {
      clearInterval(this.fallbackInterval);
      this.fallbackInterval = null;
    }
  }
}

export const tokenBlacklist = new TokenBlacklistService();
