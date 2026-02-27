# Unified Remediation Plan — TestOps Copilot v3.0.0

> **Date**: 2026-02-23
> **Source**: Cross-referenced from two independent audits (internal + external)
> **Target Release**: 2026-03-01 (v3.0.0)
> **Branch**: `claude/production-audit-march-tgJNE`

---

## Audit Reconciliation

Before planning, we reconciled the two audits to separate real issues from stale findings.

| External Audit Claim | Verified Status | Notes |
|----------------------|-----------------|-------|
| Token blacklist = in-memory only | **INCORRECT** | Redis-primary with in-memory fallback (`tokenBlacklist.service.ts`). ARCHITECTURE.md text was stale (fixed in this audit). |
| Only 48 tests for 52K LOC | **OUTDATED** | Current: **623 test cases** across 51 files (35 backend + 13 frontend + 3 E2E). External audit likely ran against older branch. |
| No CSRF protection | **CONFIRMED** | No csurf, csrf-csrf, or double-submit cookie. Real gap. |
| No database migrations strategy | **CONFIRMED** | Only 1 baseline migration (492 lines). No rollback scripts. |
| SQLite ↔ PostgreSQL schema drift | **PARTIALLY MITIGATED** | Dual schemas exist but CI enforces field-level parity via `validate-schema.js --strict-fields`. |
| No 2FA/MFA | **CONFIRMED** | Planned for v3.1 per SECURITY.md. |
| No IP whitelisting/geo-blocking | **CONFIRMED** | Not implemented. |
| No secret rotation | **CONFIRMED** | No mechanism for JWT secret or API key rotation. |
| 20 console.log in production | **PARTIALLY RESOLVED** | 26 fixed in this audit (AI manager + vector client). ~47 remain in other files. |
| No request ID/correlation ID | **CONFIRMED** | No UUID middleware. Only request timing exists. |
| No DB connection pooling config | **CONFIRMED** | Prisma defaults only (typically 10 connections). |
| Redis session store missing | **CONFIRMED** | `express-session` uses in-memory store. RedisStore is installed (`connect-redis` v9) but commented out. |
| No deep health checks | **CONFIRMED** | `/health` returns `{status: 'ok', timestamp}` only. No DB/Redis/service checks. |
| Docker images not pinned | **PARTIALLY VALID** | Postgres/Redis pinned to minor. Weaviate uses `:latest`. |

---

## Phase 1: Security Blockers (MUST fix before March 1)

These are release-blocking issues. No tag should be cut until all are resolved.

### 1.1 — Fix `$queryRawUnsafe` SQL Pattern

**Issue**: H1 from internal audit
**File**: `services/prediction-analysis.service.ts:54-66`
**Risk**: Medium-high. The `...values` spread provides parameterization for user input, but `dateFn` and `where` clause are built via string interpolation. If the `groupBy` or condition-building logic ever expands to accept user strings, this becomes SQL injection.

**Fix Strategy**:
```
Option A (Preferred): Refactor to Prisma.$queryRaw with tagged template
  - Replace $queryRawUnsafe with $queryRaw using Prisma.sql tagged template
  - For the dateFn conditional, use two separate static queries (day vs week)
  - Eliminates string interpolation entirely

Option B: Keep raw SQL but whitelist all interpolated values
  - Validate groupBy is strictly 'day' | 'week' (already typed but not runtime-checked)
  - Assert conditions array only contains hardcoded column comparisons
  - Add runtime assertion before query execution
```

