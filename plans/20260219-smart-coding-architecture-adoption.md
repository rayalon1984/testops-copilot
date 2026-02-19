# Smart Coding Architecture Adoption Plan

> **Date**: 2026-02-19
> **Author**: AI + Rotem
> **Status**: DRAFT — Awaiting approval
> **Goal**: Transform TestOps Companion into an AI-native, spec-driven codebase by adopting EMHub's Smart Coding Architecture — fully adapted for our TestOps domain.

---

## Executive Summary

We're adopting a **spec-driven development workflow** inspired by EMHub's architecture. The key insight: **one master entrypoint file (AGENTS.md)** that AI agents read first, linking to living spec documents that stay in sync with the code.

**What we keep**: Our 10-persona A-Team system (it's _better_ than EMHub's 5-persona setup).
**What we add**: Consolidated specs hub, design language, AI tools registry, reusable skills, and a plans directory.
**What we consolidate**: Scattered docs into authoritative `specs/` files.

---

## Current State vs Target State

| Aspect | Current | Target |
|--------|---------|--------|
| AI entrypoint | `CLAUDE.md` (4.8KB routing rules) | `AGENTS.md` (full operational guide) + `CLAUDE.md` (kept as shortcut) |
| Specs | Only `specs/a-team/` (personas) | `specs/` with SPEC, ARCHITECTURE, DESIGN_LANG, AI_TOOLS, API_CONTRACT, SECURITY |
| Design language | `frontend/src/theme.ts` only (code) | `specs/DESIGN_LANG_V2.md` (spec) + theme.ts (implementation) |
| AI tools catalog | Scattered across `backend/src/services/ai/tools/` | `specs/AI_TOOLS.md` (registry) + code (implementation) |
| API contracts | `docs/api.md` (informal) | `specs/API_CONTRACT.md` (formal contract) |
| Security spec | `docs/project/SECURITY.md` (disclosure policy) | `specs/SECURITY.md` (architecture + threat model) |
| Roadmap | `docs/project/ROADMAP.md` | `specs/roadmap/ROADMAP.md` (canonical location) |
| Skills | None | `.cursor/skills/` (3 reusable workflows) |
| Plans | None | `plans/` directory for task plans |
| Personas | `specs/a-team/` (10 personas) | `specs/team/` (10 personas, renamed for clarity) |

---

## Phase 1: Foundation (Single PR)

### 1.1 Create `AGENTS.md` — The Master Entrypoint

**What**: Root-level file that every AI agent reads first.
**Why**: Single source of truth for "how we work" — replaces scattered context.

Content structure:
```
# TestOps Companion — AI Agent Instructions
## 0) Project Snapshot (product, stack, purpose)
## 1) Repo Map (where everything lives)
## 2) Core Principles (think before coding, AI-first, design compliance)
## 3) Verification Loop (tests, build, lint, docs, self-review)
## 4) Definition of Done (AC, tests, build, lint, docs, conventional commits)
## 5) Design Language (link to specs/DESIGN_LANG_V2.md)
## 6) AI Tool System (link to specs/AI_TOOLS.md)
## 7) Persona Routing (link to specs/team/TEAM_SELECTION.md)
## 8) When Stuck (stop, simplify, ask, reset)
## 9) Quick Commands (npm run test/build/lint/dev)
## 10) Context Hierarchy (read order)
```

**Source material**: EMHub template (Part 2 above) + our current CLAUDE.md + tempo CLAUDE.md (2,234 lines of TestOps-specific patterns).

**Critical**: This file must be **TestOps-specific**, referencing our actual stack (PostgreSQL, Prisma, Weaviate, Express, React/MUI, multi-provider AI), not generic placeholders.

### 1.2 Update `CLAUDE.md` — Keep It Lean

**What**: Slim down to a routing file that points to AGENTS.md.
**Why**: CLAUDE.md is read by Claude Code specifically. AGENTS.md is the universal agent guide.

New CLAUDE.md structure:
```
# CLAUDE.md — TestOps Companion
> Read AGENTS.md first. This file adds Claude Code-specific overrides.
## Persona Routing (kept — quick reference)
## Quality Standards (kept — checklist)
## Anti-Patterns (kept)
## When Unsure (kept)
```

