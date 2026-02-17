# Changelog

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
