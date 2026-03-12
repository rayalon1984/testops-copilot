# Production Quick Start Guide

Deploy TestOps Copilot to production in under 5 minutes.

## Prerequisites

- Docker and Docker Compose installed
- Git

---

## 🚀 Quick Deployment

```bash
# 1. Clone the repository
git clone https://github.com/rayalon1984/testops-copilot.git
cd testops-copilot

# 2. Copy production env template
cp .env.production.example .env.production

# 3. Edit secrets (REQUIRED!)
nano .env.production  # Set POSTGRES_PASSWORD, JWT_SECRET, JWT_REFRESH_SECRET

# 4. Start all services
docker compose -f docker-compose.ghcr.yml up -d

# 5. Open dashboard
open http://localhost
```

---

## 🔐 Login Credentials

### Demo Mode (Development)

All accounts use password `demo123`:
- `admin@testops.ai` — Site Admin
- `lead@testops.ai` — QA Lead
- `engineer@testops.ai` — QA Engineer
- `viewer@testops.ai` — Stakeholder

### Production Mode

Register your first admin account via the API (backend runs on port 3000 inside the Docker network, exposed on the same port).

**Password requirements:** 8+ characters, must include at least one uppercase letter, one lowercase letter, one digit, and one special character (`@`, `$`, `!`, `%`, `*`, `?`, or `&`).

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@yourcompany.com",
    "password": "SecureP@ss1",
    "firstName": "Admin",
    "lastName": "User"
  }'
```

> **Note:** Change the example password above to your own before running.

---

## 🔄 Updating to New Version

```bash
cd testops-copilot
docker compose -f docker-compose.ghcr.yml pull
docker compose -f docker-compose.ghcr.yml up -d
```

---

## 💾 Database Backup & Restore

```bash
# Backup
./scripts/backup-db.sh ./backups/

# Restore
./scripts/restore-db.sh ./backups/testops_backup_*.sql.gz
```

---

## 🔧 Required Environment Variables

| Variable | Description |
|----------|-------------|
| `POSTGRES_PASSWORD` | Secure password for the PostgreSQL database |
| `JWT_SECRET` | 64-char random string for auth tokens |
| `JWT_REFRESH_SECRET` | 64-char random string for refresh tokens |

`DATABASE_URL` is pre-configured in `.env.production.example` using `${POSTGRES_PASSWORD}` interpolation — you only need to set the password.

See `.env.production.example` for all available options.

---

## 📖 Need More Help?

- [Full README](../../README.md)
- [Demo Mode Guide](../getting-started/DEV_MODE.md)
- [Integration Guides](../integrations/)
