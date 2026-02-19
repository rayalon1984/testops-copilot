# Changelog

## [2.9.0-rc.1] - 2026-02-19

> **Agentic AI Copilot** — Full agentic backend + 3-column Mission Control UI + consolidated AI config + production hardening.

---

### Agentic AI System

**ReAct Reasoning Loop** — AI copilot follows a Reason - Act - Observe - Answer cycle with streaming SSE for real-time feedback.

**13 AI Tools** — 7 read-only tools (auto-approved) and 6 write tools (requiring user confirmation):
- Read: Jira Search, Jira Get, GitHub Commit, GitHub PR, Confluence Search, Jenkins Status, Dashboard Metrics
- Write: GitHub Create PR, GitHub Create Branch, GitHub Update File, Jira Create Issue, Jira Transition, Jira Comment

**Human-in-the-Loop Confirmation** — Write operations generate activity cards with a 5-minute TTL. Users must explicitly approve before mutations execute.

**Role-Aware Prompts** — System prompts adapt to user role (Admin, Engineer, Viewer) for appropriate scope and permissions.

**Chat Session Persistence** — Full message history stored and retrievable across sessions.

**3-Column Mission Control** — Layout grid: navigation sidebar | main content | AI copilot panel.

---

### Test Intelligence

**Flaky Test Detection** — Statistical scoring identifies intermittently failing tests based on historical pass/fail patterns.

**Test Impact Analysis** — Maps code changes to potentially affected test suites for targeted re-runs.

**Smart Test Selection** — API endpoint recommends which tests to run based on impact analysis of changed files.

---

### Housekeeping

- Aligned all version numbers to `2.9.0-rc.1` across root, backend, frontend, MCP server, and spec headers
- Updated ROADMAP.md to reflect shipped vs. planned status accurately
- Wired cost tracker budget alerts to existing email notification service
- Implemented "Clear All" notification functionality in frontend

---

### Production Hardening

**Token Blacklist → Redis** — JWT revocation list migrated from in-memory Map to Redis with automatic TTL expiration. Falls back to in-memory when Redis is unavailable.

**SSRF Validation** — Shared `validateUrlForSSRF()` utility blocks requests to private/internal networks (localhost, RFC 1918, link-local, IPv6 ULA). Applied to Jenkins, Confluence, TestRail, and Monday.com service constructors. Jenkins' existing protection refactored to use the shared utility.

**Notification Persistence** — Replaced 18 hardcoded mock notifications with real Prisma database queries. GET, PATCH (mark read), and DELETE endpoints now operate on the Notification table.

**Performance Monitoring** — Added HTTP response time tracking middleware with circular buffer for p50/p95/p99 computation. AI cache hit/miss rates now exported to Prometheus. New metrics: `testops_http_request_duration_p95_seconds`, `testops_ai_cache_hits_total`, `testops_ai_cache_hit_rate`.

---

### AI Config Consolidation

- All AI environment variables (25+) now load through a single `AIConfigManager`
- Provider settings (maxTokens, temperature, timeout), API keys, and vector DB config centralized
- `createProviderFromConfig()` replaces direct env var reads in provider registry
- Cache and vector client singletons now read config from AIConfigManager
- `.env.example` updated with all AI env vars organized by section

---

## [2.8.5] - 2026-02-17

> **Enterprise Readiness** — This release transforms TestOps Companion from a team-level tool into a production-grade, enterprise-ready platform.

---

### 🔐 Security & Identity

**Single Sign-On (SAML 2.0)** — Authenticate through your existing identity provider.
Supports Okta, Azure AD, and Keycloak with Just-In-Time user provisioning.

**Role-Based Access Control** — Four granular roles (`Viewer`, `Editor`, `Admin`, `Billing`)
give you precise control over who can view, modify, and manage pipelines.

---

### 📜 Compliance & Audit Logging

Every critical action is now recorded with full context:

| Field | Detail |
|-------|--------|
| **Who** | User ID, Email |
| **Where** | IP Address, User Agent |
| **What** | Action type, redacted metadata |

Built to satisfy **SOC 2** and **ISO 27001** audit trail requirements.
Sensitive fields are automatically redacted (API keys, tokens, passwords).

---

### ⚡ Scalability & High Availability

**Redis Cluster Support** — Eliminates the single point of failure.
Full compatibility with AWS ElastiCache and Redis Sentinel.

**Stateless Backend** — The application server is now fully stateless,
ready for horizontal autoscaling on Kubernetes.

---

### 🔭 Observability

**OpenTelemetry** — Native distributed tracing and metrics.
Ship telemetry to Datadog, Jaeger, or Prometheus with a single environment variable.

**API Documentation** — Interactive Swagger UI at `/api/docs`,
auto-generated from route annotations.

---

### 🐳 DevOps

**Alpine Docker Images** — Multi-stage builds with `node:20-alpine` reduce
image size by ~80% and run as a non-root `node` user.

**CI/CD Pipeline** — Automated quality gates on every push:
Lint → Typecheck → Test (61/61) → Docker Build.

---

### Upgrading

```bash
# Docker
docker pull ghcr.io/rayalon1984/testops-companion/backend:2.8.5
docker pull ghcr.io/rayalon1984/testops-companion/frontend:2.8.5

# Environment
OTEL_ENABLED=true   # Enable OpenTelemetry tracing
```
