# Lessons Learned — Living Document

> **Owner**: Release QA Engineer + all personas
> **Status**: Living document — updated every sprint
> **Purpose**: Track recurring error patterns, root causes, and preventive measures so we never repeat the same class of failure twice.
> **Current Version**: 3.0.1

---

## Quick Reference: Never Do These

These are the distilled "never again" rules from every incident below. **Read this first.**

| Rule | Why | Pattern |
|------|-----|---------|
| Never add a Prisma model to one schema without adding it to all three | Silent erasure in demo mode; broken Docker builds | EPR-001 |
| Never import a package without verifying it's in `package.json` | Phantom imports pass locally but explode in CI | EPR-002 |
| Never keep an unmaintained dependency with a known CVE | Security bypass risk; forks exist for a reason | EPR-003 |
| Never assume `npm audit` alone catches transitive vulnerabilities | Use `overrides` in `package.json` when transitives are pinned | EPR-004 |
| Never trust types from third-party libraries without narrowing | `unknown` fields cause TS failures under strict mode | EPR-005 |
| Never put business logic or Prisma imports in controllers | Fat controllers slow onboarding and block testing | EPR-006 |
| Never assume the migration baseline has all current models | Baselines go stale as models are added; regenerate periodically | EPR-007 |
| Never assume code that compiles against SQLite also compiles against PostgreSQL | Enum representation differs; use schema-agnostic return types | EPR-008 |
| Never assume CI environments have the same env vars as local dev | Missing `REDIS_URL` or `AI_ENABLED` causes test failures invisible locally | EPR-009 |
| Never mix setup and server start in one concurrent command | If setup fails, the concurrent server processes mask the error | EPR-010 |
| Never use `ts-node` for seed/script execution on Node 23+ | `ts-node` v10 misresolves Prisma re-exported types; use `tsx` | EPR-011 |
| Never register a Playwright catch-all route after specific routes | LIFO order means catch-all evaluates first, hijacking all requests | EPR-012 |
| Never ship demo mode with core features disabled in generated .env | `AI_ENABLED=false` in deploy-demo.sh disables the entire AI copilot | EPR-013 |
| Never fall back to MemoryStore silently in production | Missing Redis causes session loss on restart with no log warning | EPR-014 |
| Never let CI workflows unconditionally overwrite release content | Custom release notes get clobbered on every tag push | EPR-015 |
| Never run monorepo sub-project tools from the root without `cd` | eslint/tsc can't find tsconfig.json when invoked from repo root | EPR-016 |
| Never ship a release without verifying `npm audit --audit-level=high` passes in CI | Transitive dependency CVEs (e.g. minimatch ReDoS) break the security audit gate post-merge | EPR-017 |
| Never add a required env var without updating deploy-demo.sh | Fresh-clone users hit ZodError crash on `npm run dev:simple` | EPR-018 |

---

## How to Use This Document

1. **After every incident or sprint postmortem**, add an entry to the Error Pattern Registry below
2. **Before every sprint**, review the Prevention Checklist to verify all guards are still active
3. **When adding a new CI gate**, add it to the Automated Guards table
4. **When closing a pattern**, mark it as "Mitigated" with the sprint and mechanism
5. **When onboarding**, read the Quick Reference table above — these are the hard-won rules

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

### EPR-007: Migration Baseline Incompleteness

| Field | Value |
|-------|-------|
| **Pattern** | Production migration baseline (`0001_baseline/migration.sql`) doesn't include all models from the current schema — new models added over time were never backfilled into the baseline |
| **First seen** | Sprint 7 (2026-02-21) |
| **Impact** | P1 — Docker production deployments (`prisma migrate deploy`) create an incomplete database (12 of 22 tables, 4 of 5 enums). Missing tables: `team_members`, `dashboard_configs`, `shared_analyses`, `channel_user_mappings`, `failure_comments`, `failure_patterns`, `ai_usage`, `jira_issues`, `confluence_pages`, `testrail_runs`. Missing enum: `AutonomyLevel` |
| **Root cause** | The baseline migration was generated from an early schema. As 10 models were added across Sprints 4-6, the baseline was never regenerated. Demo mode (`prisma db push`) doesn't use migrations so the gap was invisible locally |
| **Prevention** | Regenerate baseline whenever models are added. CI production typecheck step validates schema compiles, but a dedicated migration completeness check would catch this class earlier |
| **CI guard** | `backend-ci.yml` step "Typecheck with production schema" validates compilation; `installation-test.yml` Docker build validates the full deploy path |
| **Status** | **Mitigated** (Sprint 7) — Baseline regenerated with all 22 tables and 5 enums |

