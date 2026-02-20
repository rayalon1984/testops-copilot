# Changelog

## [3.0.1] - 2026-02-20

> **E2E Agentic Copilot Tests — Playwright Smoke Suite**

### E2E Tests (Playwright)

- **10 smoke tests** covering the full agentic copilot user journey
- Mock API fixtures: auth, dashboard, pipelines, SSE chat streaming
- Pre-built SSE scenarios: Jira search, Jira create (confirmation), proactive suggestions, autonomous actions, persona routing
- Tests: login flow, ReAct loop, confirmation approve/deny, proactive suggestion cards, Tier 1 autonomous action notifications, persona badge display, chat clear, page navigation with copilot, chat input behavior, multi-query sessions
- Playwright config: auto-starts frontend dev server, chromium-only for speed
- New scripts: `npm run test:e2e`, `npm run test:e2e:headed`, `npm run test:all`

---

## [3.0.0] - 2026-02-20

> **v3.0.0 GA — Virtual Team Routing + Autonomous AI + Resilience**

This is the first major release of TestOps Companion v3. It promotes rc.1 through rc.7
to general availability with all lint, type, and test issues resolved.

### What's New in v3.0.0

- **Virtual Team Routing**: AI queries routed to 9 specialist personas via PersonaRouter (keyword rules + LLM micro-classification fallback)
- **Graduated Autonomy**: Three-tier system (Full Auto / AI-in-the-Loop / Human-in-the-Loop) with 22 registered tools
- **Proactive AI Suggestions**: Post-tool-result recommendations (empty search → suggest create, transient failure → suggest retry, etc.)
- **Global AI Context**: Page-aware AI assistance via AIProvider + usePageContext hook
- **Resilience Layer**: Circuit breaker + retry + timeout for all external service calls (GitHub, Jira, Jenkins, Confluence)
- **High-Fidelity Seeder**: TypeScript-based seed data with realistic pipelines, test runs, and failure patterns
- **Security Hardened**: passport-saml v5, bcrypt 6, ReDoS mitigations (40 → 8 moderate vulns, all devDeps)

### Quality Gates

- **Tests**: 323/323 passing (188 backend + 135 frontend)
- **Lint**: 0 errors, 0 warnings (ESLint clean)
- **TypeScript**: 0 compilation errors
- **Build**: All 3 packages (backend, frontend, mcp-server) build successfully

### Breaking Changes

None. Virtual Team Routing and Autonomous AI are additive features. Existing API contracts are fully backward compatible.

---

## [2.9.0-rc.7] - 2026-02-20

> **Sprint 9 — Resilience + Documentation Overhaul**

---

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

---

### Documentation Overhaul

- `specs/ARCHITECTURE.md` — Added §7.1 Resilience Layer (circuit breaker diagram, per-service config table, state descriptions)
- `specs/API_CONTRACT.md` — Documented `/health/full`, `/health/ready`, `/health/live` endpoints with full response schema
- `AGENTS.md` — Added resilience to Non-Negotiable Backend Patterns
- `specs/team/PERFORMANCE_ENGINEER.md` — Added resilience to bottleneck areas
- `specs/team/DEVOPS_ENGINEER.md` — Added circuit breaker observability guidance
- `CHANGELOG.md` — Comprehensive release notes for rc.6 + rc.7

### CLAUDE.md Simplification (from rc.6)

- CLAUDE.md reduced from 76 → 6 lines — single pointer to `AGENTS.md`
- Version aligned to 2.9.0-rc.7 across all 4 package.json files, specs, personas

---

## [2.9.0-rc.7] - 2026-02-20

> **Sprint 8 — Global AI Context + High-Fidelity Seeding**

---

### Pervasive AI Provider Context

**AIContext** — Global React Context wrapping the entire application. Every page reports its current context (page type, focused entity with ID/label/metadata) so the AI Copilot always knows what the user is viewing.

**usePageContext hook** — Convenience hook for pages to report context on mount. Added to 7 pages: Dashboard, PipelineList, PipelineDetail, TestRunList, TestRunDetail, FailureKnowledgeBase, CostTracker.

**Context injection** — `useAICopilot.sendMessage()` now accepts an optional `uiContext` string. `AICopilot.tsx` calls `getContextString()` on every message, automatically injecting page/entity context into AI requests.

---

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

---

### Testing — Graduated Autonomy (95 tests)

