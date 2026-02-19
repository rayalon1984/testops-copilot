/**
 * Mock Tool Results — Realistic demo data for all 18 AI tools.
 *
 * Used in demo/mock mode so the full card experience renders without
 * needing real Jira, GitHub, Jenkins, or Confluence connections.
 * Each entry matches the exact data shape the frontend card expects.
 */

import { ToolResult } from './tools/types';

type MockResultFn = (args: Record<string, unknown>) => ToolResult;

// ─── Read Tools (Phase 1) ───

const jiraSearch: MockResultFn = (args) => ({
    success: true,
    summary: `Found 3 issues matching "${args.query || 'checkout'}"`,
    data: [
        { key: 'TESTOPS-142', summary: 'Flaky: PaymentProcessor.processCheckout timeout', status: 'Open', priority: 'High', assignee: 'Maria Chen', type: 'Bug', labels: ['flaky', 'e2e'] },
        { key: 'TESTOPS-138', summary: 'Cart total miscalculation on discount codes', status: 'In Progress', priority: 'Medium', assignee: 'Jake Torres', type: 'Bug', labels: ['regression'] },
        { key: 'TESTOPS-125', summary: 'Checkout E2E test infrastructure upgrade', status: 'Done', priority: 'Low', assignee: 'Sam Park', type: 'Task', labels: ['infra'] },
    ],
});

const jiraGet: MockResultFn = (args) => ({
    success: true,
    summary: `Retrieved ${args.issueKey || 'TESTOPS-142'}: Flaky PaymentProcessor test`,
    data: {
        key: args.issueKey || 'TESTOPS-142',
        summary: 'Flaky: PaymentProcessor.processCheckout timeout',
        description: 'The test has a 21% failure rate over the last 30 days. Root cause appears to be a race condition in the CSS transition animation.',
        status: 'Open',
        type: 'Bug',
        labels: ['flaky', 'e2e', 'checkout'],
        assignee: 'Maria Chen',
    },
});

const githubGetCommit: MockResultFn = (args) => ({
    success: true,
    summary: `Commit ${String(args.sha || 'a1b2c3d').slice(0, 7)}: Fix checkout timeout race condition`,
    data: {
        message: 'fix(checkout): add waitForVisible before confirm button click\n\nThe #confirm-button was clicked before its opacity transition completed,\ncausing intermittent TimeoutError in PaymentProcessor.processCheckout.',
        filesChanged: 3,
        files: [
            { filename: 'src/pages/Checkout.tsx', status: 'modified', additions: 8, deletions: 2, patch: '@@ -142,7 +142,13 @@\n-    await page.click("#confirm-button");\n+    await page.waitForSelector("#confirm-button", { state: "visible" });\n+    await page.click("#confirm-button");' },
            { filename: 'tests/e2e/checkout.spec.ts', status: 'modified', additions: 3, deletions: 1 },
            { filename: 'src/utils/wait-helpers.ts', status: 'added', additions: 15, deletions: 0 },
        ],
    },
});

const githubGetPR: MockResultFn = (args) => ({
    success: true,
    summary: `PR #${args.prNumber || 487}: Fix flaky checkout test`,
    data: {
        number: Number(args.prNumber) || 487,
        title: 'fix(checkout): resolve flaky PaymentProcessor timeout',
        author: 'maria-chen',
        url: 'https://github.com/testops/app/pull/487',
        state: 'open',
    },
});

const confluenceSearch: MockResultFn = (args) => ({
    success: true,
    summary: `Found 2 docs matching "${args.query || 'checkout'}"`,
    data: [
        { id: 'doc-001', title: 'Checkout Service — Architecture & Test Strategy', url: 'https://confluence.example.com/pages/checkout-arch', excerpt: 'The checkout flow uses a 3-stage pipeline: cart validation, payment processing, and order confirmation. E2E tests cover the happy path and 4 error scenarios.', labels: ['architecture', 'checkout'] },
        { id: 'doc-002', title: 'Flaky Test Runbook', url: 'https://confluence.example.com/pages/flaky-runbook', excerpt: 'Step-by-step guide for diagnosing and fixing flaky tests. Common causes: race conditions, network timeouts, shared state leaks between tests.', labels: ['runbook', 'testing'] },
    ],
});

const jenkinsGetStatus: MockResultFn = (args) => ({
    success: true,
    summary: `Pipeline "${args.pipelineName || 'checkout-e2e'}": 2 of last 5 runs failed`,
    data: {
        pipeline: { name: args.pipelineName || 'checkout-e2e' },
        recentRuns: [
            { id: 'run-501', name: 'Build #501', status: 'PASSED', branch: 'main', passed: 142, failed: 0, skipped: 3, duration: 185000 },
            { id: 'run-500', name: 'Build #500', status: 'FAILED', branch: 'main', passed: 139, failed: 3, skipped: 3, duration: 210000 },
            { id: 'run-499', name: 'Build #499', status: 'PASSED', branch: 'main', passed: 142, failed: 0, skipped: 3, duration: 178000 },
            { id: 'run-498', name: 'Build #498', status: 'PASSED', branch: 'feature/checkout-fix', passed: 142, failed: 0, skipped: 3, duration: 192000 },
            { id: 'run-497', name: 'Build #497', status: 'FAILED', branch: 'main', passed: 138, failed: 4, skipped: 3, duration: 225000 },
        ],
    },
});

const dashboardMetrics: MockResultFn = () => ({
    success: true,
    summary: 'Dashboard: 94.2% pass rate across 12 active pipelines',
    data: {
        timeRange: 'Last 7 Days',
        totalTestRuns: 847,
        passedRuns: 798,
        failedRuns: 49,
        passRate: '94.2%',
        failuresArchived: 127,
        activePipelines: 12,
    },
});

