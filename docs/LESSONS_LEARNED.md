# Lessons Learned — Living Document

> **Owner**: Release QA Engineer + all personas
> **Status**: Living document — updated every sprint
> **Purpose**: Track recurring error patterns, root causes, and preventive measures so we never repeat the same class of failure twice.
> **Current Version**: 2.9.0-rc.4

---

## How to Use This Document

1. **After every incident or sprint postmortem**, add an entry to the Error Pattern Registry below
2. **Before every sprint**, review the Prevention Checklist to verify all guards are still active
3. **When adding a new CI gate**, add it to the Automated Guards table
4. **When closing a pattern**, mark it as "Mitigated" with the sprint and mechanism

---

## Error Pattern Registry

Each entry tracks a class of error (not a single instance) so we catch variations.

### EPR-001: Schema Desynchronization

| Field | Value |
|-------|-------|
| **Pattern** | Model or fields added to one Prisma schema but not propagated to all three (`schema.prisma`, `schema.dev.prisma`, `schema.production.prisma`) |
| **First seen** | Sprint 4 (2026-02-20) |
| **Impact** | P1 — Complete startup failure in demo mode |
| **Root cause** | Manual schema sync with no automated enforcement |
| **Postmortem** | `docs/archive/POSTMORTEM_SPRINT4_DEMO_MODE_FAILURE.md` |
| **Prevention** | `validate-schema.js --strict-fields` in CI (blocks merge) + multi-schema typecheck |
| **CI guard** | `backend-ci.yml` step "Schema parity check" + "Typecheck with dev schema" |
| **Status** | **Mitigated** (Sprint 5) — field-level parity now enforced |
| **Recurrence** | Sprint 5 caught 40 drifted fields across 7 models during reconciliation |

---

### EPR-002: Phantom Import (Unused/Wrong Package Import)

| Field | Value |
|-------|-------|
| **Pattern** | Import from a package that doesn't exist, is misspelled, or has been replaced by another |
| **First seen** | Sprint 5 (2026-02-20) |
| **Impact** | P2 — `tsc --noEmit` failure blocking all CI |
| **Root cause** | `@aws-sdk/client-bedrock` imported but only `@aws-sdk/client-bedrock-runtime` is installed. The import was never executed at runtime (dead code path) so it was invisible until strict typecheck |
| **Prevention** | `tsc --noEmit` runs in CI on every PR. Unused imports flagged by ESLint `no-unused-vars` |
| **CI guard** | `backend-ci.yml` step "Typecheck" |
| **Status** | **Mitigated** (Sprint 5) — removed phantom import, CI catches future occurrences |

---

### EPR-003: Unmaintained Dependency with Known CVE

| Field | Value |
|-------|-------|
| **Pattern** | Production dependency has a known vulnerability with no upstream fix, typically because the package is unmaintained |
| **First seen** | Sprint 5 (2026-02-20) |
| **Impact** | P1 — Critical SAML signature verification bypass (passport-saml) |
| **Root cause** | `passport-saml@3` is unmaintained; the active fork is `@node-saml/passport-saml` |
| **Prevention** | `npm audit --audit-level=high` in CI. Weekly dependency check workflow (`dependencies.yml`) |
| **CI guard** | `backend-ci.yml` step "Security audit" + `dependencies.yml` weekly schedule |
| **Status** | **Mitigated** (Sprint 5) — migrated to maintained fork, all critical/high vulns resolved |
| **Note** | When migrating packages, expect API changes. passport-saml v3 → v5: `path` → `callbackUrl`, `cert` → `idpCert`, added required `logoutVerify` callback |

---

### EPR-004: Transitive Dependency Vulnerability

| Field | Value |
|-------|-------|
| **Pattern** | A direct dependency pulls in a vulnerable transitive dependency that can't be fixed by bumping the direct dep alone |
| **First seen** | Sprint 5 (2026-02-20) |
| **Impact** | P2 — 37 high-severity ReDoS vulns in `minimatch` via eslint, jest, nodemon, etc. + 4 high `tar` vulns via bcrypt's `node-pre-gyp` |
| **Root cause** | Transitive deps pinned by intermediate packages |
| **Prevention** | `overrides` field in `package.json` forces minimum versions. Major version bumps of direct deps when they remove vulnerable transitive chains (e.g., bcrypt 6 drops `node-pre-gyp`/`tar` entirely) |
| **CI guard** | `npm audit --audit-level=high` in CI |
| **Status** | **Mitigated** (Sprint 5) — overrides added, bcrypt upgraded. 8 remaining moderate vulns are dev-only (ESLint 8 → ajv) |

