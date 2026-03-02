/**
 * Xray Controller — Integration Tests
 *
 * Tests all 10 Xray endpoints via supertest:
 *  - Auth (401 without token, 403 for non-admin on test-connection/config)
 *  - 503 when Xray is not configured
 *  - Validation (Zod: query params, UUID params, plan IDs, test case keys)
 *  - Success paths for all endpoints
 *  - Config PATCH/GET for auto-sync toggle
 */

import express, { Request, Response, NextFunction } from 'express';
import request from 'supertest';

// ─── Mocks (before imports) ─────────────────────────────────

const mockXrayService = {
  isEnabled: jest.fn().mockReturnValue(true),
  validateConnection: jest.fn().mockResolvedValue(true),
  getTestCases: jest.fn().mockResolvedValue([
    { key: 'PROJ-TC-1', summary: 'Login test', status: 'PASS', lastExecution: null },
  ]),
  getTestPlans: jest.fn().mockResolvedValue({
    total: 1,
    plans: [{ key: 'PROJ-TP-1', summary: 'Sprint 11', testCount: 5, passRate: 0, coveragePercentage: 80, coveredCount: 4, lastUpdated: null }],
  }),
  getTestPlan: jest.fn().mockResolvedValue({
    key: 'PROJ-TP-1', summary: 'Sprint 11', testCount: 5, passRate: 0, coveragePercentage: 80, coveredCount: 4, lastUpdated: null,
    testCases: [{ key: 'PROJ-TC-1', summary: 'Login test', status: 'PASS', lastExecution: null }],
  }),
  getTestCaseHistory: jest.fn().mockResolvedValue({
    testCaseKey: 'PROJ-TC-1', summary: 'Login test', status: 'PASS',
    executionHistory: [{ date: '2026-03-01', status: 'PASS', executionKey: 'PROJ-EX-1' }],
    linkedDefects: [],
  }),
  syncTestRun: jest.fn().mockResolvedValue({
    syncId: '00000000-0000-0000-0000-000000000001',
    status: 'SYNCED',
    xrayExecutionId: 'PROJ-123',
    resultCount: 3,
  }),
  getSyncHistory: jest.fn().mockResolvedValue([]),
  getSyncStatus: jest.fn().mockResolvedValue({
    id: '00000000-0000-0000-0000-000000000001',
    status: 'SYNCED',
    testRunId: '00000000-0000-0000-0000-000000000002',
  }),
};

jest.mock('@/services/xray.service', () => ({
  xrayService: mockXrayService,
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {},
}));

jest.mock('@/config', () => ({
  config: {
    jwt: { secret: 'test-secret-must-be-32-characters-long!!' },
    security: {
      csrfSecret: 'test-csrf-secret-must-be-at-least-32-characters-long',
      sessionSecret: 'test-session-secret-must-be-at-least-32-chars',
      secureCookie: false,
    },
    log: { level: 'silent' },
    xray: { autoSync: false },
  },
}));

jest.mock('@/services/tokenBlacklist.service', () => ({
  tokenBlacklist: { isBlacklisted: jest.fn().mockResolvedValue(false) },
}));

// Mock authenticate/authorize — lightweight version for route tests
jest.mock('@/middleware/auth', () => ({
  authenticate: (req: Request, _res: Response, next: NextFunction): void => {
    const userRole = req.headers['x-test-role'] as string | undefined;
    if (!userRole) {
      _res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    req.user = { id: 'test-user-id', role: userRole } as never;
    next();
  },
  authorize: (requiredRole: string) => (req: Request, res: Response, next: NextFunction): void => {
    const roleHierarchy: Record<string, number> = { VIEWER: 10, EDITOR: 30, ADMIN: 40 };
    const userRole = (req.user as { role: string })?.role;
    if ((roleHierarchy[userRole] || 0) < (roleHierarchy[requiredRole] || 0)) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }
    next();
  },
}));

// ─── App Setup ──────────────────────────────────────────────

import { xrayController } from '../xray.controller';

function createApp(): express.Application {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/xray', xrayController);
  return app;
}

// ─── Tests ──────────────────────────────────────────────────

