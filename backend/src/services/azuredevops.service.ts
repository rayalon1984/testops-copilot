/**
 * Azure DevOps Service — Core (Pipelines, Builds, Work Items)
 *
 * Full integration with Azure DevOps REST API v7.1.
 * This file contains the class definition, constructor, status helpers,
 * Pipelines, Builds, and Work Items methods.
 *
 * Additional methods (Wiki, Repos, PRs, Test Runs, Utility) are attached
 * via prototype extension in ./azuredevops-content.service.ts and loaded
 * as a side-effect import before the singleton export.
 *
 * Follows existing service patterns: axios + Basic auth (PAT),
 * withResilience wrapping, circuit breaker, singleton export, isEnabled() gating.
 */

import axios, { AxiosInstance } from 'axios';
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
  protected client: AxiosInstance | null = null;
  protected orgUrl: string = '';
  protected project: string = '';
  protected team: string | undefined;
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

  protected checkEnabled(): void {
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

}

// ── Content extension (Wiki, Repos, PRs, Test Runs, Utility) ────────────
// Side-effect import: attaches additional methods to AzureDevOpsService.prototype
import './azuredevops-content.service';

// ── Singleton Export ──────────────────────────────────────────────────────

export const azureDevOpsService = new AzureDevOpsService();