### 1.3 Rename `specs/a-team/` to `specs/team/`

**What**: Rename directory for consistency with EMHub convention.
**Why**: "team" is more discoverable than "a-team" for new contributors.

All 10 personas move as-is (they're already superior to EMHub's versions):
- AI_ARCHITECT.md
- AI_PRODUCT_MANAGER.md
- DATA_ENGINEER.md
- DEVOPS_ENGINEER.md
- PERFORMANCE_ENGINEER.md
- SECURITY_ENGINEER.md
- SENIOR_ENGINEER.md
- TEAM_SELECTION.md
- TEST_ENGINEER.md
- UX_DESIGNER.md

Update all references in CLAUDE.md, AGENTS.md.

### 1.4 Create `plans/` Directory

**What**: Directory for dated planning documents.
**Why**: Formal tracking of design decisions, sprint plans, architecture proposals.

Create with:
```
plans/
├── README.md                              # Explains the plans convention
└── 20260219-smart-coding-architecture-adoption.md  # This plan (first entry)
```

---

## Phase 2: Living Specs (Second PR)

### 2.1 Create `specs/SPEC.md` — Product Specification

**What**: Authoritative product spec for TestOps Companion.
**Why**: The tempo version is a generic placeholder. We need the real thing.

Content derived from:
- `docs/OVERVIEW.md` (product description)
- `docs/features.md` (feature list)
- `docs/HOW_DOES_IT_WORK.md` (functional flows)
- `docs/project/ROADMAP.md` (shipped features as proof of scope)

Sections:
```
# TestOps Companion — Product Specification
## Vision & Mission
## Core Capabilities
  - Pipeline Management (Jenkins, GitHub Actions)
  - Test Execution Tracking & Analytics
  - Failure Analysis (AI-powered RCA, categorization, log summarization)
  - Cross-Platform Context Enrichment (Jira, Confluence, GitHub)
  - Notification System (Slack, Email, Pushover)
  - Failure Knowledge Base (fingerprinting, semantic search)
  - MCP Server (8 tools, token-efficient)
  - Agentic AI Copilot (ReAct loop, tool use, confirmation flow)
## User Personas (QA Lead, SDET, DevOps Engineer, Engineering Manager)
## Integration Matrix
## Non-Functional Requirements (perf, security, scalability)
```

### 2.2 Create `specs/ARCHITECTURE.md` — System Design

**What**: Authoritative architecture document.
**Why**: The tempo version says "MongoDB on AWS" — completely wrong. We need the real architecture.

Content derived from:
- `docs/architecture.md` (mermaid diagrams, component descriptions)
- `docs/specs/ai-integration/ARCHITECTURE.md` (AI subsystem)
- tempo `CLAUDE.md` lines 50-250 (detailed backend/frontend architecture)

Sections:
```
# TestOps Companion — System Architecture
## System Overview (mermaid diagram from docs/architecture.md)
## Tech Stack
  - Backend: Node.js 18+ / TypeScript / Express / Prisma / PostgreSQL / Redis
  - Frontend: React 18 / TypeScript / MUI / Zustand / React Query / Vite
  - AI: Anthropic Claude / OpenAI / Google Gemini / Azure OpenAI / Weaviate
  - Infra: Docker / GitHub Actions / Grafana / Prometheus
## Request Flow (auth → routing → controller → service → DB)
## Backend Architecture (service layer pattern, middleware stack)
## Frontend Architecture (component hierarchy, state management)
## AI Subsystem (providers, features, tools, ReAct loop)
## Data Layer (PostgreSQL schema, Redis caching strategy, Weaviate collections)
## Integration Architecture (Jira, Confluence, GitHub, Jenkins, Slack)
## Deployment Architecture (Docker Compose, production config)
## Key Design Decisions (ADR-style inline)
```

### 2.3 Create `specs/DESIGN_LANG_V2.md` — UI Design Language

