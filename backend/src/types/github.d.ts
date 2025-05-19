import { Prisma } from '@prisma/client';

export interface GitHubCredentials {
  username: string;
  apiToken: string;
}

export interface GitHubConfig {
  url: string;
  credentials: GitHubCredentials;
  repository?: string;
  branch?: string;
  workflow?: string;
  triggers?: ('push' | 'pull_request' | 'schedule' | 'manual')[];
  schedule?: string;
}

export interface GitHubWorkflow {
  id: number;
  name: string;
  path: string;
  state: string;
  created_at: string;
  updated_at: string;
}

export interface GitHubWorkflowRun {
  id: number;
  name?: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | null;
  head_branch: string | null;
  head_sha: string;
  run_number: number;
  event?: string;
  html_url: string;
  created_at: string;
  updated_at: string;
  display_title?: string;
}

// Prisma Model Types
export type Pipeline = Prisma.PipelineGetPayload<{
  include: {
    testRuns: true;
  };
}>;

export type TestRun = Prisma.TestRunGetPayload<{
  include: {
    pipeline: true;
  };
}>;

// Pipeline Status Types
export type PipelineStatus = 'pending' | 'running' | 'success' | 'failure' | 'cancelled' | 'timeout';

// Type Guards
export function isGitHubConfig(config: any): config is GitHubConfig {
  return (
    typeof config === 'object' &&
    config !== null &&
    typeof config.url === 'string' &&
    typeof config.credentials === 'object' &&
    typeof config.credentials.username === 'string' &&
    typeof config.credentials.apiToken === 'string'
  );
}