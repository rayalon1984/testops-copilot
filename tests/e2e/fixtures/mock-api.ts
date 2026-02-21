/**
 * E2E Test Fixtures — Mock API helpers for Playwright tests.
 *
 * Provides route interceptors that simulate the backend API for:
 * - Auth (login, /me)
 * - Dashboard data
 * - AI Chat SSE streaming
 * - Pipelines / Test Runs
 */

import { Page } from '@playwright/test';

// ─── Auth Mock ───────────────────────────────────────────────────────

const MOCK_USER = {
  id: 'user-e2e-001',
  email: 'engineer@testops.ai',
  role: 'USER',
};

const MOCK_TOKEN = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.e2e-test-token';

export async function mockAuthAPIs(page: Page): Promise<void> {
  // Login endpoint
  await page.route('**/api/v1/auth/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: { user: MOCK_USER, accessToken: MOCK_TOKEN },
      }),
    });
  });

  // Auth check (/me)
  await page.route('**/api/v1/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { user: MOCK_USER } }),
    });
  });

  // Logout
  await page.route('**/api/v1/auth/logout', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    });
  });
}

// ─── Dashboard & Data Mocks ──────────────────────────────────────────

export async function mockDashboardAPIs(page: Page): Promise<void> {
  // Dashboard stats
  await page.route('**/api/v1/dashboard**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          pipelineCount: 12,
          testRunCount: 245,
          failureRate: 8.3,
          recentRuns: [],
        },
      }),
    });
  });

  // Pipelines
  await page.route('**/api/v1/pipelines**', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            { id: 'p1', name: 'E2E Suite', status: 'PASSED', source: 'github_actions', lastRunAt: '2026-02-20T10:00:00Z' },
            { id: 'p2', name: 'Unit Tests', status: 'FAILED', source: 'jenkins', lastRunAt: '2026-02-20T09:30:00Z' },
          ],
          pagination: { total: 2, page: 1, limit: 20 },
        }),
      });
    }
  });

  // Test runs
  await page.route('**/api/v1/test-runs**', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            { id: 'tr-1', name: 'Run #42', status: 'FAILED', passed: 95, failed: 5, duration: 120, createdAt: '2026-02-20T10:00:00Z' },
          ],
          pagination: { total: 1, page: 1, limit: 20 },
        }),
      });
    }
  });

  // Notifications
  await page.route('**/api/v1/notifications**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [], pagination: { total: 0 } }),
    });
  });

  // AI Personas endpoint
  await page.route('**/api/v1/ai/personas**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          { id: 'SENIOR_ENGINEER', displayName: 'Senior Engineer', description: 'Default technical persona' },
          { id: 'SECURITY_ENGINEER', displayName: 'Security Engineer', description: 'Security specialist' },
          { id: 'TEST_ENGINEER', displayName: 'Test Engineer', description: 'Test & QA specialist' },
        ],
      }),
    });
  });

  // AI cost tracking
  await page.route('**/api/v1/ai/usage**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { totalCost: 42.50, totalTokens: 125000, callCount: 89 } }),
    });
  });

  // Catch-all for other API routes to prevent 404s
  await page.route('**/api/v1/**', async (route) => {
    // Only intercept GET requests that haven't been handled above
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      });
    } else {
      await route.continue();
    }
  });
}

// ─── SSE Chat Mock Helpers ───────────────────────────────────────────

interface SSEEvent {
  type: string;
  data: string;
  tool?: string;
}

/** Format an SSE event string */
function formatSSE(event: SSEEvent): string {
  let line = `data: ${JSON.stringify(event)}\n\n`;
  return line;
}

/** Build a complete SSE stream body from a sequence of events */
export function buildSSEStream(events: SSEEvent[]): string {
  return events.map(formatSSE).join('');
}

// ─── Pre-built SSE Scenarios ─────────────────────────────────────────

/** Simple read-only query: persona → thinking → tool → result → answer */
export const SCENARIO_JIRA_SEARCH: SSEEvent[] = [
  {
    type: 'persona_selected',
    data: JSON.stringify({
      persona: 'SENIOR_ENGINEER',
      displayName: 'Senior Engineer',
      confidence: 0.92,
      reasoning: 'General implementation query',
    }),
  },
  { type: 'thinking', data: 'Searching Jira for recent failures...' },
  { type: 'tool_start', data: 'Searching Jira', tool: 'jira_search' },
  {
    type: 'tool_result',
    data: JSON.stringify({
      summary: 'Found 3 matching issues',
      data: {
        issues: [
          { key: 'PROJ-1248', summary: 'Login timeout on EU region', status: 'Open', assignee: 'jsmith' },
          { key: 'PROJ-1189', summary: 'API latency spike in tax service', status: 'In Progress', assignee: 'alee' },
          { key: 'PROJ-1100', summary: 'Flaky E2E test: checkout flow', status: 'Done', assignee: 'mwong' },
        ],
      },
    }),
    tool: 'jira_search',
  },
  { type: 'answer', data: 'I found 3 Jira issues matching your query. **PROJ-1248** is an open login timeout issue, **PROJ-1189** is an in-progress API latency spike, and **PROJ-1100** is a resolved flaky test.' },
  { type: 'done', data: '' },
];

/** Write tool requiring confirmation: Jira create */
export const SCENARIO_JIRA_CREATE: SSEEvent[] = [
  {
    type: 'persona_selected',
    data: JSON.stringify({
      persona: 'SENIOR_ENGINEER',
      displayName: 'Senior Engineer',
      confidence: 0.88,
      reasoning: 'Jira issue creation request',
    }),
  },
  { type: 'thinking', data: 'I\'ll create a Jira issue for you...' },
  {
    type: 'confirmation_request',
    data: JSON.stringify({
      actionId: 'action-e2e-001',
      tool: 'jira_create_issue',
      args: {
        project: 'PROJ',
        summary: 'E2E Test: Login Timeout Fix',
        description: 'Increase timeout from 2s to 5s for EU region API calls',
        issueType: 'Bug',
      },
      summary: 'Create Jira issue: E2E Test: Login Timeout Fix',
    }),
  },
  { type: 'done', data: '' },
];

