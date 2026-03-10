/**
 * Azure DevOps Controller
 *
 * REST API endpoints for Azure DevOps integration.
 * All routes require authentication.
 *
 * Endpoints:
 * - GET    /status                    — connection status
 * - GET    /pipelines                 — list pipelines
 * - GET    /pipelines/:id             — get pipeline
 * - POST   /pipelines/:id/run         — trigger pipeline run
 * - GET    /pipelines/:id/runs        — list pipeline runs
 * - GET    /builds                    — list builds
 * - GET    /builds/:id                — get build
 * - GET    /builds/:id/timeline       — get build timeline
 * - POST   /work-items/query          — query work items (WIQL)
 * - GET    /work-items/search         — search work items by text
 * - GET    /work-items/:id            — get work item
 * - POST   /work-items                — create work item
 * - PATCH  /work-items/:id            — update work item
 * - GET    /wikis                     — list wikis
 * - GET    /wikis/:wikiId/pages       — get/list wiki pages
 * - PUT    /wikis/:wikiId/pages       — create/update wiki page
 * - GET    /repos                     — list repositories
 * - GET    /repos/:repoId/pull-requests — list pull requests
 * - GET    /repos/:repoId/pull-requests/:prId — get pull request
 * - GET    /test-runs                 — list test runs
 * - GET    /test-runs/:id/results     — get test results
 */

import { Router, Request, Response } from 'express';
import { azureDevOpsService } from '@/services/azuredevops.service';
import { asyncHandler } from '@/middleware/errorHandler';
import { authenticate } from '@/middleware/auth';
import {
  azdoQueryWorkItemsSchema,
  azdoCreateWorkItemSchema,
  azdoUpdateWorkItemSchema,
  azdoCreateWikiPageSchema,
  azdoTriggerPipelineSchema,
  CreateWorkItemField,
} from '@/types/azuredevops';

const router: Router = Router();

// All Azure DevOps routes require authentication
router.use(authenticate);

/** Safely extract a string param from Express params (handles string | string[]). */
function param(req: Request, name: string): string {
  const val = req.params[name];
  return Array.isArray(val) ? val[0] : (val as string);
}

// ── Connection Status ────────────────────────────────────────────────────

router.get(
  '/status',
  asyncHandler(async (_req: Request, res: Response) => {
    if (!azureDevOpsService.isEnabled()) {
      res.status(200).json({
        enabled: false,
        message: 'Azure DevOps integration is not configured',
      });
      return;
    }

    const result = await azureDevOpsService.testConnection();
    res.status(200).json({
      enabled: true,
      ...result,
      connectionInfo: azureDevOpsService.getConnectionInfo(),
    });
  })
);

// ── Pipelines ────────────────────────────────────────────────────────────

router.get(
  '/pipelines',
  asyncHandler(async (_req: Request, res: Response) => {
    const pipelines = await azureDevOpsService.listPipelines();
    res.status(200).json({ pipelines, count: pipelines.length });
  })
);

router.get(
  '/pipelines/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const pipelineId = parseInt(param(req, 'id'), 10);
    if (isNaN(pipelineId)) {
      res.status(400).json({ error: 'Pipeline ID must be a number' });
      return;
    }
    const pipeline = await azureDevOpsService.getPipeline(pipelineId);
    res.status(200).json(pipeline);
  })
);

router.post(
  '/pipelines/:id/run',
  asyncHandler(async (req: Request, res: Response) => {
    const pipelineId = parseInt(param(req, 'id'), 10);
    if (isNaN(pipelineId)) {
      res.status(400).json({ error: 'Pipeline ID must be a number' });
      return;
    }
    const parsed = azdoTriggerPipelineSchema.parse({
      pipelineId,
      ...req.body,
    });
    const run = await azureDevOpsService.triggerPipelineRun(
      parsed.pipelineId,
      parsed.branch,
      parsed.parameters
    );
    res.status(201).json(run);
  })
);

router.get(
  '/pipelines/:id/runs',
  asyncHandler(async (req: Request, res: Response) => {
    const pipelineId = parseInt(param(req, 'id'), 10);
    if (isNaN(pipelineId)) {
      res.status(400).json({ error: 'Pipeline ID must be a number' });
      return;
    }
    const top = parseInt(req.query.top as string, 10) || 10;
    const runs = await azureDevOpsService.listPipelineRuns(pipelineId, top);
    res.status(200).json({ runs, count: runs.length });
  })
);

// ── Builds ───────────────────────────────────────────────────────────────

