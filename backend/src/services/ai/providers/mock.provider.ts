/**
 * MockProvider — Full-spectrum demo provider for TestOps Copilot.
 *
 * Returns native toolCalls matching realistic user intents so the
 * complete card experience renders without a real LLM or external APIs.
 * Covers all 18 registered tools across 8 services.
 */

import { BaseProvider, ProviderConfig, ProviderLimits, ProviderPricing, CompletionOptions, EmbeddingOptions } from './base.provider';
import { AIProviderName, AIResponse, ChatMessage, ToolCall } from '../types';

// ─── Intent → Tool mapping ───

interface IntentRule {
    primary: string[];
    secondary?: string[];
    tool: string;
    args: Record<string, unknown>;
    preamble: string; // text before tool call
}

const INTENT_RULES: IntentRule[] = [
    // ── Read tools (Phase 1) ──

    // Dashboard / overview — broad catch for "how are things"
    { primary: ['dashboard', 'overview', 'summary', 'metrics', 'stats', 'status report'],
      tool: 'dashboard_metrics', args: {},
      preamble: 'Let me pull up the dashboard metrics for you.' },

    // Predictions / risk
    { primary: ['predict', 'risk', 'forecast', 'trend', 'anomaly', 'flaky'],
      tool: 'failure_predictions', args: {},
      preamble: 'I\'ll check the predictive failure analysis.' },

    // Jenkins / pipeline / build status
    { primary: ['pipeline', 'build', 'jenkins', 'ci', 'cd', 'workflow status'],
      secondary: ['status', 'check', 'how', 'show', 'get', 'recent', 'last'],
      tool: 'jenkins_get_status', args: { pipelineName: 'checkout-e2e' },
      preamble: 'Checking the pipeline status.' },

    // Confluence / docs / runbook
    { primary: ['doc', 'documentation', 'runbook', 'confluence', 'wiki', 'guide'],
      tool: 'confluence_search', args: { query: 'checkout test flaky runbook' },
      preamble: 'Searching Confluence for relevant documentation.' },

    // GitHub PR
    { primary: ['pull request', 'pr ', 'merge request'],
      secondary: ['get', 'show', 'find', 'check', 'review', 'what'],
      tool: 'github_get_pr', args: { owner: 'testops', repo: 'app', prNumber: 487 },
      preamble: 'Looking up the pull request.' },

    // GitHub commit
    { primary: ['commit', 'change', 'diff', 'what changed', 'code change'],
      secondary: ['get', 'show', 'find', 'check', 'last', 'recent'],
      tool: 'github_get_commit', args: { owner: 'testops', repo: 'app', sha: 'a1b2c3d' },
      preamble: 'Fetching the commit details.' },

    // Jira search
    { primary: ['jira', 'issue', 'ticket', 'bug'],
      secondary: ['search', 'find', 'related', 'look', 'any', 'show', 'list'],
      tool: 'jira_search', args: { query: 'checkout flaky' },
      preamble: 'Searching Jira for related issues.' },

    // Jira get (specific ticket)
    { primary: ['testops-', 'proj-', 'jira-', 'issue key', 'get issue', 'show issue', 'get ticket'],
      tool: 'jira_get', args: { issueKey: 'TESTOPS-142' },
      preamble: 'Retrieving the issue details.' },

    // ── Write tools (Phase 2) — these trigger confirmation previews ──

    // Trigger build / re-run pipeline
    { primary: ['trigger', 're-run', 'rerun', 'start', 'kick off', 'launch'],
      secondary: ['build', 'pipeline', 'ci', 'jenkins', 'workflow'],
      tool: 'jenkins_trigger_build', args: { pipelineName: 'checkout-e2e', branch: 'main' },
      preamble: 'I\'ll trigger a new build for you.' },

    // Retry test
    { primary: ['retry', 'rerun'],
      secondary: ['test', 'run', 'failed'],
      tool: 'testrun_retry', args: { testRunId: 'run-500' },
      preamble: 'I\'ll retry the failed test run.' },

    // Cancel test
    { primary: ['cancel', 'stop', 'abort', 'kill'],
      secondary: ['test', 'run', 'build'],
      tool: 'testrun_cancel', args: { testRunId: 'run-500' },
      preamble: 'I\'ll cancel that test run.' },

    // Create Jira issue
    { primary: ['create', 'open', 'file', 'make', 'new'],
      secondary: ['jira', 'ticket', 'issue', 'bug', 'task'],
      tool: 'jira_create_issue',
      args: { summary: 'Fix flaky test PaymentProcessor.processCheckout', description: 'The test has a 21% failure rate. Root cause: race condition in CSS transition animation on #confirm-button.', type: 'Bug', priority: 'High' },
      preamble: 'I\'ll create a Jira issue with the failure details.' },

    // Transition Jira issue
    { primary: ['transition', 'move', 'change status', 'progress', 'close', 'resolve'],
      secondary: ['issue', 'ticket', 'jira', 'testops'],
      tool: 'jira_transition_issue',
      args: { issueKey: 'TESTOPS-142', transition: 'In Progress' },
      preamble: 'I\'ll transition the issue for you.' },

    // Comment on Jira
    { primary: ['comment', 'note', 'update'],
      secondary: ['jira', 'issue', 'ticket', 'testops'],
      tool: 'jira_comment',
      args: { issueKey: 'TESTOPS-142', comment: 'Investigating: race condition in CSS transition on #confirm-button. Fix PR incoming.' },
      preamble: 'Adding a comment to the issue.' },

    // Create PR
    { primary: ['create', 'open', 'make'],
      secondary: ['pr', 'pull request', 'merge request'],
      tool: 'github_create_pr',
      args: { owner: 'testops', repo: 'app', title: 'fix(checkout): resolve flaky PaymentProcessor timeout', body: 'Adds waitForVisible before confirm button click.', head: 'fix/checkout-flaky', base: 'main' },
      preamble: 'I\'ll create a pull request with the fix.' },

    // Create branch
    { primary: ['create', 'make', 'new'],
      secondary: ['branch'],
      tool: 'github_create_branch',
      args: { owner: 'testops', repo: 'app', branchName: 'fix/checkout-flaky', baseBranch: 'main' },
      preamble: 'Creating a new branch for the fix.' },

    // Update file
    { primary: ['update', 'edit', 'change', 'modify', 'fix'],
      secondary: ['file', 'code', 'source'],
      tool: 'github_update_file',
      args: { owner: 'testops', repo: 'app', path: 'src/pages/Checkout.tsx', content: 'await page.waitForSelector("#confirm-button", { state: "visible" });', message: 'fix: add waitForVisible', branch: 'fix/checkout-flaky' },
      preamble: 'I\'ll update the file with the fix.' },

    // Rerun GitHub workflow
    { primary: ['rerun', 're-run', 'restart'],
      secondary: ['workflow', 'action', 'github action'],
      tool: 'github_rerun_workflow',
      args: { owner: 'testops', repo: 'app', workflowId: 'ci.yml', branch: 'main' },
      preamble: 'Re-running the GitHub Actions workflow.' },

    // ── Catch-all: RCA / explain / why ──
    { primary: ['explain', 'why', 'cause', 'reason', 'analyze', 'failure', 'failed', 'investigate'],
      tool: 'jira_search', args: { query: 'checkout test failure' },
      preamble: 'Let me investigate. First, I\'ll search for related issues.' },
];