/** Proactive suggestion after empty search */
export const SCENARIO_PROACTIVE_SUGGESTION: SSEEvent[] = [
  {
    type: 'persona_selected',
    data: JSON.stringify({
      persona: 'TEST_ENGINEER',
      displayName: 'Test Engineer',
      confidence: 0.95,
      reasoning: 'Test failure investigation query',
    }),
  },
  { type: 'thinking', data: 'Searching for matching test failures...' },
  { type: 'tool_start', data: 'Searching Jira', tool: 'jira_search' },
  {
    type: 'tool_result',
    data: JSON.stringify({ summary: 'No matching issues found', data: { issues: [] } }),
    tool: 'jira_search',
  },
  {
    type: 'proactive_suggestion',
    data: JSON.stringify({
      rule: 'empty_jira_search',
      reason: 'No existing Jira issue found for this failure. Would you like me to create one?',
      tool: 'jira_create_issue',
      preparedArgs: {
        project: 'PROJ',
        summary: 'New: checkout-flow test failure',
        issueType: 'Bug',
      },
      confidence: 0.85,
    }),
  },
  { type: 'answer', data: 'I didn\'t find any existing Jira issues for this failure. I\'ve suggested creating a new one — check the suggestion card above.' },
  { type: 'done', data: '' },
];

/** Tier 1 autonomous action: Jira link + label */
export const SCENARIO_AUTONOMOUS_ACTION: SSEEvent[] = [
  {
    type: 'persona_selected',
    data: JSON.stringify({
      persona: 'SENIOR_ENGINEER',
      displayName: 'Senior Engineer',
      confidence: 0.90,
      reasoning: 'Root cause analysis with housekeeping',
    }),
  },
  { type: 'thinking', data: 'Analyzing root cause and performing housekeeping...' },
  { type: 'tool_start', data: 'Analyzing root cause', tool: 'rca_analyze' },
  {
    type: 'tool_result',
    data: JSON.stringify({
      summary: 'Root Cause: EU API latency spike causing tax_calculation timeout',
      data: { rootCause: 'EU latency spike', confidence: 0.92, category: 'Infrastructure' },
    }),
    tool: 'rca_analyze',
  },
  {
    type: 'autonomous_action',
    data: JSON.stringify({
      summary: 'Linked PROJ-1248 ↔ PROJ-1189 (same root cause)',
      data: { sourceKey: 'PROJ-1248', targetKey: 'PROJ-1189', linkType: 'relates to' },
    }),
    tool: 'jira_link_issues',
  },
  {
    type: 'autonomous_action',
    data: JSON.stringify({
      summary: 'Added label "investigated-by-ai" to PROJ-1248',
      data: { issueKey: 'PROJ-1248', labels: ['investigated-by-ai'] },
    }),
    tool: 'jira_add_label',
  },
  { type: 'answer', data: 'The root cause is an **EU API latency spike** causing the tax_calculation service to timeout. I\'ve automatically linked the related issues and added an investigation label.' },
  { type: 'done', data: '' },
];

/** Security persona routing */
export const SCENARIO_SECURITY_PERSONA: SSEEvent[] = [
  {
    type: 'persona_selected',
    data: JSON.stringify({
      persona: 'SECURITY_ENGINEER',
      displayName: 'Security Engineer',
      confidence: 0.97,
      reasoning: 'Query about authentication vulnerabilities',
    }),
  },
  { type: 'thinking', data: 'Analyzing authentication security posture...' },
  { type: 'answer', data: 'As the **Security Engineer**, I\'ve reviewed the authentication configuration. The SAML implementation uses @node-saml/passport-saml v5, which resolves the critical signature verification vulnerability.' },
  { type: 'done', data: '' },
];

// ─── Chat Route Interceptor ─────────────────────────────────────────

/**
 * Mock the /api/v1/ai/chat SSE endpoint to return a predefined scenario.
 * Each call to this replaces the current chat mock.
 */
export async function mockChatSSE(page: Page, events: SSEEvent[]): Promise<void> {
  await page.route('**/api/v1/ai/chat', async (route) => {
    const body = buildSSEStream(events);
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      headers: {
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
      body,
    });
  });
}

/**
 * Mock the /api/v1/ai/confirm endpoint for write tool confirmations.
 */
export async function mockConfirmAction(page: Page, approved: boolean): Promise<void> {
  await page.route('**/api/v1/ai/confirm', async (route) => {
    if (approved) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { toolName: 'jira_create_issue' },
          toolResult: {
            summary: 'Created PROJ-1299: E2E Test: Login Timeout Fix',
            data: { key: 'PROJ-1299', status: 'Open', url: 'https://jira.example.com/browse/PROJ-1299' },
          },
        }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { status: 'denied' } }),
      });
    }
  });
}

// ─── Full Setup Helper ───────────────────────────────────────────────

/**
 * Sets up all API mocks and logs the user in.
 * After calling this, the page will be at /dashboard with a logged-in user.
 */
export async function setupAuthenticatedSession(page: Page): Promise<void> {
  await mockAuthAPIs(page);
  await mockDashboardAPIs(page);

  // Pre-set the access token so AuthContext picks it up
  await page.addInitScript(() => {
    localStorage.setItem('accessToken', 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.e2e-test-token');
  });
}
