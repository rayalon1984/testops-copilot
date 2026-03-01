# API_CONTRACT.md — API Contract

> **Owner**: Senior Engineer · **Status**: Living document · **Version**: 3.2.0 · **Last verified**: 2026-03-02

---

## 1. Conventions

| Aspect | Convention |
|--------|-----------|
| Base URL | `/api/v1` |
| Auth | `Authorization: Bearer <JWT>` (except public routes) |
| Content-Type | `application/json` (request + response) |
| Streaming | `text/event-stream` (SSE for AI chat) |
| Error format | `{ "status": "error", "message": "..." }` |
| Timestamps | ISO-8601 (`2026-02-19T12:34:56.789Z`) |
| IDs | UUIDs |
| Pagination | Implicit limits (no cursor/offset API yet) |
| Swagger | `GET /api/docs` (interactive UI) |

---

## 2. Global Middleware

| Middleware | Config |
|-----------|--------|
| Helmet | All default security headers |
| CORS | Origin: `CORS_ORIGIN` (default `http://localhost:5173`), credentials: true |
| Rate limit (global) | 100 req / 15 min |
| Rate limit (auth) | 10 req / 15 min on login + register |
| Body parser | JSON + URL-encoded, 1MB limit |
| Compression | gzip |

---

## 3. Error Responses

| Status | Meaning |
|--------|---------|
| 400 | Validation error (Zod) |
| 401 | Missing or invalid JWT |
| 403 | Insufficient role |
| 404 | Resource not found |
| 409 | Conflict (duplicate) |
| 429 | Rate limit exceeded |
| 500 | Internal server error |

Production responses include `message` only. Development adds `stack` and `details`.

---

## 4. Route Catalog

### 4.1 Health (No Auth)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Returns `{ status: "ok", timestamp }` |
| GET | `/health/full` | Comprehensive health with service + circuit breaker states |
| GET | `/health/ready` | Readiness probe (database connectivity) |
| GET | `/health/live` | Liveness probe (process alive + uptime) |

**`/health/full` response**:

```json
{
  "status": "healthy | degraded | unhealthy",
  "timestamp": "ISO-8601",
  "version": "3.0.0",
  "uptime": 12345,
  "services": {
    "database": { "status": "up | down", "responseTime": 5 },
    "redis": { "status": "up | down", "responseTime": 2 },
    "weaviate": { "status": "up | down" },
    "ai": { "status": "up | down", "details": { "provider": "anthropic" } }
  },
  "circuitBreakers": [
    {
      "name": "github | jira | jenkins | confluence",
      "state": "CLOSED | OPEN | HALF_OPEN",
      "failures": 0,
      "lastFailureTime": "ISO-8601 | null",
      "nextRetryTime": "ISO-8601 | null"
    }
  ],
  "environment": { "nodeEnv": "production", "nodeVersion": "v18.x", "port": 3000 }
}
```

**Status logic**: `unhealthy` if any service is down. `degraded` if any service degraded OR any circuit breaker is OPEN. Returns 503 for `unhealthy`, 200 otherwise.

### 4.2 Authentication

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| POST | `/api/v1/auth/register` | No | — | Register user. Body: `{ email, password, firstName, lastName }` |
| POST | `/api/v1/auth/login` | No | — | Login. Body: `{ email, password }`. Returns `{ user, accessToken }` + refresh cookie |
| POST | `/api/v1/auth/logout` | Yes | — | Blacklist tokens, clear cookie |
| POST | `/api/v1/auth/refresh` | No* | — | Refresh via cookie. Returns new `{ accessToken }` + new cookie |
| GET | `/api/v1/auth/me` | Yes | — | Get current user profile |
| PUT | `/api/v1/auth/password` | Yes | — | Update password. Body: `{ currentPassword, newPassword }` |
| GET | `/api/v1/auth/login/sso/saml` | No | — | Initiate SAML SSO (if `SSO_ENABLED`) |
| POST | `/api/v1/auth/login/sso/saml/callback` | No | — | SAML callback → redirect with token |