// ─── Wrap-up responses after tool results ───

const TOOL_SUMMARIES: Record<string, string> = {
    jira_search: 'I found **3 related Jira issues**. TESTOPS-142 looks directly related — it\'s a flaky checkout test with a 21% failure rate. Want me to transition it to "In Progress" or pull up more details?',
    jira_get: 'Here are the full details for this issue. The flakiness is caused by a race condition in the CSS transition. Maria Chen is already assigned. Want me to add a comment with the latest analysis?',
    github_get_commit: 'This commit addresses the flaky checkout test by adding `waitForVisible` before the confirm button click. 3 files changed across the checkout page, test spec, and a new wait helper utility.',
    github_get_pr: 'The PR is open and ready for review. It targets `main` from the fix branch. Want me to check the pipeline status for this PR?',
    confluence_search: 'Found 2 relevant docs: the Checkout Architecture guide and the Flaky Test Runbook. The runbook has a step-by-step guide for exactly this type of race condition.',
    jenkins_get_status: 'The **checkout-e2e** pipeline shows 2 failures in the last 5 runs. Build #500 and #497 both failed with 3-4 test failures. The latest build (#501) is green. Want me to check the risk predictions?',
    dashboard_metrics: 'Overall health looks good: **94.2% pass rate** across 847 test runs this week. 12 active pipelines, 49 failures archived. The checkout pipeline is the main contributor to the failure count.',
    failure_predictions: '3 tests are flagged as high risk:\n- **PaymentProcessor.processCheckout** (87/100 - CRITICAL)\n- **UserAuth.loginWithSSO** (62/100 - HIGH)\n- **CartService.applyDiscount** (45/100 - MODERATE)\n\nThe checkout test has a 21% failure rate and an increasing trend. Want me to create a Jira ticket or trigger a build?',
    jira_create_issue: 'Jira ticket **TESTOPS-156** has been created. It\'s filed as a High-priority Bug and assigned to the checkout team. Want me to also create a branch and PR with the fix?',
    jira_transition_issue: 'Done — TESTOPS-142 has been moved to **In Progress**. I\'ll add a comment with the investigation notes.',
    jira_comment: 'Comment added to TESTOPS-142 with the latest analysis. The team will be notified.',
    github_create_pr: 'PR **#492** has been created: "fix(checkout): resolve flaky PaymentProcessor timeout". It targets `main` from `fix/checkout-flaky`. Ready for review.',
    github_create_branch: 'Branch `fix/checkout-flaky` has been created from `main`. Ready for commits.',
    github_update_file: 'Updated `src/pages/Checkout.tsx` on branch `fix/checkout-flaky`. The fix adds `waitForVisible` before the confirm button click.',
    jenkins_trigger_build: 'Build triggered for **checkout-e2e** on `main`. It\'s now in PENDING status. I\'ll check back once it completes.',
    testrun_cancel: 'Test run cancelled successfully. The run has been marked as CANCELLED.',
    testrun_retry: 'Retrying the failed test run. A new run has been queued as PENDING.',
    github_rerun_workflow: 'GitHub Actions workflow `ci.yml` has been re-triggered on `main`. It should start shortly.',
};

