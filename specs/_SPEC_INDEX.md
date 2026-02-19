# _SPEC_INDEX.md — Specification Directory

> **Purpose**: Single index of all living specs. If a document isn't listed here, it's not canonical.

---

## Entrypoints

| Document | Purpose | Read First? |
|----------|---------|-------------|
| `AGENTS.md` (repo root) | Master AI agent instructions | Always |
| `CLAUDE.md` (repo root) | Claude Code-specific overrides | Always (Claude Code) |

---

## Living Specs

| File | Owner Persona | Content |
|------|--------------|---------|
| `specs/SPEC.md` | AI_PRODUCT_MANAGER | Product specification — mission, users, capabilities, NFRs, metrics |
| `specs/ARCHITECTURE.md` | SENIOR_ENGINEER | System design — layers, services, data model, AI architecture, deployment |
| `specs/SECURITY.md` | SECURITY_ENGINEER | Security — auth, RBAC, transport, rate limiting, AI gates, known gaps |
| `specs/AI_TOOLS.md` | AI_ARCHITECT | AI tool registry — 13 tools, ReAct loop, providers, cost, MCP |
| `specs/API_CONTRACT.md` | SENIOR_ENGINEER | API contract — 99 endpoints, auth, roles, validation, schemas |
| `specs/DESIGN_LANG_V2.md` | UX_DESIGNER | Design language — layout, colors, typography, components, a11y |
| `specs/ROADMAP.md` | AI_PRODUCT_MANAGER | Roadmap — shipped versions, planned features, tech debt |

---

## Team Personas

| File | Domain | Routing Step |
|------|--------|-------------|
| `specs/team/TEAM_SELECTION.md` | Routing rubric | — |
| `specs/team/SECURITY_ENGINEER.md` | Auth, secrets, threats | 1 (highest priority) |
| `specs/team/AI_ARCHITECT.md` | AI behavior, tools, architecture | 2 |
| `specs/team/DATA_ENGINEER.md` | Schema, migrations, queries | 3 |
| `specs/team/UX_DESIGNER.md` | UX flows, design, accessibility | 4 |
| `specs/team/PERFORMANCE_ENGINEER.md` | Latency, throughput, profiling | 5 |
| `specs/team/TEST_ENGINEER.md` | Test strategy, coverage, CI gates | 6 |
| `specs/team/DEVOPS_ENGINEER.md` | Pipelines, Docker, observability | 7 |
| `specs/team/AI_PRODUCT_MANAGER.md` | Requirements, scope, acceptance criteria | 8 |
| `specs/team/SENIOR_ENGINEER.md` | Implementation (default) | 9 |

---

## Reading Order by Task Type

### New Feature Implementation
1. `AGENTS.md` → 2. `TEAM_SELECTION.md` → 3. Persona file → 4. `SPEC.md` → 5. `ARCHITECTURE.md` → 6. `API_CONTRACT.md`

### AI Feature Work
1. `AGENTS.md` → 2. `AI_ARCHITECT.md` → 3. `AI_TOOLS.md` → 4. `ARCHITECTURE.md` §5

### Security Change
1. `AGENTS.md` → 2. `SECURITY_ENGINEER.md` → 3. `SECURITY.md`

### UI Work
1. `AGENTS.md` → 2. `UX_DESIGNER.md` → 3. `DESIGN_LANG_V2.md`

### Database Change
1. `AGENTS.md` → 2. `DATA_ENGINEER.md` → 3. `ARCHITECTURE.md` §4

---

## Update Rules

- **When shipping a feature**: Update `SPEC.md` + `ROADMAP.md`
- **When adding an API endpoint**: Update `API_CONTRACT.md`
- **When changing AI tools/behavior**: Update `AI_TOOLS.md`
- **When changing security posture**: Update `SECURITY.md`
- **When changing UI patterns**: Update `DESIGN_LANG_V2.md`
- **When changing schema**: Update `ARCHITECTURE.md` §4
- **When changing deployment**: Update `ARCHITECTURE.md` §8
