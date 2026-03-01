/**
 * Direct text responses for starter prompts that benefit from rich markdown
 * answers rather than tool card UIs. Extracted from MockProvider.
 *
 * Architecture: data-driven response table keeps the lookup function short
 * while each response block lives as a named constant.
 */

// ─── Response constants ───────────────────────────────────────────────

const QUARANTINE_QUEUE =
    '## Quarantine Queue\n\n' +
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

const SELF_HEALING =
    '## Self-Healing Rules\n\n' +
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

const HEALTH_CHECK =
    '## Test Suite Health Check\n\n' +
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

const COST_SUMMARY =
    '## AI Cost Summary — This Month\n\n' +
    '| Provider | Analyses | Cost | Avg/Analysis |\n' +
    '|----------|----------|------|--------------|\n' +
    '| Claude 3.5 Sonnet | 342 | $18.74 | $0.055 |\n' +
    '| GPT-4o | 128 | $12.30 | $0.096 |\n' +
    '| Gemini 1.5 | 87 | $4.22 | $0.049 |\n' +
    '| **Total** | **557** | **$35.26** | **$0.063** |\n\n' +
    '**Cache hit rate:** 67.3% (saved ~$71 in duplicate analyses)\n\n' +
    '**Budget status:** $35.26 / $100.00 (35.3% used, 22 days remaining)\n\n' +
    'Costs are trending 12% lower than last month thanks to improved caching. Want a per-team breakdown?';

const MTTR =
    '## Mean Time to Resolution — This Week\n\n' +
    '| Priority | MTTR | Target SLA | Status |\n' +
    '|----------|------|-----------|--------|\n' +
    '| 🔴 Critical | **2h 14m** | 4h | ✅ Within SLA |\n' +
    '| 🟠 High | **6h 38m** | 8h | ✅ Within SLA |\n' +
    '| 🟡 Medium | **18h 22m** | 24h | ✅ Within SLA |\n' +
    '| 🟢 Low | **3d 4h** | 5d | ✅ Within SLA |\n\n' +
    '**Overall MTTR: 8h 42m** (↘️ 23% faster than last week)\n\n' +
    'AI-assisted investigations resolved **34% faster** than manual ones. The checkout team has the fastest resolution times.';

const TIME_SAVINGS =
    '## AI Time Savings — This Week\n\n' +
    '| Activity | Manual Estimate | AI-Assisted | Saved |\n' +
    '|----------|----------------|-------------|-------|\n' +
    '| Failure triage | 12.5h | 3.2h | **9.3h** |\n' +
    '| Root cause analysis | 8.0h | 2.1h | **5.9h** |\n' +
    '| Jira ticket creation | 3.5h | 0.4h | **3.1h** |\n' +
    '| Fix suggestion review | 6.0h | 1.8h | **4.2h** |\n' +
    '| **Total** | **30.0h** | **7.5h** | **22.5h** |\n\n' +
    '**ROI:** 22.5 hours saved × $85/hr avg = **$1,912 this week**\n\n' +
    'Self-healing auto-fixed 110 failures without any human intervention, saving an additional ~15h.';

const CACHE_PERFORMANCE =
    '## AI Knowledge Base Performance\n\n' +
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

const RELEASE_READINESS =
    '## Release Readiness Check\n\n' +
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

const RESOLUTION_RATE =
    '## Failure Resolution Rate — This Month\n\n' +
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

const COVERAGE_TREND =
    '## Test Coverage Trends — Last 30 Days\n\n' +
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

const BROKEN_TESTS =
    '## Broken Tests in Your Repositories\n\n' +
    '**5 tests currently failing** across 3 repos:\n\n' +
    '| Test | Repo | Failing Since | Cause |\n' +
    '|------|------|--------------|-------|\n' +
    '| `PaymentProcessor.processCheckout` | app | 2 days | Race condition |\n' +
    '| `UserAuth.loginWithSSO` | auth-service | 1 day | SSO provider timeout |\n' +
    '| `CartService.applyDiscount` | app | 3 days | Rounding error |\n' +
    '| `WebSocket.handleConnection` | realtime-svc | 5 hours | Connection pool exhaustion |\n' +
    '| `SearchAPI.fuzzyMatch` | search-service | 1 day | Index not refreshed |\n\n' +
    'The PaymentProcessor test has the highest impact (CRITICAL risk score). Want me to analyze it or create a fix PR?';

