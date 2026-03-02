/**
 * TestRun Service — Auto-Sync Hook Tests
 *
 * Tests the completeTestRun() method's fire-and-forget Xray sync behavior:
 * - Auto-sync fires when config.xray.autoSync=true AND xrayService.isEnabled()
 * - Auto-sync does NOT block test run completion
 * - Auto-sync errors are logged but silently swallowed
 * - No auto-sync when disabled or Xray not configured
 */

// ─── Mocks (must be before imports due to hoisting) ────────────

const mockTestRunFindUnique = jest.fn();
const mockTestRunUpdate = jest.fn();

jest.mock('@/lib/prisma', () => ({
  prisma: {
    testRun: {
      findUnique: mockTestRunFindUnique,
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: mockTestRunUpdate,
      delete: jest.fn(),
      count: jest.fn(),
    },
    testResult: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

const mockConfigObj = { xray: { autoSync: false } };

jest.mock('@/config', () => ({
  get config() { return mockConfigObj; },
}));

const mockIsEnabled = jest.fn().mockReturnValue(false);
const mockSyncTestRun = jest.fn().mockResolvedValue({
  syncId: 'sync-1', status: 'SYNCED', xrayExecutionId: 'PROJ-EX-1', resultCount: 3,
});

jest.mock('@/services/xray.service', () => ({
  xrayService: {
    get isEnabled() { return mockIsEnabled; },
    get syncTestRun() { return mockSyncTestRun; },
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// ─── Imports (after mocks) ─────────────────────────────────────

import { TestRunService } from '../testRun.service';

// ─── Tests ─────────────────────────────────────────────────────

describe('TestRunService.completeTestRun (auto-sync hook)', () => {
  let service: TestRunService;

  const mockTestRun = {
    id: 'run-1',
    pipelineId: 'pipe-1',
    userId: 'user-1',
    name: 'Test Run 1',
    status: 'RUNNING',
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const updatedTestRun = {
    ...mockTestRun,
    status: 'PASSED',
    completedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TestRunService();

    // Default: test run found and updatable
    mockTestRunFindUnique.mockResolvedValue(mockTestRun);
    mockTestRunUpdate.mockResolvedValue(updatedTestRun);

    // Default: auto-sync disabled
    mockConfigObj.xray = { autoSync: false };
    mockIsEnabled.mockReturnValue(false);
    mockSyncTestRun.mockResolvedValue({
      syncId: 'sync-1', status: 'SYNCED', xrayExecutionId: 'PROJ-EX-1', resultCount: 3,
    });
  });

  it('completes test run and returns updated record', async () => {
    const result = await service.completeTestRun('run-1', 'user-1', 'PASSED');
    expect(result.status).toBe('PASSED');
    expect(mockTestRunUpdate).toHaveBeenCalledWith({
      where: { id: 'run-1' },
      data: expect.objectContaining({ status: 'PASSED', completedAt: expect.any(Date) }),
    });
  });

  it('does NOT fire auto-sync when autoSync=false', async () => {
    mockConfigObj.xray = { autoSync: false };
    mockIsEnabled.mockReturnValue(true);

    await service.completeTestRun('run-1', 'user-1', 'PASSED');
    expect(mockSyncTestRun).not.toHaveBeenCalled();
  });

  it('does NOT fire auto-sync when Xray not enabled', async () => {
    mockConfigObj.xray = { autoSync: true };
    mockIsEnabled.mockReturnValue(false);

    await service.completeTestRun('run-1', 'user-1', 'PASSED');
    expect(mockSyncTestRun).not.toHaveBeenCalled();
  });

  it('fires auto-sync with trigger=AUTO when both conditions met', async () => {
    mockConfigObj.xray = { autoSync: true };
    mockIsEnabled.mockReturnValue(true);

    await service.completeTestRun('run-1', 'user-1', 'PASSED');

    // Fire-and-forget — give the microtask a tick to resolve
    await new Promise(process.nextTick);

    expect(mockSyncTestRun).toHaveBeenCalledWith('run-1', 'AUTO');
  });

  it('auto-sync failure does NOT throw or block completion', async () => {
    mockConfigObj.xray = { autoSync: true };
    mockIsEnabled.mockReturnValue(true);
    mockSyncTestRun.mockRejectedValue(new Error('Xray API timeout'));

    // Should NOT throw despite sync failure
    const result = await service.completeTestRun('run-1', 'user-1', 'PASSED');
    expect(result.status).toBe('PASSED');

    // Give the promise.catch a tick to resolve
    await new Promise(process.nextTick);

    // Sync was attempted
    expect(mockSyncTestRun).toHaveBeenCalledWith('run-1', 'AUTO');
  });

  it('rejects completion of already-completed test run', async () => {
    mockTestRunFindUnique.mockResolvedValue({ ...mockTestRun, status: 'PASSED' });

    await expect(service.completeTestRun('run-1', 'user-1', 'PASSED'))
      .rejects
      .toThrow('Can only complete pending or running test runs');
  });

  it('accepts PENDING test runs for completion', async () => {
    mockTestRunFindUnique.mockResolvedValue({ ...mockTestRun, status: 'PENDING' });

    const result = await service.completeTestRun('run-1', 'user-1', 'FAILED');
    expect(result).toBeDefined();
    expect(mockTestRunUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED' }),
      }),
    );
  });
});