**AutonomyClassifier tests** (47 tests) — Static tier map verification for all 22 tools, context-dependent overrides (testrun_retry, github_rerun_workflow, jenkins_trigger_build prod, jira_comment AI notes), user preference modes (Conservative / Balanced / Autonomous), combined context+preference scenarios.

**ProactiveSuggestionEngine tests** (29 tests) — All 5 suggestion rules validated: empty Jira search → create issue, transient failure → retry, Jenkins failure → rebuild, related issues → link, mergeable PR → merge. Pre-filled arg enrichment, unique IDs, rule priority ordering.

**Autonomy flow integration tests** (19 tests) — End-to-end scenarios: investigation chains, SSE event type resolution, production safety overrides, conservative/autonomous user preference scenarios. Verifies classifier + suggestion engine wired together correctly.

---

### New Tools (4 added → 22 total)

| Tool | Tier | Category | Description |
|------|------|----------|-------------|
| `giphy_search` | 1 (auto) | Read | Contextual work-appropriate GIF search with G-rating, session dedup ring buffer, curated search terms per event, emoji fallback |
| `jira_link_issues` | 1 (auto) | Jira | Link related issues discovered during investigation. Reversible metadata. |
| `jira_add_label` | 1 (auto) | Jira | Tag issues with investigation labels (e.g. "investigated-by-ai"). Reversible. |
| `github_merge_pr` | 2 (card) | GitHub | Merge an open PR from chat. Supports merge/squash/rebase. |

All 4 tools include mock results for demo mode.

---

### Frontend — New Card Components

**GiphyEmbedCard** — Inline GIF display (max 200px), dismissable, Giphy TOS attribution, emoji fallback when API unavailable.

**RetryCard** — Smart retry with play button, confidence progress bar (color-coded), previous run history indicators, batch "Retry All N" for multiple affected tests, Skip option.

**HousekeepingCard** — Autonomous Jira housekeeping summary for link and label actions. Shows source→target links with relationship type, label chips, "Auto" badge, Undo button.

**ServiceBadge** — Added `giphy` service with green accent color.

**ToolResultCard** — Wired 4 new card routes: `giphy_search`, `testrun_retry`, `jira_link_issues`, `jira_add_label`.

---

## [2.9.0-rc.4] - 2026-02-20

> **Sprint 6 — Graduated Autonomy + Backend Stability Refactor**

---

### Autonomous AI & Proactive UX (Phase 3)

**AutonomyClassifier** — Three-tier classification engine maps every tool to an autonomy tier. Static tier assignments, context-dependent overrides (e.g., high-confidence retries auto-execute), and user preference modulation (Conservative / Balanced / Autonomous).

**ProactiveSuggestionEngine** — Post-tool-result evaluator with 5 rules: empty Jira search → suggest create, transient failure → suggest retry, Jenkins failure → suggest rebuild, related issues → suggest linking, mergeable PR → suggest merge. Emits `proactive_suggestion` SSE events with pre-filled action cards.

**ReAct loop upgraded** — Binary tool confirmation replaced with graduated autonomy: Tier 1 (internal/reversible) auto-executes, Tier 2 (team-visible) shows one-click cards, Tier 3 (destructive) requires full confirmation. New SSE events: `proactive_suggestion`, `autonomous_action`.

**`github_get_pr` enhanced** — Now returns file diffs with patches, per-file addition/deletion counts, and merge context. Enables inline diff rendering in the frontend.

---

### Frontend — New Components

**InlineDiffViewer** — GitHub-style syntax-highlighted unified diff viewer with green/red line coloring, file headers with +/- counts, and collapsible sections for diffs > 20 lines.

**GitHubPRCard enhanced** — Inline diff toggle, file change summary chip (`3 files +42/-7`), dual buttons: `[Review Diff]` / `[Approve & Merge]` / `[GitHub]`.

**ProactiveSuggestionCard** — AI suggestion cards with accept/dismiss, pre-filled Jira arg preview, confidence badge, tool-specific accent colors.

**useAICopilot SSE handlers** — New handlers for `proactive_suggestion` and `autonomous_action` event types.

**Settings → AI Copilot tab** — ToggleButtonGroup for autonomy preference (Conservative / Balanced / Autonomous) with descriptive explanations. Persisted via `PUT /api/v1/ai/autonomy`.

---

### Schema

**`autonomyLevel` field on User model** — Added to all 3 Prisma schemas (dev, production, dev template). Default: `balanced`. Production uses enum (`AutonomyLevel`), dev uses string with comment.

---

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

---

### Type Safety & Build Fixes