**What**: Comprehensive design system document for TestOps Companion's UI.
**Why**: Design decisions currently live only in `theme.ts` code. Need a spec that AI and humans can reference.

Content derived from:
- `frontend/src/theme.ts` (actual color palette, typography, spacing)
- `frontend/src/styles/agentic-theme.css` (agentic UI patterns)
- Component audit of `frontend/src/components/`

Sections:
```
# TestOps Companion — Design Language v2
## Design Philosophy
  - Command-center aesthetic (dark mode, data-dense, scannable)
  - Density with breathability (operational dashboards, not marketing pages)
  - Trust through transparency (AI actions visible, confirmable, explainable)
## Color System
  - Primary: #3b82f6 (Blue) — actions, links, focus
  - Secondary: #8b5cf6 (Purple) — AI features, intelligence
  - Status colors: success (#10b981), error (#ef4444), warning (#f59e0b)
  - Surfaces: #0f172a (background), #1e293b (paper), #334155 (divider)
## Typography
  - Font stack: Inter / Roboto / system
  - Monospace: JetBrains Mono (logs, code, terminal output)
  - Scale: h1 (2.5rem/700) → body2 (0.875rem/400)
## Component Catalog
  - Dashboard widgets (pipeline status, failure trends, test health)
  - AI Copilot panel (chat, tool calls, confirmation cards)
  - Data tables (sortable, filterable, paginated)
  - Status badges, chips, indicators
## Interaction Patterns
  - Drill-down: dashboard → pipeline → test run → failure detail
  - AI confirmation flow: suggest → review → approve/deny
  - Inline actions: quick-create Jira ticket, link knowledge base
## Accessibility
  - WCAG 2.1 AA target
  - Keyboard navigation for all interactive elements
  - Color-independent status indicators (icons + color)
## BEM Naming Convention
  - Pattern: .ComponentName__element--modifier
  - AI components: .AICopilot__message--tool-call
```

### 2.4 Create `specs/AI_TOOLS.md` — AI Tool Registry

**What**: Catalog of all AI tools available to the agentic copilot.
**Why**: Tempo version describes generic ML tools. We need our actual tool registry documented.

Content derived from:
- `backend/src/services/ai/tools/*.ts` (11 tool files)
- `backend/src/services/ai/tools/registry.ts` (tool registration)
- `backend/src/services/ai/tools/types.ts` (tool type definitions)
- `mcp-server/SKILL.md` (MCP tools)

Sections:
```
# TestOps Companion — AI Tools Registry
## Tool Architecture
  - Tool definition schema (name, description, parameters, handler)
  - Read vs Write tool classification
  - Confirmation requirement for write tools
## Read Tools (safe, no side effects)
  - dashboard: get-pipeline-status, get-failure-trends, get-test-health
  - github: get-commits, get-pr-changes, get-repo-info
  - jira: search-issues, get-issue-details
  - confluence: search-pages, get-page-content
  - jenkins: get-build-status, get-build-log
## Write Tools (require confirmation)
  - github-write: create-issue, add-comment, create-pr
  - github-advanced-write: create-branch, merge-pr
  - jira-write: create-issue, update-issue, add-comment, transition-issue
## AI Feature Services (non-tool AI capabilities)
  - RCA matching (semantic search via Weaviate)
  - Failure categorization (6 categories)
  - Log summarization
  - Cross-platform context enrichment
## MCP Server Tools (8 tools)
  - Reference: mcp-server/SKILL.md
## Adding New Tools (workflow)
  - Step-by-step guide for adding a read or write tool
  - Testing requirements
  - Registration in tools/index.ts
```

### 2.5 Create `specs/API_CONTRACT.md` — API Specification

**What**: Formal API contract covering all endpoints.
**Why**: `docs/api.md` exists but isn't positioned as a contract spec.

Content derived from:
- `docs/api.md` (existing API docs — substantial)
- `docs/specs/ai-integration/API.md` (AI endpoints)
- `backend/src/routes/` (route definitions — source of truth)

