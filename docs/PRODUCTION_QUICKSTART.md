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
- **Email:** `demo@testops.ai`
- **Password:** `demo123`

### Production Mode
### Production Mode
The installation script (`scripts/setup.sh`) will prompt you to create an admin account (email and password).

**Use the credentials you defined during the setup process.**

> [!NOTE]
> The setup script will display your selected credentials at the end of the installation.

If you need to create additional users later, you can use the API:

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "colleague@company.com",
    "password": "secure-password",
    "firstName": "New",
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
