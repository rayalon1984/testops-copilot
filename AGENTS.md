# TestOps Copilot — AI Agent Instructions

> This file is the **single entrypoint** for all AI coding agents working in this repo.
> It defines how AI should reason about this codebase, what to prioritize, and how to collaborate.
>
> **Version**: 3.5.1 | **Updated**: 2026-03-15

---

## 0) Project Snapshot

- **Product**: TestOps Copilot
- **Purpose**: Comprehensive test operations platform for managing CI/CD pipelines, tracking test results, analyzing failures with AI, and enriching context across Jira, Confluence, and GitHub.
- **Architecture**:
  - **Backend**: Node.js 18+ | TypeScript | Express.js | Prisma ORM | PostgreSQL | Redis
  - **Frontend**: React 18 | TypeScript | Material-UI | Zustand | React Query | Vite
  - **AI**: Anthropic Claude | OpenAI | Google Gemini | Azure OpenAI | AWS Bedrock | Weaviate Vector DB
  - **Infra**: Docker | GitHub Actions | Grafana | Prometheus | Playwright E2E
- **Auth**: JWT access + refresh tokens | Token blacklist (Redis) | SAML SSO | RBAC (Admin > Editor > User > Billing > Viewer)

**Critical Rule**: Always keep `specs/` documents updated when modifying behavior, APIs, or architecture.

---

## 1) Repo Map

| Area | Location | Purpose |
|------|----------|---------|
| Backend API | `backend/src/` | Express.js server (controllers, services, middleware, routes) |
| Frontend SPA | `frontend/src/` | React app (components, pages, hooks, contexts) |
| MCP Server | `mcp-server/` | Model Context Protocol server (8 tools) |
| AI Services | `backend/src/services/ai/` | Providers, tools, features, ReAct loop |
| Database | `backend/prisma/` | Prisma schema and migrations |
| Specs | `specs/` | Living specification documents (source of truth) |
| Personas | `specs/team/` | 11 expert persona files for task routing |
| Plans | `plans/` | Dated planning and decision documents |
| Docs | `docs/` | Detailed reference documentation |
| Tests | `tests/` + `backend/src/**/__tests__/` | E2E (Playwright), integration, unit (Jest/Vitest) |
| Infra | `infra/` | Grafana dashboards, Prometheus, Nginx configs |
| CI/CD | `.github/workflows/` | GitHub Actions pipelines |

---

## 2) Core Principles

### A) Think Before Coding
- State assumptions explicitly before implementing
- Surface multiple interpretations before deciding
- Ask clarifying questions rather than guess
- Simplify over-complicated solutions — boring > clever

### B) Three-Layer Backend — Never Skip Layers
```
Routes → Controllers (thin: HTTP only) → Services (thick: business logic) → Database (Prisma)
```
- Controllers parse requests and format responses. No business logic.
- Services encapsulate all business logic, DB queries, and external integrations.
- Never call Prisma directly from controllers. Never handle HTTP in services.

### C) Singletons Are Sacred
- **PrismaClient**: Always import from `@/lib/prisma`. Never `new PrismaClient()`.
- **AIManager**: Always use `AIManager.getInstance()`. Never call providers directly.
- **Why**: Direct instantiation bypasses connection pooling, cost tracking, caching, and monitoring.

### D) Strict TypeScript
- Never use `any` (use `unknown` if truly needed)
- All functions must have explicit return types
- Throw custom error classes (`NotFoundError`, `ValidationError`, etc.), never plain `Error`
- Validate inputs at system boundaries with Zod schemas

### E) AI Is a First-Class System
- All AI calls go through `AIManager` (tracking, caching, cost management)
- Write tools require user confirmation (activity cards, not direct writes)
- Privacy-first: owner-only data never leaks across users
- Every AI call is logged with provider, tokens, and cost

### F) React Query for Server State
- Use React Query for all async data fetching. Never `useState` for server data.
- Always invalidate queries on mutations.
- Use Zustand only for client-side UI state.

### G) Design Language Compliance
- Follow `specs/DESIGN_LANG_V2.md` for all UI work
- Reuse components from `frontend/src/components/` before building new ones
- Dark-mode command-center aesthetic (data-dense, scannable, breathable)

### H) Break Once, Never Again
Every failure follows a four-step cycle — no exceptions:
1. **Detect** — Surface the failure (test, lint, build, runtime error)
2. **Understand** — Root-cause it. Don't just fix the symptom.
3. **Fix** — Resolve the underlying issue
4. **Prevent** — Add a guard so the same class of bug can never recur (test case, lint rule, CI check, type constraint, or validation)