Sections:
```
# TestOps Companion — API Contract
## Base URL: /api/v1
## Authentication (JWT Bearer, refresh tokens, token blacklist)
## Endpoints
  - Auth: register, login, refresh, logout, me, SAML
  - Pipelines: CRUD, sync, dashboard stats
  - Test Runs: CRUD, filtering, analytics
  - Notifications: CRUD, preferences
  - AI: chat, enrich, categorize, health
  - Integrations: Jira, Confluence, GitHub, Jenkins
  - Admin: users, settings, audit
## Error Responses (standard error shape)
## Rate Limiting
## Pagination Convention
## Versioning Strategy
```

### 2.6 Create `specs/SECURITY.md` — Security Architecture

**What**: Security architecture and threat model (not just vulnerability disclosure).
**Why**: `docs/project/SECURITY.md` is a disclosure policy. We need the design-level security spec.

Content derived from:
- `docs/project/SECURITY.md` (disclosure policy — keep reference)
- `specs/a-team/SECURITY_ENGINEER.md` (persona guidance)
- `backend/src/middleware/auth.ts` (JWT implementation)
- `backend/src/services/tokenBlacklist.service.ts`
- CHANGELOG entries for security fixes (v2.7.1)

Sections:
```
# TestOps Companion — Security Architecture
## Authentication
  - JWT access + refresh tokens
  - Token blacklist (Redis-backed)
  - SAML SSO (enterprise)
  - Password hashing (bcrypt)
## Authorization
  - Role hierarchy: Admin > Editor > User > Billing > Viewer
  - Route-level guards (middleware)
  - Resource ownership checks
## Data Protection
  - Secrets: env-based, never in code
  - SSRF protection on external integrations
  - Input validation (Zod schemas)
  - SQL injection prevention (Prisma ORM)
  - XSS prevention (React escaping + Helmet)
## AI-Specific Security
  - Tool confirmation gates (write tools require user approval)
  - Prompt injection mitigation
  - API key rotation for AI providers
  - Cost budget limits
## Vulnerability Disclosure (link to docs/project/SECURITY.md)
## Security Checklist (for PR reviews)
```

### 2.7 Move Roadmap to `specs/roadmap/ROADMAP.md`

**What**: Move the existing comprehensive roadmap to specs.
**Why**: Canonical location per the Smart Coding Architecture.

- Copy `docs/project/ROADMAP.md` to `specs/roadmap/ROADMAP.md`
- Keep `docs/project/ROADMAP.md` as a symlink or redirect note
- Content is already excellent and TestOps-specific (shipped v1.0→v2.8, planned v2.9→v3.0)

---

## Phase 3: Skills & Workflows (Third PR)

### 3.1 Create `.cursor/skills/add-ai-tool.md`

**What**: Step-by-step workflow for adding a new AI tool to the copilot.
**Why**: This is our most common AI development task. Codify the workflow.

Adapted from EMHub template but TestOps-specific:
```
# Skill: Add AI Tool to Copilot
## Prerequisites
## Step 1: Define tool type in backend/src/services/ai/tools/types.ts
## Step 2: Implement tool handler
## Step 3: Register in tools/index.ts
## Step 4: Classify as read or write tool
## Step 5: Add confirmation requirement (if write tool)
## Step 6: Write tests (unit + integration)
## Step 7: Update specs/AI_TOOLS.md
## Step 8: Test in copilot chat
## Verification checklist
```

### 3.2 Create `.cursor/skills/database-migration.md`

**What**: Workflow for Prisma schema changes and migrations.
**Why**: Schema changes are high-risk and need a repeatable process.

```
# Skill: Database Migration
## Prerequisites
## Step 1: Update backend/prisma/schema.prisma
## Step 2: Generate migration (npx prisma migrate dev --name <name>)
## Step 3: Review generated SQL
## Step 4: Update seed data if needed
## Step 5: Verify migration rollback
## Step 6: Update specs/ARCHITECTURE.md (data layer section)
## Step 7: Update API types if schema affects endpoints
## Step 8: Run full test suite
## Verification checklist
```

### 3.3 Create `.cursor/skills/feature-workflow.md`

**What**: End-to-end workflow for implementing a new feature.
**Why**: Standardize how features are built across the team.