**Bedrock provider import fix** — Removed broken `@aws-sdk/client-bedrock` import from provider registry. The correct SDK package (`@aws-sdk/client-bedrock-runtime`) was already in use; the phantom import blocked `tsc --noEmit`.

---

### Schema Integrity

**Field-level drift reconciliation** — Synced 40 fields across 7 models between `schema.production.prisma` and `schema.dev.prisma`. Models reconciled: `Pipeline`, `TestExecution`, `TestCase`, `FailureAnalysis`, `RCARevision`, `SharedAnalysis`, `DashboardConfig`. SQLite-compatible type mappings applied (e.g., `@default(uuid())` → `@default(cuid())`).

---

### Security

**passport-saml → @node-saml/passport-saml v5** — Replaced unmaintained `passport-saml@3` with the actively maintained `@node-saml/passport-saml@5`. Fixes critical SAML signature verification vulnerability (GHSA-4mxg-3p6v-xgq3). Updated API: `path` → `callbackUrl`, `cert` → `idpCert`, added required `logoutVerify` callback.

**bcrypt 5 → 6** — Upgraded to bcrypt 6 which uses Node.js native crypto instead of C++ bindings via `node-pre-gyp`. Eliminates `tar` dependency entirely, fixing 4 high-severity path traversal vulnerabilities (GHSA-r6q2-hw4h-h46w, GHSA-34x7-hfp2-rc4v, GHSA-83g3-92jg-28cx, GHSA-8qq5-rm4j-mr97).

**Transitive dependency overrides** — Added `minimatch >= 10.2.1` and `glob >= 11.0.0` overrides to backend `package.json`, matching root overrides. Resolves 37 high-severity ReDoS vulnerabilities in transitive dependencies.

**Audit result**: 40 vulnerabilities (1 critical, 37 high, 2 moderate) → 8 moderate (all in ESLint 8 devDeps, no production exposure).

---

### CI/CD Hardening

**`--strict-fields` CI gate** — Schema validation in `backend-ci.yml` and `installation-test.yml` now runs with `--strict-fields`, promoting field-level drift from warning to blocking failure. Closes the gap identified in the Sprint 4 postmortem.

---

## [2.9.0-rc.2] - 2026-02-20

> **Virtual Team Persona Routing + Stability Fixes** — AI queries routed to specialist personas, dotenv crash fix, schema drift prevention.

---

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

---

### Stability & DevOps

**dotenv fallback chain** — `npm run dev` no longer crashes when no `.env` file exists. Uses `dotenv.config({ path: ['.env', '.env.dev'] })` — first file's values win, `.env.dev` fills gaps, real env vars always take precedence.

**Schema parity CI guardrail** — `validate-schema.js` now checks model parity between `schema.dev.prisma` and `schema.production.prisma`. CI fails if models are added to one schema but not the other (with allowlist for intentional differences).

**Schema drift fix** — Synced `schema.dev.prisma` with `schema.prisma` (6 missing models restored: RCARevision, FailureComment, AIProviderConfig, Team, TeamMember, DashboardConfig).

---

### Documentation Overhaul

- **README.md** — Complete rewrite: persona routing section, updated features, fixed dead links, streamlined structure
- **DEMO.md** — Added copilot workflow diagrams, confirmation system mockups, persona routing examples
- **HOW_DOES_IT_WORK.md** — Added AI copilot section, virtual team explanation, ReAct loop, human-in-the-loop FAQ
- **CHANGELOG.md** — Added rc.2 entry (this)
- **ROADMAP.md** — Added Virtual Team Routing items under v3.0.0
- **CI doc freshness check** — Automated validation that key docs reference current version

---

## [2.9.0-rc.1] - 2026-02-19

> **Agentic AI Copilot** — Full agentic backend + 3-column Mission Control UI + consolidated AI config + production hardening.

---

### Agentic AI System

**ReAct Reasoning Loop** — AI copilot follows a Reason - Act - Observe - Answer cycle with streaming SSE for real-time feedback.

**13 AI Tools** — 7 read-only tools (auto-approved) and 6 write tools (requiring user confirmation):
- Read: Jira Search, Jira Get, GitHub Commit, GitHub PR, Confluence Search, Jenkins Status, Dashboard Metrics
- Write: GitHub Create PR, GitHub Create Branch, GitHub Update File, Jira Create Issue, Jira Transition, Jira Comment

**Human-in-the-Loop Confirmation** — Write operations generate activity cards with a 5-minute TTL. Users must explicitly approve before mutations execute.