*Refresh uses httpOnly cookie, not Bearer header.

### 4.3 Pipelines

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/api/v1/pipelines` | Yes | VIEWER | List user's pipelines |
| GET | `/api/v1/pipelines/:id` | Yes | VIEWER | Get pipeline by ID |
| POST | `/api/v1/pipelines` | Yes | EDITOR | Create pipeline. Body: `{ name, type, config }` |
| PUT | `/api/v1/pipelines/:id` | Yes | EDITOR | Update pipeline |
| DELETE | `/api/v1/pipelines/:id` | Yes | EDITOR | Delete pipeline |
| POST | `/api/v1/pipelines/:id/start` | Yes | EDITOR | Trigger pipeline run |
| POST | `/api/v1/pipelines/:id/schedule` | Yes | EDITOR | Set cron schedule |
| GET | `/api/v1/pipelines/:id/test-runs` | Yes | VIEWER | Get test runs (last 20) |
| GET | `/api/v1/pipelines/:id/failed-tests` | Yes | VIEWER | Get failed tests |
| GET | `/api/v1/pipelines/:id/flakey-tests` | Yes | VIEWER | Get flaky tests |
| POST | `/api/v1/pipelines/validate-config` | Yes | — | Validate pipeline config |

**Pipeline types**: `jenkins`, `github-actions`, `custom`

**Pipeline config schema**:
```json
{
  "url": "string (valid URL)",
  "credentials": { "username": "string", "apiToken": "string" },
  "repository": "string (optional)",
  "branch": "string (optional)",
  "triggers": ["push", "pull_request", "schedule", "manual"],
  "schedule": "string (cron expression, optional)"
}
```

### 4.4 Test Runs

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/api/v1/test-runs` | Yes | VIEWER | List test runs (last 100, desc) |
| GET | `/api/v1/test-runs/:id` | Yes | VIEWER | Get test run with details |

**Test run statuses**: `success`, `failed`, `running`, `pending`, `skipped`, `flaky`

### 4.5 Flaky Tests

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/api/v1/tests/flaky` | Yes | VIEWER | List flaky tests across all pipelines |
| GET | `/api/v1/tests/:testName/flaky-history` | Yes | VIEWER | Get flakiness history for one test |

### 4.6 Failure Archive

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| POST | `/api/v1/failure-archive` | Yes | EDITOR | Create failure entry |
| GET | `/api/v1/failure-archive/:id` | Yes | VIEWER | Get failure by ID |
| GET | `/api/v1/failure-archive/search` | Yes | VIEWER | Search with filters |
| POST | `/api/v1/failure-archive/find-similar` | Yes | VIEWER | Find similar failures (signature matching) |
| GET | `/api/v1/failure-archive/insights` | Yes | VIEWER | Get trends and patterns |
| PUT | `/api/v1/failure-archive/:id/resolve` | Yes | EDITOR | Mark as resolved |
| PUT | `/api/v1/failure-archive/:id/document-rca` | Yes | EDITOR | Document root cause analysis (version-aware) |
| GET | `/api/v1/failure-archive/trends` | Yes | VIEWER | Failure trend time-series |
| GET | `/api/v1/failure-archive/predictions` | Yes | VIEWER | Risk scores per test |
| GET | `/api/v1/failure-archive/anomalies` | Yes | VIEWER | Anomaly detection results |
| GET | `/api/v1/failure-archive/:id/revisions` | Yes | VIEWER | RCA revision history |
| POST | `/api/v1/failure-archive/:id/comments` | Yes | EDITOR | Add comment to failure |
| GET | `/api/v1/failure-archive/:id/comments` | Yes | VIEWER | List comments (paginated) |
| DELETE | `/api/v1/failure-archive/:id/comments/:commentId` | Yes | EDITOR | Delete own comment |
| GET | `/api/v1/failure-archive/:id/activity` | Yes | VIEWER | Activity feed (revisions + comments) |

### 4.7 Notifications

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/api/v1/notifications` | Yes | VIEWER | List notifications |
| GET | `/api/v1/notifications/undelivered` | Yes | VIEWER | Undelivered only |
| PATCH | `/api/v1/notifications/:id/delivered` | Yes | VIEWER | Mark delivered |
| DELETE | `/api/v1/notifications/:id` | Yes | VIEWER | Delete notification |
| GET | `/api/v1/notifications/preferences` | Yes | VIEWER | Get user preferences |
| PUT | `/api/v1/notifications/preferences` | Yes | VIEWER | Update preferences |
| POST | `/api/v1/notifications/test` | Yes | VIEWER | Send test notification |
| GET | `/api/v1/notifications/channels` | Yes | VIEWER | List available channels |
| POST | `/api/v1/notifications/channels/verify` | Yes | VIEWER | Verify channel config |
| GET | `/api/v1/notifications/history` | Yes | VIEWER | Delivery history |
| GET | `/api/v1/notifications/metrics` | Yes | ADMIN | Delivery metrics |
| POST | `/api/v1/notifications/broadcast` | Yes | ADMIN | Broadcast to all users |
| GET | `/api/v1/notifications/settings` | Yes | ADMIN | Global settings |
| PUT | `/api/v1/notifications/settings` | Yes | ADMIN | Update global settings |

