import { z } from 'zod';

// ── Azure DevOps REST API types ─────────────────────────────────────────

/**
 * Azure DevOps Integration — Type Definitions
 *
 * Covers: Pipelines, Work Items, Wiki, Repos/Pull Requests, Test Plans.
 * Based on Azure DevOps REST API v7.1.
 */

// ── Pipelines ────────────────────────────────────────────────────────────

export interface AzdoPipeline {
  id: number;
  name: string;
  folder: string;
  revision: number;
  url: string;
  _links: Record<string, { href: string }>;
}

export interface AzdoPipelineRun {
  id: number;
  name: string;
  state: 'unknown' | 'inProgress' | 'canceling' | 'completed';
  result: 'unknown' | 'succeeded' | 'failed' | 'canceled' | 'partiallySucceeded' | 'none';
  createdDate: string;
  finishedDate: string | null;
  url: string;
  pipeline: { id: number; name: string };
  resources?: Record<string, unknown>;
  templateParameters?: Record<string, string>;
}

export interface AzdoBuild {
  id: number;
  buildNumber: string;
  status: 'all' | 'cancelling' | 'completed' | 'inProgress' | 'none' | 'notStarted' | 'postponed';
  result: 'canceled' | 'failed' | 'none' | 'partiallySucceeded' | 'succeeded';
  queueTime: string;
  startTime: string;
  finishTime: string | null;
  sourceBranch: string;
  sourceVersion: string;
  definition: { id: number; name: string };
  requestedFor: { displayName: string; uniqueName: string };
  repository: { id: string; name: string; type: string };
  url: string;
  _links: Record<string, { href: string }>;
}

export interface AzdoBuildTimeline {
  records: AzdoTimelineRecord[];
}

export interface AzdoTimelineRecord {
  id: string;
  parentId: string | null;
  type: string;
  name: string;
  state: 'completed' | 'inProgress' | 'pending';
  result: 'abandoned' | 'canceled' | 'failed' | 'skipped' | 'succeeded' | 'succeededWithIssues' | null;
  startTime: string | null;
  finishTime: string | null;
  errorCount: number;
  warningCount: number;
  log?: { id: number; type: string; url: string };
  issues?: Array<{ type: string; category: string; message: string }>;
}

// ── Work Items ───────────────────────────────────────────────────────────

export interface AzdoWorkItem {
  id: number;
  rev: number;
  url: string;
  fields: {
    'System.Id': number;
    'System.Title': string;
    'System.State': string;
    'System.WorkItemType': string;
    'System.AssignedTo'?: { displayName: string; uniqueName: string };
    'System.Description'?: string;
    'System.Tags'?: string;
    'System.CreatedDate': string;
    'System.ChangedDate': string;
    'System.AreaPath': string;
    'System.IterationPath': string;
    'Microsoft.VSTS.Common.Priority'?: number;
    'Microsoft.VSTS.Common.Severity'?: string;
    [key: string]: unknown;
  };
  _links: Record<string, { href: string }>;
}

export interface AzdoWorkItemQueryResult {
  queryType: string;
  queryResultType: string;
  asOf: string;
  workItems: Array<{ id: number; url: string }>;
}

export interface CreateWorkItemField {
  op: 'add' | 'replace' | 'remove' | 'test';
  path: string;
  value: unknown;
}

// ── Wiki ─────────────────────────────────────────────────────────────────

export interface AzdoWiki {
  id: string;
  name: string;
  type: 'projectWiki' | 'codeWiki';
  url: string;
  versions: Array<{ version: string }>;
  repositoryId?: string;
  mappedPath?: string;
}

export interface AzdoWikiPage {
  id: number;
  path: string;
  url: string;
  remoteUrl: string;
  content?: string;
  gitItemPath?: string;
  subPages?: AzdoWikiPage[];
  isParentPage?: boolean;
}

export interface CreateWikiPageRequest {
  content: string;
}

// ── Repositories & Pull Requests ─────────────────────────────────────────

export interface AzdoRepository {
  id: string;
  name: string;
  url: string;
  defaultBranch: string;
  size: number;
  remoteUrl: string;
  webUrl: string;
  project: { id: string; name: string };
}

