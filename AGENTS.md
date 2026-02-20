# TestOps Companion — AI Agent Instructions

> This file is the **single entrypoint** for all AI coding agents working in this repo.
> It defines how AI should reason about this codebase, what to prioritize, and how to collaborate.
>
> **Version**: 3.0.0 | **Updated**: 2026-02-20

---

## 0) Project Snapshot

- **Product**: TestOps Companion
- **Purpose**: Comprehensive test operations platform for managing CI/CD pipelines, tracking test results, analyzing failures with AI, and enriching context across Jira, Confluence, and GitHub.
- **Architecture**:
  - **Backend**: Node.js 18+ | TypeScript | Express.js | Prisma ORM | PostgreSQL | Redis
  - **Frontend**: React 18 | TypeScript | Material-UI | Zustand | React Query | Vite
  - **AI**: Anthropic Claude | OpenAI | Google Gemini | Azure OpenAI | Weaviate Vector DB
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
| Skills | `.cursor/skills/` | Reusable workflow templates |
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
| Resilience | Wrap external service calls with `withResilience()` from `@/lib/resilience`. Pre-configured breakers: github, jira, jenkins, confluence. Never call external APIs without circuit breaker protection. |
| Secrets | Environment variables only. Never in code. `backend/.env` and `frontend/.env` are separate. |

### Frontend Patterns

| Pattern | Rule |
|---------|------|
| Data fetching | React Query hooks. Invalidate on mutations. |
| State | Zustand for client UI state. Never useState for server data. |
| Components | Reuse from `frontend/src/components/`. Check before creating new ones. |
| Styling | Material-UI theme system. CSS only in `*.css` files, not inline. |
| Types | Shared types in `frontend/src/types/`. Mirror backend DTOs. |

### AI Subsystem Patterns

| Pattern | Rule |
|---------|------|
| Providers | Implement `BaseProvider`. Register in `providers/registry.ts`. |
| Tools | Define in `backend/src/services/ai/tools/`. Register in `tools/index.ts`. |
| Autonomy tiers | Tier 1 (auto-execute) for read/reversible. Tier 2 (activity card) for team-visible. Tier 3 (full confirm) for destructive. |
| Cost tracking | Every AI call logged. Budget alerts configured. Cache aggressively. |
| Vector search | Use Weaviate for semantic similarity. Not keyword matching. |
| ReAct loop | Max 5 tool calls, max 8 iterations. Safety limits enforced. |

---

## 5) Verification Loop

Before completing ANY task, run this checklist:

1. **Tests pass** — `npm run test` (backend Jest + frontend Vitest)
2. **Build succeeds** — `npm run build` (backend + frontend + mcp)
3. **Typecheck clean** — `npm run typecheck` (no TypeScript errors)
4. **Lint clean** — `npm run lint` (ESLint passing)
5. **Specs updated** — If behavior changed, update relevant `specs/` documents
6. **Self-review** — Read the diff. Check edge cases. Verify error handling.

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
10. **.cursor/skills/*.md** — Reusable workflow templates

---

## 9) Integration Map

TestOps Companion integrates with these external systems:

| System | Service File | Purpose |
|--------|-------------|---------|
| Jira | `backend/src/services/jira.service.ts` | Issue creation, search, sync |
| Confluence | `backend/src/services/confluence.service.ts` | Knowledge base, runbook search |
| GitHub | `backend/src/services/github.service.ts` | Commit diffs, PR changes, repo info |
| Jenkins | `backend/src/services/jenkins.service.ts` | Build status, logs, triggering |
| Slack | `backend/src/services/notification.service.ts` | Alerts, notifications |
| Weaviate | `backend/src/services/ai/vector/` | Vector embeddings, semantic search |
| AI Providers | `backend/src/services/ai/providers/` | Anthropic, OpenAI, Google, Azure |

**Cross-platform enrichment** (v2.8): `POST /api/ai/enrich` synthesizes Jira + Confluence + GitHub context for failure analysis.

---

## 10) When Stuck

1. **Stop** — Re-read the original requirements
2. **Simplify** — Break into smaller sub-tasks
3. **Ask** — Pose specific clarifying questions
4. **Reset** — Consider a completely different approach

**Max 3 retry loops on the same error** before escalating or simplifying scope.

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