router.get(
  '/builds',
  asyncHandler(async (req: Request, res: Response) => {
    const top = parseInt(req.query.top as string, 10) || 20;
    const statusFilter = req.query.status as string | undefined;
    const resultFilter = req.query.result as string | undefined;
    const branchName = req.query.branch as string | undefined;

    const builds = await azureDevOpsService.listBuilds({
      top,
      statusFilter,
      resultFilter,
      branchName,
    });
    res.status(200).json({ builds, count: builds.length });
  })
);

router.get(
  '/builds/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const buildId = parseInt(param(req, 'id'), 10);
    if (isNaN(buildId)) {
      res.status(400).json({ error: 'Build ID must be a number' });
      return;
    }
    const build = await azureDevOpsService.getBuild(buildId);
    res.status(200).json(build);
  })
);

router.get(
  '/builds/:id/timeline',
  asyncHandler(async (req: Request, res: Response) => {
    const buildId = parseInt(param(req, 'id'), 10);
    if (isNaN(buildId)) {
      res.status(400).json({ error: 'Build ID must be a number' });
      return;
    }
    const timeline = await azureDevOpsService.getBuildTimeline(buildId);
    res.status(200).json(timeline);
  })
);

// ── Work Items ───────────────────────────────────────────────────────────

router.post(
  '/work-items/query',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = azdoQueryWorkItemsSchema.parse(req.body);
    const queryResult = await azureDevOpsService.queryWorkItems(parsed.wiql, parsed.top);

    // Automatically hydrate work items if there are results
    let workItems: unknown[] = [];
    if (queryResult.workItems.length > 0) {
      const ids = queryResult.workItems.map(wi => wi.id);
      workItems = await azureDevOpsService.getWorkItems(ids);
    }

    res.status(200).json({
      queryResult: { asOf: queryResult.asOf, count: queryResult.workItems.length },
      workItems,
    });
  })
);

router.get(
  '/work-items/search',
  asyncHandler(async (req: Request, res: Response) => {
    const searchText = req.query.q as string || '';
    const workItemType = req.query.type as string | undefined;
    const state = req.query.state as string | undefined;
    const top = parseInt(req.query.top as string, 10) || 20;

    const workItems = await azureDevOpsService.searchWorkItems(searchText, workItemType, state, top);
    res.status(200).json({ workItems, count: workItems.length });
  })
);

router.get(
  '/work-items/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(param(req, 'id'), 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Work item ID must be a number' });
      return;
    }
    const expand = req.query.expand as 'none' | 'relations' | 'fields' | 'links' | 'all' | undefined;
    const workItem = await azureDevOpsService.getWorkItem(id, expand);
    res.status(200).json(workItem);
  })
);

router.post(
  '/work-items',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = azdoCreateWorkItemSchema.parse(req.body);

    const fields: CreateWorkItemField[] = [
      { op: 'add', path: '/fields/System.Title', value: parsed.title },
    ];

    if (parsed.description) {
      fields.push({ op: 'add', path: '/fields/System.Description', value: parsed.description });
    }
    if (parsed.assignedTo) {
      fields.push({ op: 'add', path: '/fields/System.AssignedTo', value: parsed.assignedTo });
    }
    if (parsed.areaPath) {
      fields.push({ op: 'add', path: '/fields/System.AreaPath', value: parsed.areaPath });
    }
    if (parsed.iterationPath) {
      fields.push({ op: 'add', path: '/fields/System.IterationPath', value: parsed.iterationPath });
    }
    if (parsed.priority !== undefined) {
      fields.push({ op: 'add', path: '/fields/Microsoft.VSTS.Common.Priority', value: parsed.priority });
    }
    if (parsed.tags) {
      fields.push({ op: 'add', path: '/fields/System.Tags', value: parsed.tags });
    }

    // Add any additional custom fields
    if (parsed.additionalFields) {
      for (const [key, value] of Object.entries(parsed.additionalFields)) {
        fields.push({ op: 'add', path: `/fields/${key}`, value });
      }
    }

    const workItem = await azureDevOpsService.createWorkItem(parsed.type, fields);
    res.status(201).json(workItem);
  })
);

router.patch(
  '/work-items/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(param(req, 'id'), 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Work item ID must be a number' });
      return;
    }
    const parsed = azdoUpdateWorkItemSchema.parse(req.body);
    const workItem = await azureDevOpsService.updateWorkItem(id, parsed.fields as CreateWorkItemField[]);
    res.status(200).json(workItem);
  })
);

// ── Wiki ─────────────────────────────────────────────────────────────────

