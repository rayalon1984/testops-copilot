/**
 * XrayService Unit Tests
 *
 * Covers: authentication, connection validation, test case search,
 * sync, security (SSRF, JQL escape, secret leak), and mock/demo path.
 */

import axios from 'axios';
import { XrayService } from '../xray.service';
import { config } from '@/config';
import { validateUrlForSSRF } from '@/utils/ssrf-validator';
import { prisma } from '@/lib/prisma';

// ─── Mocks ─────────────────────────────────────────────────────────

jest.mock('axios');
jest.mock('@/lib/prisma', () => ({
  prisma: {
    testRun: { findUnique: jest.fn() },
    xraySync: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));
jest.mock('@/utils/ssrf-validator');
jest.mock('@/lib/resilience', () => ({
  withResilience: jest.fn((fn: () => Promise<unknown>) => fn()),
  circuitBreakers: {
    xray: { execute: jest.fn((fn: () => Promise<unknown>) => fn()) },
  },
}));

const mockAxiosCreate = axios.create as jest.Mock;
const mockValidateSSRF = validateUrlForSSRF as jest.Mock;

function createMockAxiosInstance() {
  return {
    post: jest.fn(),
    get: jest.fn(),
    defaults: { baseURL: '', headers: { common: {} } },
  };
}

// ─── Helpers ───────────────────────────────────────────────────────

function buildXrayConfig() {
  return {
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    projectKey: 'PROJ',
    cloudUrl: 'https://xray.cloud.getxray.app',
    autoSync: false,
  };
}

// ─── Tests ─────────────────────────────────────────────────────────

describe('XrayService', () => {
  let mockClient: ReturnType<typeof createMockAxiosInstance>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = createMockAxiosInstance();
    mockAxiosCreate.mockReturnValue(mockClient);
    mockValidateSSRF.mockImplementation(() => {}); // No-op — pass validation
  });

  // ── Constructor / isEnabled ────────────────────────────────────

  describe('constructor', () => {
    it('initializes when Xray config is present', () => {
      (config as unknown as Record<string, unknown>).xray = buildXrayConfig();
      const service = new XrayService();
      expect(service.isEnabled()).toBe(true);
      expect(mockValidateSSRF).toHaveBeenCalledWith('https://xray.cloud.getxray.app');
    });

    it('disables when Xray config is missing', () => {
      (config as unknown as Record<string, unknown>).xray = undefined;
      const service = new XrayService();
      expect(service.isEnabled()).toBe(false);
    });

    it('disables when SSRF validation rejects the URL', () => {
      (config as unknown as Record<string, unknown>).xray = buildXrayConfig();
      mockValidateSSRF.mockImplementation(() => {
        throw new Error('SSRF: localhost not allowed');
      });
      const service = new XrayService();
      expect(service.isEnabled()).toBe(false);
    });
  });

  // ── Authentication ─────────────────────────────────────────────

  describe('authenticate()', () => {
    it('exchanges client credentials for JWT token', async () => {
      (config as unknown as Record<string, unknown>).xray = buildXrayConfig();
      const service = new XrayService();

      mockClient.post.mockResolvedValueOnce({ data: '"mock-jwt-token"' });
      const token = await service.authenticate();

      expect(token).toBe('mock-jwt-token');
      expect(mockClient.post).toHaveBeenCalledWith('/authenticate', {
        client_id: 'test-client-id',
        client_secret: 'test-client-secret',
      });
    });

    it('caches token on subsequent calls', async () => {
      (config as unknown as Record<string, unknown>).xray = buildXrayConfig();
      const service = new XrayService();

      mockClient.post.mockResolvedValueOnce({ data: '"cached-jwt"' });
      await service.authenticate();
      const token2 = await service.authenticate();

      expect(token2).toBe('cached-jwt');
      // Only called once — second call uses cache
      expect(mockClient.post).toHaveBeenCalledTimes(1);
    });

    it('throws clear error on invalid credentials', async () => {
      (config as unknown as Record<string, unknown>).xray = buildXrayConfig();
      const service = new XrayService();

      const axiosError = new Error('Request failed') as Error & { response?: { status: number }; isAxiosError: boolean; code?: string };
      axiosError.response = { status: 401 };
      axiosError.isAxiosError = true;
      Object.setPrototypeOf(axiosError, axios.AxiosError.prototype);

      mockClient.post.mockRejectedValueOnce(axiosError);

      await expect(service.authenticate()).rejects.toThrow('Xray authentication failed');
    });

    it('throws when service is not enabled', async () => {
      (config as unknown as Record<string, unknown>).xray = undefined;
      const service = new XrayService();

      await expect(service.authenticate()).rejects.toThrow('not enabled or configured');
    });
  });

  // ── Connection Validation ──────────────────────────────────────

  describe('validateConnection()', () => {
    it('returns true when authentication succeeds', async () => {
      (config as unknown as Record<string, unknown>).xray = buildXrayConfig();
      const service = new XrayService();

      mockClient.post.mockResolvedValueOnce({ data: '"jwt-token"' });
      const result = await service.validateConnection();

      expect(result).toBe(true);
    });

    it('returns false when authentication fails', async () => {
      (config as unknown as Record<string, unknown>).xray = buildXrayConfig();
      const service = new XrayService();

      mockClient.post.mockRejectedValueOnce(new Error('Auth failed'));
      const result = await service.validateConnection();

      expect(result).toBe(false);
    });
  });

  // ── Test Case Search ───────────────────────────────────────────

  describe('getTestCases()', () => {
    it('returns structured test case results', async () => {
      (config as unknown as Record<string, unknown>).xray = buildXrayConfig();
      const service = new XrayService();

      // Auth call
      mockClient.post.mockResolvedValueOnce({ data: '"jwt"' });
      // getAuthorizedClient creates a new axios instance
      const authorizedClient = createMockAxiosInstance();
      mockAxiosCreate.mockReturnValueOnce(authorizedClient);

      authorizedClient.post.mockResolvedValueOnce({
        data: {
          data: {
            getTests: {
              total: 2,
              results: [
                {
                  issueId: '1001',
                  testType: { name: 'Manual' },
                  status: { name: 'PASS' },
                  lastModified: '2026-02-28',
                  jira: { key: 'PROJ-TC-101', summary: 'Checkout — valid payment' },
                },
                {
                  issueId: '1002',
                  testType: { name: 'Automated' },
                  status: { name: 'FAIL' },
                  lastModified: '2026-02-28',
                  jira: { key: 'PROJ-TC-102', summary: 'Checkout — expired card' },
                },
              ],
            },
          },
        },
      });

      const results = await service.getTestCases('checkout', 10);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        key: 'PROJ-TC-101',
        summary: 'Checkout — valid payment',
        status: 'PASS',
        lastExecution: '2026-02-28',
      });
    });

    it('caps results at 25 regardless of user request', async () => {
      (config as unknown as Record<string, unknown>).xray = buildXrayConfig();
      const service = new XrayService();

      mockClient.post.mockResolvedValueOnce({ data: '"jwt"' });
      const authorizedClient = createMockAxiosInstance();
      mockAxiosCreate.mockReturnValueOnce(authorizedClient);
      authorizedClient.post.mockResolvedValueOnce({ data: { data: { getTests: { total: 0, results: [] } } } });

      await service.getTestCases('test', 100);

      const graphqlQuery = authorizedClient.post.mock.calls[0][1].query;
      expect(graphqlQuery).toContain('limit: 25');
    });
  });

  // ── Sync Test Run ──────────────────────────────────────────────

  describe('syncTestRun()', () => {
    const mockTestRun = {
      id: 'run-uuid-1',
      name: 'Checkout E2E Suite',
      results: [
        { id: 'r1', status: 'PASSED', error: null, duration: 1200, externalTestCaseId: 'PROJ-TC-101' },
        { id: 'r2', status: 'FAILED', error: 'Timeout', duration: 5000, externalTestCaseId: 'PROJ-TC-102' },
        { id: 'r3', status: 'SKIPPED', error: null, duration: null, externalTestCaseId: null },
      ],
    };

    it('creates Xray execution with mapped test results', async () => {
      (config as unknown as Record<string, unknown>).xray = buildXrayConfig();
      const service = new XrayService();

      (prisma.testRun.findUnique as jest.Mock).mockResolvedValue(mockTestRun);
      (prisma.xraySync.findFirst as jest.Mock).mockResolvedValue(null); // No existing sync
      (prisma.xraySync.create as jest.Mock).mockResolvedValue({ id: 'sync-1', status: 'SYNCING' });
      (prisma.xraySync.update as jest.Mock).mockResolvedValue({});

      // Auth
      mockClient.post.mockResolvedValueOnce({ data: '"jwt"' });
      // Authorized client for import
      const authorizedClient = createMockAxiosInstance();
      mockAxiosCreate.mockReturnValueOnce(authorizedClient);
      authorizedClient.post.mockResolvedValueOnce({
        data: { testExecIssue: { key: 'PROJ-456' } },
      });

      const result = await service.syncTestRun('run-uuid-1');

      expect(result).toEqual({
        syncId: 'sync-1',
        status: 'SYNCED',
        xrayExecutionId: 'PROJ-456',
        resultCount: 3,
      });

      // Verify the import payload
      const importCall = authorizedClient.post.mock.calls[0];
      expect(importCall[0]).toBe('/import/execution');
      const payload = importCall[1];
      expect(payload.tests).toHaveLength(3);
      expect(payload.tests[0].status).toBe('PASS');
      expect(payload.tests[0].testKey).toBe('PROJ-TC-101');
      expect(payload.tests[1].status).toBe('FAIL');
      expect(payload.tests[1].comment).toBe('Timeout');
      expect(payload.tests[2].status).toBe('TODO');
    });

    it('maps status correctly: PASSED→PASS, FAILED→FAIL, SKIPPED→TODO', async () => {
      (config as unknown as Record<string, unknown>).xray = buildXrayConfig();
      const service = new XrayService();

      (prisma.testRun.findUnique as jest.Mock).mockResolvedValue({
        id: 'run-1',
        name: 'Status Test',
        results: [
          { id: 'r1', status: 'PASSED', error: null, duration: null, externalTestCaseId: null },
          { id: 'r2', status: 'FAILED', error: null, duration: null, externalTestCaseId: null },
          { id: 'r3', status: 'SKIPPED', error: null, duration: null, externalTestCaseId: null },
          { id: 'r4', status: 'FLAKY', error: null, duration: null, externalTestCaseId: null },
          { id: 'r5', status: 'ERROR', error: null, duration: null, externalTestCaseId: null },
        ],
      });
      (prisma.xraySync.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.xraySync.create as jest.Mock).mockResolvedValue({ id: 'sync-2', status: 'SYNCING' });
      (prisma.xraySync.update as jest.Mock).mockResolvedValue({});

      mockClient.post.mockResolvedValueOnce({ data: '"jwt"' });
      const authorizedClient = createMockAxiosInstance();
      mockAxiosCreate.mockReturnValueOnce(authorizedClient);
      authorizedClient.post.mockResolvedValueOnce({ data: { key: 'PROJ-789' } });

      await service.syncTestRun('run-1');

      const tests = authorizedClient.post.mock.calls[0][1].tests;
      expect(tests[0].status).toBe('PASS');
      expect(tests[1].status).toBe('FAIL');
      expect(tests[2].status).toBe('TODO');
      expect(tests[3].status).toBe('FAIL'); // FLAKY → FAIL
      expect(tests[4].status).toBe('FAIL'); // ERROR → FAIL
    });

    it('persists execution ID in XraySync model after success', async () => {
      (config as unknown as Record<string, unknown>).xray = buildXrayConfig();
      const service = new XrayService();

      (prisma.testRun.findUnique as jest.Mock).mockResolvedValue(mockTestRun);
      (prisma.xraySync.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.xraySync.create as jest.Mock).mockResolvedValue({ id: 'sync-persist', status: 'SYNCING' });
      (prisma.xraySync.update as jest.Mock).mockResolvedValue({});

      mockClient.post.mockResolvedValueOnce({ data: '"jwt"' });
      const authorizedClient = createMockAxiosInstance();
      mockAxiosCreate.mockReturnValueOnce(authorizedClient);
      authorizedClient.post.mockResolvedValueOnce({ data: { testExecIssue: { key: 'PROJ-EXEC-1' } } });

      await service.syncTestRun('run-uuid-1');

      const updateCall = (prisma.xraySync.update as jest.Mock).mock.calls[0][0];
      expect(updateCall.where.id).toBe('sync-persist');
      expect(updateCall.data.status).toBe('SYNCED');
      expect(updateCall.data.xrayExecutionId).toBe('PROJ-EXEC-1');
      expect(updateCall.data.resultCount).toBe(3);
      expect(updateCall.data.syncedAt).toBeInstanceOf(Date);
    });

    it('updates existing sync on re-sync (idempotent)', async () => {
      (config as unknown as Record<string, unknown>).xray = buildXrayConfig();
      const service = new XrayService();

      const existingSync = { id: 'existing-sync', xrayExecutionId: 'PROJ-OLD', status: 'SYNCED' };
      (prisma.testRun.findUnique as jest.Mock).mockResolvedValue(mockTestRun);
      (prisma.xraySync.findFirst as jest.Mock).mockResolvedValue(existingSync);
      (prisma.xraySync.update as jest.Mock).mockResolvedValue({ id: 'existing-sync', status: 'SYNCING' });

      mockClient.post.mockResolvedValueOnce({ data: '"jwt"' });
      const authorizedClient = createMockAxiosInstance();
      mockAxiosCreate.mockReturnValueOnce(authorizedClient);
      authorizedClient.post.mockResolvedValueOnce({ data: { testExecIssue: { key: 'PROJ-UPDATED' } } });

      const result = await service.syncTestRun('run-uuid-1');

      expect(result.syncId).toBe('existing-sync');
      // Verify it sends the existing execution ID in payload
      const payload = authorizedClient.post.mock.calls[0][1];
      expect(payload.testExecutionKey).toBe('PROJ-OLD');
    });

    it('marks sync as FAILED on API error (atomic rollback)', async () => {
      (config as unknown as Record<string, unknown>).xray = buildXrayConfig();
      const service = new XrayService();

      (prisma.testRun.findUnique as jest.Mock).mockResolvedValue(mockTestRun);
      (prisma.xraySync.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.xraySync.create as jest.Mock).mockResolvedValue({ id: 'sync-fail', status: 'SYNCING' });
      (prisma.xraySync.update as jest.Mock).mockResolvedValue({});

      mockClient.post.mockResolvedValueOnce({ data: '"jwt"' });
      const authorizedClient = createMockAxiosInstance();
      mockAxiosCreate.mockReturnValueOnce(authorizedClient);
      authorizedClient.post.mockRejectedValueOnce(new Error('Xray API down'));

      await expect(service.syncTestRun('run-uuid-1')).rejects.toThrow('Failed to sync');

      const failUpdate = (prisma.xraySync.update as jest.Mock).mock.calls[0][0];
      expect(failUpdate.data.status).toBe('FAILED');
      expect(failUpdate.data.errorMessage).toBeTruthy();
    });

    it('throws when test run is not found', async () => {
      (config as unknown as Record<string, unknown>).xray = buildXrayConfig();
      const service = new XrayService();

      (prisma.testRun.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.syncTestRun('nonexistent')).rejects.toThrow('Test run not found');
    });
  });

  // ── Security ───────────────────────────────────────────────────

  describe('security', () => {
    it('constructor rejects localhost/private-IP URLs (SSRF)', () => {
      (config as unknown as Record<string, unknown>).xray = {
        ...buildXrayConfig(),
        cloudUrl: 'http://localhost:8080',
      };
      mockValidateSSRF.mockImplementation(() => {
        throw new Error('SSRF: private IP not allowed');
      });

      const service = new XrayService();
      expect(service.isEnabled()).toBe(false);
      expect(mockValidateSSRF).toHaveBeenCalledWith('http://localhost:8080');
    });

    it('escapes JQL special characters in search queries', async () => {
      (config as unknown as Record<string, unknown>).xray = buildXrayConfig();
      const service = new XrayService();

      mockClient.post.mockResolvedValueOnce({ data: '"jwt"' });
      const authorizedClient = createMockAxiosInstance();
      mockAxiosCreate.mockReturnValueOnce(authorizedClient);
      authorizedClient.post.mockResolvedValueOnce({ data: { data: { getTests: { total: 0, results: [] } } } });

      await service.getTestCases('test" OR 1=1 --', 5);

      const graphqlQuery = authorizedClient.post.mock.calls[0][1].query;
      // The double-quote should be escaped — verify no raw unescaped quote injection
      expect(graphqlQuery).not.toMatch(/test"\s+OR/);
      // Should contain the escaped double-quote
      expect(graphqlQuery).toContain('test\\"');
      // The dashes should be escaped
      expect(graphqlQuery).toContain('\\-\\-');
    });

    it('auth failure error does not include client_secret', async () => {
      (config as unknown as Record<string, unknown>).xray = buildXrayConfig();
      const service = new XrayService();

      const secretError = new Error('client_secret=super-secret-value leaked');
      mockClient.post.mockRejectedValueOnce(secretError);

      try {
        await service.authenticate();
      } catch (error) {
        const msg = (error as Error).message;
        expect(msg).not.toContain('super-secret-value');
        expect(msg).toContain('***');
      }
    });

    it('sync failure error does not include JWT token', async () => {
      (config as unknown as Record<string, unknown>).xray = buildXrayConfig();
      const service = new XrayService();

      (prisma.testRun.findUnique as jest.Mock).mockResolvedValue({
        id: 'r1',
        name: 'Test',
        results: [{ id: 'r1', status: 'PASSED', error: null, duration: null, externalTestCaseId: null }],
      });
      (prisma.xraySync.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.xraySync.create as jest.Mock).mockResolvedValue({ id: 's1', status: 'SYNCING' });
      (prisma.xraySync.update as jest.Mock).mockResolvedValue({});

      mockClient.post.mockResolvedValueOnce({ data: '"jwt"' });
      const authorizedClient = createMockAxiosInstance();
      mockAxiosCreate.mockReturnValueOnce(authorizedClient);

      const tokenError = new Error('Bearer eyJhbGciOiJIUzI1NiJ9.secret leaked');
      authorizedClient.post.mockRejectedValueOnce(tokenError);

      await expect(service.syncTestRun('r1')).rejects.toThrow('Failed to sync');

      // The errorMessage saved should be sanitized
      const failUpdate = (prisma.xraySync.update as jest.Mock).mock.calls[0][0];
      expect(failUpdate.data.errorMessage).not.toContain('eyJhbGciOiJIUzI1NiJ9');
      expect(failUpdate.data.errorMessage).toContain('***');
    });
  });
});
