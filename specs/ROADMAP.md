# ROADMAP.md — Canonical Roadmap

> **Owner**: AI Product Manager · **Status**: Living document · **Last verified**: 2026-03-02
> **Current Version**: 3.4.0 (March 2026)

---

## Planned

### v3.5.0 — Sprint 13: Xray Bi-Directional Sync + Xray Server (TBD)
- [ ] Xray bi-directional sync (push results, pull test case updates)
- [ ] Xray Server (on-prem) support
- [ ] Test case creation from Copilot

---

## Shipped

### v3.4.0 — Sprint 12: Xray Deep Integration + Card Graduation (March 2026)
- [x] Auto-sync to Xray — fire-and-forget on test run completion (trigger=AUTO)
- [x] Admin toggle — PATCH `/xray/config` flips auto-sync on/off
- [x] Trigger tracking — sync history shows Manual vs Auto trigger
- [x] Test Plan Browser — paginated list with coverage bars, drill-down to test cases
- [x] AI Enrichment Pipeline — Xray as 4th parallel source (Promise.allSettled)
- [x] Dedicated Xray Cards — XraySearchCard + XrayHistoryCard
- [x] V2 Card Graduation — feature flag removed, V1 GitHubPRCard deleted
- [x] XraySync → TestRun FK relation with cascade delete (all 3 Prisma schemas)
- [x] RC Hardening: EDITOR auth on sync, Jira multi-segment key validation, Zod schema for sync history limit, completeTestRun status validation, syncTestRun rollback error handling
- [x] 967 tests passing (822 backend + 145 frontend), 320 feature spec assertions

### v3.3.0 — Sprint 11: Xray Integration + Context-Aware Prompts (March 2026)
- [x] Xray Cloud integration — XrayService (OAuth2 auth, test case search, result sync)
- [x] `xray_search` AI tool — query Xray test cases/plans from copilot (read-only, Tier 1)
- [x] Xray sync: POST /xray/sync/:testRunId (map Copilot test run → Xray Test Execution)
- [x] Xray Settings UI (client ID/secret, project key, test connection)
- [x] XraySync Prisma model (sync state tracking, execution ID persistence)
- [x] Xray circuit breaker + resilience wrapper
- [x] Tier 2 context-aware starter prompts (live pipeline/failure signals)
- [x] 930 tests passing (787 backend + 143 frontend), 246 feature spec assertions

### v3.2.0 — Sprint 10: Smart Starter Prompts + Card Redesign (March 2026)
- [x] Smart Starter Prompts — role-based defaults + user-configurable pins (`specs/features/smart-starter-prompts.feature.yaml`)
- [x] Role prompt catalog: QA Engineer, Developer, Engineering Lead, Product Manager + generic fallback
- [x] GET /ai/starter-prompts + PATCH /ai/starter-prompts/pins APIs
- [x] Dynamic EmptyState component (fetch from API, skeleton loading, pin indicator)
- [x] StarterPromptSettings popover (pin/unpin, custom prompts, reorder, reset)
- [x] User model: pinnedStarterPrompts JSON field
- [x] V2 Card Redesign (graduated v3.4.0): RootCauseCard → GitHubPRCardV2 → HousekeepingCardV2 analysis chain
- [x] `rca_identify` tool — AI root cause analysis with confidence scoring
- [x] Self-Healing demo data seeding (rules, events, quarantine)
- [x] Copilot panel always-visible on desktop (md+ breakpoint)
- [x] Rate limiter fix: 1000 req/15min in dev/demo mode (prevents false 429s)
- [x] Code health refactoring: mock provider split (625→418 lines), StarterPromptSettings extraction (278→144 lines)
- [x] 831 tests passing (675 backend + 137 frontend + 19 E2E), zero lint warnings
- [x] Deferred to v3.3: Tier 2 context-aware prompts (live pipeline/failure signals)

### v3.1.0 — Sprint 9: Self-Healing Pipelines + "Let's TOC" Branding (February 2026)
- [x] "Let's TOC" branding for AI copilot chat (placeholder, empty state, thinking indicator)
- [x] Self-Healing Phase 1: Auto-Retry for Transient Failures (8 built-in patterns, circuit breaker, autonomy-aware)
- [x] Self-Healing Phase 2: Flaky Test Quarantine (auto-quarantine, severity scoring, reinstate/delete)
- [x] Self-Healing Phase 3: AI-Suggested Fix PRs (RCA fuzzy matching, repository context, fix suggestions)
- [x] HealingRule, HealingEvent, QuarantinedTest Prisma models with full CRUD
- [x] Self-Healing dashboard page with 3 tabs (Rules & Events | Quarantine | Fix Suggestions)
- [x] 24 unit tests for self-healing service (pattern matching, built-in rules)
- [x] React Query hooks for all healing endpoints
- [x] Codebase refactoring: dead deps removal, DB indexes, N+1 fixes, god-service splits, React Query migration
- [x] 812 tests passing (675 backend + 137 frontend), zero lint warnings