router.get(
  '/wikis',
  asyncHandler(async (_req: Request, res: Response) => {
    const wikis = await azureDevOpsService.listWikis();
    res.status(200).json({ wikis, count: wikis.length });
  })
);

router.get(
  '/wikis/:wikiId/pages',
  asyncHandler(async (req: Request, res: Response) => {
    const wikiId = param(req, 'wikiId');
    const pagePath = (req.query.path as string) || '/';
    const includeContent = req.query.includeContent !== 'false';

    const page = await azureDevOpsService.getWikiPage(wikiId, pagePath, includeContent);
    res.status(200).json(page);
  })
);

router.put(
  '/wikis/:wikiId/pages',
  asyncHandler(async (req: Request, res: Response) => {
    const wikiId = param(req, 'wikiId');
    const parsed = azdoCreateWikiPageSchema.parse({ wikiId, ...req.body });
    const eTag = req.headers['if-match'] as string | undefined;

    const page = await azureDevOpsService.createOrUpdateWikiPage(
      parsed.wikiId,
      parsed.path,
      parsed.content,
      eTag
    );
    res.status(200).json(page);
  })
);

// ── Repositories ─────────────────────────────────────────────────────────

router.get(
  '/repos',
  asyncHandler(async (_req: Request, res: Response) => {
    const repos = await azureDevOpsService.listRepositories();
    res.status(200).json({ repositories: repos, count: repos.length });
  })
);

// ── Pull Requests ────────────────────────────────────────────────────────

router.get(
  '/repos/:repoId/pull-requests',
  asyncHandler(async (req: Request, res: Response) => {
    const repoId = param(req, 'repoId');
    const status = req.query.status as 'abandoned' | 'active' | 'completed' | 'all' | undefined;
    const top = parseInt(req.query.top as string, 10) || 20;

    const pullRequests = await azureDevOpsService.listPullRequests(repoId, { status, top });
    res.status(200).json({ pullRequests, count: pullRequests.length });
  })
);

router.get(
  '/repos/:repoId/pull-requests/:prId',
  asyncHandler(async (req: Request, res: Response) => {
    const repoId = param(req, 'repoId');
    const pullRequestId = parseInt(param(req, 'prId'), 10);
    if (isNaN(pullRequestId)) {
      res.status(400).json({ error: 'Pull request ID must be a number' });
      return;
    }
    const pr = await azureDevOpsService.getPullRequest(repoId, pullRequestId);
    res.status(200).json(pr);
  })
);

router.get(
  '/repos/:repoId/pull-requests/:prId/threads',
  asyncHandler(async (req: Request, res: Response) => {
    const repoId = param(req, 'repoId');
    const pullRequestId = parseInt(param(req, 'prId'), 10);
    if (isNaN(pullRequestId)) {
      res.status(400).json({ error: 'Pull request ID must be a number' });
      return;
    }
    const threads = await azureDevOpsService.getPullRequestThreads(repoId, pullRequestId);
    res.status(200).json({ threads, count: threads.length });
  })
);

// ── Test Runs & Results ──────────────────────────────────────────────────

router.get(
  '/test-runs',
  asyncHandler(async (req: Request, res: Response) => {
    const top = parseInt(req.query.top as string, 10) || 20;
    const testRuns = await azureDevOpsService.listTestRuns({ top });
    res.status(200).json({ testRuns, count: testRuns.length });
  })
);

router.get(
  '/test-runs/:id/results',
  asyncHandler(async (req: Request, res: Response) => {
    const testRunId = parseInt(param(req, 'id'), 10);
    if (isNaN(testRunId)) {
      res.status(400).json({ error: 'Test run ID must be a number' });
      return;
    }
    const top = parseInt(req.query.top as string, 10) || 1000;
    const results = await azureDevOpsService.getTestResults(testRunId, top);
    res.status(200).json({ results, count: results.length });
  })
);

// ── Project Info ─────────────────────────────────────────────────────────

router.get(
  '/project',
  asyncHandler(async (_req: Request, res: Response) => {
    const project = await azureDevOpsService.getProject();
    res.status(200).json(project);
  })
);

router.get(
  '/teams',
  asyncHandler(async (_req: Request, res: Response) => {
    const teams = await azureDevOpsService.listTeams();
    res.status(200).json({ teams, count: teams.length });
  })
);

router.get(
  '/iterations/current',
  asyncHandler(async (_req: Request, res: Response) => {
    const iteration = await azureDevOpsService.getCurrentIteration();
    if (!iteration) {
      res.status(404).json({ message: 'No team configured or no current iteration found' });
      return;
    }
    res.status(200).json(iteration);
  })
);

export const azureDevOpsController = router;
