# TEAM_SELECTION.md

## Purpose

This document is a **repeatable rubric** for selecting the right agent persona for a task.

Goal:
- Reduce ambiguity and hand-offs
- Route work to the persona with the **highest leverage + accountability**

## Available personas (in `specs/team/`)

- **AI_ARCHITECT** — AI behavior, orchestration, AI UX, cross-cutting architecture
- **AI_PRODUCT_MANAGER** — requirements, acceptance criteria, scope and prioritization
- **SENIOR_ENGINEER** — feature implementation, refactors, maintainability
- **DATA_ENGINEER** — schema/modeling, persistence, query performance, migrations
- **TEST_ENGINEER** — test strategy, coverage, CI quality gates, contract/parity testing
- **UX_DESIGNER** — UX flows, IA, interaction design, UI clarity/trust
- **SECURITY_ENGINEER** — threat modeling, authn/authz boundaries, secure design
- **DEVOPS_ENGINEER** — CI/CD, Docker, deployment, observability, operational safety
- **PERFORMANCE_ENGINEER** — latency/load profiling, benchmarking, perf regressions

---

## Quick selection flow (first “yes” wins)

### 1) Security boundary / risk
Does this change affect **authn/authz**, sensitive data handling, threat surfaces, or hard-to-reverse security posture?

➡️ Select: **SECURITY_ENGINEER**

---

### 2) AI behavior / system-level architecture
Does this materially affect AI behavior, trust/explainability, tool execution policy, or cross-cutting architecture?

➡️ Select: **AI_ARCHITECT**

---

### 3) Data correctness / persistence / migrations
Does this affect schema, migrations, data integrity, query patterns, DB performance, or storage growth?

➡️ Select: **DATA_ENGINEER**

---

### 4) UX / interaction design
Is the core output a user flow, interaction pattern, information hierarchy, or design language compliance?

➡️ Select: **UX_DESIGNER**

---

### 5) Performance / scalability incidents
Is the primary goal reducing latency, improving throughput, load resilience, or profiling a hotspot?

➡️ Select: **PERFORMANCE_ENGINEER**

---

### 6) Testing / quality gates
Is the primary goal improving test coverage/strategy, CI quality, or V1↔V2 parity/contract testing?

➡️ Select: **TEST_ENGINEER**

---

### 7) Deployment / ops / CI-CD
Is the task about pipelines, releases, environments, Docker, runtime observability, or operational risk?

➡️ Select: **DEVOPS_ENGINEER**

---

### 8) Product definition
Is the task clarifying requirements, defining acceptance criteria, or prioritizing scope?

➡️ Select: **AI_PRODUCT_MANAGER**

---

### 9) Default: implementation / refactor
If it’s primarily about implementing, refactoring, or maintaining code:

➡️ Select: **SENIOR_ENGINEER**

---

## Cross-domain tasks

If multiple categories apply:
- **Primary owner** = persona for the highest-risk/least-reversible part
- Other personas contribute within their domain
- Document key trade-offs when decisions are hard to undo

---

## Example routing scenarios

| Task | Persona |
|---|---|
| Add a new AI tool + update tool-call policy | AI_ARCHITECT |
| Add/modify Prisma models + migration | DATA_ENGINEER |
| Define acceptance criteria for Workstreams vNext | AI_PRODUCT_MANAGER |
| Redesign Planning board interactions | UX_DESIGNER |
| Investigate slow `/api/ai/assist` responses | PERFORMANCE_ENGINEER |
| Add V1↔V2 parity tests for migrated endpoints | TEST_ENGINEER |
| Harden auth middleware / scope enforcement | SECURITY_ENGINEER |
| Add CI job to run `pytest` + `vitest` + Playwright | DEVOPS_ENGINEER |
| Ship a new page/feature with tests | SENIOR_ENGINEER |