export interface AzdoPullRequest {
  pullRequestId: number;
  title: string;
  description: string;
  status: 'abandoned' | 'active' | 'completed' | 'notSet';
  sourceRefName: string;
  targetRefName: string;
  mergeStatus: string;
  createdBy: { displayName: string; uniqueName: string };
  creationDate: string;
  closedDate: string | null;
  url: string;
  repository: { id: string; name: string };
  reviewers: Array<{
    displayName: string;
    uniqueName: string;
    vote: number; // 10=approved, 5=approved with suggestions, 0=no vote, -5=waiting, -10=rejected
  }>;
  labels?: Array<{ id: string; name: string }>;
}

export interface AzdoPullRequestThread {
  id: number;
  status: 'active' | 'byDesign' | 'closed' | 'fixed' | 'pending' | 'unknown' | 'wontFix';
  comments: Array<{
    id: number;
    content: string;
    author: { displayName: string; uniqueName: string };
    publishedDate: string;
    commentType: string;
  }>;
  threadContext?: {
    filePath: string;
    rightFileStart?: { line: number; offset: number };
    rightFileEnd?: { line: number; offset: number };
  };
}

// ── Test Plans & Results ─────────────────────────────────────────────────

export interface AzdoTestRun {
  id: number;
  name: string;
  state: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  notApplicableTests: number;
  startedDate: string;
  completedDate: string | null;
  build?: { id: string; name: string };
  pipelineReference?: { pipelineId: number; stageReference?: { stageName: string } };
  url: string;
  webAccessUrl: string;
}

export interface AzdoTestResult {
  id: number;
  testCaseTitle: string;
  outcome: 'Passed' | 'Failed' | 'NotExecuted' | 'Blocked' | 'Error' | 'Timeout' | 'Aborted' | 'Inconclusive' | 'NotApplicable';
  durationInMs: number;
  errorMessage?: string;
  stackTrace?: string;
  automatedTestName?: string;
  automatedTestStorage?: string;
  startedDate: string;
  completedDate: string;
  build?: { id: string };
  testRun?: { id: string; name: string };
}

// ── Validation Schemas ───────────────────────────────────────────────────

export const azdoQueryWorkItemsSchema = z.object({
  wiql: z.string().min(1, 'WIQL query is required'),
  top: z.number().int().positive().max(200).optional(),
});

export const azdoCreateWorkItemSchema = z.object({
  type: z.string().min(1, 'Work item type is required (e.g., Bug, Task, User Story)'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  assignedTo: z.string().optional(),
  areaPath: z.string().optional(),
  iterationPath: z.string().optional(),
  priority: z.number().int().min(1).max(4).optional(),
  tags: z.string().optional(),
  additionalFields: z.record(z.unknown()).optional(),
});

export const azdoUpdateWorkItemSchema = z.object({
  fields: z.array(z.object({
    op: z.enum(['add', 'replace', 'remove']),
    path: z.string(),
    value: z.unknown(),
  })).min(1, 'At least one field update is required'),
});

export const azdoCreateWikiPageSchema = z.object({
  wikiId: z.string().min(1, 'Wiki ID is required'),
  path: z.string().min(1, 'Page path is required'),
  content: z.string().min(1, 'Page content is required'),
});

export const azdoUpdateWikiPageSchema = z.object({
  wikiId: z.string().min(1, 'Wiki ID is required'),
  path: z.string().min(1, 'Page path is required'),
  content: z.string().min(1, 'Page content is required'),
  eTag: z.string().optional(),
});

export const azdoTriggerPipelineSchema = z.object({
  pipelineId: z.number().int().positive('Pipeline ID must be a positive integer'),
  branch: z.string().optional(),
  parameters: z.record(z.string()).optional(),
});

export type AzdoQueryWorkItemsInput = z.infer<typeof azdoQueryWorkItemsSchema>;
export type AzdoCreateWorkItemInput = z.infer<typeof azdoCreateWorkItemSchema>;
export type AzdoUpdateWorkItemInput = z.infer<typeof azdoUpdateWorkItemSchema>;
export type AzdoCreateWikiPageInput = z.infer<typeof azdoCreateWikiPageSchema>;
export type AzdoUpdateWikiPageInput = z.infer<typeof azdoUpdateWikiPageSchema>;
export type AzdoTriggerPipelineInput = z.infer<typeof azdoTriggerPipelineSchema>;
