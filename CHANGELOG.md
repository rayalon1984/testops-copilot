# Changelog

All notable changes to TestOps Copilot (formerly TestOps Companion) are documented here.
Versions follow [Semantic Versioning](https://semver.org/).
Beta releases are pre-release builds on the path to production GA.

---

## [3.4.0] - 2026-03-02

> **Xray Deep Integration + Card Graduation + RC Hardening**

v3.4 completes the Xray Cloud story and graduates the V2 card system. Every test run can now auto-sync to Xray on completion, test plans are browsable directly from Settings, and AI failure analysis pulls Xray test case history as a 4th enrichment source.

### Auto-Sync to Xray

- **Fire-and-forget**: When enabled, `completeTestRun` pushes results to Xray automatically with trigger=AUTO. Sync failures are logged but never block completion.
- **Admin toggle**: `PATCH /xray/config` flips auto-sync on/off from the Settings UI.
- **Trigger tracking**: Sync history table shows Manual vs Auto trigger for every sync record.

### Test Plan Browser

- **Paginated list**: `GET /xray/test-plans` returns plans with coverage percentage.
- **Drill-down**: Click any plan row to expand and see its test cases.
- **Coverage bars**: Visual progress bars show pass rate at a glance.

### AI Enrichment Pipeline

Xray is now the 4th parallel source in the context enrichment pipeline:

- Runs alongside Jira, Confluence, and GitHub via `Promise.allSettled`.
- Gated: only fires when `externalTestCaseId` is present and Xray is enabled.
- Failure-isolated: Xray errors never block other enrichment sources.

### Dedicated Xray Cards

Two new copilot result cards replace GenericResultCard for Xray tools:

- **XraySearchCard**: Renders test case results with status chips, test plan results with coverage bars.
- **XrayHistoryCard**: Shows execution timeline as date+status chips and linked defects.

### V2 Card Graduation

The `copilot-cards-v2` feature flag has been removed. V2 is now the only card style:

- Feature flag deleted, V1 `GitHubPRCard` removed.
- `ToolResultCard` switch simplified — no conditional routing.
- XraySync -> TestRun FK relation with cascade delete across all 3 Prisma schemas.

### RC Hardening

Full audit uncovered and resolved 5 issues:

- **HIGH**: Added EDITOR authorization to `POST /sync/:testRunId`.
- Jira key format validation (multi-segment: `PROJ-TC-1`).
- Sync history limit param wired through Zod schema.
- `completeTestRun` status validation with `ValidationError`.
- Rollback error handling in `syncTestRun` (try/catch on failure update).

### Quality

- 967 tests passing (822 backend + 145 frontend)
- 320 feature spec assertions — invariants at 100%, behavioral 90%, contracts 95%
- All CI green: Backend, Frontend, Feature Spec Validation, Installation Test
- Zero lint warnings, zero typecheck errors

---

## [3.3.0] - 2026-03-02

> **Xray Cloud Integration + Context-Aware Prompts**

TestOps Copilot now talks to Xray. Push test results to Xray Cloud with one click, search test cases from the AI copilot, and track every sync in a unified history. No more copy-pasting between tools.

### Xray Cloud Integration

Connect your Xray Cloud instance and sync test results directly from Copilot:

- **One-click sync**: "Sync to Xray" button on every test run detail page — maps PASSED→PASS, FAILED→FAIL, SKIPPED→TODO and creates a linked Test Execution in Xray
- **AI-powered search**: Ask the copilot "find Xray test cases for checkout" — the new `xray_search` tool queries Xray's API and returns matching cases with status and last execution date
- **Settings & connection testing**: New Xray tab in Settings with one-click connection validation, sync history table, and status tracking (SYNCED / FAILED / SYNCING)
- **Resilient by design**: OAuth2 authentication with token caching, circuit breaker (opens after 5 failures), retry with backoff, SSRF validation on configurable URLs

### Context-Aware Starter Prompts (Tier 2)

The copilot empty state now reacts to what's happening in your system. Five live signals surface the right prompt at the right time:

- **New failures detected** — when tests fail in the last hour
- **Quarantine needs review** — when 3+ tests are quarantined
- **Pipeline failures trending** — when 5+ runs fail in 24h
- **Xray sync failures** — when Xray syncs fail in the last 24h
- **Flaky test spike** — when 10+ flaky results detected in 24h

Each signal appears with a "Live" badge and is prioritized between user pins and role defaults.

### Quality

- 930 tests passing (787 backend + 143 frontend)
- 246/246 feature spec assertions at 100% coverage
- 28 Xray assertions + 33 starter prompt assertions (draft specs, fully tested)

---

## [3.1.1] - 2026-03-01

> **QA Fixes + Smart Starter Prompts Spec**

### Bug Fixes
- **CSRF stateless mode**: Fixed HMAC mismatch caused by `saveUninitialized: false` — switched to stateless session identifier
- **Auth route CSRF exemption**: Login, register, and refresh endpoints no longer require CSRF tokens
- **Chat CSRF failure**: `useAICopilot` SSE hook now sends `X-CSRF-Token` header and `credentials: 'include'` (was bypassing centralized API client)
- **E2E selector mismatch**: Updated 12 placeholder selectors from `"Ask Copilot..."` to `"Let's TOC... ask about a failing test"`
- **Playwright config**: Added `testMatch`/`testIgnore` to prevent backend test file pickup

### Specs & Planning
- **Smart Starter Prompts**: Added `specs/features/smart-starter-prompts.feature.yaml` — role-based default prompts + user-configurable pins (targeting v3.2.0)
- **Roadmap**: Added v3.2.0 planned section for Smart Starter Prompts

---

## [3.1.0] - 2026-02-27

> **Self-Healing Pipelines + "Let's TOC" Branding**

### Self-Healing Pipelines (3-Phase Architecture)

TestOps Copilot now detects and recovers from transient CI failures automatically:

- **Phase 1 — Auto-Retry**: 8 built-in transient patterns (network timeout, Docker rate limit, npm registry, Selenium stale element, DNS failure, OOM, disk space, flaky timeout) with circuit breaker (max 2 retries/pipeline/hour) and autonomy-aware execution
- **Phase 2 — Flaky Test Quarantine**: Auto-quarantine flaky tests with severity scoring, occurrence tracking, and reinstate/delete operations
- **Phase 3 — AI-Suggested Fix PRs**: Match failures against documented RCAs using fuzzy similarity, surface fix suggestions with repository context

New Prisma models: `HealingRule`, `HealingEvent`, `QuarantinedTest`. 17 REST endpoints at `/api/v1/healing`. Self-Healing dashboard page with 3 tabs (Rules & Events | Quarantine | Fix Suggestions). 24 unit tests for pattern matching and built-in rules.

### "Let's TOC" Branding

The AI copilot chat now uses the "Let's TOC" catchphrase (TOC = TestOps Copilot, pronounced "talk"):
- Chat input placeholder: "Let's TOC... ask about a failing test"
- Empty state greeting: "Let's TOC"
- Thinking indicator: "TOCing" instead of "Thinking"

### Codebase Quality Refactoring

- Dead dependency removal (axios, react-toastify)
- Missing FK indexes on JiraIssue
- N+1 query guards (bounded includes)
- CI parallelization
- Component splits (Settings, useAICopilot)
- God-service splits (validation.ts, AI routes)
- React Query migration (zero raw-fetch holdouts)
- Fuzzy matching wired end-to-end
- 812 tests passing (675 backend + 137 frontend), zero lint warnings

---

## [3.0.1] - 2026-02-26

> **TestOps Copilot — The Rebrand Release**

### Rebrand: TestOps Companion → TestOps Copilot

The platform has earned its name. With 9 AI personas, graduated autonomy, and an agentic copilot that investigates failures before you even open your laptop — this is a copilot, not a companion. Every user-facing string, API title, email footer, JWT claim, package name, and documentation page now reflects the new identity.

**Migration note for existing users**: See [MIGRATION.md](docs/MIGRATION.md) for details on JWT re-authentication and encrypted config compatibility.

### Bedrock Embedding Support (Amazon Titan V2)

The `embed()` method is no longer a stub. Bedrock users can now generate vector embeddings via Amazon Titan Embeddings V2 (`amazon.titan-embed-text-v2:0`), enabling semantic failure matching and knowledge base search on AWS infrastructure. Configurable via `AWS_BEDROCK_EMBEDDING_MODEL` env var. No new SDK dependencies — uses the same `@aws-sdk/client-bedrock-runtime` and `InvokeModelCommand`.

### Redis/CSRF Clarification

The v3.0.0 release notes incorrectly stated "Production mode requires Redis for CSRF session validation." In reality, CSRF protection uses a stateless double-submit cookie pattern and works without Redis. Sessions already fell back to MemoryStore silently — now the backend logs a clear `warn` message at startup when Redis is unavailable, explaining the impact (session loss on restart) and confirming CSRF is unaffected.

### E2E Tests in CI

Playwright E2E tests now run in CI via `.github/workflows/e2e.yml`, triggered on PRs that touch `frontend/` or `tests/e2e/`. Three spec files (sanity, AI write flow, copilot agentic) run against a mock API layer — no backend required. Reports are uploaded as artifacts.

### Documentation

- Added **EPR-014** (silent session store fallback), **EPR-015** (CI release notes overwrite), **EPR-016** (monorepo lint-staged path resolution) to LESSONS_LEARNED.md
- Updated Automated Guards table with Playwright E2E and release notes guard
- Comprehensive rename across 60+ files (source, docs, specs, configs, infra)

---

## [3.0.0] - 2026-02-26

> **TestOps Companion v3 — Your Test Failures Now Have a Detective on Payroll**

### Highlights

Your CI pipeline breaks at 2 AM. By the time you open your laptop, the AI copilot has already searched Jira for similar failures, pulled the relevant Confluence runbook, identified the root cause from your failure knowledge base, and is waiting with a one-click fix. You review it, hit approve, and move on with your coffee.

That's TestOps Companion v3. Four betas, four release candidates, and a full security audit later — it's ready.

### Your AI Team, Not Just a Chatbot

Every query is routed to the right specialist before a single token is generated. Ask about flaky tests? **Test Engineer** handles it. Pipeline broken? **DevOps Engineer**. Security concern? **Security Engineer**. Nine personas, each with domain expertise baked into their system prompts.

The routing is two-tier: keyword matching fires in under 1ms at zero cost. When that misses, a lightweight LLM micro-classification kicks in (~200 tokens). You see who's handling your query in real time: *"Test Engineer is on it."*

### Graduated Autonomy — You Set the Dial

Not everyone wants the same level of AI independence. v3 gives you three modes:

- **Conservative** — AI investigates and recommends. You approve everything.
- **Balanced** — Low-risk actions (searches, reads, labels) execute automatically. Team-visible actions show a one-click approval card.
- **Autonomous** — The AI handles what it can, escalates what it should. Destructive actions always require your sign-off.

22 tools. 8 auto-execute. 11 with tiered approval. 3 housekeeping. Every write operation goes through a human-in-the-loop confirmation gate with a 5-minute TTL.

### Bring Your Own Provider

Hot-swap AI providers mid-conversation from the in-chat picker:

| Provider | What You Get |
|----------|-------------|
| **Anthropic Claude** | Direct API — Opus, Sonnet, Haiku |
| **AWS Bedrock** | Claude models via IAM role auth — no API keys needed in AWS environments |
| **OpenAI** | GPT-4o, o1 |
| **Google Gemini** | Gemini Pro, Flash |
| **Azure OpenAI** | Enterprise Azure deployments |
| **OpenRouter** | 100+ models through a single gateway |

New in this release: **AWS Bedrock** with full chat, tool calling, and health check support. IAM role authentication means zero credential management when running in AWS.

### Test Intelligence That Learns

Your failure knowledge base gets smarter with every test run:

- **Predictive Failure Analysis** — Risk scores per test, trend aggregation, z-score anomaly detection that catches problems before they become patterns
- **Flaky Test Detection** — Statistical scoring across historical pass/fail data surfaces the tests you can't trust
- **Smart Test Selection** — Changed 3 files? The platform tells you which 12 of your 400 tests actually need to run
- **Failure Fingerprinting** — Same root cause, different stack trace? The knowledge base links them automatically

### Production-Hardened

This isn't a prototype. v3 went through a dedicated security audit in rc.3:

- SQL injection prevention (Prisma.sql tagged templates — no more raw queries)
- CSRF protection (double-submit cookie pattern)
- Redis-backed sessions with automatic token blacklisting
- Structured logging with request correlation (every request gets an `X-Request-ID` you can trace end-to-end)
- Deep health checks: `/health/ready` (DB + Redis), `/health/live` (liveness), `/health/full` (all services including AI providers)
- Clean `npm audit` at high severity — the 8 remaining moderates are ESLint devDeps with zero production exposure

### CI That Catches What Humans Miss

- **Commitlint + lint-staged** enforce conventional commits — no more "fix stuff" messages
- **Architectural lint** blocks layer violations before they reach code review
- **Code health check** flags oversized files and functions with baseline tracking
- **Schema parity gate** catches drift between dev and production Prisma schemas
- **Bug tracker workflow** auto-labels `fix(` PRs and links them to open issues
- **Living Feature Specs** — 16 features, 229 machine-readable assertions, 100% scanner pass. Your specs aren't documentation — they're tests.

### Get Running in 2 Minutes

```bash
git clone https://github.com/rayalon1984/testops-copilot.git
cd testops-copilot && npm install && npm run dev:simple
```

No PostgreSQL. No Redis. No API keys. SQLite + mock AI provider. Login with `engineer@testops.ai` / `demo123` and start talking to the copilot.

For production deployments with real AI providers: **[Production Quickstart](docs/PRODUCTION_QUICKSTART.md)**

### Known Limitations

- **Production mode requires Redis** for CSRF session validation — this is by design. Session security demands a persistent store. Demo mode works without it.
- **Bedrock embedding** is not yet supported — `embed()` throws with guidance to use Amazon Titan Embeddings directly. Chat and tool calling work fully.
- **E2E tests** (Playwright) are available but not part of the default CI gate — run with `npm run test:e2e`.

### The Numbers

| Gate | Status |
|------|--------|
| Tests | **760 passing** (40 backend suites + 13 frontend suites) |
| TypeScript | Zero errors |
| Build | All 3 packages compile |
| Lint | Clean |
| Architecture | No layer violations |
| Health | All functions within limits |
| Spec Scanner | 229/229 assertions (100%) |
| Security Audit | 0 high/critical |

### The Road Here

| Milestone | Date | What Changed |
|-----------|------|-------------|
| beta.1 | 2026-02-20 | Agentic copilot, ReAct loop, 22 tools, persona routing, graduated autonomy |
| beta.2 | 2026-02-20 | 10 Playwright E2E smoke tests |
| beta.3 | 2026-02-20 | Onboarding wizard, budget indicator, smart error recovery |
| beta.4 | 2026-02-21 | Living Feature Specs — machine-readable acceptance criteria |
| rc.1 | 2026-02-21 | Specs complete, CI release workflow stabilized |
| rc.2 | 2026-02-21 | Full beta coverage — 16 features, 229 assertions |
| rc.3 | 2026-02-23 | Security hardening & production readiness audit |
| rc.4 | 2026-02-26 | AWS Bedrock integration, CI quality gates, bug tracking |

### Breaking Changes

None. All new features are additive. Existing API contracts are fully backward compatible with v2.x.

---

## [3.0.0-rc.4] - 2026-02-26

> **AWS Bedrock Integration, CI Quality Gates & Bug Tracking**

### Highlights

AWS Bedrock joins the provider fleet — full chat, tool calling, and health check support with IAM role-based auth. CI gets commitlint + lint-staged enforcement, automated bug labeling, and retroactive issue tracking for institutional memory.

### AI Provider: AWS Bedrock

- **BedrockProvider** — Full implementation extending `BaseProvider` with `chat()`, `embed()` (throws with guidance), and `healthCheck()`
- **IAM + explicit auth** — Falls back to IAM role when no explicit credentials provided; supports `AWS_BEDROCK_ACCESS_KEY_ID` / `AWS_BEDROCK_SECRET_ACCESS_KEY` for local dev
- **Refactored for health compliance** — `chat()` extracted into 3 focused helpers (`convertMessages`, `buildToolSchemas`, `parseResponseContent`) to stay under 80-line function limit
- **Frontend ProviderPicker** — Bedrock added with Claude Opus 4, Sonnet 4.5, and Haiku 4.5 model options
- **22 unit tests** — Constructor variants, pricing tiers, chat flow, tool calling, health check, error handling
- **Docs updated** — `AI_TOOLS.md` provider registry, `.env.example` with Bedrock env vars

### CI & Quality Gates

- **Bug Tracker workflow** — Auto-labels `fix(` PRs with `bug` label; comments on PRs touching files with open issues
- **Commitlint + lint-staged** — Conventional commit enforcement via husky pre-commit and commit-msg hooks
- **lint-staged monorepo fix** — eslint runs from subdirectory context so tsconfig resolves correctly
- **Bug report template** — Enhanced with Break Once prevention fields (root cause, prevention guard)
- **PR template** — Added "Break Once, Never Again" section for bug fix PRs

### Security

- **Rollup CVE remediation** — Frontend high-severity vulnerability patched

### Quality Gates

| Gate | Status |
|------|--------|
| Tests | **760 passing** (38 backend suites + 13 frontend suites) |
| TypeScript | Zero errors |
| Build | All packages compile |
| Lint | Clean |
| Architecture | No violations |
| Health | All functions within limits |

---

## [3.0.0-rc.3] - 2026-02-23

> **Security Hardening & Production Readiness Audit**

### Highlights

Full audit of unified remediation plan (Phase 1 + Phase 2). All 9 items verified, 3 gaps closed, specs updated, and 706 tests passing (571 backend + 135 frontend).

### Security (Phase 1 — Release Blockers)

- **SQL Injection Prevention** — `$queryRawUnsafe` replaced with `$queryRaw` + Prisma.sql tagged templates in prediction analysis (1.1)
- **Secrets Hygiene** — `.env.dev` removed from git tracking; `.env.dev.example` with safe placeholders provided (1.2)
- **CSRF Protection** — Double-submit cookie via `csrf-csrf`; `X-CSRF-Token` header on all state-changing requests; webhook routes exempted (1.3)
- **Redis Session Store** — `connect-redis` enabled in production; MemoryStore fallback for dev; `SESSION_SECRET` now required with no default (1.4)

### Hardening (Phase 2 — Critical Improvements)

- **Structured Logging** — All `console.log/error/warn` replaced with winston logger (only `tracing.ts` exempted) (2.1)
- **Input Validation** — Zod schemas on all Monday.com POST/PUT routes (2.2)
- **Safe parseInt** — `safeParseInt()` utility with bounds clamping on all query param parsing (2.3)
- **Request Correlation** — `X-Request-ID` middleware with UUID v4; propagated to response headers and error logs (2.4)
- **Deep Health Checks** — `/health/ready` (DB + Redis), `/health/live` (liveness), `/health/full` (all services including Weaviate + AI) (2.5)

### Infrastructure

- Backend healthcheck added to `docker-compose.prod.yml` (points to `/health/ready`)
- Test environment defaults in `jest.config.js` for isolated worktree runs

### Specs Updated

- `SECURITY.md` — Added CSRF protection (§3.4), session security (§3.5), request correlation (§6.3); updated token blacklist (§1.3), CORS multi-origin (§3.2), known gaps (§9)

### Quality Gates

| Gate | Status |
|------|--------|
| Tests | **706 passing** (38 backend suites + 13 frontend suites) |
| TypeScript | Zero errors |
| Build | All packages compile |
| Lint | Clean |

---

## [3.0.0-rc.2] - 2026-02-21

> **Phase 4: Full Beta Coverage — 16 Features, 229 Assertions**

### Highlights

Every product feature now has a living feature spec. Expanded from 6 pilot features (103 assertions) to **16 features (229 assertions)** — complete coverage of the entire product surface for beta readiness.

### What's New

- **10 New Feature Manifests + Spec-Aware Tests** covering the full product surface:
  - Failure Analysis (17) — categorization, log summary, RCA matching
  - Authentication (21) — JWT, RBAC, SSO, token blacklist, audit logging
  - MCP Server (15) — analyze, batch, knowledge base, stats
  - Failure Knowledge Base (13) — fingerprinting, matching, RCA docs, insights
  - Resilience (13) — circuit breaker, retry with backoff, timeout, pre-configured breakers
  - ReAct Loop (12) — loop bounds, tool execution, SSE streaming, registry
  - Context Enrichment (10) — gathering, confidence, synthesis
  - AI Cost Management (9) — budget tracking, cache key format, hit/miss
  - Pipeline Management (8) — CRUD, test run tracking, scheduling
  - Notifications & Alerting (8) — multi-channel dispatch, Slack, URL building
- **Scanner fix** — Added `lastRun` to version tracker type definition

### Quality Gates

| Gate | Status |
|------|--------|
| Tests | **417 passing** (27 backend suites + 13 frontend suites) |
| Spec Scanner | 229/229 (100%) — invariants 144, behavioral 41, contracts 44 |
| TypeScript | Zero errors |
| Build | All packages compile |

---

## [3.0.0-rc.1] - 2026-02-21

> **Release Candidate 1 — Specs Complete, Docs Polished, CI Hardened**

### Highlights

First release candidate for v3.0.0. All 6 pilot features fully spec'd (103 assertions), documentation cross-referenced and cleaned up, CI release workflow stabilized.

### What's New

- **Living Feature Specs Phase 1-3 Complete** — 6 features (Giphy, Smart Retry, Jira Housekeeping, Proactive Suggestions, Inline Diff, Autonomy Preferences) with 103 assertions, 100% coverage
- **Coverage Thresholds Enforced** — Scanner blocks CI on invariant <100%, behavioral <80%, contract <80%
- **PR Coverage Reports** — `npm run report:specs` and `npm run report:specs:dashboard` auto-posted to PRs via GitHub Actions
- **Health Scoring** — A+ through D grading per-feature based on assertion coverage
- **Documentation Cleanup** — v3.0.0 cross-referencing across README, SPEC, ARCHITECTURE, AGENTS
- **CI Release Fix** — Release workflow no longer overwrites custom notes; bash 3.2 compatible script for macOS

### Quality Gates

| Gate | Status |
|------|--------|
| Tests | 323 passing (188 backend + 135 frontend) |
| Spec Scanner | 103/103 (100%) |
| TypeScript | Zero errors |
| Build | All packages compile |

---

## [3.0.0-beta.4] - 2026-02-21

> **Living Feature Specs — Machine-Readable Acceptance Criteria**

*(Previously tagged as v3.0.3-beta.1)*

### Highlights

Specs are no longer passive documentation. This release introduces **Living Feature Specs** — structured YAML manifests that connect product specifications directly to test assertions, enabling automated drift detection, coverage tracking, and orphan analysis.

### What's New

- **Feature Manifest System** — Each feature gets a versioned YAML manifest in `specs/features/` with typed assertions (`invariant` / `behavioral` / `contract`)
- **3 Pilot Features Instrumented** — Giphy Integration (14 assertions), Smart Retry (14 assertions), Jira Housekeeping (15 assertions) — 43 total assertions mapped
- **Test Helpers** — `describeFeature()` and `itAssertion()` wire Jest/Vitest tests to manifest assertions with automatic version drift detection
- **CI Scanner** — `npm run validate:specs` validates manifests, detects orphaned tests, and reports assertion-level coverage by type
- **Schema & Registry** — TypeScript types and a manifest loader/indexer for programmatic access to feature specs

### Why It Matters

- **Zero spec drift** — When a spec changes, behavioral tests become `todo` instead of breaking, while invariants always fail fast
- **Visible coverage** — Know exactly which acceptance criteria have tests and which don't
- **Orphan detection** — Tests referencing removed specs and specs without tests are surfaced automatically

### Quality Gates

| Gate | Status |
|------|--------|
| Tests | 323 passing (188 backend + 135 frontend) |
| Build | All 3 packages compile |
| Typecheck | Zero errors |
| Lint | Zero errors, zero warnings |
| Spec Scanner | 3 features, 43 assertions valid |

---

## [3.0.0-beta.3] - 2026-02-20

> **First-Run Experience & Error Recovery**

*(Previously tagged as v3.0.2-beta.1)*

### Highlights

New users get a guided onboarding flow. Existing users get smarter error handling that recovers automatically from transient failures and surfaces budget context when rate limits hit.

### What's New

- **Onboarding Wizard** — 3-step guided setup (Welcome, AI Provider, Sample Queries) that appears on first login and can be dismissed or revisited from Settings
- **Budget Indicator** — Live budget badge in the Copilot header showing remaining spend, with 80% warning threshold and detailed tooltip breakdown
- **Smart Error Recovery** — Network errors auto-retry with countdown; rate limit errors link to Cost Tracker; all errors classified with visual category badges

---

## [3.0.0-beta.2] - 2026-02-20

> **End-to-End Test Coverage for the Agentic Copilot**

*(Previously tagged as v3.0.1-beta.1)*

### Highlights

The full agentic copilot flow is now covered by 10 Playwright smoke tests — from login through multi-step AI tool chains to confirmation workflows.

### What's New

- **10 E2E smoke tests** covering login, ReAct reasoning loop, confirmation approve/deny, proactive suggestions, autonomous actions, persona routing, and session persistence
- **Mock API fixtures** with pre-built SSE streaming scenarios for Jira, GitHub, and autonomous flows
- **CI-ready** — auto-starts dev server, chromium-only for speed, 2 retries in CI with trace capture on failure

---

## [3.0.0-beta.1] - 2026-02-20

> **TestOps Companion v3 — AI That Thinks, Acts, and Learns**

### Highlights

The biggest release in TestOps Companion history. Your AI copilot now routes queries to specialist personas, acts autonomously on low-risk tasks, and proactively suggests next steps — all while maintaining human oversight for anything that affects your team.

### What's New

- **Virtual Team Routing** — Every query is automatically routed to one of 9 specialist AI personas (Security Engineer, Test Engineer, DevOps Engineer, and more) for domain-expert responses
- **Graduated Autonomy** — Three-tier system gives you control over how much the AI does on its own:
  - **Tier 1 (Full Auto)** — Internal, reversible actions execute instantly (searches, reads, labels)
  - **Tier 2 (AI Proposes)** — Team-visible actions show a one-click approval card
  - **Tier 3 (You Decide)** — Destructive actions require full confirmation with 5-minute timeout
- **Proactive Suggestions** — After every tool result, the AI evaluates whether to suggest a next step (empty search → create issue, transient failure → retry, related issues → link them)
- **Page-Aware Context** — The AI always knows what you're looking at and adapts its responses accordingly
- **Resilience Layer** — Circuit breakers, retries with backoff, and timeouts on every external service call prevent cascading failures
- **22 AI Tools** — 8 read-only (auto-approved), 10 write (tiered approval), 4 housekeeping (auto-execute)

### Quality Gates

| Gate | Status |
|------|--------|
| Tests | **323/323 passing** (188 backend + 135 frontend) |
| Lint | 0 errors, 0 warnings |
| TypeScript | 0 compilation errors |
| Build | All 3 packages compile |

### Breaking Changes

None. All new features are additive. Existing API contracts are fully backward compatible.

---

## [2.9.0-rc.7] - 2026-02-20

> **Sprint 9 — Resilience + Documentation Overhaul**

### Circuit Breaker / Resilience Layer

**resilience.ts** — New fault tolerance library for external service calls. Prevents cascading failures when Jira, GitHub, Jenkins, or Confluence go down.

| Component | What |
|-----------|------|
| `CircuitBreaker` | State machine (CLOSED → OPEN → HALF_OPEN) per service |
| `withRetry()` | Exponential backoff with jitter, configurable max retries |
| `withTimeout()` | Per-request deadline enforcement |
| `withResilience()` | Composed wrapper (circuit breaker + retry + timeout) |

**Pre-configured breakers** for GitHub (5/30s), Jira (5/30s), Jenkins (3/60s), Confluence (5/30s).

**Health endpoint** — `/health/full` now returns `circuitBreakers[]` with per-service state, failure count, and next retry time. OPEN breakers trigger `degraded` status.

**30 unit tests** covering state transitions, retry behavior, timeout, composition.

### Documentation Overhaul

- `specs/ARCHITECTURE.md` — Added §7.1 Resilience Layer (circuit breaker diagram, per-service config table, state descriptions)
- `specs/API_CONTRACT.md` — Documented `/health/full`, `/health/ready`, `/health/live` endpoints with full response schema
- `AGENTS.md` — Added resilience to Non-Negotiable Backend Patterns
- `specs/team/PERFORMANCE_ENGINEER.md` — Added resilience to bottleneck areas
- `specs/team/DEVOPS_ENGINEER.md` — Added circuit breaker observability guidance

---

## [2.9.0-rc.6] - 2026-02-20

> **Sprint 8 — Global AI Context + High-Fidelity Seeding**

### Pervasive AI Provider Context

**AIContext** — Global React Context wrapping the entire application. Every page reports its current context (page type, focused entity with ID/label/metadata) so the AI Copilot always knows what the user is viewing.

**usePageContext hook** — Convenience hook for pages to report context on mount. Added to 7 pages: Dashboard, PipelineList, PipelineDetail, TestRunList, TestRunDetail, FailureKnowledgeBase, CostTracker.

**Context injection** — `useAICopilot.sendMessage()` now accepts an optional `uiContext` string. `AICopilot.tsx` calls `getContextString()` on every message, automatically injecting page/entity context into AI requests.

### CLAUDE.md Simplification

- CLAUDE.md reduced from 76 → 6 lines — single pointer to `AGENTS.md`
- Version aligned to 2.9.0-rc.6 across all 4 package.json files, specs, personas

### High-Fidelity Database Seeding

**seed.dev.ts** — Complete TypeScript rewrite of seed.dev.js using `@faker-js/faker`. Covers **all 20 models** in the Prisma schema:

| Model | Count | Notes |
|-------|-------|-------|
| Users | 3 | Admin (autonomous) + Engineer (balanced) + Viewer (conservative) |
| Teams | 2 | Platform Engineering + QA Automation with 5 memberships |
| Pipelines | 15 | Realistic templates across GitHub Actions, Jenkins, Custom |
| Test Runs | 200 | 30 days of history with realistic pass/fail/flaky distribution |
| Test Results | 600+ | 2-4 per run with error details for failures |
| Failure Archives | 1,600 | 6 categories, 13 failure templates, tags, RCA data |
| RCA Revisions | 90+ | Multi-version revision history on 30 failures |
| Failure Comments | 120+ | Collaborative discussion threads |
| Failure Patterns | 5 | Detected recurring patterns with confidence scores |
| AI Usage Records | 20,000+ | 60 days, 4 providers, 5 features, cost tracking |
| Chat Sessions | 8 | Persona-routed conversations with tool calls |
| Chat Messages | 100+ | User/assistant/tool exchanges |
| Pending Actions | 3 | Approved/Denied/Pending confirmation queue |
| Notifications | 50 | Mixed types linked to test runs |
| Jira Issues | 25 | Linked to test runs and failures |
| Confluence Pages | 5 | Runbooks and RCA documentation |
| TestRail Runs | 10 | External test management sync |
| Dashboard Configs | 2 | Team overview + QA metrics layouts |
| Shared Analyses | 2 | Shareable AI analysis links |
| Channel Mappings | 3 | Slack + Teams user mappings |

---

## [2.9.0-rc.5] - 2026-02-20

> **Sprint 7 — Autonomy Tests + New Tools + Proactive UX Cards**

### Testing — Graduated Autonomy (95 tests)

**AutonomyClassifier tests** (47 tests) — Static tier map verification for all 22 tools, context-dependent overrides (testrun_retry, github_rerun_workflow, jenkins_trigger_build prod, jira_comment AI notes), user preference modes (Conservative / Balanced / Autonomous), combined context+preference scenarios.

**ProactiveSuggestionEngine tests** (29 tests) — All 5 suggestion rules validated: empty Jira search → create issue, transient failure → retry, Jenkins failure → rebuild, related issues → link, mergeable PR → merge. Pre-filled arg enrichment, unique IDs, rule priority ordering.

**Autonomy flow integration tests** (19 tests) — End-to-end scenarios: investigation chains, SSE event type resolution, production safety overrides, conservative/autonomous user preference scenarios. Verifies classifier + suggestion engine wired together correctly.

### New Tools (4 added, 22 total)

| Tool | Tier | Category | Description |
|------|------|----------|-------------|
| `giphy_search` | 1 (auto) | Read | Contextual work-appropriate GIF search with G-rating, session dedup ring buffer, curated search terms per event, emoji fallback |
| `jira_link_issues` | 1 (auto) | Jira | Link related issues discovered during investigation. Reversible metadata. |
| `jira_add_label` | 1 (auto) | Jira | Tag issues with investigation labels (e.g. "investigated-by-ai"). Reversible. |
| `github_merge_pr` | 2 (card) | GitHub | Merge an open PR from chat. Supports merge/squash/rebase. |

All 4 tools include mock results for demo mode.

### Frontend — New Card Components

**GiphyEmbedCard** — Inline GIF display (max 200px), dismissable, Giphy TOS attribution, emoji fallback when API unavailable.

**RetryCard** — Smart retry with play button, confidence progress bar (color-coded), previous run history indicators, batch "Retry All N" for multiple affected tests, Skip option.

**HousekeepingCard** — Autonomous Jira housekeeping summary for link and label actions. Shows source→target links with relationship type, label chips, "Auto" badge, Undo button.

**ServiceBadge** — Added `giphy` service with green accent color.

**ToolResultCard** — Wired 4 new card routes: `giphy_search`, `testrun_retry`, `jira_link_issues`, `jira_add_label`.

---

## [2.9.0-rc.4] - 2026-02-20

> **Sprint 6 — Graduated Autonomy + Backend Stability Refactor**

### Autonomous AI & Proactive UX (Phase 3)

**AutonomyClassifier** — Three-tier classification engine maps every tool to an autonomy tier. Static tier assignments, context-dependent overrides (e.g., high-confidence retries auto-execute), and user preference modulation (Conservative / Balanced / Autonomous).

**ProactiveSuggestionEngine** — Post-tool-result evaluator with 5 rules: empty Jira search → suggest create, transient failure → suggest retry, Jenkins failure → suggest rebuild, related issues → suggest linking, mergeable PR → suggest merge. Emits `proactive_suggestion` SSE events with pre-filled action cards.

**ReAct loop upgraded** — Binary tool confirmation replaced with graduated autonomy: Tier 1 (internal/reversible) auto-executes, Tier 2 (team-visible) shows one-click cards, Tier 3 (destructive) requires full confirmation. New SSE events: `proactive_suggestion`, `autonomous_action`.

**`github_get_pr` enhanced** — Now returns file diffs with patches, per-file addition/deletion counts, and merge context. Enables inline diff rendering in the frontend.

### Frontend — New Components

**InlineDiffViewer** — GitHub-style syntax-highlighted unified diff viewer with green/red line coloring, file headers with +/- counts, and collapsible sections for diffs > 20 lines.

**GitHubPRCard enhanced** — Inline diff toggle, file change summary chip (`3 files +42/-7`), dual buttons: `[Review Diff]` / `[Approve & Merge]` / `[GitHub]`.

**ProactiveSuggestionCard** — AI suggestion cards with accept/dismiss, pre-filled Jira arg preview, confidence badge, tool-specific accent colors.

**useAICopilot SSE handlers** — New handlers for `proactive_suggestion` and `autonomous_action` event types.

**Settings → AI Copilot tab** — ToggleButtonGroup for autonomy preference (Conservative / Balanced / Autonomous) with descriptive explanations. Persisted via `PUT /api/v1/ai/autonomy`.

### Schema

**`autonomyLevel` field on User model** — Added to all 3 Prisma schemas (dev, production, dev template). Default: `balanced`. Production uses enum (`AutonomyLevel`), dev uses string with comment.

### Backend Stability Refactor (Thin Controller Pattern)

**Fat controller extraction** — 4 controllers refactored from fat (Prisma + business logic) to thin HTTP adapters. All business logic and data access moved to dedicated services:

| Controller | Before → After | New Service |
|---|---|---|
| `pipeline.controller.ts` | 264 → 61 lines | `pipeline.service.ts` |
| `dashboard.controller.ts` | 466 → 31 lines | `dashboard.service.ts` |
| `auth.controller.ts` | 245 → 47 lines | `user.service.ts` |
| `notification.controller.ts` | 244 → 54 lines | `notification-preference.service.ts` |

**AI route split** — Monolithic `routes/ai/index.ts` (778 lines) split into 3 focused sub-modules:
- `config.ts` — Health, personas, autonomy, provider config
- `analysis.ts` — RCA, categorization, summarization, enrichment, costs/stats
- `chat.ts` — SSE chat, session CRUD, action confirmation

**Convention update** — `SENIOR_ENGINEER.md` updated with "Thin Controller Rule": no Prisma imports in controllers, services own all domain logic.

---

## [2.9.0-rc.3] - 2026-02-20

> **Sprint 5 Stabilization** — Type safety, schema integrity, security audit, CI hardening.

### Type Safety & Build Fixes

**Bedrock provider import fix** — Removed broken `@aws-sdk/client-bedrock` import from provider registry. The correct SDK package (`@aws-sdk/client-bedrock-runtime`) was already in use; the phantom import blocked `tsc --noEmit`.

### Schema Integrity

**Field-level drift reconciliation** — Synced 40 fields across 7 models between `schema.production.prisma` and `schema.dev.prisma`. Models reconciled: `Pipeline`, `TestExecution`, `TestCase`, `FailureAnalysis`, `RCARevision`, `SharedAnalysis`, `DashboardConfig`. SQLite-compatible type mappings applied (e.g., `@default(uuid())` → `@default(cuid())`).

### Security

**passport-saml → @node-saml/passport-saml v5** — Replaced unmaintained `passport-saml@3` with the actively maintained `@node-saml/passport-saml@5`. Fixes critical SAML signature verification vulnerability (GHSA-4mxg-3p6v-xgq3). Updated API: `path` → `callbackUrl`, `cert` → `idpCert`, added required `logoutVerify` callback.

**bcrypt 5 → 6** — Upgraded to bcrypt 6 which uses Node.js native crypto instead of C++ bindings via `node-pre-gyp`. Eliminates `tar` dependency entirely, fixing 4 high-severity path traversal vulnerabilities (GHSA-r6q2-hw4h-h46w, GHSA-34x7-hfp2-rc4v, GHSA-83g3-92jg-28cx, GHSA-8qq5-rm4j-mr97).

**Transitive dependency overrides** — Added `minimatch >= 10.2.1` and `glob >= 11.0.0` overrides to backend `package.json`, matching root overrides. Resolves 37 high-severity ReDoS vulnerabilities in transitive dependencies.

**Audit result**: 40 vulnerabilities (1 critical, 37 high, 2 moderate) → 8 moderate (all in ESLint 8 devDeps, no production exposure).

### CI/CD Hardening

**`--strict-fields` CI gate** — Schema validation in `backend-ci.yml` and `installation-test.yml` now runs with `--strict-fields`, promoting field-level drift from warning to blocking failure. Closes the gap identified in the Sprint 4 postmortem.

---

## [2.9.0-rc.2] - 2026-02-20

> **Virtual Team Persona Routing + Stability Fixes** — AI queries routed to specialist personas, dotenv crash fix, schema drift prevention.

### Virtual Team Persona Routing (v3.0.0 Phase 1)

**PersonaRouter** — Two-tier query classifier routes every AI copilot query to the right specialist persona before fulfillment.

- **Tier 1: Keyword rules** (zero cost, <1ms) — pattern matching against domain vocabulary
- **Tier 2: LLM micro-classification** (fallback, ~200 tokens) — lightweight AI classification when no keyword match
- **9 personas**: Security Engineer, AI Architect, Data Engineer, UX Designer, Performance Engineer, Test Engineer, DevOps Engineer, Product Manager, Senior Engineer (default)
- **PersonaInstructions** — condensed ~200-token system prompt addons per persona
- **`persona_selected` SSE event** — emitted before ReAct loop, frontend renders persona badge
- **Frontend persona badge** — "Test Engineer is handling this" chip on thinking indicator
- **`GET /api/v1/ai/personas`** — endpoint returns all available personas with metadata
- **Schema**: `activePersona` on ChatSession, `persona` on ChatMessage (all 3 schemas)

### Stability & DevOps

**dotenv fallback chain** — `npm run dev` no longer crashes when no `.env` file exists. Uses `dotenv.config({ path: ['.env', '.env.dev'] })` — first file's values win, `.env.dev` fills gaps, real env vars always take precedence.

**Schema parity CI guardrail** — `validate-schema.js` now checks model parity between `schema.dev.prisma` and `schema.production.prisma`. CI fails if models are added to one schema but not the other (with allowlist for intentional differences).

**Schema drift fix** — Synced `schema.dev.prisma` with `schema.prisma` (6 missing models restored: RCARevision, FailureComment, AIProviderConfig, Team, TeamMember, DashboardConfig).

### Documentation Overhaul

- **README.md** — Complete rewrite: persona routing section, updated features, fixed dead links, streamlined structure
- **DEMO.md** — Added copilot workflow diagrams, confirmation system mockups, persona routing examples
- **HOW_DOES_IT_WORK.md** — Added AI copilot section, virtual team explanation, ReAct loop, human-in-the-loop FAQ
- **ROADMAP.md** — Added Virtual Team Routing items under v3.0.0
- **CI doc freshness check** — Automated validation that key docs reference current version

---

## [2.9.0-rc.1] - 2026-02-19

> **Agentic AI Copilot** — Full agentic backend + 3-column Mission Control UI + consolidated AI config + production hardening.

### Agentic AI System

**ReAct Reasoning Loop** — AI copilot follows a Reason - Act - Observe - Answer cycle with streaming SSE for real-time feedback.

**13 AI Tools** — 7 read-only tools (auto-approved) and 6 write tools (requiring user confirmation):
- Read: Jira Search, Jira Get, GitHub Commit, GitHub PR, Confluence Search, Jenkins Status, Dashboard Metrics
- Write: GitHub Create PR, GitHub Create Branch, GitHub Update File, Jira Create Issue, Jira Transition, Jira Comment

**Human-in-the-Loop Confirmation** — Write operations generate activity cards with a 5-minute TTL. Users must explicitly approve before mutations execute.

**Role-Aware Prompts** — System prompts adapt to user role (Admin, Engineer, Viewer) for appropriate scope and permissions.

**Chat Session Persistence** — Full message history stored and retrievable across sessions.

**3-Column Mission Control** — Layout grid: navigation sidebar | main content | AI copilot panel.

### Test Intelligence

**Flaky Test Detection** — Statistical scoring identifies intermittently failing tests based on historical pass/fail patterns.

**Test Impact Analysis** — Maps code changes to potentially affected test suites for targeted re-runs.

**Smart Test Selection** — API endpoint recommends which tests to run based on impact analysis of changed files.

### Production Hardening

**Token Blacklist → Redis** — JWT revocation list migrated from in-memory Map to Redis with automatic TTL expiration. Falls back to in-memory when Redis is unavailable.

**SSRF Validation** — Shared `validateUrlForSSRF()` utility blocks requests to private/internal networks (localhost, RFC 1918, link-local, IPv6 ULA). Applied to Jenkins, Confluence, TestRail, and Monday.com service constructors. Jenkins' existing protection refactored to use the shared utility.

**Notification Persistence** — Replaced 18 hardcoded mock notifications with real Prisma database queries. GET, PATCH (mark read), and DELETE endpoints now operate on the Notification table.

**Performance Monitoring** — Added HTTP response time tracking middleware with circular buffer for p50/p95/p99 computation. AI cache hit/miss rates now exported to Prometheus. New metrics: `testops_http_request_duration_p95_seconds`, `testops_ai_cache_hits_total`, `testops_ai_cache_hit_rate`.

### AI Config Consolidation

- All AI environment variables (25+) now load through a single `AIConfigManager`
- Provider settings (maxTokens, temperature, timeout), API keys, and vector DB config centralized
- `createProviderFromConfig()` replaces direct env var reads in provider registry
- Cache and vector client singletons now read config from AIConfigManager
- `.env.example` updated with all AI env vars organized by section

---

## [2.8.5] - 2026-02-17

> **Enterprise Readiness** — Production-grade security, compliance, and scalability foundations.

### Security & Identity

**Single Sign-On (SAML 2.0)** — Authenticate through your existing identity provider. Supports Okta, Azure AD, and Keycloak with Just-In-Time user provisioning.

**Role-Based Access Control** — Four granular roles (`Viewer`, `Editor`, `Admin`, `Billing`) give you precise control over who can view, modify, and manage pipelines.

### Compliance & Audit Logging

Every critical action is now recorded with full context:

| Field | Detail |
|-------|--------|
| **Who** | User ID, Email |
| **Where** | IP Address, User Agent |
| **What** | Action type, redacted metadata |

Built to satisfy **SOC 2** and **ISO 27001** audit trail requirements. Sensitive fields are automatically redacted (API keys, tokens, passwords).

### Scalability & High Availability

**Redis Cluster Support** — Eliminates the single point of failure. Full compatibility with AWS ElastiCache and Redis Sentinel.

**Stateless Backend** — The application server is now fully stateless, ready for horizontal autoscaling on Kubernetes.

### Observability

**OpenTelemetry** — Native distributed tracing and metrics. Ship telemetry to Datadog, Jaeger, or Prometheus with a single environment variable.

**API Documentation** — Interactive Swagger UI at `/api/docs`, auto-generated from route annotations.

### DevOps

**Alpine Docker Images** — Multi-stage builds with `node:20-alpine` reduce image size by ~80% and run as a non-root `node` user.

**CI/CD Pipeline** — Automated quality gates on every push: Lint → Typecheck → Test (61/61) → Docker Build.
