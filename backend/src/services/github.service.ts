import { Octokit } from '@octokit/rest';
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
        userId: pipeline.userId || null,
        status: TestStatus.PENDING,
        branch: 'main',
        commit: null,
        startTime: new Date(),
        endTime: null,
        duration: null,
        passed: 0,
        failed: 0,
        skipped: 0,
        flaky: 0,
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
    _pipeline: Pipeline
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

  /**
   * Get the files changed in a specific commit.
   * Returns file names, patches (diffs), and change stats.
   */
  async getCommitChanges(
    owner: string,
    repo: string,
    commitSha: string
  ): Promise<{ message: string; files: Array<{ filename: string; status: string; patch: string; additions: number; deletions: number }> }> {
    try {
      const response = await this.octokit.repos.getCommit({
        owner,
        repo,
        ref: commitSha,
      });

      const commit = response.data;
      return {
        message: commit.commit.message,
        files: (commit.files || []).map((f) => ({
          filename: f.filename,
          status: f.status,
          patch: f.patch || '',
          additions: f.additions,
          deletions: f.deletions,
        })),
      };
    } catch (error) {
      logger.error(`Failed to get commit changes for ${commitSha}:`, error);
      throw new Error('Failed to get commit changes from GitHub');
    }
  }

  /**
   * Find the pull request associated with a commit SHA.
   */
  async getPullRequestForCommit(
    owner: string,
    repo: string,
    commitSha: string
  ): Promise<{ number: number; title: string; body: string; url: string; author: string } | null> {
    try {
      const response = await this.octokit.repos.listPullRequestsAssociatedWithCommit({
        owner,
        repo,
        commit_sha: commitSha,
      });

      const prs = response.data;
      if (prs.length === 0) return null;

      // Return the most recent merged or open PR
      const pr = prs.find((p) => p.merged_at) || prs[0];
      return {
        number: pr.number,
        title: pr.title,
        body: pr.body || '',
        url: pr.html_url,
        author: pr.user?.login || 'unknown',
      };
    } catch (error) {
      logger.error(`Failed to find PR for commit ${commitSha}:`, error);
      return null;
    }
  }

  /**
   * Get the files changed in a pull request.
   */
  async getPullRequestFiles(
    owner: string,
    repo: string,
    pullNumber: number
  ): Promise<Array<{ filename: string; status: string; patch: string; additions: number; deletions: number }>> {
    try {
      const response = await this.octokit.pulls.listFiles({
        owner,
        repo,
        pull_number: pullNumber,
        per_page: 100,
      });

      return response.data.map((f) => ({
        filename: f.filename,
        status: f.status,
        patch: f.patch || '',
        additions: f.additions,
        deletions: f.deletions,
      }));
    } catch (error) {
      logger.error(`Failed to get PR #${pullNumber} files:`, error);
      return [];
    }
  }

  /**
   * Create a pull request on GitHub.
   */
  async createPullRequest(
    owner: string,
    repo: string,
    title: string,
    body: string,
    head: string,
    base: string
  ): Promise<{ number: number; title: string; url: string; }> {
    try {
      const response = await this.octokit.pulls.create({
        owner,
        repo,
        title,
        body,
        head,
        base,
      });

      logger.info(`Created PR #${response.data.number}: "${title}" in ${owner}/${repo}`);

      return {
        number: response.data.number,
        title: response.data.title,
        url: response.data.html_url,
      };
    } catch (error) {
      logger.error(`Failed to create PR in ${owner}/${repo}:`, error);
      throw new Error('Failed to create pull request on GitHub');
    }
  }

  /**
   * Create a new branch from a base branch (usually main).
   */
  async createBranch(owner: string, repo: string, branchName: string, baseBranch: string = 'main'): Promise<void> {
    try {
      // Get the SHA of the base branch
      const baseRef = await this.octokit.git.getRef({
        owner,
        repo,
        ref: `heads/${baseBranch}`,
      });

      const sha = baseRef.data.object.sha;

      // Create the new branch
      await this.octokit.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${branchName}`,
        sha,
      });

      logger.info(`Created branch ${branchName} from ${baseBranch} in ${owner}/${repo}`);
    } catch (error) {
      logger.error(`Failed to create branch ${branchName}:`, error);
      throw new Error(`Failed to create branch ${branchName}`);
    }
  }

  /**
   * Update (commit) a file in the repository.
   */
  async updateFile(
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    branch: string
  ): Promise<{ sha: string; url: string }> {
    try {
      // Get current file SHA (if it exists) to allow updating
      let sha: string | undefined;
      try {
        const current = await this.octokit.repos.getContent({
          owner,
          repo,
          path,
          ref: branch,
        });
        if (!Array.isArray(current.data) && current.data.sha) {
          sha = current.data.sha;
        }
      } catch (e) {
        // File doesn't exist, which is fine (we'll create it)
      }

      const response = await this.octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path,
        message,
        content: Buffer.from(content).toString('base64'),
        branch,
        ...(sha ? { sha } : {}),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      return {
        sha: response.data.commit.sha as string,
        url: response.data.commit.html_url || '',
      };
    } catch (error) {
      logger.error(`Failed to update file ${path}:`, error);
      throw new Error(`Failed to update file ${path}`);
    }
  }

  /**
   * Re-run a GitHub Actions workflow by dispatching a new workflow run.
   */
  async rerunWorkflow(
    owner: string,
    repo: string,
    workflowId: string,
    branch: string = 'main'
  ): Promise<void> {
    try {
      const response = await this.octokit.actions.createWorkflowDispatch({
        owner,
        repo,
        workflow_id: workflowId,
        ref: branch,
      });

      if (response.status !== 204) {
        throw new Error(`Unexpected status ${response.status} from workflow dispatch`);
      }

      logger.info(`[GitHubService] Dispatched workflow ${workflowId} on ${owner}/${repo} (${branch})`);
    } catch (error) {
      logger.error(`Failed to rerun workflow ${workflowId}:`, error);
      throw new Error(`Failed to dispatch workflow ${workflowId}`);
    }
  }

  /**
   * Merge a pull request.
   * Sprint 7: Tier 2 — team-visible, requires one-click approval.
   */
  async mergePR(
    owner: string,
    repo: string,
    prNumber: number,
    options: { method?: string; commitMessage?: string } = {}
  ): Promise<{ sha: string; message: string }> {
    if (!this.isEnabled()) {
      throw new Error('GitHub is not configured');
    }

    try {
      const mergeMethod = options.method || 'squash';
      const { data } = await this.octokit!.pulls.merge({
        owner,
        repo,
        pull_number: prNumber,
        merge_method: mergeMethod as 'merge' | 'squash' | 'rebase',
        ...(options.commitMessage ? { commit_message: options.commitMessage } : {}),
      });

      logger.info(`[GitHubService] Merged PR #${prNumber} in ${owner}/${repo} via ${mergeMethod}`);

      return {
        sha: data.sha,
        message: data.message || `PR #${prNumber} merged successfully`,
      };
    } catch (error) {
      logger.error(`Failed to merge PR #${prNumber}:`, error);
      throw new Error(`Failed to merge PR #${prNumber}`);
    }
  }

  /**
   * Check if GitHub is configured with a valid token
   */
  isEnabled(): boolean {
    return !!config.github.token;
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