**Notification channels**: `email`, `slack`, `pushover`

**Notification conditions**: `pipelineStart`, `pipelineSuccess`, `pipelineFailure`, `testFlaky`, `coverageDecrease`

### 4.8 AI Services

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/api/v1/ai/health` | Yes | VIEWER | AI service health |
| POST | `/api/v1/ai/rca/similar` | Yes | VIEWER | Find similar failures (vector search) |
| POST | `/api/v1/ai/rca/store` | Yes | VIEWER | Store failure for future matching |
| PUT | `/api/v1/ai/rca/:id/resolve` | Yes | VIEWER | Mark failure as resolved |
| GET | `/api/v1/ai/costs` | Yes | VIEWER | AI cost summary (date range) |
| GET | `/api/v1/ai/stats` | Yes | VIEWER | Overall AI statistics |
| POST | `/api/v1/ai/categorize` | Yes | VIEWER | Categorize a failure |
| POST | `/api/v1/ai/summarize` | Yes | VIEWER | Summarize failure logs |
| POST | `/api/v1/ai/enrich` | Yes | VIEWER | Cross-platform context enrichment |

**Failure categories**: `bug_critical`, `bug_minor`, `environment`, `flaky`, `configuration`, `unknown`

### 4.8a AI Starter Prompts (v3.2.0)

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/api/v1/ai/starter-prompts` | Yes | VIEWER | Resolved prompts for current user (role defaults + pins) |
| GET | `/api/v1/ai/starter-prompts/catalog` | Yes | VIEWER | Full prompt catalog for settings UI |
| PATCH | `/api/v1/ai/starter-prompts/pins` | Yes | VIEWER | Save/update user pinned prompts (max 4) |
| DELETE | `/api/v1/ai/starter-prompts/pins` | Yes | VIEWER | Reset to role defaults |

**GET response**: `{ data: { prompts: [{ id, label, prompt, icon?, category?, pinned, source }] } }` — `source`: `pin` | `context` | `role`

**PATCH body**: `{ pins: [{ id?, label, prompt }] }` — Validation: max 4 pins, label ≤ 40 chars, prompt ≤ 200 chars

**Cache**: `Cache-Control: private, max-age=300` (5 min)

### 4.9 AI Chat (Agentic — SSE Streaming)

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| POST | `/api/v1/ai/chat` | Yes | VIEWER | Start agentic chat (SSE stream) |
| GET | `/api/v1/ai/sessions` | Yes | VIEWER | List user's chat sessions |
| GET | `/api/v1/ai/sessions/:id` | Yes | VIEWER | Get session with messages |
| POST | `/api/v1/ai/sessions` | Yes | VIEWER | Create new session |
| DELETE | `/api/v1/ai/sessions/:id` | Yes | VIEWER | Delete session + messages |
| GET | `/api/v1/ai/sessions/:id/pending` | Yes | VIEWER | Get pending write actions |
| POST | `/api/v1/ai/confirm` | Yes | VIEWER | Approve/deny pending action |

