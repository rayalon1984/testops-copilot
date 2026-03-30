import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { config } from '../config';
import { PipelineType } from '../constants';
import { githubService } from './github.service';

interface GitHubRunData {
  id: number;
  status: string;
  conclusion: string | null;
  head_sha: string;
  head_branch: string;
  created_at: string;
  updated_at: string;
  run_number: number;
  name: string;
}

export class GitHubSyncService {
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private syncing = false;
  private lastSyncAt: Date | null = null;

  /**
   * Upsert a single GitHub workflow run into the test_runs table.
   * Shared by both polling sync and webhook handler.
   */
  async upsertWorkflowRun(pipelineId: string, pipelineName: string, run: GitHubRunData): Promise<void> {
    const buildNumber = String(run.id);
    const status = githubService.mapGitHubStatus(run.status, run.conclusion || '');

    const startedAt = new Date(run.created_at);
    const isCompleted = ['PASSED', 'FAILED', 'SKIPPED', 'ERROR'].includes(status);
    const completedAt = isCompleted ? new Date(run.updated_at) : null;
    const duration = completedAt ? completedAt.getTime() - startedAt.getTime() : null;

    const existing = await prisma.testRun.findFirst({
      where: { pipelineId, buildNumber },
    });

    if (existing) {
      // Only update if status changed
      if (existing.status !== status) {
        await prisma.testRun.update({
          where: { id: existing.id },
          data: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            status: status as any,
            commit: run.head_sha,
            completedAt,
            duration,
          },
        });
        logger.debug(`[GitHubSync] Updated run ${buildNumber} → ${status}`, { pipelineId });
      }
    } else {
      await prisma.testRun.create({
        data: {
          pipelineId,
          name: `${pipelineName} #${run.run_number}`,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          status: status as any,
          branch: run.head_branch,
          commit: run.head_sha,
          buildNumber,
          startedAt,
          completedAt,
          duration,
        },
      });
      logger.info(`[GitHubSync] Created run ${buildNumber} (${status})`, { pipelineId });
    }
  }

  /**
   * Sync a single pipeline's recent workflow runs.
   */
  async syncPipeline(pipeline: { id: string; name: string; config: unknown }): Promise<number> {
    const workflowConfig = githubService.parseConfig(pipeline.config);
    const runs = await githubService.fetchRecentRuns(workflowConfig, 10);

    let synced = 0;
    for (const run of runs) {
      try {
        await this.upsertWorkflowRun(pipeline.id, pipeline.name, run);
        synced++;
      } catch (err) {
        logger.warn(`[GitHubSync] Failed to upsert run ${run.id}`, {
          pipelineId: pipeline.id,
          error: (err as Error).message,
        });
      }
    }

    // Update pipeline lastRunAt from most recent run
    if (runs.length > 0) {
      await prisma.pipeline.update({
        where: { id: pipeline.id },
        data: { lastRunAt: new Date(runs[0].created_at) },
      });
    }

    return synced;
  }

  /**
   * Sync all GITHUB_ACTIONS pipelines.
   */
  async syncAll(): Promise<void> {
    if (this.syncing) {
      logger.debug('[GitHubSync] Sync already in progress, skipping');
      return;
    }

    if (!config.github.token) {
      logger.debug('[GitHubSync] No GITHUB_TOKEN configured, skipping sync');
      return;
    }

    this.syncing = true;
    const startTime = Date.now();

    try {
      const pipelines = await prisma.pipeline.findMany({
        where: {
          type: PipelineType.GITHUB_ACTIONS,
          enabled: true,
        },
        select: { id: true, name: true, config: true },
      });

      if (pipelines.length === 0) {
        logger.debug('[GitHubSync] No GitHub Actions pipelines found');
        return;
      }

      let totalSynced = 0;
      for (const pipeline of pipelines) {
        try {
          const count = await this.syncPipeline(pipeline);
          totalSynced += count;
        } catch (err) {
          logger.warn(`[GitHubSync] Failed to sync pipeline ${pipeline.name}`, {
            pipelineId: pipeline.id,
            error: (err as Error).message,
          });
        }
      }

      this.lastSyncAt = new Date();
      const elapsed = Date.now() - startTime;
      logger.info(`[GitHubSync] Synced ${totalSynced} runs across ${pipelines.length} pipelines (${elapsed}ms)`);
    } finally {
      this.syncing = false;
    }
  }

  /**
   * Start the polling loop.
   */
  start(): void {
    if (!config.github.syncEnabled) {
      logger.info('[GitHubSync] Sync disabled (GITHUB_SYNC_ENABLED=false)');
      return;
    }

    // Use shorter interval when no webhook, longer when webhook is active
    const intervalMs = config.github.webhookSecret
      ? config.github.syncCatchupIntervalMs
      : config.github.syncIntervalMs;

    logger.info(`[GitHubSync] Starting sync every ${intervalMs / 1000}s (mode: ${config.github.webhookSecret ? 'catchup' : 'primary'})`);

    // Run immediately on start, then on interval
    this.syncAll().catch((err) => {
      logger.error('[GitHubSync] Initial sync failed', { error: (err as Error).message });
    });

    this.intervalHandle = setInterval(() => {
      this.syncAll().catch((err) => {
        logger.error('[GitHubSync] Sync cycle failed', { error: (err as Error).message });
      });
    }, intervalMs);
  }

  /**
   * Stop the polling loop.
   */
  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
      logger.info('[GitHubSync] Stopped');
    }
  }

  /**
   * Get sync status for health/diagnostics.
   */
  getStatus(): { running: boolean; lastSyncAt: Date | null; mode: string } {
    return {
      running: this.intervalHandle !== null,
      lastSyncAt: this.lastSyncAt,
      mode: config.github.webhookSecret ? 'webhook+catchup' : 'polling',
    };
  }
}

export const githubSyncService = new GitHubSyncService();
