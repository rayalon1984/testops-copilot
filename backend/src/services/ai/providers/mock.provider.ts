/**
 * MockProvider — Full-spectrum demo provider for TestOps Copilot.
 *
 * Returns native toolCalls matching realistic user intents so the
 * complete card experience renders without a real LLM or external APIs.
 * Covers all 22 registered tools across 8 services.
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
    /** Optional: build dynamic args from the user's message instead of using static `args`. */
    argBuilder?: (userContent: string) => Record<string, unknown>;
}

const INTENT_RULES: IntentRule[] = [
    // ── Read tools (Phase 1) ──

    // Dashboard / overview — broad catch for "how are things"
    { primary: ['dashboard', 'overview', 'summary', 'metrics', 'stats', 'status report'],
      tool: 'dashboard_metrics', args: {},
      preamble: 'Let me pull up the dashboard metrics for you.' },

    // Predictions / risk / flaky
    { primary: ['predict', 'risk', 'forecast', 'anomaly', 'flaky', 'flakiest', 'flakiness'],
      tool: 'failure_predictions', args: {},
      preamble: 'I\'ll check the predictive failure analysis.' },

    // Failure trends / hotspots
    { primary: ['trend', 'hotspot', 'hot spot'],
      tool: 'failure_predictions', args: {},
      preamble: 'Analyzing failure trends and hotspots.' },

    // Jenkins / pipeline / build status
    { primary: ['pipeline', 'build', 'jenkins', 'ci', 'cd', 'workflow status'],
      secondary: ['status', 'check', 'how', 'show', 'get', 'recent', 'last', 'health', 'overview', 'green', 'all'],
      tool: 'jenkins_get_status', args: { pipelineName: 'checkout-e2e' },
      preamble: 'Checking the pipeline status.' },

    // Broken tests
    { primary: ['broken test', 'broken tests', 'failing test', 'failing tests'],
      tool: 'failure_predictions', args: {},
      preamble: 'Looking for broken and failing tests across your repositories.' },

    // Fix PRs / suggested fixes
    { primary: ['fix pr', 'fix prs', 'suggested fix', 'ai-suggested', 'open fix'],
      tool: 'github_get_pr', args: { owner: 'testops', repo: 'app', prNumber: 487 },
      preamble: 'Looking up AI-suggested fix PRs.' },

    // Timeout / debug
    { primary: ['timeout', 'timed out', 'debug timeout'],
      tool: 'jira_search', args: { query: 'timeout failure' },
      preamble: 'Searching for timeout-related test failures.' },

    // Confluence / docs / runbook
    { primary: ['doc', 'documentation', 'runbook', 'confluence', 'wiki', 'guide'],
      tool: 'confluence_search', args: { query: 'checkout test flaky runbook' },
      preamble: 'Searching Confluence for relevant documentation.' },

    // GitHub PR
    { primary: ['pull request', 'pr '],
      secondary: ['get', 'show', 'find', 'check', 'review', 'what', 'my', 'related', 'recent'],
      tool: 'github_get_pr', args: { owner: 'testops', repo: 'app', prNumber: 487 },
      preamble: 'Looking up the pull request.' },

    // GitHub commit / diff review
    { primary: ['commit', 'change', 'diff', 'what changed', 'code change'],
      secondary: ['get', 'show', 'find', 'check', 'last', 'recent', 'review'],
      tool: 'github_get_commit', args: { owner: 'testops', repo: 'app', sha: 'a1b2c3d' },
      preamble: 'Fetching the commit details.' },

    // Jira search
    { primary: ['jira', 'issue', 'ticket', 'bug'],
      secondary: ['search', 'find', 'related', 'look', 'any', 'show', 'list', 'open'],
      tool: 'jira_search', args: { query: 'checkout flaky' },
      preamble: 'Searching Jira for related issues.' },

    // Jira get (specific ticket)
    { primary: ['testops-', 'proj-', 'jira-', 'issue key', 'get issue', 'show issue', 'get ticket'],
      tool: 'jira_get', args: { issueKey: 'TESTOPS-142' },
      preamble: 'Retrieving the issue details.' },

    // Giphy — celebratory / fun personality layer (Sprint 7, housekeeping tier)
    { primary: ['gif', 'giphy', 'celebrate', 'celebration', 'meme', 'fun', 'party', 'hooray', 'woohoo'],
      tool: 'giphy_search', args: { query: 'celebration' },
      preamble: 'Let me find a fun GIF for that!',
      argBuilder: (text) => {
          // Extract contextual query: "gif about success" → "success", "celebrate a fix" → "fix_merged"
          const aboutMatch = text.match(/gif\s+(?:about|for|of)\s+(.+)/i);
          if (aboutMatch) return { query: aboutMatch[1].trim() };
          // Map matched keywords to curated categories
          if (['success', 'pass', 'passed', 'nailed', 'thumbs up', 'approve'].some(k => text.includes(k))) return { query: 'all_tests_passed' };
          if (['fail', 'failure', 'error', 'broken', 'bug', 'fire'].some(k => text.includes(k))) return { query: 'pipeline_broken' };
          if (['fix', 'merged', 'ship', 'deploy', 'release'].some(k => text.includes(k))) return { query: 'fix_merged' };
          if (['party', 'hooray', 'woohoo', 'celebrate', 'celebration'].some(k => text.includes(k))) return { query: 'celebration' };
          return { query: 'celebration' };
      } },

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

    // Merge PR
    { primary: ['merge'],
      secondary: ['pr', 'pull request', 'fix'],
      tool: 'github_merge_pr',
      args: { owner: 'testops', repo: 'app', prNumber: 489, mergeMethod: 'squash' },
      preamble: 'I\'ll merge the approved PR for you.' },

    // Rerun GitHub workflow
    { primary: ['rerun', 're-run', 'restart'],
      secondary: ['workflow', 'action', 'github action'],
      tool: 'github_rerun_workflow',
      args: { owner: 'testops', repo: 'app', workflowId: 'ci.yml', branch: 'main' },
      preamble: 'Re-running the GitHub Actions workflow.' },

    // ── Catch-all: RCA / explain / why — triggers 3-card analysis chain ──
    { primary: ['explain', 'why', 'cause', 'reason', 'analyze', 'failure', 'failed', 'investigate'],
      tool: 'rca_identify', args: { testName: 'PaymentProcessor.processCheckout' },
      preamble: 'Let me investigate the root cause of this failure.' },
];