**SSE event types**: `thinking`, `tool_start`, `tool_result`, `confirmation_request`, `confirmation_resolved`, `answer`, `error`, `done`

**Chat request**: `{ message: string, sessionId?: uuid, history?: object[] }`

**Confirm request**: `{ actionId: uuid, approved: boolean }`

### 4.10 Dashboard & Metrics

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/api/v1/dashboard` | Yes | VIEWER | Dashboard metrics |
| GET | `/api/v1/metrics/summary` | Yes | VIEWER | Metrics summary |
| GET | `/api/v1/metrics/top-failures` | Yes | VIEWER | Top failing tests |
| GET | `/api/v1/metrics/health` | Yes | VIEWER | System health metrics |
| GET | `/metrics` | Yes | VIEWER | Prometheus format (text/plain) |

### 4.11 CI Integration

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| POST | `/api/v1/ci/smart-select` | Yes | VIEWER | Smart test selection by code changes |

### 4.12 Monday.com Integration

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/api/v1/monday/boards` | Yes | VIEWER | List boards |
| GET | `/api/v1/monday/boards/:boardId` | Yes | VIEWER | Get board |
| GET | `/api/v1/monday/boards/:boardId/items` | Yes | VIEWER | Get board items |
| GET | `/api/v1/monday/boards/:boardId/search` | Yes | VIEWER | Search board items |
| POST | `/api/v1/monday/items` | Yes | VIEWER | Create item |
| PUT | `/api/v1/monday/items/:itemId` | Yes | VIEWER | Update item |
| POST | `/api/v1/monday/items/:itemId/updates` | Yes | VIEWER | Add comment |
| POST | `/api/v1/monday/test-failures` | Yes | VIEWER | Create from test failure |
| GET | `/api/v1/monday/test-connection` | Yes | VIEWER | Test API connection |

### 4.13 Teams

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| POST | `/api/v1/teams` | Yes | EDITOR | Create team (creator becomes OWNER) |
| GET | `/api/v1/teams` | Yes | VIEWER | List user's teams |
| GET | `/api/v1/teams/:teamId` | Yes | VIEWER | Get team with members |
| PUT | `/api/v1/teams/:teamId` | Yes | EDITOR | Update team (requires team ADMIN) |
| DELETE | `/api/v1/teams/:teamId` | Yes | ADMIN | Delete team (requires team OWNER or global ADMIN) |
| GET | `/api/v1/teams/:teamId/members` | Yes | VIEWER | List team members |
| POST | `/api/v1/teams/:teamId/members` | Yes | EDITOR | Add member (requires team ADMIN) |
| DELETE | `/api/v1/teams/:teamId/members/:userId` | Yes | EDITOR | Remove member (requires team ADMIN) |
| PUT | `/api/v1/teams/:teamId/members/:userId/role` | Yes | EDITOR | Update member role (requires team ADMIN) |
| GET | `/api/v1/teams/:teamId/pipelines` | Yes | VIEWER | List team pipelines |
| POST | `/api/v1/teams/:teamId/pipelines/:pipelineId` | Yes | EDITOR | Assign pipeline to team |
| GET | `/api/v1/teams/:teamId/dashboards` | Yes | VIEWER | List team dashboards |
| POST | `/api/v1/teams/:teamId/dashboards` | Yes | EDITOR | Create dashboard config |
| PUT | `/api/v1/teams/:teamId/dashboards/:dashboardId` | Yes | EDITOR | Update dashboard config |
| DELETE | `/api/v1/teams/:teamId/dashboards/:dashboardId` | Yes | EDITOR | Delete dashboard config |