---

### EPR-008: Cross-Database Type Mismatch (SQLite vs PostgreSQL Enums)

| Field | Value |
|-------|-------|
| **Pattern** | TypeScript code compiles cleanly against the SQLite (dev) schema but fails against the PostgreSQL (production) schema because enum types are represented differently |
| **First seen** | Sprint 7 (2026-02-21) |
| **Impact** | P1 — Backend Docker production build fails with `tsc` error in `prismaHelpers.ts` |
| **Root cause** | `mapPipelineType()` used a string union return type (`'CI' \| 'CD' \| ...`). SQLite Prisma generates string unions for enums, so this compiles. PostgreSQL Prisma generates real enum types (`$Enums.PipelineType`), making the string union incompatible |
| **Fix** | Changed return type to `Prisma.PipelineCreateInput['type']` — schema-agnostic, works with both SQLite strings and PostgreSQL enums |
| **Prevention** | Always use Prisma's own input/output types (`Prisma.XxxCreateInput['field']`) instead of hand-written unions when dealing with enum fields. The CI "Typecheck with production schema" step catches this automatically |
| **CI guard** | `backend-ci.yml` step "Typecheck with production schema (PostgreSQL enums)" |
| **Status** | **Mitigated** (Sprint 7) — all enum-mapping functions now use schema-agnostic types |

---

### EPR-009: CI Environment Variable Gap

| Field | Value |
|-------|-------|
| **Pattern** | CI test workflows don't set all environment variables that the backend expects, causing failures that don't reproduce in local development (where `.env` files exist) |
| **First seen** | Sprint 7 (2026-02-21) |
| **Impact** | P2 — Installation-test and Docker production CI workflows fail. Backend crashes on startup attempting Redis connection or AI provider initialization |
| **Root cause** | `installation-test.yml` didn't set `REDIS_URL` (backend's graceful degradation needs the var even if Redis is unreachable) or `AI_ENABLED=false` (without this, AI initialization tries to contact providers without API keys). The frontend Dockerfile baked `VITE_API_URL` at build time for all stages including production |
| **Prevention** | Maintain a CI environment variable checklist in this document (see below). When adding a new backend dependency or feature flag, add the corresponding env var to all CI workflows |
| **CI guard** | `installation-test.yml` now includes `REDIS_URL=redis://redis:6379` and `AI_ENABLED=false` |
| **Status** | **Mitigated** (Sprint 7) |

**Required CI Environment Variables** (update when adding new dependencies):

```
NODE_ENV=production
DATABASE_URL=<postgres connection string>
REDIS_URL=redis://redis:6379
AI_ENABLED=false
JWT_SECRET=<any value for tests>
```

### EPR-010: Concurrent Setup + Server Start

| Field | Value |
|-------|-------|
| **Pattern** | `concurrently` running database setup (generate + migrate + seed) alongside the dev server, causing interleaved output and masked failures |
| **First seen** | Sprint 7 (2026-02-21) |
| **Impact** | P1 — Seed crash exits backend but frontend keeps running; user sees garbled `[0]`/`[1]`/`[2]` output and can't diagnose the failure |
| **Root cause** | `npm run dev:simple` used `concurrently` to run setup, frontend, and browser open simultaneously. When the seed failed, only the `[0]` process exited; the `[1]` frontend kept running, making the error look like a proxy issue |
| **Fix** | Separate setup from server start: `scripts/deploy-demo.sh` (sequential, `set -e`, numbered steps) then `npm run dev` (concurrent server only) |
| **CI guard** | Deploy script verifies `dev.db` exists before declaring success (`exit 1` if missing) |
| **Status** | **Mitigated** (Sprint 7) |

