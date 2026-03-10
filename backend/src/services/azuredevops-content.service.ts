/**
 * Azure DevOps Service — Content Methods (Wiki, Repos, PRs, Test Runs, Utility)
 *
 * This file extends the AzureDevOpsService class defined in azuredevops.service.ts
 * by attaching additional methods via prototype assignment. It is imported by the
 * main service file before the singleton export so that all methods are available
 * on the exported instance.
 *
 * Methods here:
 * - Wiki: listWikis, getWikiPage, createOrUpdateWikiPage, deleteWikiPage, listWikiPages
 * - Repositories: listRepositories, getRepository
 * - Pull Requests: listPullRequests, getPullRequest, getPullRequestThreads, getPullRequestIterationChanges
 * - Test Runs & Results: listTestRuns, getTestResults, getTestRunStatistics
 * - Utility: testConnection, getProject, listTeams, getCurrentIteration
 */

import { AxiosError } from 'axios';
import { logger } from '@/utils/logger';
import { withResilience, circuitBreakers } from '@/lib/resilience';
import { AzureDevOpsService } from './azuredevops.service';
import type {
  AzdoWiki,
  AzdoWikiPage,
  AzdoRepository,
  AzdoPullRequest,
  AzdoPullRequestThread,
  AzdoTestRun,
  AzdoTestResult,
} from '@/types/azuredevops';

// ── Resilience Config (matches main file) ──────────────────────────────

const AZDO_RESILIENCE = {
  circuitBreaker: circuitBreakers.azureDevOps,
  retry: { maxRetries: 2, baseDelayMs: 1000 },
  timeoutMs: 15_000,
  label: 'azureDevOps',
};

// ── Type augmentation so TS knows about the added methods ──────────────

declare module './azuredevops.service' {
  interface AzureDevOpsService {
    // Wiki
    listWikis(): Promise<AzdoWiki[]>;
    getWikiPage(wikiId: string, pagePath: string, includeContent?: boolean): Promise<AzdoWikiPage>;
    createOrUpdateWikiPage(wikiId: string, pagePath: string, content: string, eTag?: string): Promise<AzdoWikiPage>;
    deleteWikiPage(wikiId: string, pagePath: string): Promise<void>;
    listWikiPages(wikiId: string, pagePath?: string, recursionLevel?: 'none' | 'oneLevel' | 'full'): Promise<AzdoWikiPage>;

    // Repositories
    listRepositories(): Promise<AzdoRepository[]>;
    getRepository(repoId: string): Promise<AzdoRepository>;

    // Pull Requests
    listPullRequests(
      repoId: string,
      options?: {
        status?: 'abandoned' | 'active' | 'completed' | 'all';
        creatorId?: string;
        targetRefName?: string;
        top?: number;
      }
    ): Promise<AzdoPullRequest[]>;
    getPullRequest(repoId: string, pullRequestId: number): Promise<AzdoPullRequest>;
    getPullRequestThreads(repoId: string, pullRequestId: number): Promise<AzdoPullRequestThread[]>;
    getPullRequestIterationChanges(
      repoId: string,
      pullRequestId: number,
      iterationId?: number
    ): Promise<Array<{ changeType: string; item: { path: string } }>>;

    // Test Runs & Results
    listTestRuns(options?: {
      buildUri?: string;
      top?: number;
      planId?: number;
      includeRunDetails?: boolean;
    }): Promise<AzdoTestRun[]>;
    getTestResults(testRunId: number, top?: number): Promise<AzdoTestResult[]>;
    getTestRunStatistics(testRunId: number): Promise<Record<string, unknown>>;

    // Utility
    testConnection(): Promise<{ success: boolean; message: string; project?: string }>;
    getProject(): Promise<Record<string, unknown>>;
    listTeams(top?: number): Promise<Array<{ id: string; name: string; description: string; url: string }>>;
    getCurrentIteration(): Promise<Record<string, unknown> | null>;
  }
}

// ── Wiki Methods ────────────────────────────────────────────────────────

async function listWikis(this: AzureDevOpsService): Promise<AzdoWiki[]> {
  this.checkEnabled();

  return withResilience(async () => {
    const url = `/${this.project}/_apis/wiki/wikis?api-version=7.1`;
    const response = await this.client!.get(url);
    return response.data.value || [];
  }, AZDO_RESILIENCE);
}

async function getWikiPage(
  this: AzureDevOpsService,
  wikiId: string,
  pagePath: string,
  includeContent: boolean = true
): Promise<AzdoWikiPage> {
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

async function createOrUpdateWikiPage(
  this: AzureDevOpsService,
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
    }

    const url = `/${this.project}/_apis/wiki/wikis/${wikiId}/pages?${params}`;
    const response = await this.client!.put(url, { content }, { headers });
    return response.data;
  }, AZDO_RESILIENCE);
}

