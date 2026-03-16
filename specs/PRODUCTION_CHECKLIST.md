# Production Deployment Checklist

> Lessons learned from the v3.5.1–v3.5.2 production debug audit.
> Run through this checklist before and after every production deployment.

## Automated Pre-Flight

Run the validation script **before** deploying:
```bash
./scripts/preflight-check.sh
```
This catches the most common issues automatically: missing env vars, placeholder values,
schema mismatches, Docker problems, and integration config errors.

## Pre-Deploy

| # | Check | How |
|---|-------|-----|
| 1 | Pre-flight passes | `./scripts/preflight-check.sh` — all checks green |
| 2 | All new API routes have matching backend endpoints | `grep -r "api.get\|api.post\|api.put\|api.delete" frontend/src/` and verify each has a corresponding route in `backend/src/routes/` |
| 3 | Prisma schemas in sync | `diff <(grep "model\|@@map\|String\|Int\|Json\|Boolean\|Float\|DateTime" backend/prisma/schema.dev.prisma) <(grep "model\|@@map" backend/prisma/schema.production.prisma)` — field names must match across both schemas |
| 4 | Migration SQL exists for schema changes | Check `backend/prisma/migrations/` has a new folder with `migration.sql` for every schema change |
| 5 | Docker Compose variables resolve | `docker compose -f docker-compose.prod.yml config` — must not show any `${VAR}` unresolved |
| 6 | Healthchecks use `127.0.0.1` (not `localhost`) | Alpine images resolve `localhost` to IPv6 `::1`; most services listen IPv4 only |
| 7 | DB healthcheck user matches `POSTGRES_USER` | `pg_isready -U <user>` must use the actual DB user, not hardcoded `postgres` |
| 8 | `REDIS_ENABLED=true` when Redis container is present | Without this, backend falls back to MemoryStore (leaks memory, loses sessions) |
| 9 | `openapi.yaml` copied in Dockerfile production stage | Without it, `/api/docs` serves a blank spec. Must `COPY --from=builder /app/openapi.yaml ./openapi.yaml` |
| 10 | GHCR compose mirrors prod compose fixes | `docker-compose.ghcr.yml` must have the same healthcheck, env, and Redis fixes as `docker-compose.prod.yml` |
| 11 | No env values with leading/trailing spaces | Copy-pasting long API tokens often introduces whitespace or line breaks |

## Post-Deploy

| # | Check | How |
|---|-------|-----|
| 1 | All containers healthy | `docker ps` — no `(unhealthy)` status |
| 2 | No error-level log spam | `docker logs <backend> --tail 50` — no repeating errors |
| 3 | DB logs clean | `docker logs <db> --tail 20` — no `FATAL` entries |
| 4 | Migrations applied | Backend startup logs show "All migrations have been successfully applied" |
| 5 | API smoke test | `GET /health/ready` returns 200; `GET /api/v1/dashboard` returns data |
| 6 | CSRF errors return 403 (not 500) | Confirm in logs: CSRF failures show `statusCode: 403` |
| 7 | Integrations initialized | `docker logs <backend> | grep -i "jira\|github\|initialized"` — enabled integrations show success |

## Known Gotchas

### `.env` vs `.env.production`
Docker Compose resolves `${VARIABLE}` interpolation from `.env` in the project root, NOT from `env_file` entries. If `.env.production` is the source of truth, symlink it:
```bash
ln -sf .env.production .env
```

### Dual Prisma Schema (SQLite dev / PostgreSQL prod)
- `schema.dev.prisma` (SQLite) uses `String?` for JSON fields
- `schema.production.prisma` (PostgreSQL) uses `Json?` for JSON fields
- `schema.prisma` (active, used for `prisma generate`) is a copy of the dev schema
- Code must handle both: use `JSON.stringify()` on write, `typeof === 'string' ? JSON.parse() : value` on read
- The Docker build copies `schema.production.prisma` over `schema.prisma` before `prisma generate`
- **Raw SQL queries must use `@@map` table names** (e.g. `"failure_archive"`) in PostgreSQL, not Prisma model names (e.g. `FailureArchive`). Also use PostgreSQL functions (`to_char`, `DATE()::text`) instead of SQLite functions (`strftime`). Branch on `DATABASE_URL.startsWith('postgres')`.

### Alpine IPv6 in Docker
Alpine-based images (nginx:alpine, node:20-alpine) may resolve `localhost` to `::1`. Always use `127.0.0.1` in healthcheck commands.

### Jira Integration (Atlassian Cloud)
The `jira-client` npm package uses `username` + `password` for Basic auth — NOT bearer tokens. For Atlassian Cloud:
- `JIRA_EMAIL` = your Atlassian account email (used as `username`)
- `JIRA_API_TOKEN` = API token from https://id.atlassian.net/manage-profile/security/api-tokens (used as `password`)
- All 4 vars required: `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, `JIRA_PROJECT_KEY`
- If `JIRA_EMAIL` is missing, the service falls back to bearer auth which **will not work** with Atlassian Cloud.

### Weaviate Auth
Weaviate crashes in a loop if `AUTHENTICATION_APIKEY_ENABLED=true` but `AUTHENTICATION_APIKEY_ALLOWED_KEYS` is empty. The compose defaults to anonymous access (`WEAVIATE_ANON_ACCESS=true`) which is safe for internal Docker network. To enable API key auth, set in `.env.production`:
```
WEAVIATE_API_KEY=your-key-here
WEAVIATE_APIKEY_ENABLED=true
WEAVIATE_ANON_ACCESS=false
WEAVIATE_ADMIN_LIST=true
WEAVIATE_ADMIN_USERS=admin
```

### Frontend/Backend Route Naming
The frontend and backend sometimes use different naming for the same concept. Example: the frontend uses "read/unread" while the backend originally used "delivered/undelivered" for notifications. Always verify that every `api.get()`/`api.post()` call in `frontend/src/hooks/api/` has a matching route in `backend/src/routes/`. The alias routes added in `notification.routes.ts` (`/unread`, `/:id/read`, `/mark-all-read`) bridge this gap.

### Frontend Version Display
The sidebar version chip reads from `__APP_VERSION__` which Vite injects from `package.json` at build time. Bumping `frontend/package.json` version and rebuilding is all that's needed — no hardcoded strings to update.

### API Response Shape Mismatches
When the frontend uses React Query with `initialData`, the initial render works but crashes after the first refetch if the backend response shape doesn't match. Always verify that backend responses include every field the frontend types expect (e.g. `CostMetrics` needed `monthlySpent`, `cacheSavings`, `averageCostPerAnalysis` — not just `totalCost`).

### Long API Tokens in .env Files
Copy-pasting long tokens (Jira, Anthropic) into `.env.production` via terminal often introduces line breaks or leading spaces. Always verify with `grep <VAR_NAME> .env.production` after pasting. The preflight script checks for whitespace automatically.