### v3.0.0 — Sprint 8: Global AI Context + High-Fidelity Seeding (February 2026)
- [x] Global AIProvider React Context (page + entity awareness for AI Copilot)
- [x] usePageContext hook — 7 pages report context (Dashboard, Pipelines, Test Runs, Failures, Cost)
- [x] Context injection into AI chat requests (uiContext field)
- [x] High-fidelity TypeScript seeder (seed.dev.ts) with @faker-js/faker
- [x] All 20 Prisma models seeded with realistic, interconnected demo data
- [x] 200 test runs, 1600 failures, 20K+ AI usage records, 8 chat sessions

### v2.9.0-rc.5 — Sprint 7 Autonomy Tests + New Tools + Proactive UX (February 2026)
- [x] AutonomyClassifier unit tests (47 tests)
- [x] ProactiveSuggestionEngine unit tests (29 tests)
- [x] Autonomy flow integration tests (19 tests) — end-to-end classifier + suggestion + SSE
- [x] `giphy_search` tool: contextual GIF search with session dedup, curated terms, emoji fallback
- [x] `jira_link_issues` tool: Tier 1 auto-execute, link related issues (reversible)
- [x] `jira_add_label` tool: Tier 1 auto-execute, tag issues with investigation labels
- [x] `github_merge_pr` tool: Tier 2 card, merge PR from chat (merge/squash/rebase)
- [x] GiphyEmbedCard, RetryCard (smart retry with play button), HousekeepingCard (link/label + undo)
- [x] Mock results for all 22 tools (up from 18)
- [x] JiraService: `linkIssues()`, `addLabels()` methods
- [x] GitHubService: `mergePR()` method

### v2.9.0-rc.4 — Sprint 6 Graduated Autonomy + Backend Refactor (February 2026)
- [x] AutonomyClassifier: 3-tier tool classification (Full Auto / AI-in-the-Loop / Human-in-the-Loop)
- [x] ProactiveSuggestionEngine: post-tool-result suggestion rules (5 patterns)
- [x] ReAct loop graduated autonomy (replaces binary confirmation)
- [x] `proactive_suggestion` + `autonomous_action` SSE events
- [x] `github_get_pr` enhanced with file diffs + merge context
- [x] InlineDiffViewer component (syntax-highlighted unified diff)
- [x] GitHubPRCard: inline diff toggle + [Approve & Merge] / [Review Diff]
- [x] ProactiveSuggestionCard: AI suggestion cards with accept/dismiss
- [x] User autonomy preferences API + Settings UI (Conservative / Balanced / Autonomous)
- [x] `autonomyLevel` field on User model (all 3 schemas)
- [x] Fat controller extraction: 4 controllers → thin adapters + dedicated services
- [x] AI route split: 778-line monolith → 3 focused sub-modules
- [x] SENIOR_ENGINEER.md: Thin Controller Rule convention

### v2.9.0-rc.3 — Sprint 5 Stabilization (February 2026)
- [x] Bedrock provider import fix (unblock typecheck)
- [x] Schema field-level drift reconciliation (40 fields, 7 models)
- [x] Security audit: passport-saml v3 → @node-saml/passport-saml v5 (critical vuln fix)
- [x] Security audit: bcrypt 5 → 6 (removes tar dependency, 4 high vulns fixed)
- [x] Security audit: minimatch/glob overrides (37 high ReDoS vulns fixed)
- [x] CI: `--strict-fields` gate enabled (field drift blocks merge)
- [x] Audit result: 40 vulns → 8 moderate (dev-only, no production exposure)

### v2.8.0–2.8.5 — Context Enrichment & Enterprise (February 2026)
- [x] Jira similar issue search (JQL text search)
- [x] Confluence knowledge reader (CQL search for runbooks and RCA docs)
- [x] GitHub code awareness (commit diffs, PR file changes)
- [x] AI-powered context enrichment service orchestrating all three sources
- [x] `POST /api/v1/ai/enrich` endpoint
- [x] SSO: SAML 2.0 (Okta, Azure AD) with JIT provisioning
- [x] RBAC: Admin > Editor/User > Billing > Viewer hierarchy
- [x] Audit logging with PII redaction
- [x] Redis Cluster support, stateless backend

