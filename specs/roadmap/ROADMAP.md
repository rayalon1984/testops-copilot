# ROADMAP.md — Canonical Roadmap

> **Owner**: AI Product Manager · **Status**: Living document · **Last verified**: 2026-02-19
> **Current Version**: 2.9.0-rc.1 (February 2026)

---

## Shipped

### v2.8.0–2.8.5 — Context Enrichment & Enterprise (February 2026)
- [x] Jira similar issue search (JQL text search)
- [x] Confluence knowledge reader (CQL search for runbooks and RCA docs)
- [x] GitHub code awareness (commit diffs, PR file changes)
- [x] AI-powered context enrichment service orchestrating all three sources
- [x] `POST /api/v1/ai/enrich` endpoint
- [x] SSO: SAML 2.0 (Okta, Azure AD) with JIT provisioning
- [x] RBAC: Admin > Editor/User > Billing > Viewer hierarchy
- [x] Audit logging with PII redaction
- [x] Redis Cluster support, stateless backend

### v2.7.0–2.7.1 — Production Readiness & Security (February 2026)
- [x] Security hardening (privilege escalation fix, SSRF protection, auth on all routes)
- [x] Token blacklist service for proper logout/revocation
- [x] 87 tests (50 backend + 37 frontend)
- [x] CI/CD hardening (tests, lint, typecheck block merges)
- [x] PrismaClient singleton pattern

### v2.6.0 — MCP Server (January 2026)
- [x] Model Context Protocol server with 8+ tools
- [x] 98% token reduction and 90% cost savings
- [x] PostgreSQL integration with connection pooling

### v2.5.3–2.5.4 — AI Integration (November 2025)
- [x] Multi-provider AI: Anthropic Claude, OpenAI GPT-4, Google Gemini, Azure OpenAI
- [x] RCA matching with semantic search (Weaviate vector DB)
- [x] Automated failure categorization (6 categories with confidence scoring)
- [x] Intelligent log summarization (root cause + suggested fix)
- [x] Cost tracking and budget alerts ($100/month default)
- [x] 3-tier Redis caching (response, embedding, summary)

### v2.5.0–2.5.2 — Integrations & Knowledge Base (November 2025)
- [x] Failure Knowledge Base with smart fingerprinting (3-strategy matching)
- [x] Grafana & Prometheus metrics (20+ metrics, pre-built dashboards)
- [x] Monday.com Work OS integration (GraphQL API)
- [x] Confluence documentation publishing
- [x] TestRail test case management sync
- [x] Jira issue creation and bi-directional sync

### v1.0.0 — Core Platform (December 2024)
- [x] JWT authentication with refresh tokens
- [x] Pipeline management (Jenkins, GitHub Actions, custom)
- [x] Test execution tracking with result aggregation
- [x] Real-time notifications (Slack, Email, Pushover)
- [x] Interactive dashboard with analytics

---

## Next Up

### v2.9.0 — Agentic AI Copilot (Q2 2026)

**Agentic System** (shipped):
- [x] ReAct loop with streaming SSE (Reason → Act → Observe → Answer)
- [x] 13 tools: 7 read-only (auto-approved) + 6 write (confirmation required)
- [x] Human-in-the-loop confirmation gates for write operations (5-min TTL)
- [x] Role-aware system prompts (Admin/Engineer/Viewer)
- [x] 3-column Mission Control layout (sidebar | main | AI panel)
- [x] Chat session persistence with full message history

**Test Intelligence** (3/4 shipped):
- [x] Flaky test detection with statistical scoring
- [x] Test impact analysis (code changes → affected tests)
- [x] Smart test selection (run only affected tests)
- [ ] Predictive failure analysis

**Collaboration**:
- [ ] Team workspaces with shared dashboards
- [ ] Comments and discussions on failures
- [ ] Real-time collaborative RCA documentation

**Notifications v2**:
- [ ] Microsoft Teams integration
- [ ] Discord integration
- [ ] Custom notification templates with rich formatting
- [ ] Notification rules engine

---

## Medium Term

### v3.0.0 — Enterprise & Scale (Q3/Q4 2026)

**Enterprise**:
- [ ] LDAP integration
- [ ] Two-factor authentication (TOTP / WebAuthn)
- [ ] Fine-grained permissions (resource-level ACL)
- [ ] IP whitelisting
- [ ] Secret rotation mechanism

**CI/CD Expansion**:
- [ ] GitLab CI integration
- [ ] CircleCI integration
- [ ] Azure DevOps integration
- [ ] Bitbucket Pipelines

**Quality Gates**:
- [ ] Custom quality gate definitions
- [ ] Policy enforcement engine
- [ ] Coverage requirements and thresholds
- [ ] Performance regression gates

**Infrastructure**:
- [ ] Token blacklist migration to Redis
- [ ] WebSocket support for real-time updates
- [ ] Notification persistence (replace mock data)
- [ ] Multi-origin CORS support

---

## Future Considerations

### Scalability & Performance
- [ ] Microservices decomposition
- [ ] Kubernetes-native deployment
- [ ] Multi-region support
- [ ] Database sharding / read replicas
- [ ] CDN for static assets

### Extensibility
- [ ] Plugin architecture
- [ ] Custom integration framework
- [ ] API extensions
- [ ] Integration marketplace

### Mobile
- [ ] Progressive Web App (PWA)
- [ ] Mobile-optimized responsive views
- [ ] Push notification support

---

## Technical Debt Tracker

| Item | Severity | Location | Notes |
|------|----------|----------|-------|
| Token blacklist in-memory | Medium | `tokenBlacklist.service.ts` | Migrate to Redis |
| Notification mock data | Medium | `notification.routes.ts` | Implement DB persistence |
| No WebSocket support | Low | Backend | Add Socket.IO for real-time |
| Single CORS origin | Low | `app.ts` | Multi-origin config |
| No SSRF URL validation | Medium | External service URLs | Add private-IP blocklist |

---

*This roadmap is updated when features ship or priorities change. Items may shift based on user feedback and technical constraints.*
