# Changelog

## [2.8.5] - 2026-02-17

### Catalyst: Enterprise Readiness
This release marks a significant milestone in making TestOps Companion ready for large-scale enterprise deployments. We have improved security, compliance, scalability, and observability.

### Added
- **SSO/SAML Integration**: Support for enterprise identity providers (Okta, Azure AD).
- **Audit Logging**: Comprehensive, compliance-ready logging for all critical actions (Auth, Failure Archive) with PII redaction and capture of IP/User-Agent.
- **Advanced RBAC**: Granular role-based access control (Viewer, Editor, Admin, Billing).
- **Redis Cluster Support**: High availability session management and caching.
- **OpenTelemetry**: Standardized distributed tracing and metrics.
- **API Documentation**: Automated Swagger/OpenAPI documentation at `/api/docs`.

### Changed
- **Docker Optimization**: Switched to multi-stage builds using `node:20-alpine`, reducing image size by ~80% and improving security (running as non-root `node` user).
- **CI/CD**: Enhanced GitHub Actions pipeline for automated quality checks (Lint, Typecheck, Test, Build).