### EPR-011: ts-node Type Resolution on Node 23+

| Field | Value |
|-------|-------|
| **Pattern** | `ts-node` v10 misresolves Prisma re-exported types (`Pipeline`, `Prisma.TestRailRunCreateManyInput`) as `never` on Node 23+ |
| **First seen** | Sprint 7 (2026-02-21) |
| **Impact** | P1 — Demo seed fails to compile, blocking all new-user onboarding |
| **Root cause** | Node 23 changed module loading internals. `ts-node` v10 can't follow the `@prisma/client` → `.prisma/client/default` re-export chain for some types. Only certain model types (Pipeline, TestRailRun) were affected; others resolved correctly |
| **Fix** | Replaced `ts-node` with `tsx` (esbuild-based, zero-config, Node 23+ compatible). Added `tsx ^4.21.0` to backend devDependencies. Updated all seed scripts |
| **CI guard** | `deploy-demo.sh` uses `tsx` for seed execution; if compilation fails, `set -e` kills the script |
| **Status** | **Mitigated** (Sprint 7) |

### EPR-012: Playwright Route Ordering (LIFO Catch-All Trap)

| Field | Value |
|-------|-------|
| **Pattern** | Catch-all `page.route('**/api/v1/**')` registered LAST in `mockDashboardAPIs()` evaluates FIRST due to Playwright's LIFO (last-in-first-out) handler order — intercepts ALL requests before specific handlers (auth, dashboard, chat) can fire |
| **First seen** | Sprint 7 (2026-02-22) |
| **Impact** | P1 — 13/15 E2E tests fail. GET `/auth/me` returns `{ data: [] }` instead of user object → auth fails → redirect to /login. POST `/auth/login` calls `route.continue()` → network → ECONNREFUSED |
| **Root cause** | `mockDashboardAPIs()` registered specific routes first, then a catch-all last. Playwright evaluates handlers in reverse registration order (LIFO), so the catch-all ran first for every request, shadowing all specific handlers |
| **Fix** | Register catch-all FIRST in `setupAuthenticatedSession()` (so it evaluates LAST in LIFO), then register specific routes after (so they evaluate FIRST) |
| **Prevention** | Always register Playwright catch-all/fallback routes BEFORE specific routes. Add a comment explaining LIFO evaluation. Consider using `route.fallback()` for pass-through patterns |
| **CI guard** | E2E test suite (`npx playwright test`) — all 15 tests must pass |
| **Status** | **Mitigated** (Sprint 7) |

---

### EPR-013: Demo Mode Feature Flags (AI Disabled in Generated .env)

| Field | Value |
|-------|-------|
| **Pattern** | `deploy-demo.sh` generates `backend/.env` with `AI_ENABLED=false`, disabling the entire AI copilot in demo mode. The mock provider exists and works correctly, but `AIChatService.handleChatStream()` short-circuits before reaching it |
| **First seen** | Sprint 7 (2026-02-22) |
| **Impact** | P1 — Copilot shows "AI services are not initialized or enabled" for every query. No tool cards rendered, no Giphy, no agentic workflow visible. Demo mode is fundamentally broken |
| **Root cause** | The demo script was written conservatively with `AI_ENABLED=false` to avoid API key errors. But the mock provider (`AI_PROVIDER=mock`) doesn't need API keys and is specifically designed for demo mode |
| **Fix** | Changed `deploy-demo.sh` to generate `AI_ENABLED=true`, `AI_PROVIDER=mock`, `AI_MODEL=mock` in the .env file |
| **Prevention** | Demo script must enable mock provider. Smoke test after deploy: verify copilot responds with tool cards. Add `GIPHY_ENABLED=true` for full demo experience |
| **CI guard** | Deploy-demo smoke test should verify copilot functionality (not just server start) |
| **Status** | **Mitigated** (Sprint 7) |

### EPR-014: Silent Session Store Fallback

