import Redis, { Cluster, RedisOptions } from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';

let redisClient: Redis | Cluster;

const redisConfig: RedisOptions = {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    db: config.redis.db,
    retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
    },
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
    });
} else {
    logger.info('Initializing Redis in Standalone mode');
    redisClient = new Redis(redisConfig);
}

redisClient.on('connect', () => {
    logger.info('Redis connected successfully');
});

redisClient.on('error', (error) => {
    logger.error('Redis connection error:', error);
});

redisClient.on('close', () => {
    logger.warn('Redis connection closed');
});

export const redis = redisClient;