**Implementation**:
```typescript
// Replace the single dynamic query with two static templates:
if (params.groupBy === 'week') {
  rows = await prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
    SELECT strftime('%Y-W%W', lastOccurrence) as date, COUNT(*) as count
    FROM FailureArchive
    WHERE lastOccurrence >= ${since.toISOString()}
    ${testName ? Prisma.sql`AND testName = ${testName}` : Prisma.empty}
    ${category ? Prisma.sql`AND category = ${category}` : Prisma.empty}
    GROUP BY date ORDER BY date ASC`;
} else {
  rows = await prisma.$queryRaw<...>`
    SELECT DATE(lastOccurrence) as date, COUNT(*) as count
    FROM FailureArchive
    WHERE lastOccurrence >= ${since.toISOString()}
    ${testName ? Prisma.sql`AND testName = ${testName}` : Prisma.empty}
    ${category ? Prisma.sql`AND category = ${category}` : Prisma.empty}
    GROUP BY date ORDER BY date ASC`;
}
```

**Effort**: ~1 hour
**Test**: Existing prediction analysis tests + manual verification of both day/week grouping

---

### 1.2 — Remove `.env.dev` from Git

**Issue**: H2 from internal audit
**File**: `backend/.env.dev` (tracked in git)
**Risk**: Medium. Contains only placeholder/dev values, but sets a bad precedent and triggers secret-scanning tools.

**Fix Strategy**:
```
Step 1: Add to .gitignore
  echo "backend/.env.dev" >> .gitignore
  echo ".env.dev" >> backend/.gitignore  (if separate gitignore)

Step 2: Remove from tracking (keep local file)
  git rm --cached backend/.env.dev

Step 3: Clean from history (optional, recommended)
  git filter-repo --invert-paths --path backend/.env.dev
  (or use BFG Repo-Cleaner if filter-repo unavailable)

Step 4: Add .env.dev.example with placeholder values
  cp backend/.env.dev backend/.env.dev.example
  (scrub any real values, replace with placeholders)
```

**Effort**: ~30 minutes
**Risk**: History rewrite requires force-push; coordinate with team.

---

### 1.3 — Add CSRF Protection

**Issue**: Confirmed by both audits
**File**: `app.ts` (middleware stack)
**Risk**: High. Refresh token in httpOnly cookie is vulnerable to CSRF attacks without protection.

**Fix Strategy**:
```
Option A (Recommended): Double-submit cookie pattern with csrf-csrf
  npm install csrf-csrf
  - Generate CSRF token, set in cookie + response header
  - Validate on all state-changing requests (POST/PUT/DELETE)
  - Exclude webhook endpoints (Slack, Monday.com) that use their own signature verification

Option B: SameSite=strict on all cookies + custom header check
  - Already have sameSite=strict on auth cookies
  - Add X-Requested-With custom header requirement on state-changing requests
  - Lighter implementation but less standard
```

**Implementation sketch (Option A)**:
```typescript
import { doubleCsrf } from 'csrf-csrf';

const { doubleCsrfProtection, generateToken } = doubleCsrf({
  getSecret: () => config.security.csrfSecret,
  cookieName: '__csrf',
  cookieOptions: { httpOnly: true, sameSite: 'strict', secure: config.security.secureCookie },
  getTokenFromRequest: (req) => req.headers['x-csrf-token'] as string,
});

// Apply to all routes except webhooks
app.use('/api/v1', (req, res, next) => {
  if (req.path.startsWith('/webhooks/')) return next();
  doubleCsrfProtection(req, res, next);
});

// Token endpoint for frontend
app.get('/api/v1/csrf-token', (req, res) => {
  res.json({ token: generateToken(req, res) });
});
```

**Frontend changes**: Add `X-CSRF-Token` header to all API calls from the Axios/fetch interceptor.

**Effort**: ~3-4 hours (backend + frontend + testing)
**Test**: Add integration tests for CSRF validation on POST/PUT/DELETE routes

---

### 1.4 — Enable Redis Session Store

**Issue**: Confirmed by both audits
**File**: `app.ts:87-97`
**Risk**: Medium. In-memory session store leaks memory and doesn't scale across instances.

**Fix Strategy**:
```
Step 1: Uncomment RedisStore configuration
Step 2: Remove 'default_secret' fallback — require SESSION_SECRET env var
Step 3: Add sameSite: 'strict' to session cookie
Step 4: Add graceful fallback logging if Redis unavailable at startup
```

**Implementation**:
```typescript
import { RedisStore } from 'connect-redis';
import { redis } from './lib/redis';

