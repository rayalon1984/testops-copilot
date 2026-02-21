# Living Feature Specs — Architecture Plan

> **Date**: 2026-02-21 · **Owner**: AI_ARCHITECT + TEST_ENGINEER
> **Status**: Draft · **Personas consulted**: AI_ARCHITECT, TEST_ENGINEER, AI_PRODUCT_MANAGER
> **PR Branch**: `claude/codebase-review-beta-planning-LhVuu`

---

## Problem Statement

Today, feature specifications live in monolithic markdown files (`AUTONOMOUS_AI_SPEC.md`, `SPEC.md`). Tests are written independently and reference behavior implicitly. This creates three failure modes:

1. **Spec drift** — A feature changes but the spec isn't updated, or vice versa
2. **Brittle tests** — Tests break when behavior evolves, even when the new behavior is correct
3. **Invisible coverage** — No way to know which acceptance criteria have tests and which don't

The current system treats specs as passive documentation. We need specs as **active infrastructure** — versioned, machine-readable, and wired into the test pipeline.

---

## Core Concept: Feature Manifests

Each feature gets a **manifest file** — a structured YAML document in `specs/features/` that is:

- **Versioned** per-capability (not just per-feature) — a GIF display change doesn't bump the search API version
- **Typed** with assertion categories — `invariant` (must always hold) vs `behavioral` (may evolve with versions)
- **Scannable** by CI — orphan detection, coverage tracking, version drift alerts
- **Importable** by tests — test helpers dynamically generate test cases from manifest assertions

### The Key Innovation: Assertion Types

| Type | Meaning | Test behavior on failure | Example |
|------|---------|------------------------|---------|
| `invariant` | Must ALWAYS hold, regardless of version | Hard fail | "G-rated content only" |
| `behavioral` | Expected behavior that may evolve | Soft fail if spec version changed since last test run | "Max 200px wide GIF display" |
| `contract` | API/interface contract between components | Hard fail | "Tool returns `{ success, data, summary }`" |

When a `behavioral` assertion's version bumps, tests don't break — they log a `[SPEC DRIFT]` warning and mark as `todo` until the test is updated to match the new spec. This prevents the "spec changed, 14 tests broke, nobody knows if it's a bug or intentional" problem.

---

## Architecture

```
specs/features/
├── _schema.ts              # TypeScript types for YAML validation
├── registry.ts             # Loads, validates, and indexes all manifests
├── giphy-integration.feature.yaml
├── smart-retry.feature.yaml
├── jira-housekeeping.feature.yaml
├── proactive-suggestions.feature.yaml
└── ... (one per feature)

backend/src/__tests__/helpers/
├── feature-spec.ts         # describeFeature() / itAssertion() test helpers
└── spec-version-tracker.json  # Records last-tested spec versions

scripts/
└── scan-feature-specs.ts   # CI script: validate, coverage, drift detection
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    CI Pipeline                               │
│                                                              │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│   │ scan-feature  │    │  jest/vitest  │    │  coverage    │  │
│   │ -specs.ts     │    │  tests       │    │  report      │  │
│   └──────┬───────┘    └──────┬───────┘    └──────┬───────┘  │
│          │                   │                    │          │
│          ▼                   ▼                    ▼          │
│   Schema valid?     Assertions pass?    Thresholds met?     │
│   Orphans found?    Version drift?      Invariants 100%?    │
│   Coverage gaps?    Behavioral drift?                       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
              ┌──────────────────────────┐
              │  specs/features/*.yaml   │
              │  (source of truth)       │
              └──────────────────────────┘
                     ▲           │
                     │           ▼
              ┌──────┴──────────────────┐
              │  registry.ts            │
              │  - load & validate      │
              │  - index by feature/id  │
              │  - version tracking     │
              └─────────────────────────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
        Test Helpers    CI Scanner    Spec Index
        (feature-       (scan-        (_SPEC_
         spec.ts)        feature-      INDEX.md)
                         specs.ts)
```

---

## Feature Manifest Schema

### YAML Structure