const failurePredictions: MockResultFn = () => ({
    success: true,
    summary: '3 tests flagged high risk, failure trend increasing',
    data: {
        scores: [
            { testName: 'PaymentProcessor.processCheckout', score: 87, level: 'CRITICAL', prediction: 'Likely to fail in next 3 builds based on 21% recent failure rate and increasing trend.' },
            { testName: 'UserAuth.loginWithSSO', score: 62, level: 'HIGH' },
            { testName: 'CartService.applyDiscount', score: 45, level: 'MODERATE' },
            { testName: 'SearchIndex.reindex', score: 18, level: 'LOW' },
        ],
    },
});

// ─── Write Tools (Phase 2) — mock results after confirmation approval ───

const jiraCreateIssue: MockResultFn = (args) => ({
    success: true,
    summary: `Created TESTOPS-156: ${args.summary || 'New issue'}`,
    data: {
        key: 'TESTOPS-156',
        summary: args.summary || 'Fix flaky test PaymentProcessor.processCheckout',
        status: 'To Do',
        type: args.type || 'Bug',
        url: 'https://jira.example.com/browse/TESTOPS-156',
    },
});

const jiraTransitionIssue: MockResultFn = (args) => ({
    success: true,
    summary: `Transitioned ${args.issueKey || 'TESTOPS-142'} to ${args.transition || 'In Progress'}`,
    data: {
        key: args.issueKey || 'TESTOPS-142',
        previousStatus: 'Open',
        newStatus: args.transition || 'In Progress',
    },
});

const jiraComment: MockResultFn = (args) => ({
    success: true,
    summary: `Added comment to ${args.issueKey || 'TESTOPS-142'}`,
    data: {
        key: args.issueKey || 'TESTOPS-142',
        commentId: 'comment-789',
        body: args.comment || 'Investigating the flaky test failure.',
    },
});

const githubCreatePR: MockResultFn = (args) => ({
    success: true,
    summary: `Created PR #492: ${args.title || 'Fix checkout timeout'}`,
    data: {
        number: 492,
        title: args.title || 'fix: resolve flaky checkout test',
        url: 'https://github.com/testops/app/pull/492',
        state: 'open',
    },
});

const githubCreateBranch: MockResultFn = (args) => ({
    success: true,
    summary: `Created branch ${args.branchName || 'fix/checkout-flaky'}`,
    data: {
        branch: args.branchName || 'fix/checkout-flaky',
        baseBranch: args.baseBranch || 'main',
        sha: 'e4f5a6b',
    },
});

const githubUpdateFile: MockResultFn = (args) => ({
    success: true,
    summary: `Updated ${args.path || 'src/Checkout.tsx'} on ${args.branch || 'fix/checkout-flaky'}`,
    data: {
        path: args.path || 'src/pages/Checkout.tsx',
        branch: args.branch || 'fix/checkout-flaky',
        commitSha: 'f7g8h9i',
        message: args.message || 'fix: add waitForVisible before click',
    },
});

const jenkinsTriggerBuild: MockResultFn = (args) => ({
    success: true,
    summary: `Triggered build for ${args.pipelineName || 'checkout-e2e'} on ${args.branch || 'main'}`,
    data: {
        testRunId: 'run-502',
        pipeline: args.pipelineName || 'checkout-e2e',
        branch: args.branch || 'main',
        status: 'PENDING',
    },
});

const testrunCancel: MockResultFn = (args) => ({
    success: true,
    summary: `Cancelled test run ${args.testRunId || 'run-500'}`,
    data: { testRunId: args.testRunId || 'run-500', status: 'CANCELLED' },
});

const testrunRetry: MockResultFn = (args) => ({
    success: true,
    summary: `Retrying test run ${args.testRunId || 'run-500'}`,
    data: { testRunId: args.testRunId || 'run-500', newRunId: 'run-503', status: 'PENDING' },
});

const githubRerunWorkflow: MockResultFn = (args) => ({
    success: true,
    summary: `Re-ran workflow ${args.workflowId || 'ci.yml'} on ${args.branch || 'main'}`,
    data: {
        owner: args.owner || 'testops',
        repo: args.repo || 'app',
        workflowId: args.workflowId || 'ci.yml',
        branch: args.branch || 'main',
        status: 'queued',
    },
});

// ─── Registry ───

const MOCK_TOOL_RESULTS: Record<string, MockResultFn> = {
    // Phase 1: Read
    jira_search: jiraSearch,
    jira_get: jiraGet,
    github_get_commit: githubGetCommit,
    github_get_pr: githubGetPR,
    confluence_search: confluenceSearch,
    jenkins_get_status: jenkinsGetStatus,
    dashboard_metrics: dashboardMetrics,
    failure_predictions: failurePredictions,
    // Phase 2: Write
    jira_create_issue: jiraCreateIssue,
    jira_transition_issue: jiraTransitionIssue,
    jira_comment: jiraComment,
    github_create_pr: githubCreatePR,
    github_create_branch: githubCreateBranch,
    github_update_file: githubUpdateFile,
    // Phase 3: Actions
    jenkins_trigger_build: jenkinsTriggerBuild,
    testrun_cancel: testrunCancel,
    testrun_retry: testrunRetry,
    github_rerun_workflow: githubRerunWorkflow,
};

/**
 * Get a mock tool result for demo mode.
 * Returns null if no mock is available (tool executes normally).
 */
export function getMockToolResult(toolName: string, args: Record<string, unknown>): ToolResult | null {
    const fn = MOCK_TOOL_RESULTS[toolName];
    return fn ? fn(args) : null;
}
