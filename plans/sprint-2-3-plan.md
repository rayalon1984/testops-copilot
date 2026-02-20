# Sprint 2–3 Plan — Hardening & Release Prep

> **Date**: 2026-02-20
> **Baseline**: Sprint 1 merged to staging (0 errors, 122 warnings, 236 tests passing)
> **Goal**: Zero lint warnings, zero deprecation warnings, clean audit → merge-ready to main

---

## Sprint 2 — Deep Cleanup & Remaining Warnings

### 2A: Eliminate all `@typescript-eslint/no-explicit-any` (122 remaining)

| Category | Files | Est. Count |
|----------|-------|------------|
| AI providers | `providers/*.ts`, `base.provider.ts`, `registry.ts` | ~30 |
| AI services | `AIChatService.ts`, `PersonaRouter.ts`, `cache.ts`, `config.ts`, `provider-config.service.ts` | ~15 |
| AI vector | `vector/client.ts`, `vector/schema.ts`, `vector/search.ts` | ~10 |
| AI tools | `tools/jenkins.ts` | ~2 |
| AI types | `ai/types.ts` | ~5 |
| Type definitions | `types/*.ts`, `types/*.d.ts` | ~40 |
| Routes | `routes/ai/index.ts`, `channel.routes.ts`, `share.routes.ts`, `testRun.routes.ts` | ~10 |
| Utils/server | `utils/prismaHelpers.ts`, `server.ts` | ~10 |

### 2B: Fix Minor Deprecation Issues

| Issue Ref | Task |
|-----------|------|
| M-2 | Enable React Router v7 future flags (`v7_startTransition`, `v7_relativeSplatPath`) |
| M-4 | Migrate Vitest config `deps.inline` → `server.deps.inline` |

### 2C: npm Audit Triage

| Issue Ref | Task |
|-----------|------|
| M-3 | Run `npm audit`, triage: fix what's safe, document what's pinned/deferred |

---

## Sprint 3 — Verification & Gate

- Final `npm run build` / `npm run test` / `npm run typecheck` / `npm run lint`
- Confirm 0 errors, 0 warnings
- Commit, push, create PR targeting staging
- Update sprint-0-report.md with final status

---

## Gate Criteria

| Check | Target |
|-------|--------|
| `npm run build` | GREEN |
| `npm run test` | GREEN, no regressions |
| `npm run typecheck` | 0 errors |
| `npm run lint` | 0 errors, 0 warnings |
| Deprecation warnings | Resolved or documented |
