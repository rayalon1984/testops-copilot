/**
 * Azure DevOps Service
 *
 * Full integration with Azure DevOps REST API v7.1:
 * - Pipelines: list, get, trigger runs, get build logs/timeline
 * - Work Items: query (WIQL), get, create, update
 * - Wiki: list wikis, get/create/update pages
 * - Repos & Pull Requests: list repos, list/get PRs, PR threads
 * - Test Runs & Results: list test runs, get test results
 *
 * Follows existing service patterns: axios + Basic auth (PAT),
 * withResilience wrapping, circuit breaker, singleton export, isEnabled() gating.
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { logger } from '@/utils/logger';
import { config } from '@/config';
import { withResilience, circuitBreakers } from '@/lib/resilience';
import type {
  AzdoPipeline,
  AzdoPipelineRun,
  AzdoBuild,
  AzdoBuildTimeline,
  AzdoWorkItem,
  AzdoWorkItemQueryResult,
  CreateWorkItemField,
  AzdoWiki,
  AzdoWikiPage,
  AzdoRepository,
  AzdoPullRequest,
  AzdoPullRequestThread,
  AzdoTestRun,
  AzdoTestResult,
} from '@/types/azuredevops';

// ── Resilience Config ────────────────────────────────────────────────────

const AZDO_RESILIENCE = {
  circuitBreaker: circuitBreakers.azureDevOps,
  retry: { maxRetries: 2, baseDelayMs: 1000 },
  timeoutMs: 15_000,
  label: 'azureDevOps',
};

// ── Service ──────────────────────────────────────────────────────────────

export class AzureDevOpsService {
  private client: AxiosInstance | null = null;
  private orgUrl: string = '';
  private project: string = '';
  private team: string | undefined;
  private enabled: boolean = false;

  constructor() {
    if (!config.azureDevOps) {
      logger.warn('Azure DevOps integration is not configured. Azure DevOps features will be disabled.');
      this.enabled = false;
      return;
    }

    try {
      this.orgUrl = config.azureDevOps.orgUrl.replace(/\/+$/, ''); // trim trailing slashes
      this.project = config.azureDevOps.project;
      this.team = config.azureDevOps.team;

      const auth = Buffer.from(`:${config.azureDevOps.pat}`).toString('base64');

      this.client = axios.create({
        baseURL: this.orgUrl,
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        timeout: 30_000,
      });

      this.enabled = true;
      logger.info('Azure DevOps integration initialized successfully', {
        orgUrl: this.orgUrl,
        project: this.project,
        team: this.team,
      });
    } catch (error) {
      logger.error('Failed to initialize Azure DevOps client:', error);
      this.enabled = false;
    }
  }

  // ── Status ─────────────────────────────────────────────────────────────

  isEnabled(): boolean {
    return this.enabled;
  }

  private checkEnabled(): void {
    if (!this.enabled || !this.client) {
      throw new Error('Azure DevOps integration is not enabled or configured');
    }
  }

  getConnectionInfo(): { orgUrl: string; project: string; team?: string } | null {
    if (!this.enabled) return null;
    return { orgUrl: this.orgUrl, project: this.project, team: this.team };
  }

  // ── Pipelines ──────────────────────────────────────────────────────────

  /**
   * List all pipelines in the project.
   */
  async listPipelines(): Promise<AzdoPipeline[]> {
    this.checkEnabled();

    return withResilience(async () => {
      const url = `/${this.project}/_apis/pipelines?api-version=7.1`;
      const response = await this.client!.get(url);
      return response.data.value || [];
    }, AZDO_RESILIENCE);
  }

  /**
   * Get a specific pipeline by ID.
   */
  async getPipeline(pipelineId: number): Promise<AzdoPipeline> {
    this.checkEnabled();

    return withResilience(async () => {
      const url = `/${this.project}/_apis/pipelines/${pipelineId}?api-version=7.1`;
      const response = await this.client!.get(url);
      return response.data;
    }, AZDO_RESILIENCE);
  }

  /**
   * Trigger a pipeline run.
   */
  async triggerPipelineRun(
    pipelineId: number,
    branch?: string,
    templateParameters?: Record<string, string>
  ): Promise<AzdoPipelineRun> {
    this.checkEnabled();

    return withResilience(async () => {
      const url = `/${this.project}/_apis/pipelines/${pipelineId}/runs?api-version=7.1`;
      const body: Record<string, unknown> = {};

      if (branch) {
        body.resources = {
          repositories: {
            self: { refName: `refs/heads/${branch}` },
          },
        };
      }

      if (templateParameters) {
        body.templateParameters = templateParameters;
      }

      const response = await this.client!.post(url, body);
      return response.data;
    }, AZDO_RESILIENCE);
  }

  /**
   * List recent pipeline runs.
   */
  async listPipelineRuns(pipelineId: number, top: number = 10): Promise<AzdoPipelineRun[]> {
    this.checkEnabled();

    return withResilience(async () => {
      const url = `/${this.project}/_apis/pipelines/${pipelineId}/runs?api-version=7.1&$top=${top}`;
      const response = await this.client!.get(url);
      return response.data.value || [];
    }, AZDO_RESILIENCE);
  }

  // ── Builds (classic + YAML) ────────────────────────────────────────────

  /**
   * List builds with optional filters.
   */
  async listBuilds(options: {
    definitions?: number[];
    statusFilter?: string;
    resultFilter?: string;
    top?: number;
    branchName?: string;
  } = {}): Promise<AzdoBuild[]> {
    this.checkEnabled();

    return withResilience(async () => {
      const params = new URLSearchParams({ 'api-version': '7.1' });

      if (options.definitions?.length) params.set('definitions', options.definitions.join(','));
      if (options.statusFilter) params.set('statusFilter', options.statusFilter);
      if (options.resultFilter) params.set('resultFilter', options.resultFilter);
      if (options.top) params.set('$top', String(options.top));
      if (options.branchName) params.set('branchName', options.branchName);

      const url = `/${this.project}/_apis/build/builds?${params}`;
      const response = await this.client!.get(url);
      return response.data.value || [];
    }, AZDO_RESILIENCE);
  }

  /**
   * Get a specific build by ID.
   */
  async getBuild(buildId: number): Promise<AzdoBuild> {
    this.checkEnabled();

    return withResilience(async () => {
      const url = `/${this.project}/_apis/build/builds/${buildId}?api-version=7.1`;
      const response = await this.client!.get(url);
      return response.data;
    }, AZDO_RESILIENCE);
  }

  /**
   * Get build timeline (stages, jobs, tasks with status and logs).
   */
  async getBuildTimeline(buildId: number): Promise<AzdoBuildTimeline> {
    this.checkEnabled();

    return withResilience(async () => {
      const url = `/${this.project}/_apis/build/builds/${buildId}/timeline?api-version=7.1`;
      const response = await this.client!.get(url);
      return response.data;
    }, AZDO_RESILIENCE);
  }

  /**
   * Get build log content by log ID.
   */
  async getBuildLog(buildId: number, logId: number): Promise<string> {
    this.checkEnabled();

    return withResilience(async () => {
      const url = `/${this.project}/_apis/build/builds/${buildId}/logs/${logId}?api-version=7.1`;
      const response = await this.client!.get(url, {
        headers: { Accept: 'text/plain' },
      });
      return response.data;
    }, AZDO_RESILIENCE);
  }

  // ── Work Items ─────────────────────────────────────────────────────────

  /**
   * Execute a WIQL (Work Item Query Language) query.
   */
  async queryWorkItems(wiql: string, top?: number): Promise<AzdoWorkItemQueryResult> {
    this.checkEnabled();

    return withResilience(async () => {
      const params = new URLSearchParams({ 'api-version': '7.1' });
      if (top) params.set('$top', String(top));

      const url = `/${this.project}/_apis/wit/wiql?${params}`;
      const response = await this.client!.post(url, { query: wiql });
      return response.data;
    }, AZDO_RESILIENCE);
  }

  /**
   * Get work items by IDs (batch).
   */
  async getWorkItems(
    ids: number[],
    fields?: string[],
    expand?: 'none' | 'relations' | 'fields' | 'links' | 'all'
  ): Promise<AzdoWorkItem[]> {
    this.checkEnabled();

    if (ids.length === 0) return [];

    return withResilience(async () => {
      const params = new URLSearchParams({
        'api-version': '7.1',
        ids: ids.slice(0, 200).join(','),
      });
      if (fields?.length) params.set('fields', fields.join(','));
      if (expand) params.set('$expand', expand);

      const url = `/${this.project}/_apis/wit/workitems?${params}`;
      const response = await this.client!.get(url);
      return response.data.value || [];
    }, AZDO_RESILIENCE);
  }

  /**
   * Get a single work item by ID.
   */
  async getWorkItem(id: number, expand?: 'none' | 'relations' | 'fields' | 'links' | 'all'): Promise<AzdoWorkItem> {
    this.checkEnabled();

    return withResilience(async () => {
      const params = new URLSearchParams({ 'api-version': '7.1' });
      if (expand) params.set('$expand', expand);

      const url = `/${this.project}/_apis/wit/workitems/${id}?${params}`;
      const response = await this.client!.get(url);
      return response.data;
    }, AZDO_RESILIENCE);
  }

  /**
   * Create a new work item.
   */
  async createWorkItem(
    type: string,
    fields: CreateWorkItemField[]
  ): Promise<AzdoWorkItem> {
    this.checkEnabled();

    return withResilience(async () => {
      const url = `/${this.project}/_apis/wit/workitems/$${type}?api-version=7.1`;
      const response = await this.client!.post(url, fields, {
        headers: { 'Content-Type': 'application/json-patch+json' },
      });
      return response.data;
    }, AZDO_RESILIENCE);
  }

  /**
   * Update a work item by ID.
   */
  async updateWorkItem(
    id: number,
    fields: CreateWorkItemField[]
  ): Promise<AzdoWorkItem> {
    this.checkEnabled();

    return withResilience(async () => {
      const url = `/${this.project}/_apis/wit/workitems/${id}?api-version=7.1`;
      const response = await this.client!.patch(url, fields, {
        headers: { 'Content-Type': 'application/json-patch+json' },
      });
      return response.data;
    }, AZDO_RESILIENCE);
  }

  /**
   * Search work items by text (simple WIQL wrapper).
   */
  async searchWorkItems(
    searchText: string,
    workItemType?: string,
    state?: string,
    top: number = 20
  ): Promise<AzdoWorkItem[]> {
    this.checkEnabled();

    let wiql = `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${this.project}'`;

    if (searchText) {
      wiql += ` AND [System.Title] CONTAINS '${searchText.replace(/'/g, "''")}'`;
    }
    if (workItemType) {
      wiql += ` AND [System.WorkItemType] = '${workItemType}'`;
    }
    if (state) {
      wiql += ` AND [System.State] = '${state}'`;
    }

    wiql += ' ORDER BY [System.ChangedDate] DESC';

    const queryResult = await this.queryWorkItems(wiql, top);
    const ids = queryResult.workItems.map(wi => wi.id);

    if (ids.length === 0) return [];

    return this.getWorkItems(ids);
  }

  // ── Wiki ───────────────────────────────────────────────────────────────

  /**
   * List all wikis in the project.
   */
  async listWikis(): Promise<AzdoWiki[]> {
    this.checkEnabled();

    return withResilience(async () => {
      const url = `/${this.project}/_apis/wiki/wikis?api-version=7.1`;
      const response = await this.client!.get(url);
      return response.data.value || [];
    }, AZDO_RESILIENCE);
  }

  /**
   * Get a wiki page by path.
   */
  async getWikiPage(wikiId: string, pagePath: string, includeContent: boolean = true): Promise<AzdoWikiPage> {
    this.checkEnabled();

    return withResilience(async () => {
      const params = new URLSearchParams({
        'api-version': '7.1',
        path: pagePath,
        includeContent: String(includeContent),
      });

      const url = `/${this.project}/_apis/wiki/wikis/${wikiId}/pages?${params}`;
      const response = await this.client!.get(url);
      return response.data;
    }, AZDO_RESILIENCE);
  }

  /**
   * Create or update a wiki page.
   * Uses PUT with If-Match header for updates, If-None-Match for creates.
   */
  async createOrUpdateWikiPage(
    wikiId: string,
    pagePath: string,
    content: string,
    eTag?: string
  ): Promise<AzdoWikiPage> {
    this.checkEnabled();

    return withResilience(async () => {
      const params = new URLSearchParams({
        'api-version': '7.1',
        path: pagePath,
      });

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (eTag) {
        headers['If-Match'] = eTag;
      } else {
        // Attempt create — fail if page exists
        // Omit If-Match to let Azure DevOps auto-resolve
      }

      const url = `/${this.project}/_apis/wiki/wikis/${wikiId}/pages?${params}`;
      const response = await this.client!.put(url, { content }, { headers });
      return response.data;
    }, AZDO_RESILIENCE);
  }

  /**
   * Delete a wiki page.
   */
  async deleteWikiPage(wikiId: string, pagePath: string): Promise<void> {
    this.checkEnabled();

    return withResilience(async () => {
      const params = new URLSearchParams({
        'api-version': '7.1',
        path: pagePath,
      });

      const url = `/${this.project}/_apis/wiki/wikis/${wikiId}/pages?${params}`;
      await this.client!.delete(url);
    }, AZDO_RESILIENCE);
  }

  /**
   * List wiki pages (tree structure).
   */
  async listWikiPages(
    wikiId: string,
    pagePath: string = '/',
    recursionLevel: 'none' | 'oneLevel' | 'full' = 'oneLevel'
  ): Promise<AzdoWikiPage> {
    this.checkEnabled();

    return withResilience(async () => {
      const params = new URLSearchParams({
        'api-version': '7.1',
        path: pagePath,
        recursionLevel,
      });

      const url = `/${this.project}/_apis/wiki/wikis/${wikiId}/pages?${params}`;
      const response = await this.client!.get(url);
      return response.data;
    }, AZDO_RESILIENCE);
  }

  // ── Repositories ───────────────────────────────────────────────────────

  /**
   * List all Git repositories in the project.
   */
  async listRepositories(): Promise<AzdoRepository[]> {
    this.checkEnabled();

    return withResilience(async () => {
      const url = `/${this.project}/_apis/git/repositories?api-version=7.1`;
      const response = await this.client!.get(url);
      return response.data.value || [];
    }, AZDO_RESILIENCE);
  }

  /**
   * Get a specific repository.
   */
  async getRepository(repoId: string): Promise<AzdoRepository> {
    this.checkEnabled();

    return withResilience(async () => {
      const url = `/${this.project}/_apis/git/repositories/${repoId}?api-version=7.1`;
      const response = await this.client!.get(url);
      return response.data;
    }, AZDO_RESILIENCE);
  }

  // ── Pull Requests ──────────────────────────────────────────────────────

  /**
   * List pull requests for a repository.
   */
  async listPullRequests(
    repoId: string,
    options: {
      status?: 'abandoned' | 'active' | 'completed' | 'all';
      creatorId?: string;
      targetRefName?: string;
      top?: number;
    } = {}
  ): Promise<AzdoPullRequest[]> {
    this.checkEnabled();

    return withResilience(async () => {
      const params = new URLSearchParams({ 'api-version': '7.1' });

      if (options.status) params.set('searchCriteria.status', options.status);
      if (options.creatorId) params.set('searchCriteria.creatorId', options.creatorId);
      if (options.targetRefName) params.set('searchCriteria.targetRefName', options.targetRefName);
      if (options.top) params.set('$top', String(options.top));

      const url = `/${this.project}/_apis/git/repositories/${repoId}/pullrequests?${params}`;
      const response = await this.client!.get(url);
      return response.data.value || [];
    }, AZDO_RESILIENCE);
  }

  /**
   * Get a specific pull request.
   */
  async getPullRequest(repoId: string, pullRequestId: number): Promise<AzdoPullRequest> {
    this.checkEnabled();

    return withResilience(async () => {
      const url = `/${this.project}/_apis/git/repositories/${repoId}/pullrequests/${pullRequestId}?api-version=7.1`;
      const response = await this.client!.get(url);
      return response.data;
    }, AZDO_RESILIENCE);
  }

  /**
   * Get pull request threads (comments).
   */
  async getPullRequestThreads(repoId: string, pullRequestId: number): Promise<AzdoPullRequestThread[]> {
    this.checkEnabled();

    return withResilience(async () => {
      const url = `/${this.project}/_apis/git/repositories/${repoId}/pullrequests/${pullRequestId}/threads?api-version=7.1`;
      const response = await this.client!.get(url);
      return response.data.value || [];
    }, AZDO_RESILIENCE);
  }

  /**
   * Get files changed in a pull request.
   */
  async getPullRequestIterationChanges(
    repoId: string,
    pullRequestId: number,
    iterationId: number = 1
  ): Promise<Array<{ changeType: string; item: { path: string } }>> {
    this.checkEnabled();

    return withResilience(async () => {
      const url = `/${this.project}/_apis/git/repositories/${repoId}/pullrequests/${pullRequestId}/iterations/${iterationId}/changes?api-version=7.1`;
      const response = await this.client!.get(url);
      return response.data.changeEntries || [];
    }, AZDO_RESILIENCE);
  }

  // ── Test Runs & Results ────────────────────────────────────────────────

  /**
   * List test runs.
   */
  async listTestRuns(options: {
    buildUri?: string;
    top?: number;
    planId?: number;
    includeRunDetails?: boolean;
  } = {}): Promise<AzdoTestRun[]> {
    this.checkEnabled();

    return withResilience(async () => {
      const params = new URLSearchParams({ 'api-version': '7.1' });

      if (options.buildUri) params.set('buildUri', options.buildUri);
      if (options.top) params.set('$top', String(options.top));
      if (options.planId) params.set('planId', String(options.planId));
      if (options.includeRunDetails) params.set('includeRunDetails', 'true');

      const url = `/${this.project}/_apis/test/runs?${params}`;
      const response = await this.client!.get(url);
      return response.data.value || [];
    }, AZDO_RESILIENCE);
  }

  /**
   * Get test results for a test run.
   */
  async getTestResults(testRunId: number, top: number = 1000): Promise<AzdoTestResult[]> {
    this.checkEnabled();

    return withResilience(async () => {
      const params = new URLSearchParams({
        'api-version': '7.1',
        '$top': String(top),
      });

      const url = `/${this.project}/_apis/test/runs/${testRunId}/results?${params}`;
      const response = await this.client!.get(url);
      return response.data.value || [];
    }, AZDO_RESILIENCE);
  }

  /**
   * Get test run statistics.
   */
  async getTestRunStatistics(testRunId: number): Promise<Record<string, unknown>> {
    this.checkEnabled();

    return withResilience(async () => {
      const url = `/${this.project}/_apis/test/runs/${testRunId}/statistics?api-version=7.1`;
      const response = await this.client!.get(url);
      return response.data;
    }, AZDO_RESILIENCE);
  }

  // ── Utility ────────────────────────────────────────────────────────────

  /**
   * Test the connection to Azure DevOps.
   */
  async testConnection(): Promise<{ success: boolean; message: string; project?: string }> {
    this.checkEnabled();

    try {
      const url = `/_apis/projects/${this.project}?api-version=7.1`;
      const response = await this.client!.get(url);
      return {
        success: true,
        message: 'Connected to Azure DevOps successfully',
        project: response.data.name,
      };
    } catch (error) {
      const msg = error instanceof AxiosError
        ? `${error.response?.status || 'network'}: ${error.response?.data?.message || error.message}`
        : error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `Azure DevOps connection failed: ${msg}`,
      };
    }
  }

  /**
   * Get project details including team info.
   */
  async getProject(): Promise<Record<string, unknown>> {
    this.checkEnabled();

    return withResilience(async () => {
      const url = `/_apis/projects/${this.project}?api-version=7.1&includeCapabilities=true`;
      const response = await this.client!.get(url);
      return response.data;
    }, AZDO_RESILIENCE);
  }

  /**
   * List teams in the project.
   */
  async listTeams(top: number = 100): Promise<Array<{ id: string; name: string; description: string; url: string }>> {
    this.checkEnabled();

    return withResilience(async () => {
      const url = `/_apis/projects/${this.project}/teams?api-version=7.1&$top=${top}`;
      const response = await this.client!.get(url);
      return response.data.value || [];
    }, AZDO_RESILIENCE);
  }

  /**
   * Get current iteration (sprint) for the configured team.
   */
  async getCurrentIteration(): Promise<Record<string, unknown> | null> {
    this.checkEnabled();

    if (!this.team) {
      logger.warn('[AzureDevOps] No team configured — cannot get current iteration');
      return null;
    }

    return withResilience(async () => {
      const url = `/${this.project}/${this.team}/_apis/work/teamsettings/iterations?$timeframe=current&api-version=7.1`;
      const response = await this.client!.get(url);
      const iterations = response.data.value || [];
      return iterations[0] || null;
    }, AZDO_RESILIENCE);
  }
}

// ── Singleton Export ──────────────────────────────────────────────────────

export const azureDevOpsService = new AzureDevOpsService();
