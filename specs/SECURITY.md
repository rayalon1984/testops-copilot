# SECURITY.md — Security Architecture

> **Owner**: Security Engineer · **Status**: Living document · **Last verified**: 2026-02-19

---

## 1. Authentication

### 1.1 JWT Access + Refresh Token Pattern

| Token | Algorithm | Expiry | Storage | Secret |
|-------|-----------|--------|---------|--------|
| Access | HS256 | 24h (`JWT_EXPIRES_IN`) | `Authorization: Bearer` header | `JWT_SECRET` (min 32 chars) |
| Refresh | HS256 | 7d (`JWT_REFRESH_EXPIRES_IN`) | HTTP-only cookie | `JWT_REFRESH_SECRET` (min 32 chars) |

**JWT Claims**: Issuer = `testops-companion`, Audience = `testops-companion-client`

### 1.2 Token Lifecycle

```
Register/Login
  → bcrypt.compare(password, hash)       # saltRounds=12
  → sign access token (24h)
  → sign refresh token (7d)
  → set refresh cookie (httpOnly, secure, sameSite=strict)

Request
  → extract Bearer from Authorization header
  → check token blacklist
  → jwt.verify(token, secret, { issuer, audience })
  → load user from DB (verify account exists)
  → attach user to request

Logout
  → blacklist access token (24h TTL)
  → blacklist refresh token (7d TTL)
  → clear refresh cookie

Refresh
  → verify refresh token from cookie
  → blacklist old refresh token
  → issue new access + refresh token pair
```

### 1.3 Token Blacklist

- **Storage**: In-memory `Map<string, number>` with TTL expiry
- **Cleanup**: Every 15 minutes, purge expired entries
- **Checked on**: Every authenticated request (before JWT verification)
- **Limitation**: Single-instance only — not shared across horizontal replicas
- **Production path**: Migrate to Redis SET with TTL

### 1.4 Password Requirements

- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 digit
- At least 1 special character (`@$!%*?&`)
- Hashed with bcrypt, configurable salt rounds (`BCRYPT_SALT_ROUNDS`, default: 12)

### 1.5 SSO (Optional)

- **SAML 2.0**: Okta, Azure AD, Keycloak — gated by `SSO_ENABLED=true`
- **OIDC**: Client credentials flow — gated by `SSO_ENABLED=true`
- JIT user provisioning on first SSO login
- Callback redirects to `{CORS_ORIGIN}/auth/callback?token={accessToken}`

---

## 2. Authorization

### 2.1 Role-Based Access Control (RBAC)

```
ADMIN  (40)  — Full system access, user management, global settings
EDITOR (30)  — Create/update pipelines, document RCA, manage failures
USER   (30)  — Treated as EDITOR for backward compatibility
BILLING (20) — Cost dashboards, budget management
VIEWER (10)  — Read-only access to all data
```

**Hierarchy**: Higher numeric level inherits all permissions of lower levels.

### 2.2 Route Protection Matrix

| Route Group | Min Role | Notes |
|-------------|----------|-------|
| `POST /auth/login`, `POST /auth/register` | None | Public, stricter rate limit |
| `GET /health` | None | Public health check |
| `GET /api/v1/*` (reads) | VIEWER | All authenticated reads |
| `POST/PUT/DELETE /api/v1/pipelines/*` | EDITOR | Pipeline mutations |
| `PUT /api/v1/failure-archive/:id/*` | EDITOR | RCA documentation |
| `GET /api/v1/notifications/metrics` | ADMIN | Delivery metrics |
| `POST /api/v1/notifications/broadcast` | ADMIN | Broadcast to all users |
| `GET/PUT /api/v1/notifications/settings` | ADMIN | Global notification config |

---

## 3. Transport Security

### 3.1 Helmet (Security Headers)

All default Helmet protections enabled:
- `Strict-Transport-Security` (HSTS)
- `Content-Security-Policy`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection`
- `Referrer-Policy`

### 3.2 CORS

- **Allowed origin**: `CORS_ORIGIN` env var (default: `http://localhost:5173`)
- **Credentials**: Enabled (for cookie-based refresh tokens)
- **Limitation**: Single origin; no multi-origin support yet

### 3.3 Cookie Security

- `httpOnly: true` — Not accessible via JavaScript
- `secure: true` — HTTPS only (production; controlled by `SECURE_COOKIE`)
- `sameSite: strict` — CSRF protection
- `maxAge: 7d` — Matches refresh token expiry