If a fix doesn't include a prevention step, the fix is incomplete.

---

## 3) Persona Routing — Route, Read, Build

Before ANY implementation, route to the right expert.

### Quick Selection (first "yes" wins)

| # | Question | Persona |
|---|----------|---------|
| 1 | Affects authn/authz, secrets, or security posture? | `specs/team/SECURITY_ENGINEER.md` |
| 2 | Affects AI behavior, tool policy, or system architecture? | `specs/team/AI_ARCHITECT.md` |
| 3 | Affects schema, migrations, data integrity, or queries? | `specs/team/DATA_ENGINEER.md` |
| 4 | Core output is a UX flow, interaction, or visual design? | `specs/team/UX_DESIGNER.md` |
| 5 | Goal is reducing latency, throughput, or profiling? | `specs/team/PERFORMANCE_ENGINEER.md` |
| 6 | Goal is test coverage, CI quality, or contract testing? | `specs/team/TEST_ENGINEER.md` |
| 7 | About pipelines, deploys, Docker, or observability? | `specs/team/DEVOPS_ENGINEER.md` |
| 8 | API docs, user guides, or onboarding content? | `specs/team/TECHNICAL_WRITER.md` |
| 9 | Release process, versioning, or rollback? | `specs/team/RELEASE_QA_ENGINEER.md` |
| 10 | Clarifying requirements, defining AC, or scoping? | `specs/team/AI_PRODUCT_MANAGER.md` |
| 11 | Default (implementation or refactor) | `specs/team/SENIOR_ENGINEER.md` |

**Cross-domain tasks**: Primary owner = persona for the highest-risk/least-reversible aspect. Read supporting persona files too. Document trade-offs.

Full routing rubric: `specs/team/TEAM_SELECTION.md`

### Fast Path (Trivial Changes)

Skip persona routing when **all** of these are true:
- Single-file change, under ~30 lines
- Does not touch auth, AI, database schema, or API contracts
- Has an obvious owner (almost always `SENIOR_ENGINEER`)
- Is a bug fix, typo, style tweak, or config update

On the fast path: apply AGENTS.md rules directly → implement → run the verification loop (Section 5) → commit. No persona file read required.

**When in doubt, take the full path.** The fast path exists to reduce overhead on trivial work, not to bypass safety.

### The Workflow
```
1. Read AGENTS.md (this file)
2. Route to persona (specs/team/TEAM_SELECTION.md)
3. Read the persona .md file — adopt its mindset
4. Check specs/ for prior art and constraints
5. Plan changes (write to plans/ if complex)
6. Implement with testing
7. Update specs/ if behavior changed
8. Run verification loop
9. Commit with conventional message
```

---

## 4) Non-Negotiable Patterns

### Backend Patterns

| Pattern | Rule |
|---------|------|
| Prisma | Import singleton from `@/lib/prisma`. Never instantiate directly. |
| AI calls | Use `AIManager.getInstance()`. Never call providers directly. |
| Error handling | Throw custom error classes. Controllers pass errors to `next()`. Error handler middleware formats the response. |
| Validation | Zod schemas on all input boundaries. Use validation middleware. |
| Logging | Use winston logger (`logger.info/warn/error`). Never `console.log` in production code. |
| Auth | JWT Bearer tokens. All protected routes use `authenticate` middleware. Check RBAC with `authorize(role)`. |
| Integrations | Dedicated service classes for external APIs. Never hardcode API calls in controllers. |
| Resilience | Wrap external service calls with `withResilience()` from `@/lib/resilience`. Pre-configured breakers: github, jira, jenkins, confluence, xray, azureDevOps. Never call external APIs without circuit breaker protection. |
| Secrets | Environment variables only. Never in code. `backend/.env` and `frontend/.env` are separate. |

### Frontend Patterns