```yaml
# specs/features/{feature-name}.feature.yaml

feature: giphy-integration          # kebab-case unique ID
name: "Giphy Integration"           # Human-readable name
version: "1.0.0"                    # SemVer — overall feature version
status: shipped                     # draft | shipped | deprecated
since: "v2.9.0-rc.5"               # Product version when first shipped
owner: AI_ARCHITECT                 # Persona who owns this feature
category: ai-tools                  # Grouping: ai-tools | frontend | auth | pipeline | infra
spec_source: AUTONOMOUS_AI_SPEC.md  # Which spec doc this came from

# Environment configuration this feature needs
config:
  env:
    GIPHY_API_KEY:
      required: true
      description: "Giphy API key for GIF search"
    GIPHY_ENABLED:
      required: false
      default: "true"
      description: "Feature toggle for GIF display"
    GIPHY_RATING:
      required: false
      default: "g"
      description: "Content rating filter"

# Versioned capabilities — each can evolve independently
capabilities:
  - id: giphy.search
    name: "GIF Search"
    version: "1.0.0"
    description: "Search for contextual GIFs via Giphy API"
    tool: giphy_search                    # Links to AI tool registry
    files:                                # Source files implementing this
      - backend/src/services/ai/tools/giphy.ts
    assertions:
      - id: giphy.search.g-rated
        description: "Only G-rated GIFs are returned (rating=g parameter)"
        type: invariant
      - id: giphy.search.dedup
        description: "No repeated GIFs within session (ring buffer, last 20)"
        type: invariant
      - id: giphy.search.limit
        description: "Maximum 5 results per query"
        type: invariant
      - id: giphy.search.curated-terms
        description: "Known events map to curated search terms"
        type: behavioral
      - id: giphy.search.random-selection
        description: "Selected GIF is randomly chosen from curated terms"
        type: behavioral

  - id: giphy.fallback
    name: "Emoji Fallback"
    version: "1.0.0"
    description: "Graceful degradation when Giphy is unavailable"
    files:
      - backend/src/services/ai/tools/giphy.ts
    assertions:
      - id: giphy.fallback.disabled
        description: "Returns fallback emoji when GIPHY_ENABLED=false"
        type: invariant
      - id: giphy.fallback.no-key
        description: "Returns fallback emoji when API key not configured"
        type: invariant
      - id: giphy.fallback.api-error
        description: "Returns fallback emoji on Giphy API failure (soft fail)"
        type: invariant
      - id: giphy.fallback.success-true
        description: "Always returns success: true even on failure (graceful)"
        type: contract

  - id: giphy.frontend
    name: "GiphyEmbedCard"
    version: "1.0.0"
    description: "Inline GIF display in AI chat"
    files:
      - frontend/src/components/AICopilot/cards/GiphyEmbedCard.tsx
    assertions:
      - id: giphy.frontend.max-width
        description: "GIF displays at max 200px wide with preserved aspect ratio"
        type: behavioral
      - id: giphy.frontend.attribution
        description: "Shows 'Powered by GIPHY' attribution (TOS requirement)"
        type: invariant
      - id: giphy.frontend.dismissible
        description: "User can dismiss/hide the GIF"
        type: invariant
      - id: giphy.frontend.lazy-load
        description: "GIF uses lazy loading for performance"
        type: behavioral

  - id: giphy.autonomy
    name: "Tier Classification"
    version: "1.0.0"
    description: "Giphy is Tier 1 (auto-execute, no confirmation)"
    files:
      - backend/src/services/ai/AutonomyClassifier.ts
    assertions:
      - id: giphy.autonomy.tier1
        description: "giphy_search is classified as Tier 1 (auto-execute)"
        type: invariant

# Gherkin acceptance criteria (human-readable, maps to assertions)
acceptance_criteria:
  - id: AC-3
    title: "Giphy Integration"
    gherkin: |
      GIVEN a significant event occurs (tests pass, pipeline breaks, fix merged)
      WHEN the AI generates a status message
      THEN a contextual, work-appropriate GIF is embedded inline
      AND the GIF is never repeated within the same session (last 20 tracked)
      AND content rating is enforced (G-rated only)
      AND users can disable GIFs in settings
    maps_to:
      - giphy.search.g-rated
      - giphy.search.dedup
      - giphy.fallback.disabled
      - giphy.frontend.attribution

# Version history — one entry per version bump
changelog:
  - version: "1.0.0"
    date: "2026-02-20"
    product_version: "v2.9.0-rc.5"
    changes:
      - "Initial implementation: search, dedup, fallback, frontend card"
```

### TypeScript Schema Types (`_schema.ts`)

```typescript
export type AssertionType = 'invariant' | 'behavioral' | 'contract';
export type FeatureStatus = 'draft' | 'shipped' | 'deprecated';

export interface FeatureAssertion {
  id: string;                  // Globally unique dot-notation ID
  description: string;
  type: AssertionType;
  deprecated?: boolean;        // If true, skip in tests
  since_version?: string;      // When this assertion was added
}

export interface FeatureCapability {
  id: string;
  name: string;
  version: string;             // SemVer — independent of feature version
  description: string;
  tool?: string;               // AI tool name if applicable
  files: string[];             // Source files
  assertions: FeatureAssertion[];
}

export interface AcceptanceCriterion {
  id: string;                  // e.g., "AC-3"
  title: string;
  gherkin: string;
  maps_to: string[];           // Assertion IDs this AC covers
}

export interface FeatureManifest {
  feature: string;             // kebab-case ID
  name: string;
  version: string;
  status: FeatureStatus;
  since: string;
  owner: string;
  category: string;
  spec_source: string;
  config?: { env?: Record<string, EnvConfig> };
  capabilities: FeatureCapability[];
  acceptance_criteria: AcceptanceCriterion[];
  changelog: ChangelogEntry[];
}
```

