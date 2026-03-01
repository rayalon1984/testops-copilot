# Xray Integration — v3.3.0 Sprint 11 Planning

> **Date**: 2026-03-02
> **Personas**: AI_PRODUCT_MANAGER, AI_ARCHITECT, SENIOR_ENGINEER, TEST_ENGINEER
> **Target**: v3.3.0 (Sprint 11, March 2026)

---

## Part 1 — PRODUCT: Feature Plan

> Persona: `AI_PRODUCT_MANAGER`

### Problem Statement

TestOps Copilot tracks test runs and failures internally but has no integration with Xray (Jira's most widely adopted test management plugin). Teams using Xray have their test cases, test plans, and execution history locked inside Jira. This means:

- QA Engineers manually copy-paste failure data between Copilot and Xray
- Test execution results live in two disconnected systems
- Coverage metrics are split across platforms with no unified view
- The copilot can't reference Xray test cases when analyzing failures

### Target Users

| Persona | Need | v3.3 Outcome |
|---------|------|-------------|
| QA / Test Automation Engineer | Stop dual-entry between Copilot and Xray | One-click push of Copilot results → Xray (eliminates manual copy-paste) |
| Developer | See Xray test coverage when reviewing failures | Copilot surfaces Xray test case links via `xray_search` AI tool |
| Engineering Lead | Know which Copilot runs have been synced to Xray | Sync status badge on test runs + sync history endpoint |
| QA Manager | Query Xray test cases without leaving Copilot | AI copilot answers "find Xray test cases for checkout" |

> **Note**: v3.3 is **push-only** (Copilot → Xray). Bi-directional sync (Xray → Copilot) is a v3.4 candidate.

### Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Sync latency | < 30s from Copilot test run completion to Xray result upload | Server-side timer (`XraySync.syncedAt - createdAt`) |
| Connection success rate | Test-connection returns 200 on valid credentials, ≤ 5s response | Integration test (AC-1) |
| End-to-end demo flow | "Sync to Xray" button → status badge → sync history in one flow | E2E test (AC-2) |
| AI tool discoverability | `xray_search` tool invoked correctly for Xray-related copilot queries | Mock provider intent rule + E2E test (AC-3) |

### Scope: v3.3.0 (This Sprint)

**Must-Have (P0)**:
1. `XrayService` — REST API client for Xray Cloud (authenticate, CRUD test runs, push results)
2. Connection validation endpoint — `GET /api/v1/xray/test-connection`
3. Sync test results — `POST /api/v1/xray/sync/:testRunId` (map TestOps run to Xray execution)
4. Xray config in Settings UI — base URL, API token, project key
5. `xray_search` AI tool — read-only, query Xray test cases/plans from copilot

**Should-Have (P1)**:
6. Xray test plan browser — list plans, view coverage %
7. Auto-sync toggle — automatically push results on test run completion
8. Xray context in AI enrichment — include Xray test case details in failure analysis

**Won't-Have (This Sprint)**:
- Bi-directional sync (Xray back to Copilot) — v3.4 candidate
- Xray Server (on-premise) support — Cloud-first, server later
- Test case creation from Copilot — v3.4 candidate
- Xray defect linking (separate from Jira issue linking)

### Acceptance Criteria

**AC-1: Connection Setup**
```
GIVEN an admin user on the Settings > Integrations page
WHEN they enter Xray Cloud credentials (client ID, client secret, project key)
AND click "Test Connection"
THEN the system validates the credentials against Xray Cloud API
AND shows success/failure feedback within 5 seconds
```

**AC-2: Result Sync**
```
GIVEN a configured Xray connection
AND a completed test run in Copilot with mapped test cases
WHEN the user clicks "Sync to Xray" (or auto-sync fires)
THEN test results are uploaded to Xray as a Test Execution
AND each test case result maps: PASSED→PASS, FAILED→FAIL, SKIPPED→TODO
AND the Xray Test Execution ID is stored and linked in Copilot
```

**AC-3: AI Tool Search**
```
GIVEN a user in the copilot asking "find Xray test cases for checkout"
WHEN the AI routes to the xray_search tool
THEN the tool queries Xray API for matching test cases
AND returns test case key, summary, status, and last execution result
```

**AC-4: Sync Error Handling**
```
GIVEN a sync attempt with invalid/expired credentials
WHEN the sync runs
THEN the system retries once after 2s
AND if still failing, marks the sync as FAILED with a clear error message
AND does NOT create a partial Xray execution
```

**AC-5: Test Case Mapping**
```
GIVEN a Copilot TestResult with field externalTestCaseId (e.g., "PROJ-TC-123")
WHEN the system builds the Xray execution payload
THEN each result is mapped to the corresponding Xray test case key
AND results without an externalTestCaseId are included as ad-hoc test runs
```
> This AC requires a new `externalTestCaseId` field on the `TestResult` Prisma model (see Architect §Data Model).

### Out of Scope (Documented)

- Xray Server (on-premise) — different API, different auth flow
- Test case creation/editing from Copilot
- Xray webhook ingestion (Xray notifying Copilot of changes)
- Custom field mapping beyond standard result fields

---

## Part 2 — ARCHITECT: Architectural Design

> Persona: `AI_ARCHITECT`

### Architecture Decision: Standalone Service + Jira Coordination

**Decision**: Create a dedicated `xray.service.ts` that handles Xray Cloud REST API operations independently, while coordinating with the existing `jira.service.ts` for issue-level operations (linking Xray test cases to Jira issues).

**Rationale**:
- Xray Cloud has its own REST API (`https://xray.cloud.getxray.app/api/v2/`) separate from the Jira API
- Authentication is OAuth2 (client_id + client_secret) not Jira API tokens
- Keeps single-responsibility: `jira.service.ts` = issue tracking, `xray.service.ts` = test management
- TestRail integration is the direct precedent — same domain, same patterns

**Rejected alternatives**:
- Extending `jira.service.ts` — violates SRP, conflates issue tracking with test management
- Generic "test management adapter" pattern — over-abstraction for 2 providers (TestRail + Xray)

### Component Diagram

```
                  ┌─────────────────────────────────────┐
                  │         Frontend (React)             │
                  │  ┌─────────────┐ ┌───────────────┐  │
                  │  │Settings Page│ │ AI Copilot     │  │
                  │  │Xray Config  │ │ xray_search    │  │
                  │  └──────┬──────┘ └───────┬────────┘  │
                  └─────────┼────────────────┼───────────┘
                            │ REST           │ SSE
                            ▼                ▼
┌───────────────────────────────────────────────────────────┐
│                   Express Backend                          │
│                                                            │
│  ┌──────────────────┐  ┌──────────────────────────────┐   │
│  │ xray.routes.ts   │  │ AI Tool: xray_search         │   │
│  │ /api/v1/xray/*   │  │ tools/xray.ts                │   │
│  └────────┬─────────┘  └──────────────┬───────────────┘   │
│           │                            │                   │
│           ▼                            ▼                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              xray.service.ts (Singleton)              │  │
│  │                                                       │  │
│  │  authenticate()     — OAuth2 token exchange           │  │
│  │  getTestCases()     — Search/list test cases          │  │
│  │  getTestPlans()     — List test plans + coverage      │  │
│  │  createExecution()  — Create test execution           │  │
│  │  addResults()       — Push test results               │  │
│  │  syncTestRun()      — Map Copilot run → Xray exec    │  │
│  │  validateConnection() — Health check                  │  │
│  └──────────────────────┬────────────────────────────────┘  │
│                          │                                  │
│  ┌───────────┐  ┌────────┴────────┐  ┌────────────────┐   │
│  │  Prisma   │  │  withResilience  │  │  config.ts     │   │
│  │  XraySync │  │  circuitBreaker  │  │  xray config   │   │
│  └───────────┘  └─────────────────┘  └────────────────┘   │
└───────────────────────────────────────────────────────────┘
                          │
                          ▼
              ┌──────────────────────┐
              │ Xray Cloud REST API  │
              │ xray.cloud.getxray   │
              │ .app/api/v2/         │
              └──────────────────────┘
```

### Data Model

```prisma
model XraySync {
  id              String   @id @default(uuid())
  testRunId       String                       // FK to TestRun
  xrayExecutionId String?                      // Xray Test Execution issue key (e.g., "PROJ-456")
  projectKey      String                       // Jira project key
  status          String   @default("PENDING") // PENDING | SYNCING | SYNCED | FAILED
  resultCount     Int      @default(0)         // Number of results pushed
  errorMessage    String?                      // Last error if FAILED
  syncedAt        DateTime?                    // When sync completed
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([testRunId])
  @@index([status])
}
```

**Design choice**: Single `XraySync` model (not separate `XrayRun` + `XrayTestCase`). We don't replicate Xray's data model — we track sync state only. Xray is the source of truth for test cases and plans.

#### TestResult Schema Addition

The existing `TestResult` model has `name`, `className`, `status` but **no field to map to an external test case key**. Add:

```prisma
model TestResult {
  // ... existing fields ...
  externalTestCaseId  String?              // e.g., "PROJ-TC-123" (Xray) or "C12345" (TestRail)
}
```

- **Nullable** — existing results and results without Xray mapping work as before
- **Generic name** (`externalTestCaseId`, not `xrayTestCaseKey`) — reusable by TestRail and future integrations
- Populated by CI reporters or via a bulk-mapping API endpoint (future)
- Results without this field are synced as **ad-hoc test runs** in Xray (valid Xray behavior)

### Credential Storage Decision

**Decision**: Store Xray `client_id` and `client_secret` as **environment variables** (same pattern as Jira, TestRail, Confluence).

**Rationale**:
- All existing integrations in `config.ts` use env vars: `JIRA_API_TOKEN`, `TESTRAIL_API_KEY`, `CONFLUENCE_API_TOKEN`
- The `provider-config.service.ts` AES-256-GCM encryption is for **user-configured AI provider API keys** only (stored in DB per-user). Integration credentials are infrastructure-level, set by admins at deploy time.
- Settings UI reads a masked status (configured / not configured) — it never sends secrets back to the browser.

**Rejected alternative**: Encrypted DB storage via `provider-config.service.ts` — over-engineering for infrastructure credentials that are already managed by env var injection in Docker/CI.

### Authentication Flow

Xray Cloud uses OAuth2 client credentials:

```
1. POST https://xray.cloud.getxray.app/api/v2/authenticate
   Body: { "client_id": "...", "client_secret": "..." }
   Returns: JWT token (valid ~1 hour)

2. All subsequent requests use: Authorization: Bearer <jwt>

3. Service caches token, refreshes on 401
```

### Status Mapping

| Copilot Status | Xray Status | Notes |
|---------------|-------------|-------|
| PASSED | PASS | Direct map |
| FAILED | FAIL | Direct map |
| SKIPPED | TODO | Xray has no "skipped" |
| FLAKY | FAIL | Conservative — flaky is still a failure |
| ERROR | FAIL | Runtime errors = failure |

### AI Tool: `xray_search`

```typescript
{
  name: 'xray_search',
  description: 'Search Xray test cases and test plans in the configured project',
  category: 'read',
  requiresConfirmation: false,  // Read-only, Tier 1
  parameters: [
    { name: 'query', type: 'string', required: true, description: 'Search text for test case summary/key' },
    { name: 'type', type: 'string', required: false, description: '"test_case" | "test_plan" (default: test_case)' },
    { name: 'limit', type: 'number', required: false, description: 'Max results (default: 10)' },
  ],
}
```

### API Endpoints

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/api/v1/xray/test-connection` | JWT | ADMIN | Validate Xray credentials |
| GET | `/api/v1/xray/test-cases` | JWT | VIEWER | Search test cases (query param) |
| GET | `/api/v1/xray/test-plans` | JWT | VIEWER | List test plans with coverage |
| POST | `/api/v1/xray/sync/:testRunId` | JWT | USER | Sync a test run to Xray |
| GET | `/api/v1/xray/syncs` | JWT | VIEWER | List sync history |
| GET | `/api/v1/xray/syncs/:id` | JWT | VIEWER | Get sync status |

### Resilience Configuration

```typescript
// Add to backend/src/lib/resilience.ts
const xrayBreaker = new CircuitBreaker({
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 30_000,  // 30s half-open window
});

const XRAY_RESILIENCE = {
  circuitBreaker: xrayBreaker,
  retry: { maxRetries: 2, baseDelayMs: 1000 },
  timeoutMs: 15_000,
  label: 'xray',
};
```

### Config Schema

```typescript
// Add to backend/src/config.ts envSchema
XRAY_CLIENT_ID: z.string().optional(),
XRAY_CLIENT_SECRET: z.string().optional(),
XRAY_PROJECT_KEY: z.string().optional(),
XRAY_CLOUD_URL: z.string().url().optional().default('https://xray.cloud.getxray.app'),
XRAY_AUTO_SYNC: z.string().optional().default('false'),
```

### Security: SSRF Validation

The `XRAY_CLOUD_URL` is user-configurable. The `XrayService` constructor **must** validate it with `validateUrlForSSRF()` — same pattern as `testrail.service.ts` line 83:

```typescript
constructor() {
  if (!config.xray) { this.enabled = false; return; }
  validateUrlForSSRF(config.xray.cloudUrl);  // Rejects localhost, private IPs, etc.
  // ... create axios client
}
```

This prevents attackers from pointing the Xray URL at internal services.

### Mock Provider: Demo Mode Support

The default `AI_PROVIDER=mock` must surface `xray_search` in the copilot. Add to `mock.provider.ts`:

```typescript
// INTENT_RULES — add after existing Jira rules:
{ primary: ['xray', 'test case', 'test plan', 'xray test'],
  secondary: ['search', 'find', 'show', 'list', 'get'],
  tool: 'xray_search', args: { query: 'checkout', type: 'test_case', limit: 10 },
  preamble: 'Searching Xray test cases.' },
```

Add to `mock-tool-results.ts`:
```typescript
const xraySearch: MockResultFn = (args) => ({
  success: true,
  summary: `Found 3 Xray test cases matching "${args.query}"`,
  data: {
    testCases: [
      { key: 'PROJ-TC-101', summary: 'Checkout — valid payment', status: 'PASS', lastRun: '2026-02-28' },
      { key: 'PROJ-TC-102', summary: 'Checkout — expired card', status: 'FAIL', lastRun: '2026-02-28' },
      { key: 'PROJ-TC-103', summary: 'Checkout — empty cart guard', status: 'TODO', lastRun: null },
    ],
  },
});
```

Add to `TOOL_SUMMARIES`: `xray_search: 'Found Xray test cases matching the query.'`

### Files to Create/Modify

| # | File | Action | Owner |
|---|------|--------|-------|
| 1 | `backend/src/services/xray.service.ts` | **Create** | Backend |
| 2 | `backend/src/routes/xray.routes.ts` | **Create** | Backend |
| 3 | `backend/src/controllers/xray.controller.ts` | **Create** | Backend |
| 4 | `backend/src/services/ai/tools/xray.ts` | **Create** | AI |
| 5 | `backend/src/services/ai/tools/index.ts` | Modify (register) | AI |
| 6 | `backend/src/services/ai/mock-tool-results.ts` | Modify (add mock) | AI |
| 7 | `backend/src/config.ts` | Modify (add Xray config) | Backend |
| 8 | `backend/src/lib/resilience.ts` | Modify (add breaker) | Backend |
| 9 | `backend/src/app.ts` | Modify (mount routes) | Backend |
| 10 | `backend/prisma/schema.prisma` | Modify (add XraySync) | Data |
| 11 | `backend/prisma/schema.dev.prisma` | Modify (add XraySync) | Data |
| 12 | `backend/prisma/schema.production.prisma` | Modify (add XraySync) | Data |
| 12b | `backend/prisma/schema*.prisma` (all 3) | Modify (add `externalTestCaseId` to TestResult) | Data |
| 13 | `frontend/src/pages/Settings/XraySettings.tsx` | **Create** | Frontend |
| 14 | `frontend/src/hooks/api/useXray.ts` | **Create** | Frontend |
| 15 | `specs/features/xray-integration.feature.yaml` | **Create** | QA |
| 16 | `specs/AI_TOOLS.md` | Modify (add xray_search) | Docs |
| 17 | `specs/SPEC.md` | Modify (add Xray to integrations) | Docs |
| 18 | `specs/API_CONTRACT.md` | Modify (add Xray endpoints) | Docs |

---

## Part 3 — LEAD: Sprint Planning + RnRs

> Persona: `SENIOR_ENGINEER` (Tech Lead hat)

### Sprint 11 Overview

| Field | Value |
|-------|-------|
| Sprint | 11 |
| Version | v3.3.0 |
| Duration | 2 weeks (March 2–16, 2026) |
| Theme | Xray Integration + Context-Aware Prompts |
| Capacity | 4 personas (Backend, Frontend, AI, QA) |

### Sprint Goals

1. **Primary**: Ship Xray Cloud integration (P0 scope: service, sync, AI tool, settings UI)
2. **Secondary**: Tier 2 context-aware starter prompts (carry-over from v3.2.0 deferral)
3. **Stretch**: Xray test plan browser (P1)

### Roles and Responsibilities

| Role | Persona | Owns | Deliverables |
|------|---------|------|-------------|
| **Backend Engineer** | SENIOR_ENGINEER | Xray service, routes, controller, config, resilience, Prisma model | `xray.service.ts`, `xray.routes.ts`, `xray.controller.ts`, config changes, schema migration |
| **AI Engineer** | AI_ARCHITECT | `xray_search` tool, mock results, system prompt update, enrichment hook | `tools/xray.ts`, mock results, tool registration, AI_TOOLS.md |
| **Frontend Engineer** | SENIOR_ENGINEER + UX_DESIGNER | Settings UI, Xray status display, sync button on test runs, React Query hooks | `XraySettings.tsx`, `useXray.ts`, TestRun page sync button |
| **QA Engineer** | TEST_ENGINEER | Feature spec, unit tests, integration tests, E2E tests, edge case coverage | `xray-integration.feature.yaml`, test files, spec coverage 100% |
| **Data Engineer** | DATA_ENGINEER | Prisma schema (3 files), migration, seed data | Schema changes, `seed.dev.ts` Xray demo data |
| **Tech Lead** | SENIOR_ENGINEER | Code review, architecture enforcement, sprint ceremonies, unblocking | PR reviews, daily standups, demo prep |

### Work Breakdown (Tickets)

| # | Title | Type | Priority | Estimate | Assignee | Dependencies |
|---|-------|------|----------|----------|----------|-------------|
| 1 | Add XraySync model + `externalTestCaseId` field (3 schemas) | Data | P0 | 1.5h | Data Engineer | None |
| 2a | XrayService — auth + validateConnection | Backend | P0 | 2h | Backend Engineer | #1, #3, #4 |
| 2b | XrayService — sync + getTestCases | Backend | P0 | 2h | Backend Engineer | #2a |
| 3 | Add Xray circuit breaker to resilience.ts | Backend | P0 | 30m | Backend Engineer | None |
| 4 | Add Xray config to config.ts + SSRF validation | Backend | P0 | 30m | Backend Engineer | None |
| 5 | Create xray.routes.ts + xray.controller.ts | Backend | P0 | 2h | Backend Engineer | #2b, #4 |
| 6 | Mount Xray routes in app.ts | Backend | P0 | 15m | Backend Engineer | #5 |
| 7 | Implement xray_search AI tool | AI | P0 | 2h | AI Engineer | #2b |
| 8 | Add xray_search mock results + mock provider intent | AI | P0 | 1.5h | AI Engineer | #7 |
| 9 | Register tool in tools/index.ts | AI | P0 | 30m | AI Engineer | #8 |
| 10 | XraySettings page (config form, test connection) | Frontend | P0 | 3h | Frontend Engineer | Mock API* |
| 11 | useXray React Query hooks | Frontend | P0 | 1h | Frontend Engineer | Mock API* |
| 12 | Sync button on TestRun detail page | Frontend | P0 | 2h | Frontend Engineer | #11 |
| 13 | Feature spec YAML (xray-integration) | QA | P0 | 2h | QA Engineer | None |
| 14 | Unit tests: XrayService (auth, sync, error handling) | QA | P0 | 4h | QA Engineer | #2b |
| 15 | Unit tests: xray_search tool + mock path | QA | P0 | 1.5h | QA Engineer | #8 |
| 16 | API integration tests (routes) + security tests | QA | P0 | 3.5h | QA Engineer | #5 |
| 17 | E2E test: Xray settings + sync flow + smoke | QA | P1 | 2.5h | QA Engineer | #10, #12 |
| 18 | Update specs (AI_TOOLS, SPEC, API_CONTRACT) | Docs | P0 | 1h | AI Engineer | #7 |
| 19 | Seed demo Xray data in seed.dev.ts | Data | P1 | 1h | Data Engineer | #1 |
| 20 | Tier 2 context-aware starter prompts | Backend+Frontend | P1 | 4h | Backend Engineer | None |

> \* **Mock API**: Frontend tickets (#10–12) depend on **API contract** (endpoint shapes), not on backend completion. Frontend uses MSW/mock handlers against the agreed contract. This decouples frontend from backend and eliminates the #2 → #10 serial bottleneck.

**Total estimate**: ~36 hours across 4 engineers over 2 weeks.

**Bottleneck mitigation**: Ticket #2 (XrayService) was a single 4h SPOF blocking 6 downstream tickets. Split into #2a (auth, 2h) and #2b (sync, 2h) — #2a unblocks `validateConnection` route immediately, while #2b unblocks the sync + AI tool tracks in parallel.

### Sprint Schedule

| Day | Backend / AI | Frontend | QA / Data |
|-----|-------------|----------|-----------|
| Day 1 (Mon) | #3, #4 — config + resilience foundation | — | **#13** — Feature spec YAML (Day 1, not Day 5), **#1** — Prisma schema |
| Day 2 (Tue) | #2a — XrayService auth + validateConnection | #10 starts (against mock API contract) | #14 starts — unit test stubs from spec |
| Day 3 (Wed) | #2b — XrayService sync + getTestCases | #10 continues, #11 — hooks | #14 continues — auth + sync tests |
| Day 4 (Thu) | #5, #6 — Routes + controller | #12 — Sync button on TestRun page | #15 — xray_search tool tests |
| Day 5 (Fri) | #7, #8, #9 — AI tool + mock results + registration | #10, #11, #12 — integrate against real routes | #16 — API integration tests + security |
| Day 6 | #18 — Update specs (AI_TOOLS, SPEC, API_CONTRACT) | Frontend bug fixes from integration | #16 continues + #19 (seed data) |
| Day 7 | #20 — Context-aware prompts (P1 carry-over) | — | #17 — E2E test + smoke test |
| Day 8 | Code review + bug fixes | Code review + bug fixes | Final QA pass, spec coverage verification |
| Day 9 | Demo prep | Demo prep | Regression sweep |
| Day 10 | Release (tag, notes, milestone close) | — | — |

**Key change**: QA writes the feature spec YAML on **Day 1** (not Day 5), and starts writing test stubs immediately. This eliminates the waterfall anti-pattern where QA sits idle for 5 days. Frontend starts against **mock API contract** on Day 2, not blocked by backend completion.

### Definition of Done (Sprint 11)

- [ ] All P0 tickets merged with passing CI
- [ ] Feature spec coverage: 100% invariants, 80%+ behavioral
- [ ] Xray connection + sync works in demo mode (mock Xray API)
- [ ] AI copilot can answer "find Xray test cases for checkout"
- [ ] Settings UI allows configuration + connection test
- [ ] specs/ documents updated (AI_TOOLS, SPEC, API_CONTRACT, ROADMAP)
- [ ] v3.3.0 tag + release notes

### Risks and Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Xray Cloud API rate limits | Medium | Sync failures | Implement batch upload + backoff; respect X-RateLimit headers |
| OAuth2 token expiry mid-sync | Low | Partial upload | Token refresh on 401; atomic sync (all-or-nothing) |
| Schema migration breaking dev mode | Low | Blocked development | Test migration on SQLite first (schema.dev.prisma) |
| Scope creep into bi-directional sync | High | Sprint overrun | Hard boundary: v3.3 = push-only, bi-directional = v3.4 |

---

## Part 4 — QA: Software Test Plan

> Persona: `TEST_ENGINEER`

### Test Strategy Overview

| Layer | Framework | Scope | Count (est.) |
|-------|-----------|-------|------|
| Unit | Jest | XrayService methods, status mapping, auth, validation | ~25 |
| Integration | Jest + Supertest | API routes, middleware, auth guards, security | ~15 |
| Feature Spec | Jest + itAssertion | Manifest-linked assertions (invariant, behavioral, contract) | ~29 |
| E2E | Playwright | Settings config, sync flow, AI tool query, smoke | ~5 |
| **Total** | | | **~74 new tests** |

> **Test type coverage**: Unit, Integration, Feature Spec (invariant + behavioral + contract), E2E, Security, Whitebox, Smoke. No test type is omitted; counts are calibrated to avoid overkill — each test covers a unique risk.

### Feature Spec: `xray-integration.feature.yaml`

```yaml
feature: xray-integration
name: "Xray Cloud Integration (Test Management Sync)"
version: "1.0.0"
status: draft
since: "v3.3.0"
owner: TEST_ENGINEER
category: backend
spec_source: SPEC.md

capabilities:
  - id: xray.auth
    name: "Xray Authentication"
    version: "1.0.0"
    files:
      - backend/src/services/xray.service.ts
    assertions:
      - id: xray.auth.oauth2-exchange
        description: "Exchanges client_id + client_secret for JWT via Xray Cloud API"
        type: invariant
      - id: xray.auth.token-cache
        description: "Caches JWT token and refreshes on 401 response"
        type: invariant
      - id: xray.auth.invalid-credentials
        description: "Returns clear error message for invalid client_id/secret"
        type: invariant

  - id: xray.sync
    name: "Test Run Sync"
    version: "1.0.0"
    files:
      - backend/src/services/xray.service.ts
    assertions:
      - id: xray.sync.create-execution
        description: "Creates Xray Test Execution with mapped test results"
        type: invariant
      - id: xray.sync.status-mapping
        description: "Maps Copilot statuses correctly: PASSED→PASS, FAILED→FAIL, SKIPPED→TODO"
        type: invariant
      - id: xray.sync.atomic
        description: "Sync is all-or-nothing: partial uploads are rolled back"
        type: invariant
      - id: xray.sync.stores-execution-id
        description: "Persists Xray execution ID in XraySync model after success"
        type: invariant
      - id: xray.sync.idempotent
        description: "Re-syncing same test run updates existing execution, does not create duplicate"
        type: behavioral

  - id: xray.api
    name: "Xray API Endpoints"
    version: "1.0.0"
    files:
      - backend/src/routes/xray.routes.ts
    assertions:
      - id: xray.api.auth-required
        description: "All endpoints require valid JWT; returns 401 otherwise"
        type: contract
      - id: xray.api.admin-only-connection
        description: "GET /xray/test-connection requires ADMIN role"
        type: contract
      - id: xray.api.sync-response-shape
        description: "POST /xray/sync/:id returns { syncId, status, xrayExecutionId, resultCount }"
        type: contract
      - id: xray.api.not-configured
        description: "Returns 503 with clear message when Xray is not configured"
        type: contract

  - id: xray.resilience
    name: "Xray Resilience"
    version: "1.0.0"
    files:
      - backend/src/services/xray.service.ts
      - backend/src/lib/resilience.ts
    assertions:
      - id: xray.resilience.circuit-breaker
        description: "Circuit breaker opens after 5 consecutive Xray API failures"
        type: invariant
      - id: xray.resilience.retry-transient
        description: "Retries 429 and 503 responses with exponential backoff (max 2)"
        type: behavioral
      - id: xray.resilience.timeout
        description: "Enforces 15s timeout on all Xray API calls"
        type: invariant

  - id: xray.tool
    name: "xray_search AI Tool"
    version: "1.0.0"
    files:
      - backend/src/services/ai/tools/xray.ts
    assertions:
      - id: xray.tool.read-only
        description: "Tool is classified as read-only (no confirmation required)"
        type: invariant
      - id: xray.tool.returns-cases
        description: "Returns test case key, summary, status, and last execution result"
        type: behavioral
      - id: xray.tool.graceful-disabled
        description: "Returns helpful error when Xray integration is not configured"
        type: behavioral
      - id: xray.tool.limit-cap
        description: "Caps results at 25 regardless of user request"
        type: invariant

  - id: xray.security
    name: "Xray Security"
    version: "1.0.0"
    files:
      - backend/src/services/xray.service.ts
      - backend/src/routes/xray.routes.ts
    assertions:
      - id: xray.security.ssrf-validation
        description: "Constructor validates XRAY_CLOUD_URL with validateUrlForSSRF()"
        type: invariant
      - id: xray.security.jql-escape
        description: "Search queries are escaped before being sent to Xray API"
        type: invariant
      - id: xray.security.no-secret-leak
        description: "Error responses never include client_secret or JWT token in body"
        type: invariant

  - id: xray.mock
    name: "Xray Demo/Mock Path"
    version: "1.0.0"
    files:
      - backend/src/services/ai/mock-tool-results.ts
      - backend/src/services/ai/providers/mock.provider.ts
    assertions:
      - id: xray.mock.intent-routes
        description: "Mock provider routes 'xray test cases' queries to xray_search tool"
        type: behavioral
      - id: xray.mock.returns-data
        description: "Mock xray_search returns realistic test case results"
        type: behavioral

  - id: xray.frontend
    name: "Xray Settings UI"
    version: "1.0.0"
    files:
      - frontend/src/pages/Settings/XraySettings.tsx
    assertions:
      - id: xray.frontend.config-form
        description: "Settings form collects client_id, client_secret, project_key"
        type: behavioral
      - id: xray.frontend.test-connection
        description: "Test Connection button calls API and shows success/failure"
        type: behavioral
      - id: xray.frontend.validation
        description: "Submit disabled with validation messages when required fields empty"
        type: behavioral
      - id: xray.frontend.error-display
        description: "Connection failure shows specific error (auth vs network vs timeout)"
        type: behavioral
```

### Unit Tests: XrayService

| Test | Assertion Type | What It Validates |
|------|---------------|-------------------|
| `authenticate() exchanges credentials for JWT` | Invariant | OAuth2 token exchange with mocked Xray API |
| `authenticate() caches token across calls` | Invariant | Second call uses cached token, no API hit |
| `authenticate() refreshes on 401` | Invariant | Token refresh triggered by expired token |
| `authenticate() throws on invalid credentials` | Invariant | Clear error message, not raw API error |
| `syncTestRun() creates Xray execution` | Invariant | Correct API payload construction |
| `syncTestRun() maps PASSED → PASS` | Invariant | Status mapping table |
| `syncTestRun() maps FAILED → FAIL` | Invariant | Status mapping table |
| `syncTestRun() maps SKIPPED → TODO` | Invariant | Status mapping table |
| `syncTestRun() maps FLAKY → FAIL` | Invariant | Conservative: flaky = failure |
| `syncTestRun() persists XraySync record on success` | Invariant | Database write after sync |
| `syncTestRun() rolls back on partial failure` | Invariant | All-or-nothing atomicity |
| `syncTestRun() is idempotent` | Behavioral | Re-sync updates, doesn't duplicate |
| `getTestCases() returns structured results` | Behavioral | Correct response parsing |
| `getTestCases() caps at 25 results` | Invariant | Safety limit |
| `validateConnection() returns true on success` | Contract | Happy path |
| `validateConnection() returns false on auth failure` | Contract | 401/403 handling |
| `isEnabled() returns false when not configured` | Contract | Graceful degradation |

### Unit Tests: Security

| Test | Assertion ID | What It Validates |
|------|-------------|-------------------|
| `constructor rejects localhost/private-IP URLs` | `xray.security.ssrf-validation` | SSRF prevention via validateUrlForSSRF() |
| `search query escapes special chars in JQL` | `xray.security.jql-escape` | No JQL injection |
| `auth failure error omits client_secret` | `xray.security.no-secret-leak` | Credential leak prevention |
| `sync failure error omits JWT token` | `xray.security.no-secret-leak` | Token leak prevention |

### Unit Tests: Mock / Demo Path

| Test | Assertion ID | What It Validates |
|------|-------------|-------------------|
| `mock provider routes "xray test cases" to xray_search` | `xray.mock.intent-routes` | Intent matching in demo mode |
| `mock xray_search returns test case array` | `xray.mock.returns-data` | Realistic mock shape |

### Integration Tests: API Routes

| Test | Assertion Type | What It Validates |
|------|---------------|-------------------|
| `GET /xray/test-connection — 401 without JWT` | Contract | Auth middleware |
| `GET /xray/test-connection — 403 for non-admin` | Contract | RBAC enforcement |
| `GET /xray/test-connection — 200 for admin` | Contract | Happy path |
| `POST /xray/sync/:id — 404 for unknown test run` | Contract | Input validation |
| `POST /xray/sync/:id — 200 with valid test run` | Contract | Sync execution |
| `POST /xray/sync/:id — response shape` | Contract | Response format |
| `GET /xray/test-cases — returns search results` | Behavioral | Query parameter handling |
| `GET /xray/test-cases — 503 when Xray not configured` | Contract | Graceful error |
| `GET /xray/syncs — lists sync history` | Behavioral | Pagination, filtering |
| `GET /xray/syncs/:id — returns sync status` | Behavioral | Single record retrieval |
| `POST /xray/sync/:id — 409 for already-syncing run` | Contract | Concurrency guard |
| `POST /xray/sync/:id — stores execution ID on success` | Invariant | Database persistence |

### E2E Tests: Playwright

| Test | Scope | Steps |
|------|-------|-------|
| `xray-settings-config` | Settings | Navigate to Settings > Integrations > Xray, fill form, click Test Connection, verify success toast |
| `xray-sync-from-testrun` | Test Run | Navigate to a test run, click "Sync to Xray", verify sync status badge |
| `xray-ai-tool-search` | Copilot | Open copilot, type "find xray test cases for login", verify tool card renders results |
| `xray-not-configured-error` | Error | Without Xray config, attempt sync, verify 503 error message |
| `xray-smoke` | **Smoke** | Settings config → test connection → navigate to test run → sync → verify sync history shows entry. Full happy path in one test. This is the **release gate** — if smoke fails, no release. |

### Edge Cases

Each edge case is mapped to a feature spec assertion to ensure traceability and prevent orphan tests.

| Category | Scenario | Expected Behavior | Assertion ID |
|----------|----------|-------------------|-------------|
| **Auth** | Token expires mid-batch-sync | Refresh token, retry current batch | `xray.auth.token-cache` |
| **Auth** | Client secret rotated | 401 → clear error, prompt re-configuration | `xray.auth.invalid-credentials` |
| **Sync** | Test run has 0 results | Sync succeeds with empty execution (valid in Xray) | `xray.sync.create-execution` |
| **Sync** | Test run has 500+ results | Batch upload in chunks of 100 | `xray.sync.create-execution` |
| **Sync** | Xray API returns 429 | Backoff + retry (max 2), then fail with rate limit message | `xray.resilience.retry-transient` |
| **Sync** | Network timeout during upload | Circuit breaker opens, subsequent calls fail-fast | `xray.resilience.circuit-breaker` |
| **Sync** | Duplicate sync attempt (concurrent) | Second request returns 409 Conflict | `xray.sync.idempotent` |
| **Sync** | Test run already synced | Updates existing execution (idempotent) | `xray.sync.idempotent` |
| **Config** | Only partial config provided | Service stays disabled, clear warning in logs | `xray.api.not-configured` |
| **Config** | Invalid URL format | Zod validation rejects at config load time | *(config.ts Zod schema — not spec-tracked)* |
| **Security** | XRAY_CLOUD_URL set to localhost | Rejected by SSRF validator in constructor | `xray.security.ssrf-validation` |
| **Security** | Search query with JQL injection chars | Escaped before API call | `xray.security.jql-escape` |
| **AI Tool** | Xray not configured, user asks copilot | Tool returns "Xray integration not configured" message | `xray.tool.graceful-disabled` |
| **AI Tool** | Query returns 0 results | Tool returns "No test cases found matching..." | `xray.tool.returns-cases` |
| **AI Tool** | Query contains special characters | JQL/query is escaped before API call | `xray.security.jql-escape` |
| **Frontend** | Settings form — empty required fields | Submit disabled, validation messages shown | `xray.frontend.validation` |
| **Frontend** | Connection test fails | Red error banner with specific error (auth vs network vs timeout) | `xray.frontend.error-display` |
| **Resilience** | 5 consecutive failures | Circuit opens, all calls fail-fast for 30s | `xray.resilience.circuit-breaker` |
| **Resilience** | Circuit half-open, next call succeeds | Circuit closes, normal operation resumes | `xray.resilience.circuit-breaker` |

### Whitebox Tests

| Area | What to Verify |
|------|---------------|
| **Token caching** | Internal `_cachedToken` and `_tokenExpiry` fields update correctly |
| **Status mapper** | `mapStatusToXray()` covers all enum values including edge cases |
| **JQL escaping** | Special characters in search queries are properly escaped |
| **Batch chunking** | `syncTestRun()` splits results into chunks when > 100 |
| **Config parsing** | `config.xray` is `undefined` when any required env var is missing |
| **Resilience label** | Circuit breaker registered with label `xray` for monitoring |

### Test Data Requirements

| Data | Source | Notes |
|------|--------|-------|
| Mock Xray API responses | Jest mocks (axios) | Realistic response shapes from Xray Cloud API docs |
| Demo XraySync records | `seed.dev.ts` | 3 synced test runs, 1 failed sync, 1 pending |
| Test run with results | Existing seed data | Reuse existing TestRun records from current seed |
| Invalid credentials | Jest fixtures | Trigger auth error paths |

---

## Summary

| Deliverable | Status | Owner |
|-------------|--------|-------|
| Product Plan (scope, AC, success metrics) | ✅ Defined (rev 2) | AI_PRODUCT_MANAGER |
| Architecture (component diagram, data model, API design) | ✅ Designed (rev 2) | AI_ARCHITECT |
| Sprint Plan (WBS, schedule, RnRs, risks) | ✅ Planned (rev 2) | SENIOR_ENGINEER |
| Test Plan (pyramid, feature spec, edge cases, whitebox) | ✅ Specified (rev 2) | TEST_ENGINEER |

**Next action**: Begin implementation on Day 1 — QA writes feature spec YAML (#13), Data creates schema (#1), Backend sets up config + resilience (#3, #4).

---

## Review Log

### Rev 2 — Full Team Review (2026-03-02)

14 issues identified and resolved across all 4 personas:

| ID | Persona | Issue | Fix |
|----|---------|-------|-----|
| P1 | PRODUCT | Target Users table promised bi-directional sync (out of scope for v3.3) | Rewrote outcomes to reflect push-only scope with explicit note |
| P2 | PRODUCT | "Adoption rate" metric unmeasurable in demo context | Replaced with concrete, testable metrics (connection success, E2E flow, AI discoverability) |
| P3 | PRODUCT | No mechanism to map TestResult → Xray test case key | Added AC-5 (externalTestCaseId field), linked to Architect data model |
| A1 | ARCHITECT | Credential storage decision not documented (env var vs encrypted DB) | Added "Credential Storage Decision" section with rationale matching existing integration patterns |
| A2 | ARCHITECT | No field on TestResult model to map to Xray test case keys | Added `externalTestCaseId String?` to TestResult schema, generic for future integrations |
| A3 | ARCHITECT | Missing SSRF validation on configurable XRAY_CLOUD_URL | Added "Security: SSRF Validation" section mirroring testrail.service.ts pattern |
| A4 | ARCHITECT | Mock provider had no intent rule for xray_search — tool invisible in demo mode | Added mock provider intent, mock result, and TOOL_SUMMARIES entry |
| L1 | LEAD | Ticket #2 (XrayService, 4h) was SPOF blocking 6 downstream tickets | Split into #2a (auth, 2h) and #2b (sync, 2h) to unblock parallel tracks earlier |
| L2 | LEAD | QA started Day 6 — waterfall anti-pattern, 5 idle days | Moved feature spec to Day 1, QA writes test stubs from Day 2, frontend starts against mock API contract Day 2 |
| Q1 | QA | No security tests (SSRF, JQL injection, credential leakage) | Added `xray.security` capability (3 assertions) + 4 unit tests |
| Q2 | QA | No demo/mock path tests — mock provider untested | Added `xray.mock` capability (2 assertions) + 2 unit tests |
| Q3 | QA | Edge cases not mapped to feature spec assertions (orphan risk) | Added `Assertion ID` column to edge case table — every scenario is traceable |
| Q4 | QA | Frontend had only 2 assertions for Settings UI | Added `xray.frontend.validation` + `xray.frontend.error-display` (4 total) |
| Q5 | QA | No smoke test defined — no release gate | Added `xray-smoke` E2E test as release gate |

**Pre-mortem risks considered**:
- Scope creep into bi-directional sync → hard boundary in Product scope + Won't-Have
- OAuth token race conditions → atomic sync + idempotency assertions
- Security surface (SSRF, JQL injection, credential leaks) → dedicated security capability in spec
- QA idle time → shifted to Day 1 parallel start
- Single engineer bottleneck → XrayService split into 2 tickets

**Post-mortem readiness**: Feature spec YAML written Day 1 means spec scanner catches drift immediately. Every edge case is mapped to an assertion ID — no orphan tests possible. Smoke test gates the release.