const FIX_PRS =
    '## Open AI-Suggested Fix PRs\n\n' +
    '| PR | Title | Status | Confidence |\n' +
    '|----|-------|--------|------------|\n' +
    '| #492 | fix(checkout): add waitForVisible | 🟡 Awaiting review | 94% |\n' +
    '| #489 | fix(auth): increase SSO timeout to 10s | 🟢 Approved | 88% |\n' +
    '| #487 | fix(cart): use Decimal for discount calc | 🟡 Changes requested | 91% |\n\n' +
    '**Summary:** 3 open fix PRs, 1 approved and ready to merge.\n\n' +
    'PR #489 has been approved — want me to merge it?';

const TIMEOUT_FAILURES =
    '## Timeout-Related Failures (Last 7 Days)\n\n' +
    '**12 timeout failures** detected across 4 test suites:\n\n' +
    '| Test | Timeout | Frequency | Root Cause |\n' +
    '|------|---------|-----------|------------|\n' +
    '| `UserAuth.loginWithSSO` | 5000ms | 8 failures | OAuth provider latency |\n' +
    '| `PaymentGateway.charge` | 3000ms | 2 failures | Stripe API slow |\n' +
    '| `SearchAPI.reindex` | 10000ms | 1 failure | Large dataset |\n' +
    '| `WebSocket.connect` | 2000ms | 1 failure | Connection pool full |\n\n' +
    '**Pattern:** 67% of timeouts occur during peak load (2-4pm UTC)\n\n' +
    '**Recommendation:** Increase SSO timeout from 5s to 10s — a fix PR is already open (#489). Want me to merge it?';

// ─── Response lookup table ────────────────────────────────────────────

interface DirectResponseRule {
    match: (text: string) => boolean;
    response: string;
}

const DIRECT_RESPONSE_RULES: DirectResponseRule[] = [
    { match: (t) => t.includes('quarantine'), response: QUARANTINE_QUEUE },
    { match: (t) => t.includes('healing') || t.includes('self-healing') || t.includes('auto-fix'), response: SELF_HEALING },
    { match: (t) => t.includes('health check') || t.includes('suite health') || (t.includes('health') && t.includes('test')), response: HEALTH_CHECK },
    { match: (t) => t.includes('cost') || t.includes('spend') || t.includes('budget'), response: COST_SUMMARY },
    { match: (t) => t.includes('mttr') || t.includes('mean time') || t.includes('time to resolution') || t.includes('time to fix'), response: MTTR },
    { match: (t) => t.includes('time saved') || t.includes('investigation time') || t.includes('hours saved'), response: TIME_SAVINGS },
    { match: (t) => t.includes('cache hit') || t.includes('hit rate') || t.includes('knowledge base'), response: CACHE_PERFORMANCE },
    { match: (t) => t.includes('release readiness') || t.includes('ready to release') || t.includes('blocker') || t.includes('green light'), response: RELEASE_READINESS },
    { match: (t) => t.includes('resolution rate') || t.includes('resolved') || t.includes('within sla'), response: RESOLUTION_RATE },
    { match: (t) => t.includes('coverage trend') || t.includes('test coverage'), response: COVERAGE_TREND },
    { match: (t) => t.includes('broken test') || t.includes('broken tests'), response: BROKEN_TESTS },
    { match: (t) => t.includes('fix pr') || t.includes('fix prs') || t.includes('suggested fix') || t.includes('ai-suggested'), response: FIX_PRS },
    { match: (t) => t.includes('timeout') && !t.includes('trigger'), response: TIMEOUT_FAILURES },
];

// ─── Public lookup ────────────────────────────────────────────────────

/**
 * Returns a rich markdown response for starter-prompt keywords, or null
 * if no direct response matches (caller should fall through to tool intent).
 */
export function getDirectResponse(text: string): string | null {
    for (const rule of DIRECT_RESPONSE_RULES) {
        if (rule.match(text)) return rule.response;
    }
    return null;
}
