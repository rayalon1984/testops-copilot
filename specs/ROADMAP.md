# ROADMAP.md — Canonical Roadmap

> **Owner**: AI Product Manager · **Status**: Living document · **Last verified**: 2026-02-20
> **Current Version**: 2.9.0-rc.6 (February 2026)

---

## Shipped

### v2.9.0-rc.6 — Sprint 8: Global AI Context + High-Fidelity Seeding (February 2026)
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
- [ ] Microsoft Teams integration
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
- [ ] Onboarding wizard (first-run provider setup, sample queries)
- [ ] Rate limit UI feedback (quota indicators in chat)
- [ ] Usage dashboard per-session (cost breakdown by tool/provider)
- [ ] Error recovery UX (retry failed tool calls, connection lost handling)
- [ ] E2E smoke tests for full agentic flow (Playwright)
- [ ] Release notes and changelog

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
