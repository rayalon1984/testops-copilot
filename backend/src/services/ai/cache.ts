/**
 * AI Services - Caching Layer
 *
 * Implements 3-tier caching for AI responses to reduce costs:
 * 1. Response Cache - Full AI responses
 * 2. Embedding Cache - Computed embeddings
 * 3. Summary Cache - Log summaries
 */

import * as crypto from 'crypto';
import Redis from 'ioredis';
import { AIResponse, Embedding } from './types';

export interface CacheConfig {
  enabled: boolean;
  ttlSeconds: number;
  redis?: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
}

/**
 * AI Response Cache
 */
export class AICache {
  private redis: Redis | null = null;
  private config: CacheConfig;
  private enabled: boolean;
  private stats: { hits: number; misses: number } = { hits: 0, misses: 0 };

  constructor(config: CacheConfig) {
    this.config = config;
    this.enabled = config.enabled;

    if (this.enabled && config.redis) {
      this.redis = new Redis({
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        db: config.redis.db || 0,
        retryStrategy: (times) => {
          if (times > 3) {
            console.warn('Redis connection failed, disabling cache');
            this.enabled = false;
            return null;
          }
          return Math.min(times * 100, 2000);
        },
      });

      this.redis.on('error', (err) => {
        console.error('Redis error:', err);
        this.enabled = false;
      });
    }
  }

  /**
   * Generate cache key from content
   */
  private generateKey(prefix: string, content: string): string {
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    return `ai:${prefix}:${hash}`;
  }

  /**
   * Cache an AI response
   */
  async cacheResponse(prompt: string, response: AIResponse): Promise<void> {
    if (!this.enabled || !this.redis) return;

    try {
      const key = this.generateKey('response', prompt);
      await this.redis.setex(
        key,
        this.config.ttlSeconds,
        JSON.stringify(response)
      );
    } catch (error) {
      console.error('Failed to cache response:', error);
    }
  }

  /**
   * Get cached AI response
   */
  async getResponse(prompt: string): Promise<AIResponse | null> {
    if (!this.enabled || !this.redis) {
      this.stats.misses++;
      return null;
    }

    try {
      const key = this.generateKey('response', prompt);
      const cached = await this.redis.get(key);

      if (cached) {
        this.stats.hits++;
        const response = JSON.parse(cached) as AIResponse;
        response.cached = true;
        return response;
      }

      this.stats.misses++;
      return null;
    } catch (error) {
      console.error('Failed to get cached response:', error);
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Cache an embedding
   */
  async cacheEmbedding(text: string, embedding: Embedding): Promise<void> {
    if (!this.enabled || !this.redis) return;

    try {
      const key = this.generateKey('embedding', text);
      await this.redis.setex(
        key,
        this.config.ttlSeconds,
        JSON.stringify(embedding)
      );
    } catch (error) {
      console.error('Failed to cache embedding:', error);
    }
  }

  /**
   * Get cached embedding
   */
  async getEmbedding(text: string): Promise<Embedding | null> {
    if (!this.enabled || !this.redis) {
      this.stats.misses++;
      return null;
    }

    try {
      const key = this.generateKey('embedding', text);
      const cached = await this.redis.get(key);

      if (cached) {
        this.stats.hits++;
        return JSON.parse(cached) as Embedding;
      }

      this.stats.misses++;
      return null;
    } catch (error) {
      console.error('Failed to get cached embedding:', error);
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Cache a summary
   */
  async cacheSummary(logHash: string, summary: any): Promise<void> {
    if (!this.enabled || !this.redis) return;

    try {
      const key = `ai:summary:${logHash}`;
      await this.redis.setex(
        key,
        this.config.ttlSeconds,
        JSON.stringify(summary)
      );
    } catch (error) {
      console.error('Failed to cache summary:', error);
    }
  }

  /**
   * Get cached summary
   */
  async getSummary(logHash: string): Promise<any | null> {
    if (!this.enabled || !this.redis) {
      this.stats.misses++;
      return null;
    }

    try {
      const key = `ai:summary:${logHash}`;
      const cached = await this.redis.get(key);

      if (cached) {
        this.stats.hits++;
        return JSON.parse(cached);
      }

      this.stats.misses++;
      return null;
    } catch (error) {
      console.error('Failed to get cached summary:', error);
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Clear all caches
   */
  async clear(prefix?: string): Promise<void> {
    if (!this.redis) return;

    try {
      const pattern = prefix ? `ai:${prefix}:*` : 'ai:*';
      const keys = await this.redis.keys(pattern);

      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      size: 0, // Would need to query Redis for actual size
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = { hits: 0, misses: 0 };
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
    }
  }
}

// Singleton instance
let cacheInstance: AICache | null = null;

export function getCache(config?: CacheConfig): AICache {
  if (!cacheInstance) {
    const finalConfig: CacheConfig = config || {
      enabled: process.env.AI_CACHE_ENABLED === 'true',
      ttlSeconds: parseInt(process.env.AI_CACHE_TTL_SECONDS || '604800', 10),
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.AI_CACHE_REDIS_DB || '1', 10),
      },
    };
    cacheInstance = new AICache(finalConfig);
  }
  return cacheInstance;
}

export function closeCache(): void {
  if (cacheInstance) {
    cacheInstance.close();
    cacheInstance = null;
  }
}