---

## Test Integration: `describeFeature()` Helper

The test helper provides two core functions that wire tests to specs:

### API Design

```typescript
import { describeFeature, itAssertion } from '../helpers/feature-spec';

// Loads the feature manifest from YAML, creates a describe block
describeFeature('giphy-integration', (feature) => {

  // Creates a test tied to a specific assertion ID
  // If the assertion doesn't exist in the manifest → test error
  // If the assertion is deprecated → test.skip with warning
  // If the assertion is behavioral and version changed → test.todo
  itAssertion('giphy.search.g-rated', () => {
    // Test implementation
    const result = await giphySearchTool.execute({ query: 'celebration' }, ctx);
    expect(result.data.gifs.every(g => g.rating === 'g')).toBe(true);
  });

  itAssertion('giphy.search.dedup', () => {
    // ...
  });

  itAssertion('giphy.fallback.disabled', () => {
    // ...
  });
});
```

### Behavior on version changes

| Scenario | Test result | Action needed |
|----------|-------------|--------------|
| Assertion exists, test passes | PASS | None |
| Assertion exists, test fails, type=invariant | FAIL | Fix the code (bug) |
| Assertion exists, test fails, type=behavioral, version unchanged | FAIL | Fix the code (bug) |
| Assertion exists, test fails, type=behavioral, version bumped | TODO | Update test to match new behavior |
| Assertion deprecated | SKIP | Remove test when convenient |
| Assertion removed from manifest | ERROR | Remove orphaned test |
| Assertion exists but no test | CI WARNING | Write a test |

### Version Tracking

The helper maintains a `spec-version-tracker.json` file:

```json
{
  "giphy-integration": {
    "lastTestedVersion": "1.0.0",
    "capabilities": {
      "giphy.search": "1.0.0",
      "giphy.fallback": "1.0.0",
      "giphy.frontend": "1.0.0"
    },
    "lastRun": "2026-02-21T10:00:00Z"
  }
}
```

When a test runs, it compares the current manifest version against this tracker. If the capability version bumped since the last successful run, behavioral assertions get the `todo` treatment instead of hard failure.

---

## CI Scanner: `scan-feature-specs.ts`

A script that runs in CI (and can be run locally) to validate the feature spec system:

### Checks Performed

| Check | Severity | Description |
|-------|----------|-------------|
| Schema validation | ERROR | Every `.feature.yaml` must conform to schema |
| Unique IDs | ERROR | No duplicate assertion IDs across all features |
| Orphaned assertions | WARNING | Assertions with no matching `itAssertion()` call |
| Orphaned tests | WARNING | `itAssertion()` calls referencing non-existent assertion IDs |
| Version drift | WARNING | Capability version bumped but no tests updated |
| Deprecated coverage | INFO | Deprecated assertions that still have tests |
| AC mapping completeness | WARNING | Acceptance criteria `maps_to` references invalid assertion IDs |
| File existence | ERROR | `files` paths in capabilities point to real files |

### Output Format

```
Feature Spec Scanner — 3 features, 28 assertions

✓ giphy-integration (v1.0.0) — 12 assertions, 12 tested, 0 orphaned
✓ smart-retry (v1.0.0) — 8 assertions, 6 tested, 2 untested
⚠ jira-housekeeping (v1.0.0) — 8 assertions, 5 tested, 3 untested

Coverage: 23/28 (82%)
Invariants: 15/15 (100%) ✓
Behavioral: 6/9 (67%)
Contracts: 2/4 (50%)

Warnings:
  - smart-retry: 2 assertions have no tests: [retry.batch-mode, retry.history-display]
  - jira-housekeeping: 3 assertions have no tests: [housekeeping.undo-all, ...]
```

### CI Integration

Add to `package.json`:

```json
{
  "scripts": {
    "validate:specs": "tsx scripts/scan-feature-specs.ts",
    "test:specs": "npm run validate:specs && npm run test"
  }
}
```

And to CI workflow (non-blocking initially, then blocking after team ramps up):

```yaml
- name: Validate feature specs
  run: npm run validate:specs
  continue-on-error: true  # Phase 1: advisory only
```

---

## Pilot Features

