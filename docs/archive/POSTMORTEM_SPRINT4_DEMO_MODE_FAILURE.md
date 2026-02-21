# Postmortem: Demo Mode Startup Failure (Sprint 4)

**Date**: 2026-02-20
**Severity**: P1 — Complete startup failure in demo mode
**Duration**: Blocked until hotfix applied
**Author**: AI Team (via Claude Code)

---

## Executive Summary

The backend demo mode (`npm run dev:simple`) suffered **complete startup failure** due to two sequential issues: a strict TypeScript compilation error in `jira.service.ts` (TS18046) and a missing Prisma model in `schema.dev.prisma` (TS2339 x4). Both were silent regressions — no CI gate caught them before merge.

---

## Timeline

| Event | Description |
|-------|-------------|
| Feature merged | `SharedAnalysis` model added to `schema.prisma` for shareable analysis links |
| Regression introduced | Model not propagated to `schema.dev.prisma` or `schema.production.prisma` |
| `jira-client` types regress | `issue.fields.status` inferred as `unknown` (library update or TS strictness change) |
| Demo mode tested | `npm run dev:simple` → **crash on startup** |
| Root cause identified | Two separate issues blocking compilation |
| Hotfix applied | Type cast in jira.service.ts + SharedAnalysis model synced to all schemas |

---

## Issue 1: Jira Service Type Error (TS18046)

### Symptom
```
src/services/jira.service.ts(150,19): error TS18046: 'issue.fields.status' is of type 'unknown'
```

### Root Cause
The `jira-client` library defines `issue.fields.status` with loose typing. Under strict TypeScript, accessing `.name` on an `unknown` type is illegal. This was never caught because CI only typechecks against the production schema (PostgreSQL), and the code path was valid at the time it was written.

### Fix Applied
```typescript
// Before (unsafe)
status: { name: issue.fields.status.name }

// After (defensive)
status: { name: (issue.fields.status as { name?: string })?.name ?? 'Unknown' }
```

### Persona Responsible
**SENIOR_ENGINEER** — Code author should have used defensive typing for external library payloads per AGENTS.md ("Strict TypeScript, no `any`"). The `as any` escape hatch suggested in the RCA violates project standards; the proper fix uses a narrow type assertion with optional chaining.

---

## Issue 2: Prisma Schema Desynchronization (TS2339)

### Symptom
```
src/services/share.service.ts(61,33): error TS2339: Property 'sharedAnalysis' does not exist on type 'PrismaClient'
```
(4 occurrences)

### Root Cause
The `SharedAnalysis` model was added to `schema.prisma` but **not** to `schema.dev.prisma` or `schema.production.prisma`. When `npm run dev:simple` runs, it copies `schema.dev.prisma` → `schema.prisma` and regenerates PrismaClient — erasing the model entirely.

### Fix Applied
Copied the `SharedAnalysis` model (with SQLite-compatible types) into `schema.dev.prisma` and the PostgreSQL version into `schema.production.prisma`.

### Persona Responsible
**DATA_ENGINEER** (primary) — Schema synchronization is a data layer responsibility. The checklist item "Tested with both PostgreSQL and SQLite (demo mode)" existed but was not enforced by CI.

**DEVOPS_ENGINEER** (supporting) — CI pipeline lacked a multi-schema typecheck gate. The existing `validate-schema.js` script checked model name parity but not field-level parity, and was only run in the `installation-test.yml` workflow — not in the primary `backend-ci.yml` that blocks merges.

---

## What We Had vs. What We Needed

| Control | Before (Gap) | After (Fix) |
|---------|-------------|-------------|
| Schema model parity | `validate-schema.js` checks model names only | Now checks **field-level parity** within each model |
| Schema parity in CI | Only in `installation-test.yml` (not blocking) | Added to `backend-ci.yml` (blocks merge) |
| Multi-schema typecheck | Not implemented | CI generates PrismaClient from dev schema and runs `tsc --noEmit` |
| External library typing | No guidance | `SENIOR_ENGINEER.md` now documents defensive typing pattern |
| Checklist enforcement | Manual ("Tested with SQLite") | Automated CI gate |

---

## Preventive Measures Implemented

### 1. Enhanced Schema Validation (`scripts/validate-schema.js`)
- Added `extractModelFields()` — parses field names from each model block
- Field-level parity check: every shared model must have identical field names in both schemas
- Exits non-zero on any mismatch (model or field level)

### 2. Multi-Schema Typecheck in CI (`backend-ci.yml`)
New CI step that:
1. Backs up current `schema.prisma`
2. Copies `schema.dev.prisma` → `schema.prisma`
3. Runs `prisma generate` (SQLite PrismaClient)
4. Runs `tsc --noEmit` (full typecheck against all services)
5. Restores original schema

This catches the exact class of bug that caused this incident.

### 3. Jira Service Type Hardening (`jira.service.ts`)
- `issue.fields.status` now uses `(... as { name?: string })?.name ?? 'Unknown'`
- Follows project standard: narrow type assertion > `as any`

### 4. Updated Persona Documentation
- **DATA_ENGINEER.md**: New "Multi-Schema Synchronization" section with non-negotiable rule, three-file table, and postmortem lesson learned. Two new checklist items.
- **SENIOR_ENGINEER.md**: New "External Library Type Safety" section with defensive typing guidance and postmortem lesson learned. New checklist item for schema propagation.
- **TEST_ENGINEER.md**: Updated CI quality gates table to reflect new gates (multi-schema typecheck, schema parity, coverage thresholds, security audit).
- **DEVOPS_ENGINEER.md**: Updated CI pipeline table and added schema parity + multi-schema typecheck to merge checklist.

---

## Lessons Learned

1. **Manual checklists don't prevent regressions — CI gates do.** The DATA_ENGINEER checklist already said "Tested with both PostgreSQL and SQLite" but nothing enforced it. Now CI does.

2. **Schema parity must go deeper than model names.** A model can exist in both schemas but be missing fields. The enhanced validator now catches field-level drift.

3. **External library types are a liability boundary.** When you `import` from a third-party package, you inherit their type quality. Defensive typing at the boundary is not optional.

4. **The `dev:simple` startup path is destructive by design.** It *overwrites* `schema.prisma`. Any model missing from `schema.dev.prisma` is silently erased. This makes schema synchronization a non-negotiable gate, not a nice-to-have.

5. **Two independent bugs compounding into one outage is a sign of insufficient layered defense.** Either bug alone would have crashed the app. Having both meant the fix required two separate investigations. Independent CI gates for each class of failure would have caught them separately.

---

## Action Items Completed

- [x] Fix `jira.service.ts` type error with proper narrowing (not `as any`)
- [x] Enhance `scripts/validate-schema.js` with field-level parity checking
- [x] Add schema parity check to `backend-ci.yml`
- [x] Add multi-schema typecheck (dev/SQLite) to `backend-ci.yml`
- [x] Update `DATA_ENGINEER.md` with multi-schema sync rules and lesson learned
- [x] Update `SENIOR_ENGINEER.md` with external library typing guidance
- [x] Update `TEST_ENGINEER.md` with current CI quality gates
- [x] Update `DEVOPS_ENGINEER.md` with new pipeline stages and checklist items