// ─── Wrap-up responses after tool results ───

const TOOL_SUMMARIES: Record<string, string> = {
    rca_identify: 'Root cause identified. The service timed out due to missing config. Let me check if there\'s already a fix PR.',
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
    github_merge_pr: 'PR **#489** has been merged via squash into `main`. The fix increases the SSO timeout from 5s to 10s. The branch has been automatically deleted.',
    giphy_search: 'Here\'s a celebratory GIF! Enjoy the moment.',
    jira_link_issues: 'Jira tickets linked. I\'ve connected the related issues so the team can see the full picture. The root cause, fix PR, and tracking tickets are now all cross-referenced.',
    jira_add_label: 'Labels added. The issue is now tagged for easier filtering and triage.',
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

        // After tool result → chain the analysis flow or provide a wrap-up
        if (lastMessage.role === 'tool') {
            const toolName = lastMessage.name || '';

            // ── Analysis flow chaining: rca_identify → github_get_pr → jira_link_issues ──
            if (toolName === 'rca_identify') {
                return this.makeToolCallResponse({
                    primary: [], tool: 'github_get_pr',
                    args: { owner: 'testops', repo: 'app', prNumber: 402 },
                    preamble: 'Found the root cause. Let me pull up the proposed fix PR.',
                });
            }

            if (toolName === 'github_get_pr' && this.isAnalysisFlow(messages)) {
                return this.makeToolCallResponse({
                    primary: [], tool: 'jira_link_issues',
                    args: { sourceKey: 'PROJ-1247', targetKeys: ['PROJ-1248'], linkType: 'relates to' },
                    preamble: 'PR ready for review. Now linking the related Jira tickets.',
                });
            }

            // Analysis-flow wrap-up: after the full 3-card chain, provide a rich summary
            if (toolName === 'jira_link_issues' && this.isAnalysisFlow(messages)) {
                return this.makeResponse(
                    '**Analysis complete.** Here\'s what I found and did:\n\n' +
                    '1. **Root cause**: The `tax_calculation` service timed out due to missing EU config data\n' +
                    '2. **Fix PR #402**: Increases the timeout from 2s → 5s for EU regions — ready for review\n' +
                    '3. **Jira housekeeping**: Linked PROJ-1247 ↔ PROJ-1248 for traceability\n\n' +
                    'Want me to **merge the PR** or **create a follow-up ticket** for the EU config gap?',
                    200,
                );
            }

            // Default wrap-up
            const wrapUp = TOOL_SUMMARIES[toolName]
                || 'Done! The action completed successfully. Is there anything else I can help with?';

            return this.makeResponse(wrapUp, 200);
        }

        // Strip [UI Context: ...] prefix so intent matching uses only the user's actual query
        const rawContent = lastMessage.content.replace(/^\[UI Context:[^\]]*\]\s*/i, '');
        const userContent = rawContent.toLowerCase();

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

        // ── Direct rich responses for starter prompts that don't need tool cards ──
        const directResponse = this.getDirectResponse(userContent);
        if (directResponse) {
            return this.makeResponse(directResponse, 250);
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
                return this.makeToolCallResponse(rule, userContent);
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

    /**
     * Direct text responses for starter prompts that benefit from rich markdown
     * answers rather than tool card UIs. Checked BEFORE intent rules.
     */
    private getDirectResponse(text: string): string | null {
        // Quarantine queue
        if (text.includes('quarantine')) {
            return '## Quarantine Queue\n\n' +
                '**9 tests** currently quarantined across 3 pipelines:\n\n' +
                '| Test | Severity | Days in Quarantine | Reinstatement |\n' +
                '|------|----------|-------------------|---------------|\n' +
                '| `PaymentProcessor.processCheckout` | 🔴 CRITICAL | 12 | Not ready — 87% failure rate |\n' +
                '| `UserAuth.loginWithSSO` | 🟠 HIGH | 8 | Review needed — 62% failure rate |\n' +
                '| `CartService.applyDiscount` | 🟡 MODERATE | 5 | Almost ready — 2 consecutive passes |\n' +
                '| `SearchAPI.fuzzyMatch` | 🟢 LOW | 3 | Ready for reinstatement |\n' +
                '| `NotificationService.sendEmail` | 🟢 LOW | 2 | Ready for reinstatement |\n\n' +
                '**Severity breakdown:** 1 Critical, 1 High, 3 Moderate, 4 Low\n\n' +
                'Want me to reinstate the tests that are ready, or review the critical ones?';
        }

        // Self-healing rules
        if (text.includes('healing') || text.includes('self-healing') || text.includes('auto-fix')) {
            return '## Self-Healing Rules\n\n' +
                '**8 active rules** (4 built-in, 4 custom):\n\n' +
                '| Rule | Type | Matches (7d) | Auto-fixed | Success Rate |\n' +
                '|------|------|-------------|------------|-------------|\n' +
                '| Connection Timeout Retry | Built-in | 23 | 21 | 91% |\n' +
                '| Database Lock Recovery | Built-in | 15 | 14 | 93% |\n' +
                '| Flaky UI Element Wait | Built-in | 31 | 28 | 90% |\n' +
                '| OOM Heap Increase | Built-in | 8 | 7 | 88% |\n' +
                '| Payment Gateway Retry | Custom | 12 | 11 | 92% |\n' +
                '| Auth Token Refresh | Custom | 19 | 18 | 95% |\n' +
                '| Rate Limit Backoff | Custom | 7 | 7 | 100% |\n' +
                '| Selenium Grid Reconnect | Custom | 5 | 4 | 80% |\n\n' +
                '**Overall:** 120 matches → 110 auto-fixed (**91.7% success rate**)\n\n' +
                'The Selenium Grid rule has the lowest success rate. Want me to review its pattern or suggest improvements?';
        }

        // Health check / test health
        if (text.includes('health check') || text.includes('suite health') || (text.includes('health') && text.includes('test'))) {
            return '## Test Suite Health Check\n\n' +
                '| Metric | Value | Trend |\n' +
                '|--------|-------|-------|\n' +
                '| Pass Rate | **94.2%** | ↗️ +1.3% vs last week |\n' +
                '| Flakiness Rate | **3.8%** | ↘️ -0.5% (improving) |\n' +
                '| Avg Duration | **4m 32s** | → Stable |\n' +
                '| Coverage | **78.4%** | ↗️ +2.1% |\n' +
                '| Quarantined | **9 tests** | ↘️ -2 reinstated |\n\n' +
                '**Coverage gaps detected:**\n' +
                '- `src/services/payment/` — 42% coverage (below 60% threshold)\n' +
                '- `src/api/webhooks/` — 38% coverage (no tests for retry logic)\n\n' +
                '**Top concern:** PaymentProcessor.processCheckout has an 87/100 risk score. Want me to investigate?';
        }

        // Cost / spend / budget
        if (text.includes('cost') || text.includes('spend') || text.includes('budget')) {
            return '## AI Cost Summary — This Month\n\n' +
                '| Provider | Analyses | Cost | Avg/Analysis |\n' +
                '|----------|----------|------|--------------|\n' +
                '| Claude 3.5 Sonnet | 342 | $18.74 | $0.055 |\n' +
                '| GPT-4o | 128 | $12.30 | $0.096 |\n' +
                '| Gemini 1.5 | 87 | $4.22 | $0.049 |\n' +
                '| **Total** | **557** | **$35.26** | **$0.063** |\n\n' +
                '**Cache hit rate:** 67.3% (saved ~$71 in duplicate analyses)\n\n' +
                '**Budget status:** $35.26 / $100.00 (35.3% used, 22 days remaining)\n\n' +
                'Costs are trending 12% lower than last month thanks to improved caching. Want a per-team breakdown?';
        }

        // MTTR / resolution time
        if (text.includes('mttr') || text.includes('mean time') || text.includes('time to resolution') || text.includes('time to fix')) {
            return '## Mean Time to Resolution — This Week\n\n' +
                '| Priority | MTTR | Target SLA | Status |\n' +
                '|----------|------|-----------|--------|\n' +
                '| 🔴 Critical | **2h 14m** | 4h | ✅ Within SLA |\n' +
                '| 🟠 High | **6h 38m** | 8h | ✅ Within SLA |\n' +
                '| 🟡 Medium | **18h 22m** | 24h | ✅ Within SLA |\n' +
                '| 🟢 Low | **3d 4h** | 5d | ✅ Within SLA |\n\n' +
                '**Overall MTTR: 8h 42m** (↘️ 23% faster than last week)\n\n' +
                'AI-assisted investigations resolved **34% faster** than manual ones. The checkout team has the fastest resolution times.';
        }

        // Time saved / ROI
        if (text.includes('time saved') || text.includes('investigation time') || text.includes('hours saved')) {
            return '## AI Time Savings — This Week\n\n' +
                '| Activity | Manual Estimate | AI-Assisted | Saved |\n' +
                '|----------|----------------|-------------|-------|\n' +
                '| Failure triage | 12.5h | 3.2h | **9.3h** |\n' +
                '| Root cause analysis | 8.0h | 2.1h | **5.9h** |\n' +
                '| Jira ticket creation | 3.5h | 0.4h | **3.1h** |\n' +
                '| Fix suggestion review | 6.0h | 1.8h | **4.2h** |\n' +
                '| **Total** | **30.0h** | **7.5h** | **22.5h** |\n\n' +
                '**ROI:** 22.5 hours saved × $85/hr avg = **$1,912 this week**\n\n' +
                'Self-healing auto-fixed 110 failures without any human intervention, saving an additional ~15h.';
        }

        // Cache hit rate
        if (text.includes('cache hit') || text.includes('hit rate') || text.includes('knowledge base')) {
            return '## AI Knowledge Base Performance\n\n' +
                '| Metric | Value |\n' +
                '|--------|-------|\n' +
                '| Cache hit rate | **67.3%** |\n' +
                '| Unique failure signatures | 142 |\n' +
                '| RCA documents indexed | 89 |\n' +
                '| Avg lookup time | 45ms |\n' +
                '| Cost savings from cache | ~$71/month |\n\n' +
                '**Top cached patterns:**\n' +
                '1. Connection timeout → retry with backoff (34 hits)\n' +
                '2. Stale element reference → re-query DOM (28 hits)\n' +
                '3. Database lock → sequential execution (19 hits)\n\n' +
                'The knowledge base is improving — hit rate was 52% last month.';
        }

        // Release readiness
        if (text.includes('release readiness') || text.includes('ready to release') || text.includes('blocker') || text.includes('green light')) {
            return '## Release Readiness Check\n\n' +
                '| Pipeline | Status | Pass Rate | Blockers |\n' +
                '|----------|--------|-----------|----------|\n' +
                '| checkout-e2e | 🟡 Warning | 91.2% | 2 flaky tests |\n' +
                '| auth-service | 🟢 Ready | 99.1% | None |\n' +
                '| payment-api | 🟢 Ready | 97.8% | None |\n' +
                '| search-service | 🟢 Ready | 98.5% | None |\n' +
                '| notification-svc | 🟡 Warning | 93.4% | 1 timeout |\n\n' +
                '**Verdict: 🟡 Conditional Go**\n\n' +
                '3 of 5 pipelines are green. 2 have warnings but no critical blockers.\n\n' +
                '**Action items:**\n' +
                '- Quarantine `PaymentProcessor.processCheckout` (flaky, not a real bug)\n' +
                '- Investigate notification timeout (new since last deploy)\n\n' +
                'Want me to quarantine the flaky test and clear the path?';
        }

        // Resolution rate / SLA
        if (text.includes('resolution rate') || text.includes('resolved') || text.includes('within sla')) {
            return '## Failure Resolution Rate — This Month\n\n' +
                '| Metric | Value |\n' +
                '|--------|-------|\n' +
                '| Total failures | **247** |\n' +
                '| Resolved | **231** (93.5%) |\n' +
                '| Within SLA | **218** (88.3%) |\n' +
                '| Auto-healed | **110** (44.5%) |\n' +
                '| Still open | **16** |\n\n' +
                '**Breakdown by resolution method:**\n' +
                '- 🤖 Self-healing auto-fix: 110 (47.6%)\n' +
                '- 🧑‍💻 AI-assisted manual: 89 (38.5%)\n' +
                '- 🔧 Manual only: 32 (13.9%)\n\n' +
                'SLA compliance is up from 82% last month. The self-healing rules are making the biggest impact.';
        }

        // Coverage trend
        if (text.includes('coverage trend') || text.includes('test coverage')) {
            return '## Test Coverage Trends — Last 30 Days\n\n' +
                '| Week | Coverage | Delta | New Tests |\n' +
                '|------|----------|-------|-----------|\n' +
                '| Week 1 | 74.2% | — | 12 |\n' +
                '| Week 2 | 75.8% | +1.6% | 18 |\n' +
                '| Week 3 | 77.1% | +1.3% | 15 |\n' +
                '| Week 4 | **78.4%** | +1.3% | 14 |\n\n' +
                '**Trend: ↗️ Steady improvement** (+4.2% over 30 days)\n\n' +
                '**Low-coverage areas:**\n' +
                '- `payment/webhooks` — 38% (needs webhook retry tests)\n' +
                '- `auth/sso` — 45% (SSO edge cases untested)\n' +
                '- `search/fuzzy` — 52% (missing boundary tests)\n\n' +
                'Want me to create Jira tickets for the coverage gaps?';
        }

        // Broken tests in repos
        if (text.includes('broken test') || text.includes('broken tests')) {
            return '## Broken Tests in Your Repositories\n\n' +
                '**5 tests currently failing** across 3 repos:\n\n' +
                '| Test | Repo | Failing Since | Cause |\n' +
                '|------|------|--------------|-------|\n' +
                '| `PaymentProcessor.processCheckout` | app | 2 days | Race condition |\n' +
                '| `UserAuth.loginWithSSO` | auth-service | 1 day | SSO provider timeout |\n' +
                '| `CartService.applyDiscount` | app | 3 days | Rounding error |\n' +
                '| `WebSocket.handleConnection` | realtime-svc | 5 hours | Connection pool exhaustion |\n' +
                '| `SearchAPI.fuzzyMatch` | search-service | 1 day | Index not refreshed |\n\n' +
                'The PaymentProcessor test has the highest impact (CRITICAL risk score). Want me to analyze it or create a fix PR?';
        }

        // Fix PRs / suggested fixes
        if (text.includes('fix pr') || text.includes('fix prs') || text.includes('suggested fix') || text.includes('ai-suggested')) {
            return '## Open AI-Suggested Fix PRs\n\n' +
                '| PR | Title | Status | Confidence |\n' +
                '|----|-------|--------|------------|\n' +
                '| #492 | fix(checkout): add waitForVisible | 🟡 Awaiting review | 94% |\n' +
                '| #489 | fix(auth): increase SSO timeout to 10s | 🟢 Approved | 88% |\n' +
                '| #487 | fix(cart): use Decimal for discount calc | 🟡 Changes requested | 91% |\n\n' +
                '**Summary:** 3 open fix PRs, 1 approved and ready to merge.\n\n' +
                'PR #489 has been approved — want me to merge it?';
        }

        // Timeout debugging
        if (text.includes('timeout') && !text.includes('trigger')) {
            return '## Timeout-Related Failures (Last 7 Days)\n\n' +
                '**12 timeout failures** detected across 4 test suites:\n\n' +
                '| Test | Timeout | Frequency | Root Cause |\n' +
                '|------|---------|-----------|------------|\n' +
                '| `UserAuth.loginWithSSO` | 5000ms | 8 failures | OAuth provider latency |\n' +
                '| `PaymentGateway.charge` | 3000ms | 2 failures | Stripe API slow |\n' +
                '| `SearchAPI.reindex` | 10000ms | 1 failure | Large dataset |\n' +
                '| `WebSocket.connect` | 2000ms | 1 failure | Connection pool full |\n\n' +
                '**Pattern:** 67% of timeouts occur during peak load (2-4pm UTC)\n\n' +
                '**Recommendation:** Increase SSO timeout from 5s to 10s — a fix PR is already open (#489). Want me to merge it?';
        }

        return null;
    }

    /** Check if the conversation is in an analysis flow (rca_identify was called). */
    private isAnalysisFlow(messages: ChatMessage[]): boolean {
        return messages.some(m => m.role === 'tool' && m.name === 'rca_identify');
    }

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

    private makeToolCallResponse(rule: IntentRule, userContent?: string): AIResponse {
        const args = rule.argBuilder && userContent
            ? rule.argBuilder(userContent)
            : rule.args;

        const toolCall: ToolCall = {
            id: `mock_${rule.tool}_${Date.now()}`,
            name: rule.tool,
            arguments: args,
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
