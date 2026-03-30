import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock prisma
vi.mock('../../lib/prisma', () => ({
  prisma: {
    testRun: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    pipeline: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Mock github service
vi.mock('../github.service', () => ({
  githubService: {
    parseConfig: vi.fn((config) => config),
    mapGitHubStatus: vi.fn((status, conclusion) => {
      if (status === 'completed' && conclusion === 'success') return 'PASSED';
      if (status === 'completed' && conclusion === 'failure') return 'FAILED';
      if (status === 'in_progress') return 'RUNNING';
      return 'PENDING';
    }),
    fetchRecentRuns: vi.fn(),
  },
}));

vi.mock('../../utils/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../config', () => ({
  config: {
    github: {
      token: 'test-token',
      syncEnabled: true,
      syncIntervalMs: 120000,
      syncCatchupIntervalMs: 900000,
      webhookSecret: undefined,
    },
  },
}));

vi.mock('../../constants', () => ({
  PipelineType: {
    JENKINS: 'JENKINS',
    GITHUB_ACTIONS: 'GITHUB_ACTIONS',
    CUSTOM: 'CUSTOM',
  },
}));

import { prisma } from '../../lib/prisma';
import { githubService } from '../github.service';
import { GitHubSyncService } from '../github-sync.service';

describe('GitHubSyncService', () => {
  let syncService: GitHubSyncService;

  beforeEach(() => {
    syncService = new GitHubSyncService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    syncService.stop();
  });

  describe('upsertWorkflowRun', () => {
    const mockRun = {
      id: 12345,
      status: 'completed',
      conclusion: 'success',
      head_sha: 'abc123',
      head_branch: 'main',
      created_at: '2026-03-30T10:00:00Z',
      updated_at: '2026-03-30T10:05:00Z',
      run_number: 42,
      name: 'CI Tests',
    };

    it('creates a new test run when none exists', async () => {
      vi.mocked(prisma.testRun.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.testRun.create).mockResolvedValue({} as any);

      await syncService.upsertWorkflowRun('pipeline-1', 'My Pipeline', mockRun);

      expect(prisma.testRun.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          pipelineId: 'pipeline-1',
          name: 'My Pipeline #42',
          status: 'PASSED',
          buildNumber: '12345',
          branch: 'main',
          commit: 'abc123',
        }),
      });
    });

    it('updates existing run when status changed', async () => {
      vi.mocked(prisma.testRun.findFirst).mockResolvedValue({
        id: 'existing-id',
        status: 'RUNNING',
      } as any);
      vi.mocked(prisma.testRun.update).mockResolvedValue({} as any);

      await syncService.upsertWorkflowRun('pipeline-1', 'My Pipeline', mockRun);

      expect(prisma.testRun.update).toHaveBeenCalledWith({
        where: { id: 'existing-id' },
        data: expect.objectContaining({
          status: 'PASSED',
          commit: 'abc123',
        }),
      });
    });

    it('skips update when status unchanged', async () => {
      vi.mocked(prisma.testRun.findFirst).mockResolvedValue({
        id: 'existing-id',
        status: 'PASSED',
      } as any);

      await syncService.upsertWorkflowRun('pipeline-1', 'My Pipeline', mockRun);

      expect(prisma.testRun.update).not.toHaveBeenCalled();
      expect(prisma.testRun.create).not.toHaveBeenCalled();
    });
  });

  describe('syncAll', () => {
    it('fetches and syncs all GitHub Actions pipelines', async () => {
      vi.mocked(prisma.pipeline.findMany).mockResolvedValue([
        { id: 'p1', name: 'Pipeline 1', config: { owner: 'org', repo: 'repo', workflow: 'ci.yml' } },
      ] as any);
      vi.mocked(githubService.fetchRecentRuns).mockResolvedValue([
        {
          id: 99, status: 'completed', conclusion: 'success',
          head_sha: 'sha1', head_branch: 'main',
          created_at: '2026-03-30T10:00:00Z', updated_at: '2026-03-30T10:05:00Z',
          run_number: 1, name: 'CI',
        },
      ]);
      vi.mocked(prisma.testRun.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.testRun.create).mockResolvedValue({} as any);
      vi.mocked(prisma.pipeline.update).mockResolvedValue({} as any);

      await syncService.syncAll();

      expect(prisma.pipeline.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { type: 'GITHUB_ACTIONS', enabled: true },
        }),
      );
      expect(prisma.testRun.create).toHaveBeenCalled();
    });

    it('does not run concurrently', async () => {
      vi.mocked(prisma.pipeline.findMany).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([] as any), 100)),
      );

      const p1 = syncService.syncAll();
      const p2 = syncService.syncAll(); // Should skip

      await Promise.all([p1, p2]);

      // findMany called only once (second sync was skipped)
      expect(prisma.pipeline.findMany).toHaveBeenCalledTimes(1);
    });
  });

  describe('getStatus', () => {
    it('reports polling mode when no webhook secret', () => {
      const status = syncService.getStatus();
      expect(status.mode).toBe('polling');
      expect(status.running).toBe(false);
    });
  });
});
