import express from 'express';
import request from 'supertest';

// Mock prisma
jest.mock('../../lib/prisma', () => ({
  prisma: {
    $queryRaw: jest.fn(),
    user: { count: jest.fn().mockResolvedValue(5) },
  },
}));

// Mock redis
const mockRedis = {
  ping: jest.fn(),
  status: 'ready' as string,
};
jest.mock('../../lib/redis', () => ({
  redis: mockRedis,
}));

// Mock resilience
jest.mock('../../lib/resilience', () => ({
  getAllCircuitBreakerStatuses: jest.fn().mockReturnValue([]),
}));

// Mock config
jest.mock('../../config', () => ({
  config: {
    security: {
      csrfSecret: 'test-csrf-secret-must-be-at-least-32-characters-long',
      sessionSecret: 'test-session-secret-must-be-at-least-32-chars',
      secureCookie: false,
    },
    redis: { host: 'localhost', port: 6379, mode: 'standalone', db: 0, nodes: [] },
  },
}));

import { prisma } from '../../lib/prisma';
import { readinessCheck, livenessCheck, healthCheck } from '../health.controller';

function createApp(): express.Application {
  const app = express();
  app.get('/health', healthCheck);
  app.get('/health/ready', readinessCheck);
  app.get('/health/live', livenessCheck);
  return app;
}

describe('Health Controller', () => {
  let app: express.Application;

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockRedis.status = 'ready';
  });

  describe('GET /health (liveness)', () => {
    it('should return 200 with status ok', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ '1': 1 }]);

      const res = await request(app).get('/health').expect(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.timestamp).toBeDefined();
    });

    it('should return 503 when database is down', async () => {
      (prisma.$queryRaw as jest.Mock).mockRejectedValue(new Error('Connection refused'));

      const res = await request(app).get('/health');
      expect(res.status).toBe(503);
      expect(res.body.status).toBe('error');
    });
  });

  describe('GET /health/live', () => {
    it('should always return 200 with alive: true', async () => {
      const res = await request(app).get('/health/live').expect(200);
      expect(res.body.alive).toBe(true);
      expect(res.body.uptime).toBeDefined();
      expect(res.body.timestamp).toBeDefined();
    });
  });

  describe('GET /health/ready', () => {
    it('should return 200 when DB and Redis are healthy', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ '1': 1 }]);
      mockRedis.ping.mockResolvedValue('PONG');

      const res = await request(app).get('/health/ready').expect(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.checks.database.status).toBe('up');
      expect(res.body.checks.redis.status).toBe('up');
    });

    it('should return 503 when database is down', async () => {
      (prisma.$queryRaw as jest.Mock).mockRejectedValue(new Error('Connection refused'));
      mockRedis.ping.mockResolvedValue('PONG');

      const res = await request(app).get('/health/ready');
      expect(res.status).toBe(503);
      expect(res.body.status).toBe('degraded');
      expect(res.body.checks.database.status).toBe('down');
      expect(res.body.checks.database.error).toContain('Connection refused');
    });

    it('should return 503 when Redis is down', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ '1': 1 }]);
      mockRedis.ping.mockRejectedValue(new Error('ECONNREFUSED'));

      const res = await request(app).get('/health/ready');
      expect(res.status).toBe(503);
      expect(res.body.status).toBe('degraded');
      expect(res.body.checks.redis.status).toBe('down');
      expect(res.body.checks.redis.error).toContain('ECONNREFUSED');
    });

    it('should skip Redis check when Redis is not connected', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ '1': 1 }]);
      mockRedis.status = 'end';

      const res = await request(app).get('/health/ready').expect(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.checks.database.status).toBe('up');
      expect(res.body.checks.redis).toBeUndefined();
    });

    it('should return 503 when both DB and Redis are down', async () => {
      (prisma.$queryRaw as jest.Mock).mockRejectedValue(new Error('DB down'));
      mockRedis.ping.mockRejectedValue(new Error('Redis down'));

      const res = await request(app).get('/health/ready');
      expect(res.status).toBe(503);
      expect(res.body.checks.database.status).toBe('down');
      expect(res.body.checks.redis.status).toBe('down');
    });
  });
});