async function deleteWikiPage(
  this: AzureDevOpsService,
  wikiId: string,
  pagePath: string
): Promise<void> {
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

async function listWikiPages(
  this: AzureDevOpsService,
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

// ── Repository Methods ──────────────────────────────────────────────────

async function listRepositories(this: AzureDevOpsService): Promise<AzdoRepository[]> {
  this.checkEnabled();

  return withResilience(async () => {
    const url = `/${this.project}/_apis/git/repositories?api-version=7.1`;
    const response = await this.client!.get(url);
    return response.data.value || [];
  }, AZDO_RESILIENCE);
}

async function getRepository(this: AzureDevOpsService, repoId: string): Promise<AzdoRepository> {
  this.checkEnabled();

  return withResilience(async () => {
    const url = `/${this.project}/_apis/git/repositories/${repoId}?api-version=7.1`;
    const response = await this.client!.get(url);
    return response.data;
  }, AZDO_RESILIENCE);
}

// ── Pull Request Methods ────────────────────────────────────────────────

async function listPullRequests(
  this: AzureDevOpsService,
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

async function getPullRequest(
  this: AzureDevOpsService,
  repoId: string,
  pullRequestId: number
): Promise<AzdoPullRequest> {
  this.checkEnabled();

  return withResilience(async () => {
    const url = `/${this.project}/_apis/git/repositories/${repoId}/pullrequests/${pullRequestId}?api-version=7.1`;
    const response = await this.client!.get(url);
    return response.data;
  }, AZDO_RESILIENCE);
}

async function getPullRequestThreads(
  this: AzureDevOpsService,
  repoId: string,
  pullRequestId: number
): Promise<AzdoPullRequestThread[]> {
  this.checkEnabled();

  return withResilience(async () => {
    const url = `/${this.project}/_apis/git/repositories/${repoId}/pullrequests/${pullRequestId}/threads?api-version=7.1`;
    const response = await this.client!.get(url);
    return response.data.value || [];
  }, AZDO_RESILIENCE);
}

async function getPullRequestIterationChanges(
  this: AzureDevOpsService,
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

// ── Test Run & Result Methods ───────────────────────────────────────────

async function listTestRuns(
  this: AzureDevOpsService,
  options: {
    buildUri?: string;
    top?: number;
    planId?: number;
    includeRunDetails?: boolean;
  } = {}
): Promise<AzdoTestRun[]> {
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

async function getTestResults(
  this: AzureDevOpsService,
  testRunId: number,
  top: number = 1000
): Promise<AzdoTestResult[]> {
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

async function getTestRunStatistics(
  this: AzureDevOpsService,
  testRunId: number
): Promise<Record<string, unknown>> {
  this.checkEnabled();

  return withResilience(async () => {
    const url = `/${this.project}/_apis/test/runs/${testRunId}/statistics?api-version=7.1`;
    const response = await this.client!.get(url);
    return response.data;
  }, AZDO_RESILIENCE);
}

// ── Utility Methods ─────────────────────────────────────────────────────

async function testConnection(
  this: AzureDevOpsService
): Promise<{ success: boolean; message: string; project?: string }> {
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

async function getProject(this: AzureDevOpsService): Promise<Record<string, unknown>> {
  this.checkEnabled();

  return withResilience(async () => {
    const url = `/_apis/projects/${this.project}?api-version=7.1&includeCapabilities=true`;
    const response = await this.client!.get(url);
    return response.data;
  }, AZDO_RESILIENCE);
}

async function listTeams(
  this: AzureDevOpsService,
  top: number = 100
): Promise<Array<{ id: string; name: string; description: string; url: string }>> {
  this.checkEnabled();

  return withResilience(async () => {
    const url = `/_apis/projects/${this.project}/teams?api-version=7.1&$top=${top}`;
    const response = await this.client!.get(url);
    return response.data.value || [];
  }, AZDO_RESILIENCE);
}

async function getCurrentIteration(
  this: AzureDevOpsService
): Promise<Record<string, unknown> | null> {
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

// ── Attach all methods to the prototype ─────────────────────────────────

Object.assign(AzureDevOpsService.prototype, {
  // Wiki
  listWikis,
  getWikiPage,
  createOrUpdateWikiPage,
  deleteWikiPage,
  listWikiPages,
  // Repositories
  listRepositories,
  getRepository,
  // Pull Requests
  listPullRequests,
  getPullRequest,
  getPullRequestThreads,
  getPullRequestIterationChanges,
  // Test Runs & Results
  listTestRuns,
  getTestResults,
  getTestRunStatistics,
  // Utility
  testConnection,
  getProject,
  listTeams,
  getCurrentIteration,
});