| Pattern | Rule |
|---------|------|
| Data fetching | React Query hooks. Invalidate on mutations. |
| State | Zustand for client UI state. Never useState for server data. |
| Components | Reuse from `frontend/src/components/`. Check before creating new ones. |
| Styling | Material-UI theme system. CSS only in `*.css` files, not inline. |
| Text containment | **Every card/bubble that renders dynamic text must enforce overflow guards.** See §Text-Containment below. |
| Types | Shared types in `frontend/src/types/`. Mirror backend DTOs. |
| Error boundaries | Wrap each route-level page in an `<ErrorBoundary>`. A component crash must never take down the whole app. Reuse `frontend/src/components/ErrorBoundary/`. |
| Component splitting | If a component exceeds ~200 lines, split it. Extract hooks for logic, keep the render function lean. One file = one responsibility. |
| Forms | Use React Hook Form + Zod for validation. Mirror backend Zod schemas where possible to avoid divergence. |
| Code splitting | Lazy-load route-level pages with `React.lazy`. Heavy components (charts, editors, modals with rich content) get their own chunk. |
| Loading states | Every async operation needs a loading indicator. Use React Query's `isLoading`/`isFetching` — never manual boolean flags. |

### §Text-Containment — Overflow Prevention Checklist

Any component that renders **dynamic text** inside a bounded container (cards, chat
bubbles, panels) **must** apply these guards. Forgetting any one layer can cause
text to visually escape its card.

| Layer | Where | CSS Properties | Why |
|-------|-------|---------------|-----|
| **Scroll container** | Outer scrollable area (e.g. copilot message list) | `overflowX: 'hidden'` | Prevents horizontal scrollbar from long content |
| **Message wrapper** | Box wrapping each message type | `minWidth: 0`, `overflow: 'hidden'` | Flex child containment — prevents flex item from growing beyond parent |
| **Card / Paper** | The Paper/Card surface itself | `overflow: 'hidden'` | Hard clip boundary for all descendants |
| **Text body** | Any `<Typography>` or `<Box>` rendering dynamic strings | `overflowWrap: 'break-word'`, `wordBreak: 'break-word'` | Breaks long URLs, tokens, paths, IDs mid-word |
| **Inline code** | `<code>` tags in markdown | `word-break: break-all` | Monospace code tokens are never natural-wrap points |
| **Markdown root** | MarkdownRenderer root `<Box>` | `overflow: 'hidden'`, `overflowWrap: 'break-word'`, `wordBreak: 'break-word'`, `minWidth: 0` | Catch-all for any parsed element |

**Common pitfalls:**
- `maxWidth: '90%'` alone does NOT prevent overflow — children can still escape if they have intrinsic width
- Flex children default to `min-width: auto` — always add `minWidth: 0` on flex items that contain text
- `dangerouslySetInnerHTML` bypasses React text flow — the container must enforce word-break
- Hover effects with `transform` don't affect containment but test them visually

### Dependency Governance

| Rule | Detail |
|------|--------|
| Justify additions | Every new npm package must include a *why* in the PR description. What problem does it solve? Why not use an existing dep? |
| Check for overlap | Before adding a package, verify no existing dependency already covers the use case. |
| Minimum viability | No packages with fewer than 1,000 weekly npm downloads unless approved by a security review. |
| Audit in CI | `npm audit --audit-level=high` runs in CI. High/critical vulnerabilities fail the build. |
| Bundle awareness | For frontend deps, check the bundle size impact (`npx bundlephobia <pkg>`). Flag anything > 50 KB gzipped. |
| Lock files | Always commit `package-lock.json` changes. Never delete or regenerate without cause. |

### AI Subsystem Patterns

| Pattern | Rule |
|---------|------|
| Providers | Implement `BaseProvider`. Register in `providers/registry.ts`. |
| Tools | Define in `backend/src/services/ai/tools/`. Register in `tools/index.ts`. |
| Autonomy tiers | Tier 1 (auto-execute) for read/reversible. Tier 2 (activity card) for team-visible. Tier 3 (full confirm) for destructive. |
| Cost tracking | Every AI call logged. Budget alerts configured. Cache aggressively. |
| Vector search | Use Weaviate for semantic similarity. Not keyword matching. |
| ReAct loop | Max 5 tool calls, max 8 iterations. Safety limits enforced. |

### AI Guardrails (Extended)

These rules supplement the patterns above. Any AI subsystem change **must** satisfy these constraints.

#### Provider Failover & Resilience

| Rule | Detail |
|------|--------|
| Failover chain | Configure a primary → secondary → tertiary provider. If primary returns 5xx or times out, fall through automatically. Log every failover event. |
| Timeout enforcement | The `timeoutMs` from `config.ts` (default 60s) **must** be enforced via `AbortController` or equivalent. No open-ended waits. |
| Retry policy | Transient failures (429, 503, network timeout) get up to 2 retries with exponential backoff (1s, 3s). Non-retryable errors (400, 401, 403) fail immediately. |
| Circuit breaker | Wrap provider calls with the same `withResilience()` pattern used for Jira/GitHub. Open after 5 consecutive failures, half-open after 30s. |
| Health checks | `AIManager.healthCheck()` must be called on startup and exposed via `/api/health`. If primary provider is down, surface it — don't hide it behind cache. |