```
# Skill: Feature Development Workflow
## Step 1: Read AGENTS.md (always first)
## Step 2: Route to persona (specs/team/TEAM_SELECTION.md)
## Step 3: Check specs for prior art
## Step 4: Create plan in plans/ (if complex)
## Step 5: Implement (backend → frontend → tests)
## Step 6: Run verification loop (test, build, lint, docs)
## Step 7: Update specs (SPEC.md, ARCHITECTURE.md, etc.)
## Step 8: Conventional commit (feat/fix/docs/refactor/test/chore)
## Definition of Done checklist
```

---

## Phase 4: Wire It All Together

### 4.1 Update AGENTS.md Cross-References

Ensure AGENTS.md links to all new specs and the persona system.

### 4.2 Update `.gitignore`

Add `plans/*.draft.md` for work-in-progress plans that shouldn't be committed.

### 4.3 Verify Documentation Coherence

Run a check that:
- Every spec file referenced in AGENTS.md exists
- Every persona file referenced in TEAM_SELECTION.md exists
- All `specs/` files have consistent formatting
- No stale EMHub references remain

---

## What We're NOT Doing

1. **NOT deleting `docs/`** — existing docs remain as detailed reference material
2. **NOT duplicating content** — specs reference docs where appropriate
3. **NOT changing the codebase** — this is a spec/documentation restructure only
4. **NOT adopting MongoDB** — the tempo ARCHITECTURE.md was wrong; we keep PostgreSQL
5. **NOT reducing personas** — our 10 > EMHub's 5
6. **NOT blindly copying EMHub** — every file is rewritten for TestOps domain

---

## Missing Files Check

**Available on tempo (usable as-is or with adaptation)**:
- AGENTS.md — needs major rewrite (too generic)
- CLAUDE.md — comprehensive, great source material
- specs/SPEC.md — generic placeholder, rewrite fully
- specs/ARCHITECTURE.md — wrong (says MongoDB), rewrite fully
- specs/DESIGN_LANG_V2.md — generic placeholder, rewrite fully
- specs/AI_TOOLS.md — generic ML template, rewrite fully
- specs/API_CONTRACT.md — single endpoint example, rewrite fully
- specs/SECURITY.md — generic, rewrite fully
- specs/roadmap/ROADMAP.md — generic, replace with existing `docs/project/ROADMAP.md`
- .cursor/skills/*.md — generic GH Actions templates, rewrite for TestOps

**Files I need you to upload to tempo if you want me to reference them**:
- None strictly required. The codebase + existing `docs/` have everything we need.
- If EMHub has a real DESIGN_LANG_V2.md (not the placeholder), that would be useful as style inspiration.

---

## Implementation Order

| Phase | PR | Files Created/Modified | Effort |
|-------|----|-----------------------|--------|
| 1 | Foundation | AGENTS.md, CLAUDE.md, specs/team/ rename, plans/ | Medium |
| 2 | Living Specs | SPEC.md, ARCHITECTURE.md, DESIGN_LANG_V2.md, AI_TOOLS.md, API_CONTRACT.md, SECURITY.md, ROADMAP.md | Large |
| 3 | Skills | .cursor/skills/ (3 files) | Small |
| 4 | Wiring | Cross-references, .gitignore, coherence check | Small |

Phases 1-2 can be done together if preferred. Phase 3 is independent. Phase 4 is a finishing pass.

---

## Success Criteria

After adoption, any AI agent (Claude Code, Cursor, Copilot) working on this repo will:

1. Read `AGENTS.md` first and understand the entire project
2. Find the right persona via `specs/team/TEAM_SELECTION.md`
3. Check the design language before touching UI
4. Know every AI tool available before adding new ones
5. Follow a consistent feature workflow
6. Update specs whenever behavior changes
7. Pass the verification loop before completing any task

**The test**: A new AI agent, with zero prior context, should be able to implement a feature correctly by just reading the spec files in order.

---

## Decision: Proceed?

Approve this plan to begin Phase 1 implementation on branch `claude/consolidate-config-ai-services-eoQHg`.