### v2.7.0–2.7.1 — Production Readiness & Security (February 2026)
- [x] Security hardening (privilege escalation fix, SSRF protection, auth on all routes)
- [x] Token blacklist service for proper logout/revocation
- [x] 87 tests (50 backend + 37 frontend)
- [x] CI/CD hardening (tests, lint, typecheck block merges)
- [x] PrismaClient singleton pattern

### v2.6.0 — MCP Server (January 2026)
- [x] Model Context Protocol server with 8+ tools
- [x] 98% token reduction and 90% cost savings
- [x] PostgreSQL integration with connection pooling

### v2.5.3–2.5.4 — AI Integration (November 2025)
- [x] Multi-provider AI: Anthropic Claude, OpenAI GPT-4, Google Gemini, Azure OpenAI
- [x] RCA matching with semantic search (Weaviate vector DB)
- [x] Automated failure categorization (6 categories with confidence scoring)
- [x] Intelligent log summarization (root cause + suggested fix)
- [x] Cost tracking and budget alerts ($100/month default)
- [x] 3-tier Redis caching (response, embedding, summary)

### v2.5.0–2.5.2 — Integrations & Knowledge Base (November 2025)
- [x] Failure Knowledge Base with smart fingerprinting (3-strategy matching)
- [x] Grafana & Prometheus metrics (20+ metrics, pre-built dashboards)
- [x] Monday.com Work OS integration (GraphQL API)
- [x] Confluence documentation publishing
- [x] TestRail test case management sync
- [x] Jira issue creation and bi-directional sync

### v1.0.0 — Core Platform (December 2024)
- [x] JWT authentication with refresh tokens
- [x] Pipeline management (Jenkins, GitHub Actions, custom)
- [x] Test execution tracking with result aggregation
- [x] Real-time notifications (Slack, Email, Pushover)
- [x] Interactive dashboard with analytics

---

## Next Up

### v2.9.0 — Agentic AI Copilot (Q2 2026)

**Agentic System** (shipped):
- [x] ReAct loop with streaming SSE (Reason → Act → Observe → Answer)
- [x] 22 tools: 11 read-only (auto-approved) + 11 write (confirmation required)
- [x] Phase 3 action tools: jenkins_trigger_build, testrun_cancel/retry, github_rerun_workflow
- [x] Human-in-the-loop confirmation gates for write operations (5-min TTL)
- [x] Role-aware system prompts (Admin/Engineer/Viewer)
- [x] AI-layer role enforcement (requiredRole on Tool interface, checked in ReAct loop)
- [x] Token-by-token answer streaming (typewriter effect via answer_chunk SSE events)
- [x] 3-column Mission Control layout (sidebar | main | AI panel)
- [x] Service-native card UX: 9 result cards + 6 preview cards + confirmation shell
- [x] Chat session persistence with full message history
- [x] In-chat AI provider picker (hot-swap Anthropic/OpenAI/Google/Azure/OpenRouter/Mock)
- [x] API key encrypted at rest (AES-256-GCM), provider config stored in DB
- [x] Full-spectrum demo mode: mock provider triggers all 18 tools with realistic data
- [x] Dark mode color audit (ServiceBadge, StatusChip, ConfirmationShell)
- [x] Accessibility audit (ARIA roles, keyboard navigation, focus management)
- [x] Card analytics hook (track expansions, actions, confirmation rates)

**Test Intelligence** (shipped):
- [x] Flaky test detection with statistical scoring
- [x] Test impact analysis (code changes → affected tests)
- [x] Smart test selection (run only affected tests)
- [x] Predictive failure analysis (trends, risk scoring, anomaly detection)

**Collaboration** (shipped):
- [x] Team workspaces with shared dashboards
- [x] Comments and discussions on failures
- [x] Real-time collaborative RCA documentation (optimistic locking, revision history)

**Notifications v2**:
- [x] Microsoft Teams integration (Bot Framework + Adaptive Cards + channel user mapping)
- [ ] Discord integration
- [ ] Custom notification templates with rich formatting
- [ ] Notification rules engine

---

## Medium Term

### v3.0.0 — Agentic AI Release (Q2/Q3 2026)

**Virtual Team Routing** (Phase 1 shipped):
- [x] PersonaRouter — two-tier classifier (keyword rules + LLM fallback)
- [x] PersonaInstructions — 9 persona system prompt addons
- [x] `persona_selected` SSE event + frontend persona badge
- [x] `GET /api/v1/ai/personas` endpoint
- [x] Schema: `activePersona` on ChatSession, `persona` on ChatMessage
- [ ] Persona override picker (user selects persona manually)
- [ ] Persona analytics (track which personas are used most)