app.use(session({
  store: new RedisStore({ client: redis }),
  secret: config.security.sessionSecret, // Remove || 'default_secret'
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: config.security.secureCookie,
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000
  }
}));
```

**Config change**: Make `SESSION_SECRET` required in Zod env schema (remove `.default()`).

**Effort**: ~1 hour
**Test**: Verify sessions persist across server restart, test logout flow

---

## Phase 2: Critical Hardening (Should fix before March 1)

These are strongly recommended. Not blocking but significantly improve production quality.

### 2.1 — Replace Remaining `console.log` Statements (H3)

**Issue**: ~47 remaining `console.log/error/warn` across backend files
**Files**: `routes/ai/analysis.ts`, `controllers/failure-archive.controller.ts`, and others
**Risk**: Unstructured logs in production lose context (no timestamps, no levels, no correlation).

**Fix Strategy**:
```
Step 1: Run a comprehensive grep for console.log/warn/error in src/ (excluding __tests__)
Step 2: Replace each with appropriate logger.info/warn/error call
Step 3: Add contextual prefix (e.g., [FailureArchive], [MondayController])
Step 4: Preserve tracing.ts console.log (acceptable — runs before logger init)
```

**Effort**: ~2-3 hours
**Test**: Lint pass (ESLint can enforce no-console rule if enabled)

---

### 2.2 — Add Zod Validation on Monday.com Routes (H4)

**Issue**: POST/PUT endpoints on Monday routes lack input validation
**File**: `routes/monday.routes.ts`
**Risk**: Medium. Unvalidated input from external integration.

**Fix Strategy**:
```
Add Zod schemas + validate middleware for:
  - POST /items — validate boardId, groupId, itemName, columnValues
  - PUT /items/:itemId — validate columnValues
  - POST /items/:itemId/updates — validate body text
  - POST /test-failures — validate testName, errorMessage, severity
```

**Implementation pattern** (follows existing codebase convention):
```typescript
import { z } from 'zod';
import { validate } from '../middleware/validation';

const createItemSchema = z.object({
  boardId: z.string().min(1),
  groupId: z.string().optional(),
  itemName: z.string().min(1).max(500),
  columnValues: z.record(z.unknown()).optional(),
});

router.post('/items', validate(createItemSchema), MondayController.createItem);
```

**Effort**: ~2 hours
**Test**: Add validation error tests for each endpoint

---

### 2.3 — Safe `parseInt` with Bounds Validation (H5)

**Issue**: Unsafe parseInt on query params without NaN/bounds checking
**File**: `controllers/failure-archive.controller.ts:169-302`
**Risk**: Low-medium. Extreme values could cause memory issues in DB queries.

**Fix Strategy**:
```
Create a utility function and apply across all controllers:

function safeParseInt(value: string | undefined, defaultVal: number, min: number, max: number): number {
  if (!value) return defaultVal;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) return defaultVal;
  return Math.max(min, Math.min(max, parsed));
}

Apply to all limit/offset/page params:
  - limit: safeParseInt(req.query.limit, 50, 1, 500)
  - offset: safeParseInt(req.query.offset, 0, 0, 100000)
```

**Effort**: ~1 hour
**Test**: Existing Zod validation tests + add edge cases

---

### 2.4 — Add Request ID / Correlation ID Middleware

**Issue**: Confirmed by external audit. No distributed tracing at request level.
**Risk**: Medium. Critical for production debugging and log correlation.

**Fix Strategy**:
```
Step 1: Install uuid or use crypto.randomUUID() (Node 18+ built-in)
Step 2: Add middleware that:
  - Reads X-Request-ID header (from load balancer/proxy) or generates UUID
  - Attaches to req object
  - Sets X-Request-ID on response
  - Injects into winston logger (child logger per request or MDC pattern)
Step 3: Propagate to external service calls (Jira, Jenkins, GitHub)
```

**Implementation**:
```typescript
// middleware/requestId.ts
import { randomUUID } from 'crypto';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = (req.headers['x-request-id'] as string) || randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
}
```

**Logger integration**: Use `logger.child({ requestId })` for per-request logger.

**Effort**: ~2 hours
**Test**: Verify header propagation in responses, check log output includes request ID

---

### 2.5 — Deep Health Check Endpoint

**Issue**: Confirmed by both audits. `/health` returns static `{status: ok}`.
**Risk**: Medium. Kubernetes/Docker health probes can't detect degraded state.

**Fix Strategy**:
```
Replace shallow health check with deep check that verifies:
  - Database: prisma.$queryRaw`SELECT 1` (with timeout)
  - Redis: redis.ping() (with timeout)
  - Weaviate: vectorClient.healthCheck() (if configured)
  - Disk space (optional)

