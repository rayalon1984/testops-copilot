# ARCHITECTURE.md — System Design

> **Owner**: Senior Engineer + AI Architect · **Status**: Living document · **Version**: 2.9.0-rc.7 · **Last verified**: 2026-02-20

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Client (Browser / MCP Host)                     │
└──────────┬──────────────────────────────────┬───────────────────────┘
           │ HTTPS / SSE                      │ stdio (MCP)
           ▼                                  ▼
┌─────────────────────┐            ┌─────────────────────┐
│   Frontend (Vite)   │            │   MCP Server        │
│   React + TS        │            │   8 tools           │
│   Port 5173         │            │   PostgreSQL direct  │
└──────────┬──────────┘            └──────────┬──────────┘
           │ REST + SSE                       │ SQL
           ▼                                  ▼
┌─────────────────────────────────────────────────────────┐
│                Express Backend (Port 3000)               │
│  ┌──────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐  │
│  │Routes│→│Controllers│→│ Services │→│External APIs   │  │
│  └──────┘ └──────────┘ └────┬─────┘ │Jira,GitHub,    │  │
│                              │       │Confluence,Slack│  │
│                              │       └───────────────┘  │
│  ┌───────────┐  ┌────────┐  │  ┌──────────────────┐    │
│  │Middleware  │  │Prisma  │←─┘  │AI Service Layer  │    │
│  │auth,rate, │  │ORM     │     │Provider Registry │    │
│  │validation │  │        │     │Tool Registry     │    │
│  └───────────┘  └───┬────┘     │Cost Tracker      │    │
│                      │          │Cache (Redis)     │    │
└──────────────────────┼──────────┴────────┬─────────────┘
                       │                   │
           ┌───────────┼───────────┐       │
           ▼           ▼           ▼       ▼
    ┌──────────┐ ┌──────────┐ ┌────────┐ ┌──────────┐
    │PostgreSQL│ │  Redis   │ │Weaviate│ │LLM APIs  │
    │Primary DB│ │Cache+Rate│ │VectorDB│ │Anthropic │
    └──────────┘ └──────────┘ └────────┘ │OpenAI etc│
                                          └──────────┘
```

---

## 2. Frontend Architecture

**Stack**: React 18 + TypeScript + Vite

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Routing | React Router v6 | Client-side routing |
| UI Components | Material UI + Tailwind CSS | Component library + utility styling |
| State | Zustand | Lightweight global state |
| Server State | React Query (TanStack) | Data fetching, caching, cache invalidation |
| Auth | Context API | JWT token management, role-based rendering |
| Testing | React Testing Library + Cypress | Unit/component + E2E tests |

**Key Patterns**:
- Pages → Components → Hooks → API Services
- Auth context wraps entire app; routes gated by role
- React Query handles all API calls with automatic refetch/retry
- Agentic UI: 3-column layout (sidebar | main content | AI panel)

---

## 3. Backend Architecture

**Stack**: Node.js + Express + TypeScript + Prisma

### 3.1 Layer Diagram

```
Request → Middleware → Route → Controller → Service → Model/External
                                                         ↓
                                                    Prisma / API
```

### 3.2 Middleware Stack (Order Matters)

1. **Helmet** — Security headers (HSTS, CSP, X-Frame-Options)
2. **CORS** — Configurable origin (default: `http://localhost:5173`)
3. **Compression** — gzip response compression
4. **Rate Limiter (global)** — 100 req / 15 min
5. **Rate Limiter (auth)** — 10 req / 15 min on `/auth/login`, `/auth/register`
6. **Body Parser** — JSON + URL-encoded, 1MB limit
7. **Session** — Express session with HTTP-only cookies
8. **Passport.js** — Auth strategy initialization (JWT + SAML)
9. **`authenticate`** — JWT verification + blacklist check
10. **`authorize(role)`** — Role hierarchy gate

### 3.3 Service Layer