---

## 4. Rate Limiting

| Scope | Window | Max Requests | Applied To |
|-------|--------|-------------|------------|
| Global | 15 min | 100 | All endpoints |
| Auth | 15 min | 10 | `/auth/login`, `/auth/register` |

Configurable via `RATE_LIMIT_WINDOW_MS` and `RATE_LIMIT_MAX_REQUESTS`.

Response on limit: `429 Too Many Requests` with standard headers.

---

## 5. Input Validation

- **Framework**: Zod schemas on all request bodies
- **Body size limit**: 1MB (JSON + URL-encoded)
- **URL validation**: `z.string().url()` on pipeline config URLs
- **Email validation**: `z.string().email()` on auth/notification endpoints
- **Password validation**: Regex pattern enforcing complexity requirements

---

## 6. Error Handling & Information Disclosure

### 6.1 Sensitive Field Redaction

Fields redacted from all error logs:
`password`, `currentPassword`, `newPassword`, `apiToken`, `token`, `secret`, `refreshToken`

### 6.2 Environment-Specific Responses

| Environment | Response Includes |
|-------------|------------------|
| Development | Error message + full stack trace + request details |
| Production | Error message only — no stack trace, no internal details |

### 6.3 Audit Logging

Every error logged with: URL, HTTP method, status code, message, timestamp.

---

## 7. AI Security

### 7.1 Human-in-the-Loop Gates

All AI write tools require explicit user approval:

```
LLM proposes write tool → PendingAction created (DB) → SSE notification → User approves/denies → Execute or reject
```

- **TTL**: 5 minutes — expired actions cannot be approved
- **Audit trail**: All pending actions logged with `resolvedBy`, `resolvedAt`
- **Max tool calls**: 5 per request
- **Max iterations**: 8 per ReAct loop

### 7.2 Cost Protection

- Monthly budget cap: `AI_MONTHLY_BUDGET_USD` (default: $100)
- Alert at 80% threshold: `AI_ALERT_THRESHOLD_PERCENT`
- All AI calls logged to `ai_usage` table (provider, model, tokens, cost, feature)

### 7.3 Prompt Safety

- System prompts are role-specific (Admin/Engineer/Viewer)
- User messages are passed as-is (no injection filtering beyond role context)
- Tool outputs are treated as untrusted data in the ReAct loop

---

## 8. External Service Credentials

| Service | Env Var | Storage |
|---------|---------|---------|
| AI Provider | `AI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, etc. | Environment |
| GitHub | `GITHUB_TOKEN`, `GITHUB_WEBHOOK_SECRET` | Environment |
| Jira | `JIRA_API_TOKEN` | Environment |
| Confluence | `CONFLUENCE_API_TOKEN` | Environment |
| Slack | `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET` | Environment |
| TestRail | `TESTRAIL_API_KEY` | Environment |
| Email | `EMAIL_PASSWORD` | Environment |
| Pushover | `PUSHOVER_USER_KEY`, `PUSHOVER_APP_TOKEN` | Environment |

**No credentials stored in database.** All secrets loaded from environment at startup.

---

## 9. Known Gaps & Hardening Roadmap

| Gap | Severity | Status | Mitigation |
|-----|----------|--------|------------|
| Token blacklist in-memory | Medium | Known | Migrate to Redis TTL set |
| No SSRF validation on external URLs | Medium | Known | Add private-IP blocklist + protocol/port validation |
| Single CORS origin | Low | Known | Multi-origin config |
| No 2FA | Medium | Planned v3.0 | TOTP / WebAuthn |
| No secret rotation mechanism | Low | Planned | Add rotation API + expiry tracking |
| No pre-commit secrets scanning | Low | Recommended | Add git-secrets or gitleaks hook |
| `SECURE_COOKIE` defaults to false | Low | By design | Must set `true` in production env |

---

## 10. Security Checklist for Contributors

Before merging any PR that touches auth, data, or AI:

- [ ] No credentials in code or committed files
- [ ] New endpoints have `authenticate` + `authorize` middleware
- [ ] Sensitive fields added to redaction list in error handler
- [ ] Input validated via Zod schema
- [ ] Write AI tools go through ConfirmationService
- [ ] No stack traces leak in production error responses
- [ ] Rate limiting appropriate for endpoint sensitivity

---

*Canonical source. Update when security posture changes — not after.*