---

### EPR-005: External Library Type Unsafety

| Field | Value |
|-------|-------|
| **Pattern** | Third-party library returns loosely typed values (`unknown`, `any`). Code accesses properties without narrowing, causing TS errors under strict mode |
| **First seen** | Sprint 4 (2026-02-20) |
| **Impact** | P2 — TypeScript compilation failure |
| **Root cause** | `jira-client` library types define `issue.fields.status` as `unknown` |
| **Prevention** | Defensive typing at library boundaries: narrow type assertions + optional chaining + fallback defaults |
| **CI guard** | `tsc --noEmit` with strict mode |
| **Status** | **Mitigated** (Sprint 4) — pattern documented in `SENIOR_ENGINEER.md` |

---

### EPR-006: Fat Controller (Mixed Concerns in HTTP Layer)

| Field | Value |
|-------|-------|
| **Pattern** | Controller files import Prisma directly and contain business logic, data transformation, and error handling that belongs in a service layer |
| **First seen** | Sprint 6 (2026-02-20) |
| **Impact** | P3 — No runtime failure, but slows onboarding, makes testing harder, and couples HTTP layer to ORM |
| **Root cause** | Organic growth — features added directly to controllers without extracting a service. 5 of 14 controllers had direct `prisma` imports |
| **Prevention** | "Thin Controller Rule" in `SENIOR_ENGINEER.md`: controllers MUST NOT import Prisma or contain business logic. Route → Controller → Service → Prisma |
| **CI guard** | Code review convention (no automated lint rule yet). Future: ESLint custom rule to ban `prisma` imports in `controllers/` directory |
| **Status** | **Mitigated** (Sprint 6) — 4 fat controllers extracted to services (pipeline, dashboard, auth, notification). 778-line AI route monolith split into 3 sub-modules |
| **Metrics** | pipeline: 264→61 lines, dashboard: 466→31 lines, auth: 245→47 lines, notification: 244→54 lines |

---

## Automated Guards Summary

| Guard | CI Workflow | What It Catches | Added |
|-------|------------|-----------------|-------|
| `tsc --noEmit` | backend-ci, frontend-ci | Type errors, phantom imports, schema drift | Sprint 3 |
| `tsc --noEmit` (dev schema) | backend-ci | Models missing from `schema.dev.prisma` | Sprint 4 |
| `validate-schema.js --strict-fields` | backend-ci, installation-test | Field-level drift between schemas | Sprint 5 |
| `npm audit --audit-level=high` | backend-ci | Known vulnerabilities in dependencies | Sprint 4 |
| `eslint` | backend-ci, frontend-ci | Code quality, unused imports, style | Sprint 3 |
| `jest` / `vitest` | backend-ci, frontend-ci | Functional regressions | Sprint 3 |
| Weekly dependency scan | dependencies.yml | Outdated deps, new CVEs, license issues | Sprint 4 |

---

## Prevention Checklist (Pre-Sprint Review)

Before starting each sprint, the Release QA Engineer verifies:

- [ ] All CI guards in the table above are active and passing on `staging`
- [ ] `npm audit --audit-level=high` returns clean for backend and frontend
- [ ] No "No fix available" critical/high vulnerabilities in production dependencies
- [ ] Schema validation passes with `--strict-fields`
- [ ] All three Prisma schemas are in sync (model + field level)
- [ ] Tech debt tracker in `ROADMAP.md` is current
- [ ] This document has been reviewed for new patterns from the previous sprint

---

## Version Bump Triggers

Per semver and the `RELEASE_QA_ENGINEER.md` version strategy:

| Trigger | Version Change | Example |
|---------|---------------|---------|
| New feature (backward-compatible) | Minor bump | 2.9.0 → 2.10.0 |
| Bug fix, security patch, docs | Patch bump | 2.9.0 → 2.9.1 |
| Breaking API change | Major bump | 2.9.0 → 3.0.0 |
| Stabilization work on RC | RC increment | 2.9.0-rc.2 → 2.9.0-rc.3 |
| RC promoted to stable | Drop RC suffix | 2.9.0-rc.3 → 2.9.0 |

**Rule**: Every merged PR that changes runtime behavior bumps the version. Documentation-only PRs do not require a bump but should reference the current version.

---

*Last updated: 2026-02-20 (Sprint 6)*
*Next review: Start of Sprint 7*
