import { Octokit } from '@octokit/rest';
import { Prisma } from '@prisma/client';
import { config } from '../config';
import { logger } from '../utils/logger';
import { PipelineStatus, TestStatus, PipelineType } from '../constants';
import { Pipeline, TestRun, TestRunWithPipeline } from '../types/pipeline';
import { sleep, generateUUID } from '../utils/common';

interface GitHubWorkflowConfig {
  owner: string;
  repo: string;
  workflow: string;
}

interface GitHubWorkflowRun {
  status: string;
  conclusion: string | null;
  head_sha: string;
  updated_at: string;
}

export class GitHubService {
  private octokit: Octokit;

  constructor() {
    this.octokit = new Octokit({
      auth: config.github.token,
      baseUrl: config.github.apiUrl
    });
  }

  async validateConnection(config: unknown): Promise<void> {
    try {
      const { owner, repo, workflow } = this.parseConfig(config);

      // Try to get workflow info to validate connection
      await this.octokit.actions.getWorkflow({
        owner,
        repo,
        workflow_id: workflow
      });
    } catch (error) {
      logger.error('GitHub connection validation failed:', error);
      throw new Error('Failed to validate GitHub connection');
    }
  }

  async startPipeline(pipeline: Pipeline & { type: PipelineType }): Promise<TestRunWithPipeline> {
    try {
      const workflowConfig = this.parseConfig(pipeline.config);

      // Create a test run
      const testRun: TestRun = {
        id: generateUUID(),
        pipelineId: pipeline.id,
        userId: pipeline.userId,
        status: TestStatus.PENDING,
        branch: 'main',
        commit: null,
        startTime: new Date(),
        endTime: null,
        duration: null,
        results: {},
        error: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Start GitHub workflow
      const response = await this.octokit.actions.createWorkflowDispatch({
        owner: workflowConfig.owner,
        repo: workflowConfig.repo,
        workflow_id: workflowConfig.workflow,
        ref: 'main'
      });

      if (response.status !== 204) {
        throw new Error('Failed to start GitHub workflow');
      }

      // Start monitoring the workflow progress
      this.monitorWorkflowProgress(workflowConfig, testRun, pipeline);

      return {
        ...testRun,
        pipeline: {
          ...pipeline,
          status: PipelineStatus.RUNNING
        }
      };
    } catch (error) {
      logger.error('Failed to start GitHub pipeline:', error);
      throw error;
    }
  }

  private async monitorWorkflowProgress(
    config: GitHubWorkflowConfig,
    testRun: TestRun,
    pipeline: Pipeline
  ): Promise<void> {
    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const runs = await this.octokit.actions.listWorkflowRuns({
          owner: config.owner,
          repo: config.repo,
          workflow_id: config.workflow
        });

        const latestRun = runs.data.workflow_runs[0] as GitHubWorkflowRun;

        if (!latestRun) {
          await sleep(5000);
          continue;
        }

        // Update test run status
        const status = this.mapGitHubStatus(latestRun.status, latestRun.conclusion || '');
        testRun.status = status;
        testRun.commit = latestRun.head_sha;
        testRun.updatedAt = new Date();

        if (this.isCompleted(status)) {
          testRun.endTime = new Date(latestRun.updated_at);
          testRun.duration = this.calculateDuration(testRun);
          break;
        }

        await sleep(5000);
      }
    } catch (error) {
      logger.error('Error monitoring GitHub workflow:', error);
      testRun.status = TestStatus.ERROR;
      testRun.error = error instanceof Error ? error.message : 'Unknown error';
      testRun.endTime = new Date();
      testRun.duration = this.calculateDuration(testRun);
    }
  }

  private parseConfig(config: unknown): GitHubWorkflowConfig {
    if (
      !config ||
      typeof config !== 'object' ||
      !('owner' in config) ||
      !('repo' in config) ||
      !('workflow' in config)
    ) {
      throw new Error('Invalid GitHub configuration');
    }

    return {
      owner: String(config.owner),
      repo: String(config.repo),
      workflow: String(config.workflow)
    };
  }

  private mapGitHubStatus(status: string, conclusion: string): TestStatus {
    if (status === 'queued') return TestStatus.PENDING;
    if (status === 'in_progress') return TestStatus.RUNNING;
    if (conclusion === 'success') return TestStatus.PASSED;
    if (conclusion === 'failure') return TestStatus.FAILED;
    if (conclusion === 'skipped') return TestStatus.SKIPPED;
    return TestStatus.ERROR;
  }

  private isCompleted(status: TestStatus): boolean {
    return [
      TestStatus.PASSED,
      TestStatus.FAILED,
      TestStatus.SKIPPED,
      TestStatus.ERROR
    ].includes(status);
  }

  private calculateDuration(testRun: TestRun): number {
    if (!testRun.startTime || !testRun.endTime) return 0;
    return testRun.endTime.getTime() - testRun.startTime.getTime();
  }
}

export const githubService = new GitHubService();