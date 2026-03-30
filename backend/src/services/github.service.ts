import { Octokit } from '@octokit/rest';
import { config } from '../config';
import { logger } from '../utils/logger';
import { PipelineStatus, TestStatus, PipelineType } from '../constants';
import { Pipeline, TestRun, TestRunWithPipeline } from '../types/pipeline';
import { sleep } from '../utils/common';
import { withResilience, circuitBreakers } from '../lib/resilience';
import { prisma } from '../lib/prisma';

const GITHUB_RESILIENCE = {
  circuitBreaker: circuitBreakers.github,
  retry: { maxRetries: 2, baseDelayMs: 1000 },
  timeoutMs: 10_000,
  label: 'github',
};

interface GitHubWorkflowConfig {
  owner: string;
  repo: string;
  workflow: string;
  ref?: string;
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
      await withResilience(
        () => this.octokit.actions.getWorkflow({ owner, repo, workflow_id: workflow }),
        GITHUB_RESILIENCE,
      );
    } catch (error) {
      logger.error('GitHub connection validation failed:', error);
      throw new Error('Failed to validate GitHub connection');
    }
  }

  async startPipeline(pipeline: Pipeline & { type: PipelineType }): Promise<TestRunWithPipeline> {
    try {
      const workflowConfig = this.parseConfig(pipeline.config);

      // Resolve the branch ref: use pipeline config ref, or fetch the repo's default branch
      let ref = workflowConfig.ref;
      if (!ref) {
        const repoInfo = await withResilience(
          () => this.octokit.repos.get({ owner: workflowConfig.owner, repo: workflowConfig.repo }),
          GITHUB_RESILIENCE,
        );
        ref = repoInfo.data.default_branch;
      }

      // Persist test run to database
      const testRun = await prisma.testRun.create({
        data: {
          pipelineId: pipeline.id,
          name: pipeline.name,
          status: 'PENDING',
          branch: ref,
          startedAt: new Date(),
        },
      });

      // Start GitHub workflow
      const response = await withResilience(
        () => this.octokit.actions.createWorkflowDispatch({
          owner: workflowConfig.owner,
          repo: workflowConfig.repo,
          workflow_id: workflowConfig.workflow,
          ref: ref!
        }),
        GITHUB_RESILIENCE,
      );

      if (response.status !== 204) {
        await prisma.testRun.update({ where: { id: testRun.id }, data: { status: 'FAILED' } });
        throw new Error('Failed to start GitHub workflow');
      }

      // Update to RUNNING and start monitoring
      const updatedTestRun = await prisma.testRun.update({
        where: { id: testRun.id },
        data: { status: 'RUNNING' },
      });

      // Update pipeline lastRunAt
      await prisma.pipeline.update({
        where: { id: pipeline.id },
        data: { lastRunAt: new Date() },
      });

      // Start monitoring the workflow progress
      this.monitorWorkflowProgress(workflowConfig, updatedTestRun.id, pipeline);

      return {
        id: updatedTestRun.id,
        pipelineId: updatedTestRun.pipelineId,
        userId: updatedTestRun.userId,
        status: TestStatus.RUNNING,
        branch: updatedTestRun.branch,
        commit: updatedTestRun.commit,
        startTime: updatedTestRun.startedAt || updatedTestRun.createdAt,
        endTime: updatedTestRun.completedAt,
        duration: updatedTestRun.duration,
        passed: updatedTestRun.passed,
        failed: updatedTestRun.failed,
        skipped: updatedTestRun.skipped,
        flaky: updatedTestRun.flaky,
        results: {},
        error: null,
        createdAt: updatedTestRun.createdAt,
        updatedAt: updatedTestRun.updatedAt,
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
    testRunId: string,
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

        const status = this.mapGitHubStatus(latestRun.status, latestRun.conclusion || '');

        if (this.isCompleted(status)) {
          const startedAt = await prisma.testRun.findUnique({ where: { id: testRunId }, select: { startedAt: true } });
          const completedAt = new Date(latestRun.updated_at);
          const duration = startedAt?.startedAt
            ? completedAt.getTime() - startedAt.startedAt.getTime()
            : null;

          await prisma.testRun.update({
            where: { id: testRunId },
            data: {
              status: status as string,
              commit: latestRun.head_sha,
              completedAt,
              duration,
            },
          });
          break;
        }

        await prisma.testRun.update({
          where: { id: testRunId },
          data: { status: status as string, commit: latestRun.head_sha },
        });

        await sleep(5000);
      }
    } catch (error) {
      logger.error('Error monitoring GitHub workflow:', error);
      await prisma.testRun.update({
        where: { id: testRunId },
        data: {
          status: TestStatus.ERROR as string,
          completedAt: new Date(),
        },
      }).catch(() => { /* best effort */ });
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
      const response = await withResilience(
        () => this.octokit.repos.getCommit({ owner, repo, ref: commitSha }),
        GITHUB_RESILIENCE,
      );

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
      const response = await withResilience(
        () => this.octokit.repos.listPullRequestsAssociatedWithCommit({ owner, repo, commit_sha: commitSha }),
        GITHUB_RESILIENCE,
      );

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
      const response = await withResilience(
        () => this.octokit.pulls.listFiles({ owner, repo, pull_number: pullNumber, per_page: 100 }),
        GITHUB_RESILIENCE,
      );

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
      const response = await withResilience(
        () => this.octokit.pulls.create({ owner, repo, title, body, head, base }),
        GITHUB_RESILIENCE,
      );

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
      const baseRef = await withResilience(
        () => this.octokit.git.getRef({ owner, repo, ref: `heads/${baseBranch}` }),
        GITHUB_RESILIENCE,
      );

      const sha = baseRef.data.object.sha;

      // Create the new branch
      await withResilience(
        () => this.octokit.git.createRef({ owner, repo, ref: `refs/heads/${branchName}`, sha }),
        GITHUB_RESILIENCE,
      );

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

      const response = await withResilience(
        () => this.octokit.repos.createOrUpdateFileContents({
          owner,
          repo,
          path,
          message,
          content: Buffer.from(content).toString('base64'),
          branch,
          ...(sha ? { sha } : {}),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any),
        GITHUB_RESILIENCE,
      );

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
      const response = await withResilience(
        () => this.octokit.actions.createWorkflowDispatch({ owner, repo, workflow_id: workflowId, ref: branch }),
        GITHUB_RESILIENCE,
      );

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
      const { data } = await withResilience(
        () => this.octokit!.pulls.merge({
          owner,
          repo,
          pull_number: prNumber,
          merge_method: mergeMethod as 'merge' | 'squash' | 'rebase',
          ...(options.commitMessage ? { commit_message: options.commitMessage } : {}),
        }),
        GITHUB_RESILIENCE,
      );

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
      workflow: String(config.workflow),
      ...('ref' in config && config.ref ? { ref: String(config.ref) } : {}),
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

}

export const githubService = new GitHubService();