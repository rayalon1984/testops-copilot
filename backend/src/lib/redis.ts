import Redis, { Cluster, RedisOptions } from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';

let redisClient: Redis | Cluster;

// ── Guard: skip connection entirely when Redis is disabled ───────────
if (!config.redis.enabled) {
    logger.info('Redis is disabled (REDIS_ENABLED=false). Using in-memory fallbacks.');

    // Build a no-op Redis stub that never touches the network.
    // All commands reject immediately so consumers fall through to their
    // in-memory fallbacks (tokenBlacklist, AI cache, etc.).
    const noop = new Redis({ lazyConnect: true });
    // Attach an error handler BEFORE anything can emit — prevents
    // "[ioredis] Unhandled error event" from ever appearing.
    noop.on('error', () => {});
    // Force permanent "end" status so session-store / health checks skip Redis
    Object.defineProperty(noop, 'status', { get: () => 'end', configurable: true });
    // Kill the internal connection so commands reject and no TCP is attempted
    noop.disconnect(false);

    redisClient = noop;
} else {
    const redisConfig: RedisOptions = {
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        db: config.redis.db,
        retryStrategy: (times) => {
            if (times > 5) {
                logger.warn('Redis retry limit reached. Redis features will be disabled.');
                return null; // Stop retrying
            }
            const delay = Math.min(times * 50, 2000);
            return delay;
        },
        lazyConnect: true, // Do not connect on instantiation
    };

    if (config.redis.mode === 'cluster') {
        logger.info('Initializing Redis in Cluster mode');
        const nodes = config.redis.nodes.map((node) => {
            const [host, port] = node.split(':');
            return { host, port: parseInt(port, 10) };
        });
        redisClient = new Redis.Cluster(nodes, {
            redisOptions: {
                password: config.redis.password,
                lazyConnect: true
            }
        });
    } else if (config.redis.mode === 'sentinel') {
        logger.info('Initializing Redis in Sentinel mode');
        const sentinels = config.redis.nodes.map((node) => {
            const [host, port] = node.split(':');
            return { host, port: parseInt(port, 10) };
        });
        redisClient = new Redis({
            sentinels,
            name: config.redis.masterName || 'mymaster',
            password: config.redis.password,
            db: config.redis.db,
            lazyConnect: true
        });
    } else {
        logger.info('Initializing Redis in Standalone mode');
        redisClient = new Redis(redisConfig);
    }

    // Attempt to connect but don't crash if it fails
    redisClient.connect().catch(err => {
        logger.error('Failed to connect to Redis. Redis features will be disabled.', err);
    });

    redisClient.on('connect', () => {
        logger.info('Redis connected successfully');
    });

    redisClient.on('error', (error) => {
        logger.error('Redis connection error:', error);
    });

    redisClient.on('close', () => {
        logger.warn('Redis connection closed');
    });
}

export const redis = redisClient;
