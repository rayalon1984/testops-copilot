# Product Specification — TestOps Copilot

> **Status**: Living document · **Owner**: AI Product Manager
> **Last synced**: 2026-02-27 · **Version**: 3.1.0

---

## 1. Mission

Reduce test failure investigation from **2+ hours to 5 minutes** by combining AI-powered analysis with institutional knowledge retention. Knowledge stays in the system, not in people's heads.

## 2. Target Users

| Persona | Core Pain | Primary Gain | Frequency |
|---------|-----------|--------------|-----------|
| **QA / Test Automation Engineer** | Manual log reading, ticket creation, context switching | Automated alerts, categorized failures, instant RCA suggestions | Daily |
| **Developer / DevOps Engineer** | Test failures blocking deploys, unclear root causes | Instant notifications, code-to-failure correlation, git awareness | Per deployment |
| **Engineering Lead / Tech Lead** | Visibility gaps, team capacity drain | Unified dashboards, trend analysis, productivity metrics | Weekly |
| **QA / Product Manager** | Can't measure test quality improvement or ROI | Quantified time-saved metrics, cost tracking | Weekly/monthly |

## 3. Core Capabilities

### 3.1 Pipeline & Test Orchestration

- Multi-CI integration: Jenkins, GitHub Actions, custom systems
- Real-time test run tracking: PENDING → RUNNING → PASSED / FAILED / FLAKY / SKIPPED
- Test result aggregation with pass rate, duration, error logs
- Pipeline scheduling (cron) and manual trigger support

### 3.2 AI-Powered Failure Analysis

| Feature | Version | Description |
|---------|---------|-------------|
| Failure Categorization | v2.5.3 | 6 categories (bug_critical, bug_minor, environment, flaky, configuration, unknown) with confidence scoring |
| Log Summarization | v2.5.4 | Root cause extraction, error location, suggested fixes |
| RCA Semantic Matching | v2.5.3 | Weaviate vector DB embeddings for similar-failure search |
| Context Enrichment | v2.8.0 | Parallel queries to Jira + Confluence + GitHub for richer analysis |
| Agentic Copilot | v2.9.0 | ReAct loop with 13 tools (7 read, 6 write) and human-in-the-loop gates |

**AI Providers**: Anthropic Claude Opus 4.6, OpenAI GPT-4.1, Google Gemini 3.0 Flash, Azure OpenAI, OpenRouter.

### 3.3 Failure Knowledge Base

- **Smart fingerprinting**: Removes timestamps, UUIDs, memory addresses for consistent signatures
- **Three-strategy matching**: Exact hash, fuzzy (≥80% Levenshtein), pattern-based
- **RCA documentation**: Root cause, solution, prevention steps, related tickets
- **Occurrence tracking**: First/last occurrence, recurrence count, resolution status

### 3.4 Integrations

| Category | Services |
|----------|----------|
| Issue Tracking | Jira (bi-directional sync, auto-create), Monday.com (GraphQL) |
| Test Management | TestRail (test case sync, milestone support) |
| Knowledge | Confluence (RCA publishing, knowledge search) |
| CI/CD | Jenkins, GitHub Actions, custom |
| Source Control | GitHub (PR awareness, commit diffs, branch creation) |
| Notifications | Slack, Email (SMTP), Pushover |
| Monitoring | Grafana (pre-built dashboards), Prometheus (`/metrics` endpoint) |

### 3.5 Enterprise Features (v2.8.5)

- **SSO**: SAML 2.0 (Okta, Azure AD, Keycloak) with JIT provisioning
- **RBAC**: Admin (40) > Editor/User (30) > Billing (20) > Viewer (10)
- **Audit logging**: Full context (who, when, what, where) with PII redaction
- **Scalability**: Redis Cluster, stateless backend, OpenTelemetry tracing

### 3.6 Notifications & Alerting

- Real-time Slack alerts with failure summaries and dashboard links
- Email digests (daily/weekly), Pushover push notifications
- Configurable rules: per pipeline, per category, per event type
- Admin broadcast capability, delivery metrics, retry with backoff

### 3.7 Observability & Dashboards

- Pipeline health overview with pass/fail/flaky rates
- Failure trend analysis and categorization breakdown
- AI cost tracking: per-provider, per-feature, budget alerts
- Flaky test detection and quarantine suggestions

### 3.8 Agentic AI Copilot (v2.9.0)

- Persistent 3-column Mission Control interface (sidebar | main | AI panel)
- ReAct loop: Reason → Act (tool call) → Observe → Answer
- **Read tools**: Search Jira, get issues, fetch commits/PRs, search Confluence, check pipeline status, dashboard metrics
- **Write tools**: Create Jira issues, transition tickets, add comments, open GitHub PRs, create branches, update files
- Human-in-the-loop confirmation gates for all write operations (5-minute expiry)
- Role-aware system prompts (Admin vs User)

## 4. Deployment Modes

| Mode | Database | AI | Use Case |
|------|----------|------|----------|
| **Demo** | SQLite (file/memory) | Mock provider | Evaluation, demos. Pre-seeded 1,600 failures. |
| **Development** | SQLite | Any provider | Local development with `npm run dev:simple` |
| **Production** | PostgreSQL + Redis + Weaviate | Full multi-provider | Enterprise deployment with Docker/K8s |

## 5. Non-Functional Requirements

| Aspect | Target |
|--------|--------|
| Dashboard load | < 2 seconds |
| API p95 latency | < 1 second |
| AI analysis time | < 10 seconds |
| Vector search | < 500ms |
| Concurrent users | 10,000+ (via Redis caching) |
| Uptime SLA | 99.5% |
| Browser support | Chrome/Edge 90+, Firefox 88+, Safari 14+ |
| Accessibility | WCAG 2.1 AA |
| Min viewport | 375px mobile, 1024x768 desktop |

## 6. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Time saved per failure | 95% reduction (2h → 5min) | Dashboard "time saved" widget |
| Knowledge capture rate | >70% failures with documented RCA | FailureArchive.rcaDocumented |
| Similar failure match rate | >40% after 2 months | Vector search hit rate |
| AI cache hit rate | >60% | Redis cache stats |
| MTTR for known failures | < 5 minutes | Resolution timestamp delta |

## 7. Data Model (Key Entities)

```
User ─1:N─→ Pipeline ─1:N─→ TestRun ─1:N─→ TestResult
  │                              │
  ├─1:N─→ Notification           └─linked─→ FailureArchive ─sig─→ FailurePattern
  │
  └─1:N─→ ChatSession ─1:N─→ ChatMessage
              └─1:N─→ PendingAction
```

See `specs/ARCHITECTURE.md` for full schema detail.

---

*Canonical source. Update this file when shipping features — not after.*
