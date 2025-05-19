import { Octokit } from '@octokit/rest';
import { Pipeline } from '@/models/pipeline.model';
import { TestRun } from '@/models/testRun.model';
import { logger } from '@/utils/logger';

import { GitHubConfig } from '@/types/github';

interface WorkflowRunResponse {
  id: number;
  status: string;
  conclusion: string | null;
  html_url: string;
  created_at: string;
  updated_at: string;
}

export class GithubService {
  private octokit: Octokit;

  constructor() {
    this.octokit = new Octokit();
  }

  private initializeClient(token: string): void {
    this.octokit = new Octokit({
      auth: token,
    });
  }

  private parseRepository(repository: string): { owner: string; repo: string } {
    const [owner, repo] = repository.split('/');
    if (!owner || !repo) {
      throw new Error('Invalid repository format. Expected "owner/repo"');
    }
    return { owner, repo };
  }

  async validateConnection(config: GitHubConfig): Promise<void> {
    try {
      if (!config.repository) {
        throw new Error('Repository is required for GitHub validation');
      }
      this.initializeClient(config.credentials.apiToken);
      const { owner, repo } = this.parseRepository(config.repository);

      // Verify repository access
      await this.octokit.repos.get({
        owner,
        repo,
      });

      logger.info('GitHub connection validated successfully');
    } catch (error) {
      logger.error('GitHub connection validation failed:', error);
      throw new Error('Failed to connect to GitHub: ' + (error as Error).message);
    }
  }

  async startPipeline(pipeline: Pipeline): Promise<TestRun> {
    const { config } = pipeline;
    const { owner, repo } = this.parseRepository(config.repository!);

    try {
      this.initializeClient(config.credentials.apiToken);

      // Create test run record
      const testRun = await TestRun.create({
        pipelineId: pipeline.id,
        userId: pipeline.userId,
        status: 'pending',
        branch: config.branch,
        startTime: new Date(),
      });

      // Get workflow ID if not provided
      let workflowId = config.workflow;
      if (!workflowId) {
        const workflows = await this.octokit.actions.listRepoWorkflows({
          owner,
          repo,
        });
        workflowId = workflows.data.workflows[0].id.toString();
      }

      // Trigger workflow
      const response = await this.octokit.actions.createWorkflowDispatch({
        owner,
        repo,
        workflow_id: workflowId,
        ref: config.branch || 'main',
        inputs: {},
      });

      if (response.status !== 204) {
        throw new Error('Failed to trigger GitHub Actions workflow');
      }

      // Start monitoring workflow progress
      this.monitorWorkflowProgress(owner, repo, testRun);

      return testRun;
    } catch (error) {
      logger.error('Failed to start GitHub Actions workflow:', error);
      throw error;
    }
  }

  private async monitorWorkflowProgress(
    owner: string,
    repo: string,
    testRun: TestRun
  ): Promise<void> {
    const pollInterval = 30000; // 30 seconds
    const maxDuration = 3600000; // 1 hour
    let elapsed = 0;

    const intervalId = setInterval(async () => {
      try {
        const runs = await this.octokit.actions.listWorkflowRuns({
          owner,
          repo,
          branch: testRun.branch || undefined,
          per_page: 1,
        });

        if (runs.data.workflow_runs.length === 0) {
          return;
        }

        const run = runs.data.workflow_runs[0];
        await this.processWorkflowStatus(run, testRun);

        if (run.status === 'completed') {
          clearInterval(intervalId);
        }

        elapsed += pollInterval;
        if (elapsed >= maxDuration) {
          clearInterval(intervalId);
          await testRun.update({
            status: 'timeout',
            error: 'Workflow exceeded maximum duration',
          });
        }
      } catch (error) {
        logger.error('Error monitoring workflow progress:', error);
        clearInterval(intervalId);
        await testRun.update({
          status: 'failure',
          error: `Failed to monitor workflow: ${(error as Error).message}`,
        });
      }
    }, pollInterval);
  }

  private async processWorkflowStatus(run: WorkflowRunResponse, testRun: TestRun): Promise<void> {
    let status: 'pending' | 'running' | 'success' | 'failure' | 'cancelled' | 'timeout';

    switch (run.status) {
      case 'queued':
        status = 'pending';
        break;
      case 'in_progress':
        status = 'running';
        break;
      case 'completed':
        status = run.conclusion === 'success' ? 'success' : 'failure';
        break;
      default:
        status = 'failure';
    }

    const updates: Partial<TestRun> = {
      status,
    };

    if (status === 'success' || status === 'failure') {
      updates.endTime = new Date(run.updated_at);
      updates.duration = Math.floor(
        (new Date(run.updated_at).getTime() - new Date(run.created_at).getTime()) / 1000
      );

      // Fetch test results if available
      const results = await this.fetchTestResults(run.html_url);
      if (results) {
        updates.results = results;
      }
    }

    await testRun.update(updates);
  }

  private async fetchTestResults(runUrl: string): Promise<any> {
    try {
      // GitHub Actions doesn't have a direct API for test results
      // You would need to implement a custom solution to parse test results
      // from workflow artifacts or a custom API endpoint
      return {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        flaky: 0,
        reportUrl: runUrl,
      };
    } catch (error) {
      logger.warn('Failed to fetch test results:', error);
      return null;
    }
  }
}