describe('Xray Controller', () => {
  let app: express.Application;

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockXrayService.isEnabled.mockReturnValue(true);
  });

  // ─── Authentication ─────────────────────────────────────

  describe('Authentication', () => {
    it('returns 401 without auth header', async () => {
      const res = await request(app).get('/api/v1/xray/test-cases?q=login');
      expect(res.status).toBe(401);
    });

    it('returns 403 on test-connection for non-admin', async () => {
      const res = await request(app)
        .get('/api/v1/xray/test-connection')
        .set('x-test-role', 'VIEWER');
      expect(res.status).toBe(403);
    });

    it('allows admin on test-connection', async () => {
      const res = await request(app)
        .get('/api/v1/xray/test-connection')
        .set('x-test-role', 'ADMIN');
      expect(res.status).toBe(200);
    });
  });

  // ─── 503 When Disabled ──────────────────────────────────

  describe('503 when Xray not configured', () => {
    beforeEach(() => {
      mockXrayService.isEnabled.mockReturnValue(false);
    });

    it('test-connection returns 503', async () => {
      const res = await request(app)
        .get('/api/v1/xray/test-connection')
        .set('x-test-role', 'ADMIN');
      expect(res.status).toBe(503);
      expect(res.body.configured).toBe(false);
    });

    it('test-cases returns 503', async () => {
      const res = await request(app)
        .get('/api/v1/xray/test-cases?q=login')
        .set('x-test-role', 'VIEWER');
      expect(res.status).toBe(503);
    });

    it('test-plans returns 503', async () => {
      const res = await request(app)
        .get('/api/v1/xray/test-plans')
        .set('x-test-role', 'VIEWER');
      expect(res.status).toBe(503);
    });

    it('sync returns 503', async () => {
      const res = await request(app)
        .post('/api/v1/xray/sync/00000000-0000-0000-0000-000000000001')
        .set('x-test-role', 'EDITOR');
      expect(res.status).toBe(503);
    });
  });

  // ─── Validation ─────────────────────────────────────────

  describe('Validation', () => {
    it('test-cases rejects missing query param', async () => {
      const res = await request(app)
        .get('/api/v1/xray/test-cases')
        .set('x-test-role', 'VIEWER');
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Validation error');
    });

    it('sync rejects invalid UUID', async () => {
      const res = await request(app)
        .post('/api/v1/xray/sync/not-a-uuid')
        .set('x-test-role', 'EDITOR');
      expect(res.status).toBe(400);
    });

    it('syncs/:id rejects invalid UUID', async () => {
      const res = await request(app)
        .get('/api/v1/xray/syncs/not-a-uuid')
        .set('x-test-role', 'VIEWER');
      expect(res.status).toBe(400);
    });
  });

  // ─── Success Paths ──────────────────────────────────────

  describe('GET /test-connection', () => {
    it('returns connected: true when credentials valid', async () => {
      const res = await request(app)
        .get('/api/v1/xray/test-connection')
        .set('x-test-role', 'ADMIN');
      expect(res.status).toBe(200);
      expect(res.body.connected).toBe(true);
    });

    it('returns 400 when credentials invalid', async () => {
      mockXrayService.validateConnection.mockResolvedValueOnce(false);
      const res = await request(app)
        .get('/api/v1/xray/test-connection')
        .set('x-test-role', 'ADMIN');
      expect(res.status).toBe(400);
      expect(res.body.connected).toBe(false);
    });
  });

  describe('GET /test-cases', () => {
    it('returns test cases matching query', async () => {
      const res = await request(app)
        .get('/api/v1/xray/test-cases?q=login&limit=5')
        .set('x-test-role', 'VIEWER');
      expect(res.status).toBe(200);
      expect(res.body.testCases).toHaveLength(1);
      expect(res.body.testCases[0].key).toBe('PROJ-TC-1');
      expect(mockXrayService.getTestCases).toHaveBeenCalledWith('login', 5);
    });
  });

  describe('GET /test-plans', () => {
    it('returns test plans', async () => {
      const res = await request(app)
        .get('/api/v1/xray/test-plans')
        .set('x-test-role', 'VIEWER');
      expect(res.status).toBe(200);
      expect(res.body.testPlans).toHaveLength(1);
      expect(res.body.total).toBe(1);
    });
  });

  describe('POST /sync/:testRunId', () => {
    it('syncs test run and returns result', async () => {
      const testRunId = '00000000-0000-0000-0000-000000000002';
      const res = await request(app)
        .post(`/api/v1/xray/sync/${testRunId}`)
        .set('x-test-role', 'EDITOR');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('SYNCED');
      expect(res.body.xrayExecutionId).toBe('PROJ-123');
      expect(mockXrayService.syncTestRun).toHaveBeenCalledWith(testRunId, 'MANUAL');
    });
  });

  describe('GET /syncs', () => {
    it('returns sync history', async () => {
      const res = await request(app)
        .get('/api/v1/xray/syncs')
        .set('x-test-role', 'VIEWER');
      expect(res.status).toBe(200);
      expect(res.body.syncs).toBeDefined();
      expect(res.body.total).toBe(0);
    });
  });

  describe('GET /syncs/:id', () => {
    it('returns sync status for valid UUID', async () => {
      const syncId = '00000000-0000-0000-0000-000000000001';
      const res = await request(app)
        .get(`/api/v1/xray/syncs/${syncId}`)
        .set('x-test-role', 'VIEWER');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('SYNCED');
      expect(mockXrayService.getSyncStatus).toHaveBeenCalledWith(syncId);
    });
  });

  // ─── v3.4 New Endpoints ───────────────────────────────────

  describe('GET /test-plans/:planId', () => {
    it('returns single plan with test cases', async () => {
      const res = await request(app)
        .get('/api/v1/xray/test-plans/PROJ-TP-1')
        .set('x-test-role', 'VIEWER');
      expect(res.status).toBe(200);
      expect(res.body.key).toBe('PROJ-TP-1');
      expect(res.body.testCases).toHaveLength(1);
      expect(res.body.coveragePercentage).toBe(80);
      expect(mockXrayService.getTestPlan).toHaveBeenCalledWith('PROJ-TP-1');
    });

    it('returns 503 when Xray disabled', async () => {
      mockXrayService.isEnabled.mockReturnValue(false);
      const res = await request(app)
        .get('/api/v1/xray/test-plans/PROJ-TP-1')
        .set('x-test-role', 'VIEWER');
      expect(res.status).toBe(503);
    });
  });

  describe('GET /test-cases/:key/history', () => {
    it('returns test case history with executions and defects', async () => {
      const res = await request(app)
        .get('/api/v1/xray/test-cases/PROJ-TC-1/history')
        .set('x-test-role', 'VIEWER');
      expect(res.status).toBe(200);
      expect(res.body.testCaseKey).toBe('PROJ-TC-1');
      expect(res.body.executionHistory).toHaveLength(1);
      expect(res.body.linkedDefects).toEqual([]);
      expect(mockXrayService.getTestCaseHistory).toHaveBeenCalledWith('PROJ-TC-1');
    });

    it('returns 503 when Xray disabled', async () => {
      mockXrayService.isEnabled.mockReturnValue(false);
      const res = await request(app)
        .get('/api/v1/xray/test-cases/PROJ-TC-1/history')
        .set('x-test-role', 'VIEWER');
      expect(res.status).toBe(503);
    });
  });

  describe('PATCH /config', () => {
    it('requires ADMIN role', async () => {
      const res = await request(app)
        .patch('/api/v1/xray/config')
        .set('x-test-role', 'VIEWER')
        .send({ autoSync: true });
      expect(res.status).toBe(403);
    });

    it('updates auto-sync config for admin', async () => {
      const res = await request(app)
        .patch('/api/v1/xray/config')
        .set('x-test-role', 'ADMIN')
        .send({ autoSync: true });
      expect(res.status).toBe(200);
      expect(res.body.autoSync).toBe(true);
      expect(res.body.message).toMatch(/enabled/i);
    });

    it('disables auto-sync', async () => {
      const res = await request(app)
        .patch('/api/v1/xray/config')
        .set('x-test-role', 'ADMIN')
        .send({ autoSync: false });
      expect(res.status).toBe(200);
      expect(res.body.autoSync).toBe(false);
      expect(res.body.message).toMatch(/disabled/i);
    });

    it('rejects invalid body', async () => {
      const res = await request(app)
        .patch('/api/v1/xray/config')
        .set('x-test-role', 'ADMIN')
        .send({ autoSync: 'not-a-boolean' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /config', () => {
    it('returns config state for any authenticated user', async () => {
      const res = await request(app)
        .get('/api/v1/xray/config')
        .set('x-test-role', 'VIEWER');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('configured');
      expect(res.body).toHaveProperty('autoSync');
    });

    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/v1/xray/config');
      expect(res.status).toBe(401);
    });
  });

  // ─── Test Plan Pagination ──────────────────────────────────

  describe('GET /test-plans pagination', () => {
    it('passes limit and start to service', async () => {
      const res = await request(app)
        .get('/api/v1/xray/test-plans?limit=5&start=10')
        .set('x-test-role', 'VIEWER');
      expect(res.status).toBe(200);
      expect(mockXrayService.getTestPlans).toHaveBeenCalledWith(5, 10);
    });

    it('uses defaults when no params given', async () => {
      const res = await request(app)
        .get('/api/v1/xray/test-plans')
        .set('x-test-role', 'VIEWER');
      expect(res.status).toBe(200);
      expect(mockXrayService.getTestPlans).toHaveBeenCalledWith(10, 0);
    });
  });
});
