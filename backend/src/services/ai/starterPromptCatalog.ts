/**
 * Starter Prompt Catalog — role-based prompt sets.
 *
 * Each role has 6-8 curated prompts. The resolver picks the top 4
 * unless overridden by user pins.
 */

export interface StarterPrompt {
  id: string;
  label: string;
  prompt: string;
  icon?: string;        // MUI icon name
  category?: string;    // For grouping in settings UI
}

// ─── Role Catalogs ─────────────────────────────────────────────

const QA_ENGINEER: StarterPrompt[] = [
  { id: 'qa-analyze-failure', label: 'Analyze last failure', prompt: 'Analyze the most recent test failure and suggest a fix', icon: 'BugReport', category: 'failures' },
  { id: 'qa-flaky-tests', label: 'Check flaky tests', prompt: 'Show me the flakiest tests this week and suggest quarantine candidates', icon: 'FlipCameraAndroid', category: 'quality' },
  { id: 'qa-quarantine-queue', label: 'Review quarantine queue', prompt: 'Show all quarantined tests with their severity and reinstatement readiness', icon: 'Shield', category: 'healing' },
  { id: 'qa-failure-trends', label: 'Show failure trends', prompt: 'Show me failure trends for the past 30 days', icon: 'TrendingUp', category: 'analytics' },
  { id: 'qa-health-check', label: 'Test health check', prompt: 'Run a health check on the test suite — flakiness rate, pass rate, coverage gaps', icon: 'HealthAndSafety', category: 'quality' },
  { id: 'qa-healing-rules', label: 'Check healing rules', prompt: 'What self-healing rules are active and how have they performed?', icon: 'AutoFixHigh', category: 'healing' },
];

const DEVELOPER: StarterPrompt[] = [
  { id: 'dev-pr-failures', label: 'My PR failures', prompt: 'Analyze test failures related to my recent pull requests', icon: 'Code', category: 'failures' },
  { id: 'dev-broken-tests', label: 'Broken tests in my repos', prompt: 'Show broken tests in repositories I contribute to', icon: 'BugReport', category: 'failures' },
  { id: 'dev-related-jira', label: 'Find related issues', prompt: 'Search Jira for open issues related to recent failures', icon: 'FindInPage', category: 'issues' },
  { id: 'dev-pipeline-status', label: 'Check pipelines', prompt: 'What is the current status of all pipelines?', icon: 'AccountTree', category: 'pipelines' },
  { id: 'dev-fix-prs', label: 'Review open fix PRs', prompt: 'Show open AI-suggested fix PRs and their review status', icon: 'RateReview', category: 'healing' },
  { id: 'dev-debug-timeout', label: 'Debug timeout errors', prompt: 'Find and analyze recent timeout-related test failures', icon: 'Timer', category: 'failures' },
];

const ENGINEERING_LEAD: StarterPrompt[] = [
  { id: 'lead-test-trends', label: 'Show test trends', prompt: 'Show me failure trends for the past 30 days', icon: 'TrendingUp', category: 'analytics' },
  { id: 'lead-pipeline-health', label: 'Pipeline health overview', prompt: 'Give me a health overview of all pipelines — pass rates, avg duration, failures', icon: 'Dashboard', category: 'pipelines' },
  { id: 'lead-cost-summary', label: 'Cost tracker summary', prompt: 'Summarize AI analysis costs this month — total spend, per-provider breakdown, cache hit rate', icon: 'AttachMoney', category: 'cost' },
  { id: 'lead-failure-hotspots', label: 'Team failure hotspots', prompt: 'Identify the top 5 failure hotspots across all teams this week', icon: 'Whatshot', category: 'analytics' },
  { id: 'lead-quarantine-size', label: 'Quarantine queue size', prompt: 'How many tests are quarantined? Show severity breakdown', icon: 'Shield', category: 'healing' },
  { id: 'lead-mttr', label: 'MTTR this week', prompt: 'What is the mean time to resolution for test failures this week?', icon: 'Speed', category: 'analytics' },
];

