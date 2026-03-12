# Troubleshooting Guide

## Demo Mode Issues

### "Prisma client not found"

```bash
cd backend && npx prisma generate
```

### "Database is locked" (SQLite)

The SQLite file is in use by another process, or a previous crash left a lock.

```bash
rm backend/prisma/dev.db
npm run dev:simple
```

### Backend crashes on startup

Check if a `.env` file in `backend/` is overriding demo mode defaults:

```bash
# Demo mode should work without any .env file
# If you have one, temporarily rename it:
mv backend/.env backend/.env.bak
npm run dev:simple
```

---

## Development Mode Issues (Docker)

### "Can't reach database" / ECONNREFUSED 5432

```bash
# 1. Verify Docker is running
docker ps

# 2. Check if PostgreSQL container is healthy
docker compose logs db

# 3. Restart infrastructure
npm run local:stop
npm run local:start
```

### "Redis connection refused"

```bash
# Check Redis container
docker compose logs redis

# Restart Redis only
docker compose restart redis
```

### Port 3000 or 5173 already in use

```bash
# Find what's using the port
lsof -i :3000
lsof -i :5173

# Change backend port in backend/.env:
# PORT=3001
# Then update frontend/.env:
# VITE_API_URL=http://localhost:3001
```

---

## Database Operations

### Safe Database Reset (Development)

```bash
# Preserves migration history — resets data only
cd backend && npx prisma migrate reset --force
```

> **Warning**: Never run `rm -rf backend/prisma/migrations`. The migration baseline is required for production deployments and cannot be regenerated from scratch. See [LESSONS_LEARNED.md — EPR-007](../project/LESSONS_LEARNED.md#epr-007-migration-baseline-incompleteness).

### Re-seed Demo Data

```bash
cd backend && npm run dev:simple:seed
```

### Re-seed Production Data

```bash
cd backend && npx prisma db seed
```

---

## Authentication Issues

### "Invalid token" or 401 errors

Verify these are set in `backend/.env`:

```env
JWT_SECRET=<any-string-at-least-32-chars>
JWT_EXPIRES_IN=24h
JWT_REFRESH_SECRET=<different-string-at-least-32-chars>
JWT_REFRESH_EXPIRES_IN=7d
```

Common mistakes:
- Using `REFRESH_TOKEN_SECRET` instead of `JWT_REFRESH_SECRET`
- Missing `JWT_REFRESH_EXPIRES_IN`
- Expired tokens after server restart (clear browser localStorage)

### Demo mode login not working

All accounts use password `demo123`:
- `admin@testops.ai` — Site Admin
- `lead@testops.ai` — QA Lead
- `engineer@testops.ai` — QA Engineer
- `viewer@testops.ai` — Stakeholder

If the seed didn't run, re-seed:
```bash
cd backend && npm run dev:simple:seed
```

---

## Build & TypeScript Issues

### TypeScript compilation errors

```bash
# Check which schema is active
head -5 backend/prisma/schema.prisma

# Regenerate Prisma client
cd backend && npx prisma generate

# Full typecheck
cd backend && npx tsc --noEmit
```

### Schema-related type errors

If you see errors about missing Prisma models or enum types, the active schema may be wrong for your mode:

```bash
# For demo mode: use dev schema
cp backend/prisma/schema.dev.prisma backend/prisma/schema.prisma
cd backend && npx prisma generate

# For production: use production schema
cp backend/prisma/schema.production.prisma backend/prisma/schema.prisma
cd backend && npx prisma generate
```

> See [LESSONS_LEARNED.md — EPR-008](../project/LESSONS_LEARNED.md#epr-008-cross-database-type-mismatch-sqlite-vs-postgresql-enums) for why SQLite and PostgreSQL schemas can have different type behavior.

---

## Environment Refresh

```bash
# Regenerate .env files from templates
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Edit secrets (required)
# backend/.env: JWT_SECRET, JWT_REFRESH_SECRET, DATABASE_URL

# Restart
npm run dev
```

---

## Cache Clear

```bash
# Clear Redis cache (development mode)
docker compose exec redis redis-cli FLUSHALL

# Clear browser state
# Chrome DevTools → Application → Clear Storage → Clear site data
```

---

## Getting Help

1. Check the [Quick Start Guide](../getting-started/quickstart.md) for setup instructions
2. Review [Lessons Learned](../project/LESSONS_LEARNED.md) for known pitfalls
3. Search [existing issues](https://github.com/rayalon1984/testops-copilot/issues)
4. Open a [new issue](https://github.com/rayalon1984/testops-copilot/issues/new/choose)