| Service | Responsibility |
|---------|---------------|
| `AuthService` | Registration, login, JWT issuance, password change |
| `PipelineService` | CRUD pipelines, trigger runs, schedule |
| `TestRunService` | Test run tracking, result aggregation |
| `NotificationService` | Multi-channel dispatch (Slack, Email, Pushover) |
| `FailureArchiveService` | Fingerprint, match, search, RCA documentation |
| `AIManager` | Orchestrates all AI features |
| `AIChatService` | ReAct loop, SSE streaming, tool execution |
| `ContextEnrichmentService` | Cross-platform enrichment (Jira + Confluence + GitHub) |
| `ConfirmationService` | Human-in-the-loop gates for write tools |
| `CostTracker` | AI usage recording, budget alerts |
| `AICache` | 3-tier Redis caching (response, embedding, summary) |
| `TokenBlacklistService` | In-memory token revocation (logout/refresh) |

---

## 4. Data Layer

### 4.1 PostgreSQL (Primary)

**ORM**: Prisma with type-safe queries and migrations

**Core Tables**:
```
User ──1:N──→ Pipeline ──1:N──→ TestRun ──1:N──→ TestResult
  │                                 │
  ├──1:N──→ Notification            └──linked──→ FailureArchive ──sig──→ FailurePattern
  │
  └──1:N──→ ChatSession ──1:N──→ ChatMessage
                 └──1:N──→ PendingAction
```

**Key Indexes**:
- `FailureArchive`: `failureSignature`, `testName`, `occurredAt`, `status`, `isRecurring`
- `FailurePattern`: `signature`
- `ai_usage`: `timestamp`, `provider`, `feature`, `user_id`

### 4.2 Redis (Cache + Rate Limiting)

- AI response cache: `ai:response:{sha256(prompt)}` — 7d TTL
- AI embedding cache: `ai:embedding:{sha256(text)}` — 7d TTL
- AI summary cache: `ai:summary:{logHash}` — 7d TTL
- Rate limit counters
- Session store (production)

### 4.3 Weaviate (Vector DB)

- Stores failure embeddings for semantic similarity search
- Used by RCA matching feature
- Optional — system degrades gracefully without it

---

## 5. AI Architecture

### 5.1 Provider Abstraction

```
ProviderRegistry (singleton)
├── AnthropicProvider   → Claude Opus 4.6 (default)
├── OpenAIProvider      → GPT-4.1
├── GoogleProvider      → Gemini 3.0 Flash
├── AzureProvider       → GPT-4.1 (custom endpoint)
├── OpenRouterProvider  → Claude Sonnet 4.5
└── MockProvider        → Testing
```

**Base Interface**: `chat()`, `embed()`, `healthCheck()`, `calculateCost()`

### 5.2 ReAct Loop (Agentic)

```
FOR iteration 0..7 (max 8):
  1. Send messages + tool definitions to LLM
  2. IF response has no tool calls → emit "answer", DONE
  3. IF response has tool calls:
     a. IF write tool → create PendingAction, emit "confirmation_request", PAUSE
     b. IF read tool → execute immediately, emit "tool_result"
     c. Append results to message history
  4. Loop with updated history
```

**Safety bounds**: Max 5 tool calls per request, max 8 iterations.

### 5.3 Tool Registry

- 7 read-only tools (auto-approved): `jira_search`, `jira_get`, `github_get_commit`, `github_get_pr`, `confluence_search`, `jenkins_get_status`, `dashboard_metrics`
- 6 write tools (confirmation required): `jira_create_issue`, `jira_transition_issue`, `jira_comment`, `github_create_pr`, `github_create_branch`, `github_update_file`

See `specs/AI_TOOLS.md` for full registry.

### 5.4 Cost Management

- Every AI call recorded to `ai_usage` table
- Monthly budget default: $100 with 80% alert threshold
- 3-tier Redis cache targets >50% hit rate
- MCP server provides 98% token reduction for Claude Code/Cursor

---

## 6. Authentication & Authorization

### 6.1 JWT Flow

```
Login → bcrypt verify → issue access token (24h) + refresh token (7d cookie)
Request → extract Bearer → check blacklist → verify JWT → load user → authorize role
Logout → blacklist both tokens → clear cookie
Refresh → verify refresh cookie → blacklist old → issue new pair
```