**Team roles** (hierarchy): `OWNER` > `ADMIN` > `MEMBER` > `VIEWER`

### 4.14 Self-Healing Pipelines

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/api/v1/healing/rules` | Yes | VIEWER | List healing rules |
| GET | `/api/v1/healing/rules/:id` | Yes | VIEWER | Get healing rule by ID |
| POST | `/api/v1/healing/rules` | Yes | EDITOR | Create healing rule |
| PUT | `/api/v1/healing/rules/:id` | Yes | EDITOR | Update healing rule |
| PATCH | `/api/v1/healing/rules/:id/toggle` | Yes | EDITOR | Toggle rule enabled/disabled |
| DELETE | `/api/v1/healing/rules/:id` | Yes | EDITOR | Delete healing rule |
| POST | `/api/v1/healing/evaluate` | Yes | EDITOR | Evaluate test run against healing rules |
| POST | `/api/v1/healing/execute` | Yes | EDITOR | Execute healing action on a test run |
| GET | `/api/v1/healing/events` | Yes | VIEWER | List healing events (with filters) |
| GET | `/api/v1/healing/stats` | Yes | VIEWER | Get healing statistics |
| GET | `/api/v1/healing/quarantine` | Yes | VIEWER | List quarantined tests |
| POST | `/api/v1/healing/quarantine` | Yes | EDITOR | Quarantine a test |
| PATCH | `/api/v1/healing/quarantine/:id/reinstate` | Yes | EDITOR | Reinstate quarantined test |
| DELETE | `/api/v1/healing/quarantine/:id` | Yes | EDITOR | Delete quarantined test |
| GET | `/api/v1/healing/quarantine/stats` | Yes | VIEWER | Get quarantine statistics |
| GET | `/api/v1/healing/fix-suggestions` | Yes | VIEWER | Get AI fix suggestions |
| POST | `/api/v1/healing/seed` | Yes | ADMIN | Seed built-in healing rules |

**Healing actions**: `retry`, `quarantine`, `fix_pr`, `notify`
**Pattern types**: `regex`, `keyword`, `signature`
**Healing categories**: `transient`, `infrastructure`, `flaky`, `custom`

---

## 5. Endpoint Summary

| Category | Endpoints | Auth Required | Admin-Only |
|----------|-----------|---------------|------------|
| Health | 1 | 0 | 0 |
| Auth | 8 | 4 | 0 |
| Pipelines | 11 | 11 | 0 |
| Test Runs | 2 | 2 | 0 |
| Flaky Tests | 2 | 2 | 0 |
| Failure Archive | 15 | 15 | 0 |
| Notifications | 14 | 14 | 4 |
| AI Services | 9 | 9 | 0 |
| AI Chat | 7 | 7 | 0 |
| Dashboard/Metrics | 5 | 5 | 0 |
| CI | 1 | 1 | 0 |
| Monday.com | 9 | 9 | 0 |
| Teams | 15 | 15 | 1 |
| Self-Healing | 17 | 17 | 1 |
| **Total** | **116** | **111** | **6** |

---

## 6. Validation Schemas (Zod)

### User Registration
- `email`: valid email format
- `password`: 8+ chars, 1+ uppercase, 1+ lowercase, 1+ digit, 1+ special (`@$!%*?&`)
- `firstName`: 2+ chars (optional)
- `lastName`: 2+ chars (optional)

### Pipeline Creation
- `name`: 3+ chars
- `type`: `jenkins` | `github-actions` | `custom`
- `config.url`: valid URL
- `config.credentials`: `{ username, apiToken }` required

### Notification Preferences
- `email.address`: valid email
- `email.digestFrequency`: `daily` | `weekly`
- `slack.channel`: string (required if enabled)
- `pushover.priority`: -2 to 2

### AI Failure Input
- `failure.testId`: string (required)
- `failure.errorMessage`: string (required)

### Broadcast
- `message`: 1+ chars
- `channels`: at least 1 of `email`, `slack`, `pushover`

---

*Canonical source. Update when routes change — not after.*
