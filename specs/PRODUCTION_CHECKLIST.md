# Production Deployment Checklist

> Lessons learned from the v3.5.1 production debug audit.
> Run through this checklist before and after every production deployment.

## Pre-Deploy

| # | Check | How |
|---|-------|-----|
| 1 | All new API routes have matching backend endpoints | `grep -r "api.get\|api.post\|api.put\|api.delete" frontend/src/` and verify each has a corresponding route in `backend/src/routes/` |
| 2 | Prisma schemas in sync | `diff <(grep "model\|@@map\|String\|Int\|Json\|Boolean\|Float\|DateTime" backend/prisma/schema.dev.prisma) <(grep "model\|@@map" backend/prisma/schema.production.prisma)` — field names must match across both schemas |
| 3 | Migration SQL exists for schema changes | Check `backend/prisma/migrations/` has a new folder with `migration.sql` for every schema change |
| 4 | Docker Compose variables resolve | `docker compose -f docker-compose.prod.yml config` — must not show any `${VAR}` unresolved |
| 5 | Healthchecks use `127.0.0.1` (not `localhost`) | Alpine images resolve `localhost` to IPv6 `::1`; most services listen IPv4 only |
| 6 | DB healthcheck user matches `POSTGRES_USER` | `pg_isready -U <user>` must use the actual DB user, not hardcoded `postgres` |
| 7 | `REDIS_ENABLED=true` when Redis container is present | Without this, backend falls back to MemoryStore (leaks memory, loses sessions) |
| 8 | `openapi.yaml` copied in Dockerfile production stage | Without it, `/api/docs` serves a blank spec. Must `COPY --from=builder /app/openapi.yaml ./openapi.yaml` |
| 9 | GHCR compose mirrors prod compose fixes | `docker-compose.ghcr.yml` must have the same healthcheck, env, and Redis fixes as `docker-compose.prod.yml` |

## Post-Deploy

| # | Check | How |
|---|-------|-----|
| 1 | All containers healthy | `docker ps` — no `(unhealthy)` status |
| 2 | No error-level log spam | `docker logs <backend> --tail 50` — no repeating errors |
| 3 | DB logs clean | `docker logs <db> --tail 20` — no `FATAL` entries |
| 4 | Migrations applied | Backend startup logs show "All migrations have been successfully applied" |
| 5 | API smoke test | `GET /health/ready` returns 200; `GET /api/v1/dashboard` returns data |
| 6 | CSRF errors return 403 (not 500) | Confirm in logs: CSRF failures show `statusCode: 403` |

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

### Alpine IPv6 in Docker
Alpine-based images (nginx:alpine, node:20-alpine) may resolve `localhost` to `::1`. Always use `127.0.0.1` in healthcheck commands.

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
