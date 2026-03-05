# TEAM_SELECTION.md — Persona Routing Rubric

> **Purpose**: Repeatable rubric for selecting the right agent persona for a task.
> Route work to the persona with the **highest leverage + accountability**.
> **Version**: 3.4.0 · **Last verified**: 2026-03-05

---

## Available Personas

| Persona | File | Domain |
|---------|------|--------|
| `SENIOR_ENGINEER` | `specs/team/SENIOR_ENGINEER.md` | Implementation, refactors, code quality |
| `AI_ARCHITECT` | `specs/team/AI_ARCHITECT.md` | AI behavior, tool policy, system architecture |
| `DATA_ENGINEER` | `specs/team/DATA_ENGINEER.md` | Schema, migrations, queries, data integrity |
| `UX_DESIGNER` | `specs/team/UX_DESIGNER.md` | UX flows, interaction design, UI clarity |
| `PERFORMANCE_ENGINEER` | `specs/team/PERFORMANCE_ENGINEER.md` | Latency, throughput, profiling |
| `TEST_ENGINEER` | `specs/team/TEST_ENGINEER.md` | Test strategy, coverage, CI quality gates |
| `DEVOPS_ENGINEER` | `specs/team/DEVOPS_ENGINEER.md` | Pipelines, Docker, deployment, observability |
| `AI_PRODUCT_MANAGER` | `specs/team/AI_PRODUCT_MANAGER.md` | Requirements, acceptance criteria, scope |
| `TECHNICAL_WRITER` | `specs/team/TECHNICAL_WRITER.md` | API docs, user guides, onboarding, integration guides |
| `RELEASE_QA_ENGINEER` | `specs/team/RELEASE_QA_ENGINEER.md` | Release mgmt, versioning, staging→prod, rollback, changelog |
| `SECURITY_ENGINEER` | `specs/team/SECURITY_ENGINEER.md` | Auth, secrets, threat modeling |

---

## Quick Selection (First "Yes" Wins)

### 1. Security boundary?
Affects authn/authz, secrets, token handling, sensitive data, or security posture?
→ **SECURITY_ENGINEER** (read `specs/SECURITY.md` first)

### 2. AI behavior or architecture?
Affects AI behavior, tool policy, ReAct loop, provider selection, or cross-cutting architecture?
→ **AI_ARCHITECT** (read `specs/AI_TOOLS.md` first)

### 3. Data or persistence?
Affects Prisma schema, migrations, data integrity, query patterns, or storage?
→ **DATA_ENGINEER** (read `specs/ARCHITECTURE.md` §4 first)

### 4. UX or interaction design?
Core output is a user flow, layout, interaction pattern, or visual hierarchy?
→ **UX_DESIGNER** (read `specs/DESIGN_LANG_V2.md` first)

### 5. Performance?
Goal is reducing latency, improving throughput, or profiling a hotspot?
→ **PERFORMANCE_ENGINEER**

### 6. Test coverage or CI quality?
Goal is test strategy, coverage improvement, or CI gate quality?
→ **TEST_ENGINEER**

### 7. Deployment or ops?
About pipelines, Docker, environments, releases, or runtime observability?
→ **DEVOPS_ENGINEER**

### 8. API docs, user guides, or onboarding content?
API reference documentation, user guides, README, integration setup guides, onboarding docs, or help text?
→ **TECHNICAL_WRITER** (read `specs/API_CONTRACT.md` first)

### 9. Release process, versioning, or rollback?
Release management, versioning, changelog, staging→prod promotion, RC validation, or rollback planning?
→ **RELEASE_QA_ENGINEER** (read `specs/ARCHITECTURE.md` §8 first)

### 10. Product definition?
Clarifying requirements, defining acceptance criteria, or prioritizing scope?
→ **AI_PRODUCT_MANAGER** (read `specs/SPEC.md` first)

### 11. Default
Implementation or refactor?
→ **SENIOR_ENGINEER**

---

## Cross-Domain Tasks

When a task spans multiple domains:

1. **Primary owner** = persona for the highest-risk or least-reversible aspect
2. **Supporting personas** = read their files for relevant sections
3. **Document trade-offs** in code comments or PR description

| Example Task | Primary | Supporting |
|-------------|---------|------------|
| New AI tool + DB schema + UI | AI_ARCHITECT | DATA_ENGINEER, UX_DESIGNER |
| Auth system change | SECURITY_ENGINEER | SENIOR_ENGINEER, TEST_ENGINEER |
| Perf fix on API endpoint | PERFORMANCE_ENGINEER | DATA_ENGINEER |
| New notification channel | SENIOR_ENGINEER | UX_DESIGNER, TEST_ENGINEER |
| Schema migration + UI update | DATA_ENGINEER | UX_DESIGNER, SENIOR_ENGINEER |

---

## Spec Reading Matrix

Every persona should read at least these specs before working:

| Persona | Required Reading |
|---------|-----------------|
| All | `AGENTS.md`, `specs/SPEC.md` |
| SENIOR_ENGINEER | + `specs/ARCHITECTURE.md`, `specs/API_CONTRACT.md` |
| AI_ARCHITECT | + `specs/AI_TOOLS.md`, `specs/ARCHITECTURE.md` §5 |
| DATA_ENGINEER | + `specs/ARCHITECTURE.md` §4, Prisma schema |
| UX_DESIGNER | + `specs/DESIGN_LANG_V2.md` |
| SECURITY_ENGINEER | + `specs/SECURITY.md` |
| TEST_ENGINEER | + `specs/ARCHITECTURE.md`, test directories |
| DEVOPS_ENGINEER | + `specs/ARCHITECTURE.md` §8, Docker configs |
| PERFORMANCE_ENGINEER | + `specs/ARCHITECTURE.md` §4–5 |
| AI_PRODUCT_MANAGER | + `specs/SPEC.md`, `specs/ROADMAP.md` |