### 6.2 Role Hierarchy

```
ADMIN (40) > EDITOR/USER (30) > BILLING (20) > VIEWER (10)
```

Higher roles inherit all permissions of lower roles. See `specs/SECURITY.md`.

---

## 7. External Integration Architecture

### 7.1 Resilience Layer

All external service calls pass through a resilience wrapper (`backend/src/lib/resilience.ts`):

```
Service Call → withResilience()
                 ├── CircuitBreaker (CLOSED → OPEN → HALF_OPEN)
                 ├── Retry (exponential backoff + jitter)
                 └── Timeout (per-request deadline)
```

**Pre-configured breakers**:

| Service | Failure Threshold | Reset Timeout | Max Retries | Timeout |
|---------|------------------|---------------|-------------|---------|
| GitHub | 5 consecutive | 30s | 2 | 10s |
| Jira | 5 consecutive | 30s | 2 | 10s |
| Jenkins | 3 consecutive | 60s | 1 | 15s |
| Confluence | 5 consecutive | 30s | 2 | 10s |

**Circuit breaker states**:
- **CLOSED** — Healthy, all calls pass through
- **OPEN** — Failing, calls fast-fail with `CircuitOpenError` (no network call)
- **HALF_OPEN** — Recovery probe, one call allowed; success → CLOSED, failure → OPEN

State visible in `/health/full` endpoint under `circuitBreakers[]`.

### 7.2 Context Enrichment Flow

```
Test Failure
    ├──→ Jira: JQL text search (cleaned error message)
    ├──→ Confluence: CQL search (runbooks, RCA docs)      ← Promise.allSettled()
    └──→ GitHub: commit diffs + PR file changes
              ↓
    AI Synthesis Engine (relevance scoring, confidence 0.3–0.95)
              ↓
    Actionable Analysis + Confidence Score
```

### 7.2 Failure Matching Flow

```
New Failure → Generate Signature (hash) → Normalize Error
    ├──→ Exact Match (100% — identical signature)
    ├──→ Fuzzy Match (≥80% — Levenshtein distance)
    └──→ Pattern Match (known recurring patterns)
              ↓
    Display Similar Past Failures + RCA Documentation
```

---

## 8. Deployment Architecture

### 8.1 Modes

| Mode | Start Command | Database | Redis | AI |
|------|--------------|----------|-------|-----|
| Demo | `npm run dev:simple` | SQLite (memory) | None | Mock |
| Development | `npm run dev` | SQLite (file) | Optional | Any |
| Production | `docker compose up` | PostgreSQL | Redis | Full |

### 8.2 Docker Services

```yaml
services:
  backend:    # Express API (port 3000)
  frontend:   # Vite dev server (port 5173) / nginx (prod)
  postgres:   # PostgreSQL 15
  redis:      # Redis 7
  weaviate:   # Weaviate vector DB (optional)
```

### 8.3 Observability

- **Logging**: Winston (structured JSON)
- **Error tracking**: Sentry integration
- **Metrics**: Prometheus endpoint at `GET /metrics`
- **Dashboards**: Pre-built Grafana dashboards (20+ metrics)
- **Circuit breakers**: `/health/full` returns per-service state (CLOSED/OPEN/HALF_OPEN), failure count, next retry time
- **Audit**: All auth events + AI actions logged with full context

---

## 9. Known Limitations

| Limitation | Impact | Mitigation Path |
|-----------|--------|-----------------|
| Token blacklist is in-memory | Single-instance only; lost on restart | Migrate to Redis (tracked) |
| No WebSocket support | Polling for non-AI updates | Add Socket.IO for real-time |
| Notification endpoints use mock data | Not persisted to DB | Implement persistence layer |
| No fine-grained permissions | Role-only, no resource-level ACL | Add permission matrix |
| Single CORS origin | One frontend URL at a time | Add multi-origin support |

---

*Canonical source. Update when architecture changes — not after.*