| Field | Value |
|-------|-------|
| **Pattern** | Infrastructure dependency falls back silently without any warning, leaving operators unaware their sessions are ephemeral |
| **First seen** | Sprint 8 (2026-02-26) |
| **Impact** | P2 — Production users lose sessions on backend restart; no log evidence of why |
| **Root cause** | `app.ts` session config checked `redis.status` and used MemoryStore fallback, but the `else` branch had no logging. CSRF was mischaracterized as Redis-dependent in release notes, but it actually uses stateless double-submit cookie pattern |
| **Fix** | Added `logger.warn()` in the `else` branch clarifying MemoryStore is active and CSRF is unaffected |
| **Prevention** | Every infrastructure fallback must log at `warn` level with impact description |
| **CI guard** | Code review convention — fallback branches must include logging |
| **Status** | **Mitigated** (Sprint 8) — startup warning added, docs corrected |

---

### EPR-015: CI Release Notes Overwrite

| Field | Value |
|-------|-------|
| **Pattern** | GitHub Actions release workflow unconditionally creates/overwrites release body, destroying manually curated release notes |
| **First seen** | Sprint 8 (2026-02-26) |
| **Impact** | P1 — v3.0.0 GA release notes were overwritten twice by auto-generated commit lists |
| **Root cause** | `release.yml` used `softprops/action-gh-release` without checking if a release with custom content already existed. Every `git tag` push triggered a fresh overwrite |
| **Fix** | Added a guard step that queries the existing release body via `gh release view`. If custom notes exist (not auto-generated "Changes in this release" text), the workflow skips creation |
| **Prevention** | Release workflows must be idempotent — check before write. Custom content takes precedence over auto-generated content |
| **CI guard** | `release.yml` step "Check if release already exists" |
| **Status** | **Mitigated** (Sprint 8) — guard step prevents overwrite of custom release notes |

---

### EPR-016: Monorepo lint-staged Path Resolution

| Field | Value |
|-------|-------|
| **Pattern** | Pre-commit hook runs linter from repo root, but the linter needs `tsconfig.json` from the sub-project directory |
| **First seen** | Sprint 8 (2026-02-26) |
| **Impact** | P2 — Pre-commit hook fails with ENOENT or tsconfig errors, blocking all commits |
| **Root cause** | `lint-staged` invokes eslint from the repo root. The backend/frontend eslint configs reference `tsconfig.json` via relative path, which doesn't resolve from root |
| **Fix** | Changed lint-staged to use `bash -c 'cd backend && node_modules/.bin/eslint --fix "$@"' _` pattern, which changes to the sub-project directory before running eslint |
| **Prevention** | In monorepo lint-staged configs, always `cd` into the sub-project before invoking tools that depend on local config files |
| **CI guard** | Pre-commit hook itself — if it fails, commits are blocked |
| **Status** | **Mitigated** (Sprint 8) — lint-staged config uses `cd` pattern |

### EPR-017: Transitive Dependency CVEs Break CI Security Audit

| Field | Value |
|-------|-------|
| **Pattern** | Release ships successfully locally but CI security audit gate (`npm audit --audit-level=high`) fails on `main` due to transitive dependency vulnerabilities not checked during the local verification loop |
| **First seen** | Sprint 8 (2026-02-27) |
| **Impact** | P1 — CI red on main immediately after a release merge; blocks downstream workflows |
| **Root cause** | v3.0.1 local verification loop ran test, typecheck, lint, build, architecture, health — but **did not run `npm audit`**. `minimatch 10.2.2` had two high-severity ReDoS advisories (GHSA-7r86-cg39-jmmj, GHSA-23c5-xmqv-rm74) in both backend and frontend `node_modules` |
| **Fix** | `npm audit fix` in both backend and frontend updated minimatch to 10.2.3+. Remaining 16 low-severity AWS SDK transitives are upstream (fast-xml-parser) and don't fail the high-severity gate |
| **Prevention** | Add `npm audit --audit-level=high` to the AGENTS.md §5 verification loop so it runs before every commit |
| **CI guard** | `npm audit --audit-level=high` step in backend-ci and frontend-ci workflows |
| **Status** | **Mitigated** (Sprint 8) — minimatch patched; verification loop updated |

### EPR-018: Deploy Script Missing Required Env Var

