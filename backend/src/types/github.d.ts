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
  name: string;
  status: string;
  conclusion: string | null;
  head_branch: string;
  head_sha: string;
  run_number: number;
  event: string;
  url: string;
  created_at: string;
  updated_at: string;
}

// Add type guard
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