Start with 3 features to prove the system:

| Feature | Manifest file | Assertions | Complexity |
|---------|--------------|------------|------------|
| Giphy Integration | `giphy-integration.feature.yaml` | ~12 | Low — well-contained |
| Smart Retry | `smart-retry.feature.yaml` | ~8 | Medium — crosses frontend/backend |
| Jira Housekeeping | `jira-housekeeping.feature.yaml` | ~8 | Medium — multiple sub-actions |

These were chosen because:
1. They're all from the same spec (`AUTONOMOUS_AI_SPEC.md`) so we can show how one monolith splits into focused manifests
2. They range in complexity from single-tool (Giphy) to multi-tool (Housekeeping)
3. They have clear, testable acceptance criteria already defined

---

## Migration Strategy

### Phase 1: Foundation (this PR)
- Create `specs/features/` directory structure
- Implement `_schema.ts` types
- Implement `registry.ts` loader/validator
- Create 3 pilot manifest files
- Implement `feature-spec.ts` test helpers
- Implement `scan-feature-specs.ts` CI scanner
- Update `_SPEC_INDEX.md` with feature spec documentation
- Scanner runs in CI as advisory (non-blocking)

### Phase 2: Adoption (next sprint)
- Convert existing tests to use `describeFeature()` / `itAssertion()` where applicable
- Create manifests for remaining features (Proactive Suggestions, Inline Diff, Autonomy Preferences)
- Scanner becomes blocking for invariant coverage (all invariants must have tests)

### Phase 3: Maturity (sprint after)
- Behavioral coverage thresholds enforced
- Auto-generated coverage report in PR comments
- Feature health dashboard (which features have drift, coverage gaps)

---

## Trade-offs & Decisions

### Why YAML over TypeScript for manifests?
- **YAML**: Readable by non-engineers (PMs, QA). Tooling-agnostic. Can be edited without compilation.
- **TypeScript**: Type-safe at write time. IDE autocomplete.
- **Decision**: YAML for manifest files, TypeScript for the registry/schema/helpers. Best of both worlds — YAML validated by TS schema at load time.

### Why per-capability versioning?
- A feature like "Giphy" has 4 capabilities (search, fallback, frontend, autonomy). Changing the frontend display width shouldn't force re-validation of the search API tests.
- Granular versioning means only affected tests see drift, not the entire feature.

### Why not just use existing test frameworks (e.g., Cucumber)?
- Cucumber/Gherkin frameworks are heavy, require their own runner, and create a parallel test universe.
- Our approach is a thin layer over Jest/Vitest — `describeFeature()` is just a `describe()` with spec awareness. Zero new runtime dependencies.
- Tests remain normal Jest tests that happen to be spec-aware.

### Why three assertion types instead of two?
- `invariant` vs `behavioral` is the core distinction (hard fail vs soft fail on version change)
- `contract` is a special invariant for interface boundaries (tool return types, API shapes). It's semantically distinct — a contract violation means two components disagree, not that one is wrong.

---

## Files to Create/Modify

### New Files
| File | Purpose |
|------|---------|
| `specs/features/_schema.ts` | TypeScript types for YAML validation |
| `specs/features/registry.ts` | Manifest loader, validator, indexer |
| `specs/features/giphy-integration.feature.yaml` | Pilot: Giphy feature manifest |
| `specs/features/smart-retry.feature.yaml` | Pilot: Smart Retry feature manifest |
| `specs/features/jira-housekeeping.feature.yaml` | Pilot: Jira Housekeeping manifest |
| `backend/src/__tests__/helpers/feature-spec.ts` | Test integration helpers |
| `backend/src/__tests__/helpers/spec-version-tracker.json` | Version tracking state |
| `scripts/scan-feature-specs.ts` | CI scanner script |

### Modified Files
| File | Change |
|------|--------|
| `specs/_SPEC_INDEX.md` | Add feature specs section |
| `package.json` | Add `validate:specs` script |

---

## Success Criteria

1. **3 pilot features** have complete manifests with all assertions mapped
2. **Scanner passes** with no schema errors on all 3 manifests
3. **Test helpers work** — `describeFeature()` loads manifests and `itAssertion()` creates spec-aware tests
4. **Version drift detection works** — bumping a capability version causes behavioral tests to show `todo` instead of `fail`
5. **Orphan detection works** — scanner warns about assertions without tests and tests without assertions
6. **Zero new runtime dependencies** — uses `js-yaml` (already in `package.json`) and existing test frameworks

---

*Reviewed by: AI_ARCHITECT (system design), TEST_ENGINEER (test infrastructure), AI_PRODUCT_MANAGER (acceptance criteria mapping)*