| Field | Value |
|-------|-------|
| **Pattern** | A required env var is added to the Zod config schema but not added to the `deploy-demo.sh` env generator, causing fresh-clone users to hit an immediate ZodError crash |
| **First seen** | Sprint 8 (2026-02-27) |
| **Impact** | P0 — `npm run dev:simple` crashes on first run for any new user; completely blocks demo |
| **Root cause** | `SESSION_SECRET` was added as a required Zod field (`.min(32)`, no `.default()`) but `deploy-demo.sh` was not updated to generate it in `backend/.env` |
| **Fix** | Added `SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")` to deploy-demo.sh |
| **Prevention** | When adding any required env var to config.ts, always update: (1) deploy-demo.sh, (2) .env.example, (3) .env.production.example. Add a checklist item to PR template |
| **CI guard** | Fresh-clone smoke test in installation-test workflow |
| **Status** | **Mitigated** (Sprint 8) — SESSION_SECRET added to deploy-demo.sh |

---

## Automated Guards Summary

| Guard | CI Workflow | What It Catches | Added |
|-------|------------|-----------------|-------|
| `tsc --noEmit` | backend-ci, frontend-ci | Type errors, phantom imports, schema drift | Sprint 3 |
| `tsc --noEmit` (dev schema) | backend-ci | Models missing from `schema.dev.prisma` | Sprint 4 |
| `tsc --noEmit` (production schema) | backend-ci | Cross-database type mismatches (SQLite vs PostgreSQL enums) | Sprint 7 |
| `validate-schema.js --strict-fields` | backend-ci, installation-test | Field-level drift between schemas | Sprint 5 |
| `npm audit --audit-level=high` | backend-ci, frontend-ci | Known vulnerabilities in dependencies | Sprint 4 |
| `eslint` | backend-ci, frontend-ci | Code quality, unused imports, style | Sprint 3 |
| `jest` / `vitest` | backend-ci, frontend-ci | Functional regressions | Sprint 3 |
| Weekly dependency scan | dependencies.yml | Outdated deps, new CVEs, license issues | Sprint 4 |
| Docker production build | installation-test | Dockerfile errors, missing deps, env var gaps | Sprint 7 |
| Playwright E2E | e2e | Frontend integration regressions, auth flow, copilot UI | Sprint 8 |
| Release notes guard | release | Custom release notes not overwritten by CI | Sprint 8 |

---

## Prevention Checklist (Pre-Sprint Review)

Before starting each sprint, the Release QA Engineer verifies:

- [ ] All CI guards in the table above are active and passing on `staging`
- [ ] `npm audit --audit-level=high` returns clean for backend and frontend
- [ ] No "No fix available" critical/high vulnerabilities in production dependencies
- [ ] Schema validation passes with `--strict-fields`
- [ ] All three Prisma schemas are in sync (model + field level)
- [ ] Migration baseline includes all models from `schema.production.prisma` (EPR-007)
- [ ] Backend compiles against both dev and production schemas (EPR-008)
- [ ] CI workflow env vars match the Required CI Environment Variables list (EPR-009)
- [ ] `npm run deploy:demo` completes successfully from a clean state (EPR-010)
- [ ] Seed scripts use `tsx` (not `ts-node`) for Node 23+ compatibility (EPR-011)
- [ ] E2E Playwright catch-all routes are registered BEFORE specific routes (EPR-012)
- [ ] `deploy-demo.sh` generates `.env` with `AI_ENABLED=true` and `AI_PROVIDER=mock` (EPR-013)
- [ ] Tech debt tracker in `ROADMAP.md` is current
- [ ] Infrastructure fallback branches include `logger.warn()` with impact description (EPR-014)
- [ ] Release workflow has guard step to protect custom release notes (EPR-015)
- [ ] lint-staged config uses `cd` pattern for monorepo sub-projects (EPR-016)
- [ ] `npm audit --audit-level=high` is included in the local verification loop before every release commit (EPR-017)
- [ ] Every required env var in `config.ts` exists in `deploy-demo.sh`, `.env.example`, and `.env.production.example` (EPR-018)
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

*Last updated: 2026-02-26 (Sprint 8)*
*Next review: Start of Sprint 9*