// ─── Provider ───

export class MockProvider extends BaseProvider {
    constructor(config: ProviderConfig) {
        super(config);
    }

    getName(): AIProviderName {
        return 'mock';
    }

    getPricing(): ProviderPricing {
        return { inputTokenCostPer1k: 0, outputTokenCostPer1k: 0, embeddingCostPer1k: 0 };
    }

    getLimits(): ProviderLimits {
        return { maxInputTokens: 100000, maxOutputTokens: 100000, requestsPerMinute: 1000, tokensPerMinute: 1000000 };
    }

    async chat(messages: ChatMessage[], _options?: CompletionOptions): Promise<AIResponse> {
        const lastMessage = messages[messages.length - 1];

        // After tool result → provide a contextual wrap-up answer
        if (lastMessage.role === 'tool') {
            const toolName = lastMessage.name || '';
            const wrapUp = TOOL_SUMMARIES[toolName]
                || 'Done! The action completed successfully. Is there anything else I can help with?';

            return this.makeResponse(wrapUp, 200);
        }

        const userContent = lastMessage.content.toLowerCase();

        // Greeting
        if (this.matchesAny(userContent, ['hi', 'hello', 'hey', 'greetings', 'good morning', 'good afternoon'])) {
            return this.makeResponse(
                "Hello! I'm your **TestOps AI Copilot**. Here's what I can do:\n\n" +
                "- **Search Jira** — *\"Find issues related to checkout\"*\n" +
                "- **Check pipelines** — *\"Show pipeline status\"*\n" +
                "- **View metrics** — *\"Dashboard overview\"*\n" +
                "- **Predict failures** — *\"Which tests are at risk?\"*\n" +
                "- **Create tickets** — *\"Create a Jira bug for the flaky test\"*\n" +
                "- **Trigger builds** — *\"Re-run the checkout pipeline\"*\n" +
                "- **Search docs** — *\"Find the flaky test runbook\"*\n\n" +
                "Try any of these, or ask me anything about your test failures!",
                150,
            );
        }

        // Help
        if (this.matchesAny(userContent, ['help', 'what can you do', 'capabilities', 'commands'])) {
            return this.makeResponse(
                "I'm an **agentic AI** with 18 tools across Jira, GitHub, Jenkins, Confluence, and more.\n\n" +
                "**Read tools** (instant results):\n" +
                "- `jira_search` / `jira_get` — Search and view Jira issues\n" +
                "- `github_get_commit` / `github_get_pr` — Inspect code changes\n" +
                "- `jenkins_get_status` — Pipeline build history\n" +
                "- `confluence_search` — Documentation lookup\n" +
                "- `dashboard_metrics` — Test health overview\n" +
                "- `failure_predictions` — Risk scores and trend analysis\n\n" +
                "**Write tools** (with confirmation):\n" +
                "- Create/transition/comment on Jira issues\n" +
                "- Create branches, PRs, update files on GitHub\n" +
                "- Trigger/cancel/retry builds and test runs\n\n" +
                "Just describe what you need in plain language!",
                100,
            );
        }

        // Match intent → tool call
        for (const rule of INTENT_RULES) {
            if (this.matchesIntent(userContent, rule.primary, rule.secondary)) {
                return this.makeToolCallResponse(rule);
            }
        }

        // Fallback
        return this.makeResponse(
            "I'm running in **Demo Mode** — no LLM connected. I respond to specific intents:\n\n" +
            "Try: *\"Show dashboard metrics\"*, *\"Search Jira for checkout issues\"*, " +
            "*\"Check pipeline status\"*, *\"Which tests are at risk?\"*, " +
            "*\"Create a Jira bug\"*, *\"Trigger a build\"*, or *\"Find the runbook\"*.\n\n" +
            "Switch to a real AI provider using the picker in the header for full natural language understanding.",
            100,
        );
    }

