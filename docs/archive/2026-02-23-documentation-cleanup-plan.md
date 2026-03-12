# Documentation Cleanup Plan

> **Branch**: `claude/cleanup-documentation-etQdb`
> **Date**: 2026-02-23

---

## Audit Summary

**Total docs found**: ~58 markdown files across `docs/`, `specs/`, `plans/`, and root
**Issues found**: 14 broken links, 5 duplicate/overlapping groups, 6 outdated files, 2 redirect stubs, 5 completed plans to archive

---

## Phase 1: Delete — Remove Dead Files & Redirect Stubs

### 1a. Delete redirect-only stubs (zero content, just point elsewhere)
| File | Reason |
|------|--------|
| `docs/project/CHANGELOG.md` | Just a redirect to root `CHANGELOG.md` |
| `docs/project/ROADMAP.md` | Just a redirect to `specs/ROADMAP.md` |

### 1b. Delete `docs/OVERVIEW.md`
- 345-line marketing/sales document aimed at "managers and stakeholders"
- Overlaps heavily with `README.md` and `docs/HOW_DOES_IT_WORK.md`
- Contains fake ROI numbers and inflated claims not appropriate for a technical repo
- `HOW_DOES_IT_WORK.md` already serves the "plain English explanation" role better

---

## Phase 2: Archive — Move Completed Plans to `docs/archive/`

These plans are completed and no longer actionable:

| File | Status | Reason |
|------|--------|--------|
| `plans/sprint-0-report.md` | Completed | v2.9.0-rc.2 sprint — discovery-only report, all items resolved |
| `plans/sprint-2-3-plan.md` | Completed | Lint/warning cleanup plan — all shipped |
| `plans/2026-02-19-chat-ux-overhaul-v3.md` | Completed | Chat UX overhaul — fully implemented |
| `plans/2026-02-21-beta-grooming-report.md` | Completed | Beta go/no-go — beta shipped Feb 22 |
| `plans/2026-02-21-living-feature-specs.md` | Completed | Feature spec architecture — Phases 1-4 complete |

**Keep in `plans/`**:
- `plans/README.md` (directory index)
- `plans/20260219-smart-coding-architecture-adoption.md` (IN_PROGRESS — Phase 3 deferred to post-beta)

---

## Phase 3: Consolidate — Merge Overlapping Docs

### 3a. Merge setup/dev guides → 2 clear paths
**Problem**: 4 docs cover overlapping "how to set up/run" content:
- `docs/quickstart.md` — Demo + production quick start
- `docs/LOCAL_SETUP.md` — Local dev with Docker (PostgreSQL/Redis/Weaviate)
- `docs/DEV_MODE.md` — Demo vs production mode comparison
- `docs/development.md` — Full development guide (also covers setup)

**Action**:
- Keep `docs/quickstart.md` as the single getting-started doc (already has Demo + Production paths)
- Merge unique content from `docs/LOCAL_SETUP.md` (Docker-based local dev details) and `docs/DEV_MODE.md` (mode comparison table) into `docs/quickstart.md`
- Keep `docs/development.md` as the developer-focused guide (coding standards, VS Code, testing) but remove its setup section (point to quickstart.md instead)
- Delete `docs/LOCAL_SETUP.md` and `docs/DEV_MODE.md` after merge

### 3b. Architecture: docs/ vs specs/
**Problem**: `docs/architecture.md` and `specs/ARCHITECTURE.md` both exist.
**Action**: `docs/architecture.md` already has a header pointing to `specs/ARCHITECTURE.md` as canonical. Convert `docs/architecture.md` to a thin redirect/summary that links to the canonical spec, removing duplicated content.

### 3c. Security: 3 files
**Problem**: `docs/security.md`, `docs/project/SECURITY.md`, and `specs/SECURITY.md` all cover security.
**Action**:
- `specs/SECURITY.md` is the canonical security spec — keep as-is
- `docs/security.md` covers practical security guide (JWT implementation, etc.) — keep but add pointer to canonical spec
- `docs/project/SECURITY.md` is a generic vulnerability reporting template with placeholder emails — **update** with real contact info and correct supported versions, or **delete** if `docs/security.md` already covers reporting

---

## Phase 4: Update — Fix Outdated Content

### 4a. `docs/README.md` — Fix broken links (14 broken references)
**Remove sections referencing non-existent files:**
- User Guides section: `docs/guides/pipelines.md`, `docs/guides/test-execution.md`, `docs/guides/notifications.md`, `docs/guides/dashboard.md`, `docs/guides/reports.md` — none exist
- Reference section: `docs/reference/configuration.md`, `docs/reference/environment-variables.md`, `docs/reference/cli-commands.md`, `docs/reference/error-codes.md` — none exist
- `docs/authentication.md` — doesn't exist
- Remove fake external links: `docs.testops-copilot.com`, `discord.gg/testops-copilot`, `newsletter.testops-copilot.com`, `twitter.com/testops-copilot`

### 4b. `docs/project/RELEASE_PROCESS.md`
- Says "Latest Release: v2.5.0 (2025-11-16)" — update to v3.0.0

### 4c. `docs/project/CONTRIBUTING.md`
- Says "licensed under its MIT License" — should be Apache 2.0
- Project structure lists `nginx/`, `prometheus/` at root — these are under `infra/` now
- Setup instructions reference `npm run setup` — verify this still works

### 4d. `docs/project/SECURITY.md`
- Email `security@yourdomain.com` — placeholder needs real email
- Supported versions table says "1.x.x" — update to current

### 4e. `docs/development.md`
- VS Code extensions list includes "Tailwind CSS IntelliSense" and "TypeScript Vue Plugin" — project uses neither Tailwind nor Vue
- Clone URL uses `yourusername` placeholder

### 4f. `AGENTS.md` — Remove reference to non-existent `.cursor/skills/`
- Line 36: Skills `.cursor/skills/` — directory doesn't exist
- Line 253: `.cursor/skills/*.md` — Reusable workflow templates — doesn't exist

### 4g. `docs/archive/README.md`
- This file IS the old AI Integration Spec content, not an archive index. Rename to `docs/archive/AI_INTEGRATION_SPEC.md` and create a proper `docs/archive/README.md` index.

---

## Phase 5: Verify — Ensure No Orphan Docs

After all changes, verify:
1. Every doc in `docs/` is reachable from `README.md` or `docs/README.md`
2. `README.md` Documentation table links all point to real files
3. `docs/README.md` has no broken internal links
4. No duplicate content between `docs/` and `specs/`

---

## Phase 6: Update README.md Documentation Table

The root `README.md` has a Documentation section (line 407-420). After cleanup, update it to reflect the final file set.

---

## Summary of Changes

| Action | Count | Files |
|--------|-------|-------|
| **Delete** | 3 | `docs/project/CHANGELOG.md`, `docs/project/ROADMAP.md`, `docs/OVERVIEW.md` |
| **Archive** (plans/ → docs/archive/) | 5 | sprint-0-report, sprint-2-3-plan, chat-ux-overhaul-v3, beta-grooming-report, living-feature-specs |
| **Consolidate** | 2 deleted | `docs/LOCAL_SETUP.md` and `docs/DEV_MODE.md` merged into `docs/quickstart.md` |
| **Update** | 8 | docs/README.md, AGENTS.md, docs/project/RELEASE_PROCESS.md, CONTRIBUTING.md, SECURITY.md, development.md, architecture.md, archive/README.md |
| **Total files removed** | 5 | (3 deleted + 2 consolidated) |
| **Total files archived** | 5 | (moved from plans/ to docs/archive/) |
| **Total files updated** | 8 | (content fixes and broken link removal) |
