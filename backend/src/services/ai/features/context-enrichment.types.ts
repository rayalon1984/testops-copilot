/**
 * Context Enrichment Types
 *
 * Shared type definitions for the context enrichment pipeline.
 * Used by the enrichment service, AI manager, and analysis routes.
 */

import { TestFailure } from '../types';

// ── Input / Output ──────────────────────────────────────────────────────────

export interface EnrichmentInput {
  /** The test failure to enrich */
  failure: TestFailure;
  /** GitHub owner/repo for code lookup (e.g. "acme/webapp") */
  repo?: string;
  /** Which enrichment sources to include */
  sources?: {
    jira?: boolean;
    confluence?: boolean;
    github?: boolean;
    xray?: boolean;
  };
  /** Maximum number of results per source */
  maxResultsPerSource?: number;
}

export interface EnrichmentResult {
  /** AI-generated analysis synthesizing all context sources */
  analysis: string;
  /** Confidence score for the analysis (0-1) */
  confidence: number;
  /** Context gathered from each source */
  context: {
    jiraIssues: JiraContext[];
    confluencePages: ConfluenceContext[];
    codeChanges: {
      commit?: { sha: string; message: string; files: CodeChange[] };
      pullRequest?: PullRequestContext;
    };
    xrayContext?: XrayEnrichmentContext;
  };
  /** Which sources were available and queried */
  sourcesQueried: string[];
}

// ── Source Context Types ────────────────────────────────────────────────────

export interface CodeChange {
  filename: string;
  status: string;
  patch: string;
  additions: number;
  deletions: number;
}

export interface PullRequestContext {
  number: number;
  title: string;
  body: string;
  url: string;
  author: string;
  files: CodeChange[];
}

export interface JiraContext {
  key: string;
  summary: string;
  status: string;
  type: string;
  priority?: string;
  assignee?: string;
  url: string;
}

export interface ConfluenceContext {
  id: string;
  title: string;
  url: string;
  excerpt: string;
  labels: string[];
}

export interface XrayEnrichmentContext {
  testCaseKey: string;
  summary: string;
  status: string;
  executionHistory: Array<{
    date: string;
    status: string;
    executionKey: string;
  }>;
  linkedDefects: Array<{
    key: string;
    summary: string;
    status: string;
  }>;
}
