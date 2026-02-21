# Production Quick Start Guide

Deploy TestOps Companion to production in under 5 minutes.

## Prerequisites

- Docker and Docker Compose installed
- Git

---

## 🚀 Quick Deployment

```bash
# 1. Clone the repository
git clone https://github.com/rayalon1984/testops-companion.git
cd testops-companion

# 2. Copy production env template
cp .env.production.example .env.production

# 3. Edit secrets (REQUIRED!)
nano .env.production  # Set DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET

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

Register your first admin account via the API (backend runs on port 3000 inside the Docker network, exposed on the same port):

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@yourcompany.com",
    "password": "your-secure-password",
    "firstName": "Admin",
    "lastName": "User"
  }'
```

---

## 🔄 Updating to New Version

```bash
cd testops-companion
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
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | 64-char random string for auth tokens |
| `JWT_REFRESH_SECRET` | 64-char random string for refresh tokens |

See `.env.production.example` for all available options.

---

## 📖 Need More Help?

- [Full README](../README.md)
- [Demo Mode Guide](DEV_MODE.md)
- [Integration Guides](integrations/)
