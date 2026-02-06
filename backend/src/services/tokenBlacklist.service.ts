import { logger } from '../utils/logger';

/**
 * Token Blacklist Service
 *
 * Maintains a set of revoked JWT tokens. Uses an in-memory store with TTL-based
 * expiration. In production with multiple instances, replace with Redis.
 */

interface BlacklistEntry {
  token: string;
  expiresAt: number;
}

class TokenBlacklistService {
  private blacklist: Map<string, number> = new Map();
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor() {
    // Clean up expired tokens every 15 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 15 * 60 * 1000);
  }

  /**
   * Add a token to the blacklist
   * @param token - The JWT token to blacklist
   * @param expiresInMs - Time until the token naturally expires (ms)
   */
  async add(token: string, expiresInMs: number): Promise<void> {
    const expiresAt = Date.now() + expiresInMs;
    this.blacklist.set(token, expiresAt);
    logger.debug('Token added to blacklist');
  }

  /**
   * Check if a token is blacklisted
   */
  async isBlacklisted(token: string): Promise<boolean> {
    const expiresAt = this.blacklist.get(token);
    if (!expiresAt) {
      return false;
    }

    // If the blacklist entry has expired, remove it
    if (Date.now() > expiresAt) {
      this.blacklist.delete(token);
      return false;
    }

    return true;
  }

  /**
   * Remove expired entries from the blacklist
   */
  private cleanup(): void {
    const now = Date.now();
    let removed = 0;
    for (const [token, expiresAt] of this.blacklist.entries()) {
      if (now > expiresAt) {
        this.blacklist.delete(token);
        removed++;
      }
    }
    if (removed > 0) {
      logger.debug(`Token blacklist cleanup: removed ${removed} expired entries`);
    }
  }

  /**
   * Shutdown the cleanup interval
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
  }
}

export const tokenBlacklist = new TokenBlacklistService();