**Role-Aware Prompts** — System prompts adapt to user role (Admin, Engineer, Viewer) for appropriate scope and permissions.

**Chat Session Persistence** — Full message history stored and retrievable across sessions.

**3-Column Mission Control** — Layout grid: navigation sidebar | main content | AI copilot panel.

---

### Test Intelligence

**Flaky Test Detection** — Statistical scoring identifies intermittently failing tests based on historical pass/fail patterns.

**Test Impact Analysis** — Maps code changes to potentially affected test suites for targeted re-runs.

**Smart Test Selection** — API endpoint recommends which tests to run based on impact analysis of changed files.

---

### Housekeeping

- Aligned all version numbers to `2.9.0-rc.1` across root, backend, frontend, MCP server, and spec headers
- Updated ROADMAP.md to reflect shipped vs. planned status accurately
- Wired cost tracker budget alerts to existing email notification service
- Implemented "Clear All" notification functionality in frontend

---

### Production Hardening

**Token Blacklist → Redis** — JWT revocation list migrated from in-memory Map to Redis with automatic TTL expiration. Falls back to in-memory when Redis is unavailable.

**SSRF Validation** — Shared `validateUrlForSSRF()` utility blocks requests to private/internal networks (localhost, RFC 1918, link-local, IPv6 ULA). Applied to Jenkins, Confluence, TestRail, and Monday.com service constructors. Jenkins' existing protection refactored to use the shared utility.

**Notification Persistence** — Replaced 18 hardcoded mock notifications with real Prisma database queries. GET, PATCH (mark read), and DELETE endpoints now operate on the Notification table.

**Performance Monitoring** — Added HTTP response time tracking middleware with circular buffer for p50/p95/p99 computation. AI cache hit/miss rates now exported to Prometheus. New metrics: `testops_http_request_duration_p95_seconds`, `testops_ai_cache_hits_total`, `testops_ai_cache_hit_rate`.

---

### AI Config Consolidation

- All AI environment variables (25+) now load through a single `AIConfigManager`
- Provider settings (maxTokens, temperature, timeout), API keys, and vector DB config centralized
- `createProviderFromConfig()` replaces direct env var reads in provider registry
- Cache and vector client singletons now read config from AIConfigManager
- `.env.example` updated with all AI env vars organized by section

---

## [2.8.5] - 2026-02-17

> **Enterprise Readiness** — This release transforms TestOps Companion from a team-level tool into a production-grade, enterprise-ready platform.

---

### 🔐 Security & Identity

**Single Sign-On (SAML 2.0)** — Authenticate through your existing identity provider.
Supports Okta, Azure AD, and Keycloak with Just-In-Time user provisioning.

**Role-Based Access Control** — Four granular roles (`Viewer`, `Editor`, `Admin`, `Billing`)
give you precise control over who can view, modify, and manage pipelines.

---

### 📜 Compliance & Audit Logging

Every critical action is now recorded with full context:

| Field | Detail |
|-------|--------|
| **Who** | User ID, Email |
| **Where** | IP Address, User Agent |
| **What** | Action type, redacted metadata |

Built to satisfy **SOC 2** and **ISO 27001** audit trail requirements.
Sensitive fields are automatically redacted (API keys, tokens, passwords).

---

### ⚡ Scalability & High Availability

**Redis Cluster Support** — Eliminates the single point of failure.
Full compatibility with AWS ElastiCache and Redis Sentinel.

**Stateless Backend** — The application server is now fully stateless,
ready for horizontal autoscaling on Kubernetes.

---

### 🔭 Observability

**OpenTelemetry** — Native distributed tracing and metrics.
Ship telemetry to Datadog, Jaeger, or Prometheus with a single environment variable.

**API Documentation** — Interactive Swagger UI at `/api/docs`,
auto-generated from route annotations.

---

### 🐳 DevOps

**Alpine Docker Images** — Multi-stage builds with `node:20-alpine` reduce
image size by ~80% and run as a non-root `node` user.

**CI/CD Pipeline** — Automated quality gates on every push:
Lint → Typecheck → Test (61/61) → Docker Build.

---

### Upgrading

```bash
# Docker
docker pull ghcr.io/rayalon1984/testops-companion/backend:2.8.5
docker pull ghcr.io/rayalon1984/testops-companion/frontend:2.8.5

# Environment
OTEL_ENABLED=true   # Enable OpenTelemetry tracing
```
