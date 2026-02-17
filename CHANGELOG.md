# Changelog

## [2.8.5] - 2026-02-17

### 🚀 Catalyst: Enterprise Readiness
**TestOps Companion is now Enterprise-Ready.**
This release transforms the platform from a team-level tool into a robust, scalable, and secure infrastructure capable of handling large-scale deployments. We focused on the "Big Corp" checklist: Security, Compliance, Scalability, and DevOps.

### ✨ Feature Spotlights

#### 🔐 Security & Identity (SSO + RBAC)
- **Single Sign-On (SAML)**: Seamless integration with Okta, Azure AD, and Keycloak. JIT provisioning ensures users can log in immediately.
- **Granular RBAC**: New roles (`Viewer`, `Editor`, `Admin`, `Billing`) provide precise access control over pipelines and configuration.

#### 📜 Compliance & Audit
- **Audit Logging**: Every critical action (Login, RCA Creation, Settings Change) is now logged with:
  - **Who**: User ID and Email
  - **Where**: IP Address and User Agent
  - **What**: Redacted metadata (sensitive keys masked)
- **Ready for Compliance**: Built to satisfy SOC2 and ISO27001 audit requirements.

#### ⚡ Scalability & High Availability
- **Redis Cluster Support**: No more Single Point of Failure. Full support for AWS ElastiCache and Redis Sentinel.
- **Stateless Architecture**: The backend is now fully stateless, ready for horizontal autoscaling on Kubernetes.

#### 🛠️ DevOps Excellence
- **Alpine Docker Images**: Switched to `node:20-alpine`, reducing image size by **80%** and improving security by running as non-root `node` user.
- **OpenTelemetry**: Native tracing and metrics integration for Datadog, Jaeger, and Prometheus.
- **API Documentation**: Interactive Swagger UI available at `/api/docs`.

### 📦 Upgrading
- **Docker**: Pull the latest `ghcr.io/rayalon1984/testops-companion` images.
- **Env**: Add `OTEL_ENABLED=true` to enable tracing.

### Changed
- **Docker Optimization**: Switched to multi-stage builds using `node:20-alpine`, reducing image size by ~80% and improving security (running as non-root `node` user).
- **CI/CD**: Enhanced GitHub Actions pipeline for automated quality checks (Lint, Typecheck, Test, Build).
