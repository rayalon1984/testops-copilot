# Changelog

## [2.9.0-rc.1] - 2026-02-19

> **Agentic AI Copilot (Backend Complete)** — The full agentic backend is in place: ReAct reasoning loop, 13 tools, confirmation gates, and test intelligence. UI polish (Phase B) pending.

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