Keep the shallow endpoint for liveness probes:
  GET /health         → shallow (fast, for liveness)
  GET /health/ready   → deep (for readiness probe)
```

**Implementation**:
```typescript
app.get('/health/ready', async (_req, res) => {
  const checks: Record<string, boolean> = {};
  let healthy = true;

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;
  } catch { checks.database = false; healthy = false; }

  try {
    await redis.ping();
    checks.redis = true;
  } catch { checks.redis = false; healthy = false; }

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    checks,
  });
});
```

**Docker compose update**: Point `healthcheck:` to `/health/ready` for backend container.

**Effort**: ~2 hours
**Test**: Test with DB down, Redis down scenarios

---

## Phase 3: Production Infrastructure (Fix within 2 weeks post-release)

### 3.1 — Database Connection Pool Configuration

**Issue**: Prisma uses default pool size (typically 10 connections).
**File**: Prisma schema datasource + `DATABASE_URL`
**Risk**: Connection exhaustion under load.

**Fix Strategy**:
```
Option A: URL parameter
  DATABASE_URL=postgresql://user:pass@host:5432/testops?connection_limit=25&pool_timeout=10

Option B: Prisma config
  Add to .env: DATABASE_POOL_SIZE=25
  Append to DATABASE_URL at runtime in config.ts

Sizing guideline: num_connections = (2 * num_cores) + num_spindles
  For typical 4-core prod: 25-30 connections.
```

**Effort**: ~30 minutes
**Test**: Load test with concurrent requests to verify pool behavior

---

### 3.2 — Incremental Migration Strategy

**Issue**: Only 1 baseline migration. No rollback capability.
**Risk**: Future schema changes are risky without rollback scripts.

**Fix Strategy**:
```
Step 1: Document migration workflow in CONTRIBUTING.md:
  npx prisma migrate dev --name <description>

Step 2: For each future migration, create a matching down migration:
  migrations/XXXX_add_feature/migration.sql     (up)
  migrations/XXXX_add_feature/rollback.sql       (down — manual)

Step 3: Add CI step that validates:
  - prisma migrate deploy works on clean DB
  - Rollback script executes without error

Step 4: Add to deploy.sh:
  - Auto-backup before migration
  - Rollback on migration failure
```

**Effort**: ~4 hours (docs + CI + deploy script)

---

### 3.3 — Backup/Restore Automation

**Issue**: `backup-db.sh` and `restore-db.sh` are referenced in docs but don't exist.
**Risk**: No verified disaster recovery.

**Fix Strategy**:
```
Step 1: Create actual backup-db.sh and restore-db.sh scripts
Step 2: Add cron configuration in docker-compose.prod.yml or systemd timer
Step 3: Add S3 upload for off-site backup (aws s3 cp)
Step 4: Add CI job that tests restore from backup monthly
Step 5: Document RTO/RPO targets
```

**Effort**: ~6 hours

---

### 3.4 — Pin Docker Images

**Issue**: Weaviate uses `:latest` tag in all compose files.
**Files**: `docker-compose.yml:75`, `docker-compose.prod.yml:75`, `docker-compose.ghcr.yml:77`

**Fix Strategy**:
```
Replace semitechnologies/weaviate:latest with specific version:
  semitechnologies/weaviate:1.24.10  (or whatever is currently deployed)

Also consider digest pinning for critical services:
  postgres:15-alpine@sha256:<digest>
```

**Effort**: ~15 minutes
**Test**: `docker compose pull && docker compose up` to verify

---

### 3.5 — CORS Multi-Origin Support

**Issue**: Single CORS origin in config.
**Risk**: Low. Only matters for multi-tenant or multi-frontend deployments.

**Fix Strategy**:
```
Update config to accept comma-separated origins:
  CORS_ORIGIN=https://app.example.com,https://admin.example.com