#### Budget & Cost Controls

| Rule | Detail |
|------|--------|
| Hard budget cutoff | When monthly spend reaches 100% of budget, **reject new AI requests** with a clear user-facing error. Soft alert at 80% (existing). |
| Per-feature caps | Each AI feature (RCA, categorization, log summary, enrichment) should have an individual budget ceiling, not just a monthly total. |
| Accurate cost tracking | Replace rough cost estimates ($0.001, $0.002) with actual token-based pricing from provider responses. Log input tokens and output tokens separately. |
| Cost anomaly alerting | If a single request costs >5x the feature's average, log a warning. If daily spend exceeds 2x the projected daily average, alert. |

#### Tool Execution Safety

| Rule | Detail |
|------|--------|
| Tool conflict resolution | If the ReAct loop produces conflicting tool calls (e.g., retry + cancel), the **more conservative action wins**. Destructive actions never auto-resolve conflicts. |
| Partial failure handling | If tool N of M fails mid-loop, return partial results with a clear indicator of what succeeded and what failed. Never silently drop tool results. |
| Autonomy enforcement | User autonomy preference (Conservative / Balanced / Autonomous) **must** be checked at runtime before executing any tool. A Conservative user must never see Tier 2 auto-execution. |

#### Cache & Data

| Rule | Detail |
|------|--------|
| Cache invalidation | TTL-based (7 days) is the baseline. Additionally: invalidate on schema changes, on manual user action ("re-analyze"), and when the underlying data (test run, failure) is updated. |
| Stale-while-revalidate | For non-critical reads (dashboard summaries), serve stale cache and refresh in the background. For analysis (RCA, categorization), always serve fresh on cache miss. |
| Privacy boundary | Cache keys **must** include the `organizationId`. A cached result for Org A must never be served to Org B, even if the input hash matches. |

#### Token Management

| Rule | Detail |
|------|--------|
| Budget overflow | If system prompt + history alone exceed the model's context budget, **truncate history first** (oldest messages), never truncate the system prompt. |
| Tool result priority | When total tool result budget is exceeded, truncate results in reverse chronological order (keep the most recent tool output intact). |
| Token counting | The 3.8 chars/token heuristic is acceptable for budgeting, but log actual token counts from provider responses and alert if estimates drift >20% from actuals. |

---

## 5) Verification Loop

Before completing ANY task, run this checklist:

1. **Tests pass** — `npm run test` (backend Jest + frontend Vitest)
2. **Build succeeds** — `npm run build` (backend + frontend + mcp)
3. **Typecheck clean** — `npm run typecheck` (no TypeScript errors)
4. **Lint clean** — `npm run lint` (ESLint passing)
5. **Architecture clean** — `npm run check:architecture` (no layer violations)
6. **Code health** — `npm run check:health` (no file/function size violations)
7. **Security audit** — `cd backend && npm audit --audit-level=high && cd ../frontend && npm audit --audit-level=high` (no high/critical CVEs)
8. **Specs updated** — If behavior changed, update relevant `specs/` documents
9. **Self-review** — Read the diff. Check edge cases. Verify error handling.

**If any check fails**: Fix and retry (max 3 attempts). If still failing, simplify scope or ask.

---

## 6) Definition of Done

A task is complete when:

- [ ] Acceptance criteria met
- [ ] Tests pass (all suites: `npm run test`)
- [ ] Build succeeds (`npm run build`)
- [ ] Typecheck passes (`npm run typecheck`)
- [ ] Lint passes (`npm run lint`)
- [ ] Specs updated (if behavior changed)
- [ ] Conventional commit message used

### Conventional Commits

Format: `type(scope): subject`

| Type | When |
|------|------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `refactor` | Code restructuring (no behavior change) |
| `test` | Adding or updating tests |
| `chore` | Tooling, deps, config |
| `perf` | Performance improvement |

---

## 7) Quick Commands