    async embed(_text: string, _options?: EmbeddingOptions): Promise<number[]> {
        return new Array(1536).fill(0).map(() => Math.random());
    }

    async healthCheck(): Promise<boolean> {
        return true;
    }

    // ─── Helpers ───

    private matchesAny(text: string, keywords: string[]): boolean {
        return keywords.some(k => text.includes(k));
    }

    private matchesIntent(text: string, primary: string[], secondary?: string[]): boolean {
        const hasPrimary = primary.some(k => text.includes(k));
        if (!hasPrimary) return false;
        if (!secondary || secondary.length === 0) return true;
        return secondary.some(k => text.includes(k));
    }

    private makeResponse(content: string, delayMs: number): AIResponse {
        return {
            content,
            provider: 'mock',
            model: 'mock-demo-v2',
            cost: { inputCost: 0, outputCost: 0, totalCost: 0 },
            usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
            cached: false,
            responseTimeMs: delayMs,
        };
    }

    private makeToolCallResponse(rule: IntentRule): AIResponse {
        const toolCall: ToolCall = {
            id: `mock_${rule.tool}_${Date.now()}`,
            name: rule.tool,
            arguments: rule.args,
        };

        return {
            content: rule.preamble,
            toolCalls: [toolCall],
            provider: 'mock',
            model: 'mock-demo-v2',
            cost: { inputCost: 0, outputCost: 0, totalCost: 0 },
            usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
            cached: false,
            responseTimeMs: 300,
        };
    }
}