Parse in config.ts:
  corsOrigin: z.string().transform(v => v.split(',').map(s => s.trim()))
```

**Effort**: ~30 minutes

---

### 3.6 — Frontend CDN / Static Asset Strategy

**Issue**: Nginx serves frontend directly. No CDN.
**Risk**: Low for MVP. Becomes important at scale.

**Fix Strategy**:
```
Short-term: Current Nginx setup with gzip + 1-year cache on /assets/ is adequate
Long-term:
  - Add CloudFront or Cloudflare in front of Nginx
  - Configure Vite to use content-hash filenames (already default)
  - Set Cache-Control: public, max-age=31536000, immutable on hashed assets
```

**Effort**: ~4 hours (infrastructure)

---

## Phase 4: Roadmap Items (Post v3.0.0 GA)

These are important but appropriately scoped for future releases.

| # | Item | Target | Effort |
|---|------|--------|--------|
| 4.1 | 2FA/MFA (TOTP + backup codes) | v3.1 | 2-3 days |
| 4.2 | IP allowlisting / geo-blocking middleware | v3.1 | 1 day |
| 4.3 | Secret rotation mechanism (JWT secrets, API keys) | v3.1 | 2 days |
| 4.4 | Database query retry logic (Prisma middleware) | v3.1 | 4 hours |
| 4.5 | WebSocket for real-time updates | v3.2 | 3-5 days |
| 4.6 | Load/stress test suite (k6) | v3.1 | 2 days |
| 4.7 | API contract tests (OpenAPI validation) | v3.1 | 1 day |
| 4.8 | Security test suite (OWASP ZAP integration) | v3.1 | 2 days |
| 4.9 | Resolve 4 `: any` types in production code | v3.0.1 | 2 hours |
| 4.10 | Address 4 TODO comments in production code | v3.0.1 | 1 hour |
| 4.11 | Make `VITE_API_URL` configurable in docker-compose.prod.yml | v3.0.1 | 30 min |

---

## Implementation Schedule

```
Week of Feb 24-28 (Pre-Release):
  Day 1:  1.1 ($queryRawUnsafe)  +  1.2 (.env.dev)          — 2 hours
  Day 2:  1.3 (CSRF protection)                               — 4 hours
  Day 3:  1.4 (Redis sessions)   +  2.3 (safe parseInt)      — 2 hours
  Day 4:  2.1 (console.log)      +  2.2 (Monday Zod)         — 5 hours
  Day 5:  2.4 (request IDs)      +  2.5 (deep health check)  — 4 hours
          CHANGELOG update + final gate run + tag v3.0.0

Week of Mar 3-7 (Post-Release Hardening):
  3.1 (connection pooling)  — 30 min
  3.4 (pin Docker images)   — 15 min
  3.5 (CORS multi-origin)   — 30 min

Week of Mar 10-14:
  3.2 (migration strategy)  — 4 hours
  3.3 (backup automation)   — 6 hours
  3.6 (CDN planning)        — 4 hours
```

---

## Updated Scoring (Post-Remediation Projections)

| Area | Current | After Phase 1-2 | After All Phases |
|------|---------|-----------------|------------------|
| Security | 7/10 | **9/10** | 9.5/10 |
| Testing | 8/10* | 8/10 | 9/10 |
| Scalability | 5/10 | **7/10** | 8/10 |
| Observability | 7/10 | **9/10** | 9.5/10 |
| CI/CD | 6/10 | 6/10 | **8/10** |
| Architecture | 8/10 | 8/10 | 8/10 |
| Documentation | 9/10 | 9/10 | 9/10 |

\* Testing score corrected from external audit's 3/10 — actual count is 623 tests across 51 files, not 48.

---

## Decision

With Phase 1 (4 items) and Phase 2 (5 items) completed, the codebase would be **UNCONDITIONAL GO** for production. Total estimated effort: **~17 hours of engineering time** spread across the final week before release.

**Signed off by**: RELEASE_QA_ENGINEER
**Date**: 2026-02-23