| Action | Command |
|--------|---------|
| **Demo setup** | `npm run deploy:demo` |
| Dev (full stack) | `npm run dev` |
| Dev (backend only) | `npm run dev:backend` |
| Dev (frontend only) | `npm run dev:frontend` |
| Build all | `npm run build` |
| Test all | `npm run test` |
| Test backend | `npm run test:backend` |
| Test frontend | `npm run test:frontend` |
| Typecheck all | `npm run typecheck` |
| Lint all | `npm run lint` |
| DB migrate | `cd backend && npx prisma migrate dev --name <name>` |
| DB studio | `cd backend && npx prisma studio` |
| MCP dev | `npm run mcp:dev` |

---

## 8) Context Hierarchy (Read in Order)

When working on this repo, read documents in this priority:

1. **AGENTS.md** (this file) — Operational rules and project overview
2. **specs/team/TEAM_SELECTION.md** — Route to the right persona
3. **specs/team/<PERSONA>.md** — Adopt persona mindset and standards
4. **specs/SPEC.md** — Product behavior and capabilities
5. **specs/ARCHITECTURE.md** — System design and runtime flows
6. **specs/DESIGN_LANG_V2.md** — UI standards (for frontend work)
7. **specs/AI_TOOLS.md** — AI tool registry (for AI work)
8. **specs/API_CONTRACT.md** — API specifications (for API work)
9. **specs/SECURITY.md** — Security architecture (for auth/data work)

---

## 9) Integration Map

TestOps Copilot integrates with these external systems:

| System | Service File | Purpose |
|--------|-------------|---------|
| Jira | `backend/src/services/jira.service.ts` | Issue creation, search, sync |
| Confluence | `backend/src/services/confluence.service.ts` | Knowledge base, runbook search |
| GitHub | `backend/src/services/github.service.ts` | Commit diffs, PR changes, repo info |
| Jenkins | `backend/src/services/jenkins.service.ts` | Build status, logs, triggering |
| Azure DevOps | `backend/src/services/azuredevops.service.ts` | Pipelines, builds, work items, wiki, PRs, test runs |
| Slack | `backend/src/services/notification.service.ts` | Alerts, notifications |
| Weaviate | `backend/src/services/ai/vector/` | Vector embeddings, semantic search |
| AI Providers | `backend/src/services/ai/providers/` | Anthropic, OpenAI, Google, Azure, AWS Bedrock |

**Cross-platform enrichment** (v2.8): `POST /api/ai/enrich` synthesizes Jira + Confluence + GitHub context for failure analysis.

---

## 10) When Stuck — Escalation Path

### Step 1: Retry (max 3 attempts on the same approach)
- Re-read the original requirements
- Check if assumptions are wrong
- Try a different implementation of the *same* approach

### Step 2: Simplify
- Break the task into smaller sub-tasks
- Reduce scope — solve the core problem first, defer edge cases
- Remove the newest change and see if the problem disappears

### Step 3: Document
- Create `plans/stuck-YYYY-MM-DD-<topic>.md` with:
  - What was attempted (with code snippets or error output)
  - Why each attempt failed
  - What's still unclear
- This creates institutional knowledge. Stuck-states that aren't documented get repeated.

### Step 4: Ask
- Surface the blocker with a **specific question**, not "I'm stuck"
- Include: what you tried, what you expected, what happened instead
- Tag the relevant persona owner if cross-domain

### Step 5: Reset
- Consider a completely different approach
- Check if the requirement itself is wrong or over-scoped
- Propose an alternative that solves 80% of the problem with 20% of the complexity

---

## 11) Quality Standards (All Personas Share)

- **Ship incrementally** — Small, reversible steps over big bangs
- **Boring > clever** — Proven patterns over novelty
- **Measure first** — Profile/benchmark before optimizing
- **Test what matters** — High-signal coverage, not vanity metrics
- **Explain trade-offs** — In code comments, PR descriptions, or plans/
- **Trust is earned** — AI features need explainability and user control
- **Code is a long-lived asset** — Write for the next maintainer, not yourself

---

## 12) Anti-Patterns — Never Do These

- Writing code without reading the relevant persona file first
- Instantiating PrismaClient or AI providers directly (use singletons)
- Putting business logic in controllers (use services)
- Using `any` in TypeScript (use `unknown` or proper types)
- Using `console.log` in production code (use winston logger)
- Shipping AI features without confirmation gates on write operations
- Skipping security review on auth or data-handling changes
- Optimizing without profiling data
- Making irreversible architecture decisions without documenting trade-offs
- Using `useState` for server data (use React Query)
- Hardcoding API keys or secrets in code
- Skipping input validation at system boundaries
