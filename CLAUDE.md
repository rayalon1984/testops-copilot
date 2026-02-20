# CLAUDE.md — TestOps Companion

> **Start here**: Read `AGENTS.md` first. It is the master entrypoint for all AI agents.
> This file adds Claude Code-specific shortcuts and overrides.

---

## Persona Routing (Quick Reference)

Before ANY implementation, route to the right persona. First "yes" wins:

1. Affects authn/authz, secrets, or security posture → `specs/team/SECURITY_ENGINEER.md`
2. Affects AI behavior, tool policy, or system architecture → `specs/team/AI_ARCHITECT.md`
3. Affects schema, migrations, data integrity, or query patterns → `specs/team/DATA_ENGINEER.md`
4. Core output is a UX flow, interaction, or visual hierarchy → `specs/team/UX_DESIGNER.md`
5. Goal is reducing latency, improving throughput, or profiling → `specs/team/PERFORMANCE_ENGINEER.md`
6. Goal is test coverage, CI quality, or contract testing → `specs/team/TEST_ENGINEER.md`
7. About pipelines, deploys, Docker, or runtime observability → `specs/team/DEVOPS_ENGINEER.md`
8. API docs, user guides, or onboarding content → `specs/team/TECHNICAL_WRITER.md`
9. Release process, versioning, or rollback → `specs/team/RELEASE_QA_ENGINEER.md`
10. Clarifying requirements, defining AC, or prioritizing scope → `specs/team/AI_PRODUCT_MANAGER.md`
11. Default (implementation or refactor) → `specs/team/SENIOR_ENGINEER.md`

Full rubric: `specs/team/TEAM_SELECTION.md`

---

## Cross-Domain Tasks

When a task touches multiple domains:
- **Primary owner** = persona for the highest-risk or least-reversible aspect
- **Supporting personas** = read their files too for relevant sections
- **Document trade-offs** explicitly in code comments or PR description

Examples:
- New AI feature + DB schema + UI → Primary: `AI_ARCHITECT`, Supporting: `DATA_ENGINEER`, `UX_DESIGNER`
- Auth system change → Primary: `SECURITY_ENGINEER`, Supporting: `SENIOR_ENGINEER`, `TEST_ENGINEER`
- Perf fix on API → Primary: `PERFORMANCE_ENGINEER`, Supporting: `DATA_ENGINEER`

---

## Verification Checklist

Before completing any task:

- [ ] Code meets `SENIOR_ENGINEER.md` standards (clean, tested, documented)
- [ ] Tests satisfy `TEST_ENGINEER.md` strategy (right layer, high signal)
- [ ] UI passes `UX_DESIGNER.md` checks (clarity, cognitive load, trust)
- [ ] Security reviewed per `SECURITY_ENGINEER.md` if auth/data involved
- [ ] Schema sound per `DATA_ENGINEER.md` if persistence involved
- [ ] AI behavior meets `AI_ARCHITECT.md` trust/explainability bar if AI involved
- [ ] Deploy safety per `DEVOPS_ENGINEER.md` if infra/pipeline involved

---

## Anti-Patterns — Never Do These

- Writing code without reading the relevant persona file first
- Shipping AI features without trust/explainability design
- Skipping security review on auth or data-handling changes
- Optimizing without profiling data
- Making irreversible architecture decisions without documenting trade-offs
- Treating UX as decoration instead of clarity
- Writing tests as an afterthought checkbox

---

## When Unsure

- Ownership unclear → re-read `specs/team/TEAM_SELECTION.md`
- Multiple valid approaches → propose 2-3 options with explicit trade-offs
- Scope creeping → consult `AI_PRODUCT_MANAGER.md` to re-scope
- Hard-to-reverse decision → slow down, read primary + supporting personas first