const PRODUCT_MANAGER: StarterPrompt[] = [
  { id: 'pm-time-saved', label: 'Time saved this week', prompt: 'How much investigation time did the AI save this week?', icon: 'Timer', category: 'metrics' },
  { id: 'pm-resolution-rate', label: 'Failure resolution rate', prompt: 'What percentage of failures were resolved within SLA this month?', icon: 'CheckCircle', category: 'metrics' },
  { id: 'pm-cache-hit-rate', label: 'AI cache hit rate', prompt: 'What is the current AI knowledge base cache hit rate?', icon: 'Cached', category: 'metrics' },
  { id: 'pm-cost-per-analysis', label: 'Cost per analysis', prompt: 'What is the average cost per AI analysis this month?', icon: 'AttachMoney', category: 'cost' },
  { id: 'pm-coverage-trend', label: 'Test coverage trend', prompt: 'Show test coverage trends across all pipelines for the last 30 days', icon: 'TrendingUp', category: 'analytics' },
  { id: 'pm-release-readiness', label: 'Release readiness check', prompt: 'Are all pipelines green? Any blockers for the next release?', icon: 'RocketLaunch', category: 'pipelines' },
];

const GENERIC: StarterPrompt[] = [
  { id: 'gen-analyze-failure', label: 'Analyze last failure', prompt: 'Analyze the most recent test failure and suggest a fix', icon: 'BugReport', category: 'failures' },
  { id: 'gen-test-trends', label: 'Show test trends', prompt: 'Show me failure trends for the past 30 days', icon: 'TrendingUp', category: 'analytics' },
  { id: 'gen-pipelines', label: 'Check pipelines', prompt: 'What is the current status of all pipelines?', icon: 'AccountTree', category: 'pipelines' },
  { id: 'gen-related-issues', label: 'Find related issues', prompt: 'Search Jira for open issues related to recent failures', icon: 'FindInPage', category: 'issues' },
];

// ─── Catalog Lookup ────────────────────────────────────────────

/** Maps user role strings to prompt catalogs. Case-insensitive. */
const ROLE_CATALOG: Record<string, StarterPrompt[]> = {
  // DB role values
  ADMIN: ENGINEERING_LEAD,
  USER: GENERIC,
  // Extended role values (for future role expansion)
  QA: QA_ENGINEER,
  QA_ENGINEER: QA_ENGINEER,
  DEVELOPER: DEVELOPER,
  DEV: DEVELOPER,
  ENGINEERING_LEAD: ENGINEERING_LEAD,
  LEAD: ENGINEERING_LEAD,
  PRODUCT_MANAGER: PRODUCT_MANAGER,
  PM: PRODUCT_MANAGER,
};

/**
 * Get the prompt catalog for a given role.
 * Returns at most `limit` prompts (default 6, for settings UI browsing).
 */
export function getCatalogForRole(role: string, limit = 6): StarterPrompt[] {
  const catalog = ROLE_CATALOG[role.toUpperCase()] ?? GENERIC;
  return catalog.slice(0, limit);
}

/**
 * Get all available prompts across all roles (for admin/settings browsing).
 */
export function getFullCatalog(): Record<string, StarterPrompt[]> {
  return {
    'QA Engineer': QA_ENGINEER,
    Developer: DEVELOPER,
    'Engineering Lead': ENGINEERING_LEAD,
    'Product Manager': PRODUCT_MANAGER,
    Generic: GENERIC,
  };
}

/**
 * Look up a single prompt by ID across all catalogs.
 */
export function getPromptById(id: string): StarterPrompt | undefined {
  const all = [...QA_ENGINEER, ...DEVELOPER, ...ENGINEERING_LEAD, ...PRODUCT_MANAGER, ...GENERIC];
  return all.find(p => p.id === id);
}