**Autonomous AI & Proactive UX** (Phase 3 — spec: `specs/AUTONOMOUS_AI_SPEC.md`):
- [x] Three-tier autonomy model (Full Auto / AI-in-the-Loop / Human-in-the-Loop) — Sprint 6
- [x] ProactiveSuggestionEngine — AI anticipates next action, presents pre-built cards — Sprint 6
- [x] Inline code diff viewer in PR cards (syntax-highlighted, Approve & Merge / Review Diff buttons) — Sprint 6
- [x] User autonomy preferences (Conservative / Balanced / Autonomous) — Sprint 6
- [x] Smart retry with play button (auto-retry transient failures, batch retry) — Sprint 7
- [x] Jira autonomous housekeeping (auto-link related issues, auto-label, undo card) — Sprint 7
- [x] Giphy integration — contextual, work-appropriate GIFs for status events — Sprint 7
- [x] 4 new tools: `jira_link_issues`, `jira_add_label`, `github_merge_pr`, `giphy_search` — Sprint 7

**Multi-Channel AI** (Phase 2-3 planned):
- [ ] Slack Bot (Events API + Block Kit responses)
- [ ] Microsoft Teams Bot (Bot Framework + Adaptive Cards)
- [ ] Channel user mapping (external ID to internal user)
- [ ] Buffered chat handler for non-streaming channels

**Release Polish** (rc.3 → GA):
- [x] Onboarding wizard (first-run provider setup, sample queries) — 3-step wizard with stepper
- [x] Rate limit UI feedback (quota indicators in chat) — QuotaIndicator with budget warnings
- [ ] Usage dashboard per-session (cost breakdown by tool/provider)
- [x] Error recovery UX (retry failed tool calls, connection lost handling) — auto-retry + classification
- [x] E2E smoke tests for full agentic flow (Playwright) — 10 tests, mock API fixtures
- [x] Release notes and changelog

**Enterprise**:
- [ ] LDAP integration
- [ ] Two-factor authentication (TOTP / WebAuthn)
- [ ] Fine-grained permissions (resource-level ACL)
- [ ] IP whitelisting
- [ ] Secret rotation mechanism

**CI/CD Expansion**:
- [ ] GitLab CI integration
- [ ] CircleCI integration
- [ ] Azure DevOps integration
- [ ] Bitbucket Pipelines

**Quality Gates**:
- [ ] Custom quality gate definitions
- [ ] Policy enforcement engine
- [ ] Coverage requirements and thresholds
- [ ] Performance regression gates

**Infrastructure** (3/4 shipped):
- [x] Token blacklist migration to Redis
- [ ] WebSocket support for real-time updates
- [x] Notification persistence (replace mock data)
- [ ] Multi-origin CORS support

---

## Future Considerations

### Scalability & Performance
- [ ] Microservices decomposition
- [ ] Kubernetes-native deployment
- [ ] Multi-region support
- [ ] Database sharding / read replicas
- [ ] CDN for static assets

### Extensibility
- [ ] Plugin architecture
- [ ] Custom integration framework
- [ ] API extensions
- [ ] Integration marketplace

### Mobile
- [ ] Progressive Web App (PWA)
- [ ] Mobile-optimized responsive views
- [ ] Push notification support

---

## Technical Debt Tracker

| Item | Severity | Location | Notes |
|------|----------|----------|-------|
| ~~Token blacklist in-memory~~ | ~~Medium~~ | ~~`tokenBlacklist.service.ts`~~ | **Resolved** — Redis with fallback |
| ~~Notification mock data~~ | ~~Medium~~ | ~~`notification.routes.ts`~~ | **Resolved** — Prisma persistence |
| No WebSocket support | Low | Backend | Add Socket.IO for real-time |
| Single CORS origin | Low | `app.ts` | Multi-origin config |
| ~~No SSRF URL validation~~ | ~~Medium~~ | ~~External service URLs~~ | **Resolved** — Shared ssrf-validator |
| ~~passport-saml critical vuln~~ | ~~Critical~~ | ~~`passport.service.ts`~~ | **Resolved** (Sprint 5) — Migrated to @node-saml/passport-saml v5 |
| ~~tar path traversal vulns~~ | ~~High~~ | ~~bcrypt transitive dep~~ | **Resolved** (Sprint 5) — bcrypt 6 removes tar entirely |
| ~~Schema field drift undetected~~ | ~~High~~ | ~~CI pipeline~~ | **Resolved** (Sprint 5) — `--strict-fields` gate enabled |
| ESLint 8 ajv moderate vulns | Low | devDependencies | 8 moderate vulns; requires ESLint 10 migration (breaking) |

---

*This roadmap is updated when features ship or priorities change. Items may shift based on user feedback and technical constraints.*
