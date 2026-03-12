# TestOps Copilot -- IT Admin Deployment Guide

> **Version**: 3.5.0 | **Last updated**: 2026-03-12
>
> This document enables an IT administrator to provision and deploy TestOps Copilot
> end-to-end on a single server or small cluster. No prior familiarity with the
> product is assumed.

---

## 1. Overview

TestOps Copilot is a web-based platform for managing CI/CD test pipelines, tracking
test results, and analyzing failures with AI assistance. It connects to tools your
engineering teams already use -- Jira, Confluence, GitHub, Jenkins, Azure DevOps,
Slack -- and provides a unified dashboard with an AI copilot that can perform root
cause analysis, categorize failures, summarize logs, and generate Jira tickets. The
platform supports role-based access control (Admin, Editor, User, Billing, Viewer)
and optional SAML SSO.

---

## 2. Prerequisites and System Requirements

### 2.1 Server Specifications

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| **CPU** | 2 cores | 4+ cores |
| **RAM** | 4 GB | 8+ GB |
| **Disk** | 20 GB free | 50+ GB SSD (database and vector store grow over time) |
| **OS** | Any OS that runs Docker (Linux, macOS, Windows with WSL2) | Ubuntu 22.04 LTS or RHEL 9 |

> **Note on AI features**: If you enable AI (Anthropic Claude, OpenAI, etc.), the AI
> providers run externally; they do **not** add local CPU/GPU load. The Weaviate
> vector store adds ~200 MB of base RAM.

### 2.2 Required Software

| Software | Version | Purpose |
|----------|---------|---------|
| **Docker Engine** | 24.0+ | Container runtime |
| **Docker Compose** | v2.20+ (included in Docker Desktop) | Service orchestration |
| **Git** | 2.x | Cloning the repository |
| **curl** or **wget** | Any | Post-install verification |
| **openssl** | Any | Generating secrets |

For **bare-metal** (non-Docker) deployment, you additionally need:

| Software | Version | Purpose |
|----------|---------|---------|
| **Node.js** | 20.x LTS (18.x minimum) | Application runtime |
| **npm** | 9.x+ | Package management |
| **PostgreSQL** | 15.x | Primary database |
| **Redis** | 7.x | Caching, session store, token blacklist |
| **Nginx** | 1.24+ | Reverse proxy / static file server |

### 2.3 Network and Port Requirements

| Port | Service | Exposure |
|------|---------|----------|
| **80** | Nginx / Frontend (HTTP) | Public (or behind load balancer) |
| **443** | Nginx (HTTPS) | Public (if TLS terminated here) |
| **3000** | Backend API | Internal only (proxied via Nginx) |
| **5432** | PostgreSQL | Internal only |
| **6379** | Redis | Internal only |
| **8081** | Weaviate (vector DB) | Internal only |

**Outbound access** is required for:
- AI provider APIs (api.anthropic.com, api.openai.com, generativelanguage.googleapis.com, etc.)
- Integration endpoints (Jira, Confluence, GitHub, Jenkins, Azure DevOps, Slack)
- Docker image registry (ghcr.io) during initial pull

---

## 3. Database Setup (PostgreSQL)

### 3.1 Option A -- Docker-managed PostgreSQL (recommended)

The Docker Compose files include a PostgreSQL 15 container. No separate installation
is needed. Skip to [Section 5](#5-application-deployment).

Database migrations run automatically on first startup via the backend's `start.sh`
script, which calls `prisma migrate deploy`.

### 3.2 Option B -- Existing / External PostgreSQL

If your organization already has a PostgreSQL cluster or managed service (e.g.,
AWS RDS, Azure Database for PostgreSQL, Google Cloud SQL):

**Requirements**:
- PostgreSQL **15.x** (14.x may work but is untested)
- `uuid-ossp` extension enabled (Prisma uses UUID primary keys)

**Create the database and role**:

```sql
-- Connect as a superuser / admin
CREATE ROLE testops WITH LOGIN PASSWORD 'REPLACE_WITH_SECURE_PASSWORD';
CREATE DATABASE testops OWNER testops;

-- Connect to the new database
\c testops

-- Grant required privileges
GRANT ALL PRIVILEGES ON DATABASE testops TO testops;
GRANT ALL PRIVILEGES ON SCHEMA public TO testops;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO testops;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO testops;

-- Enable required extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

**Connection string format** expected by the app:

```
DATABASE_URL=postgresql://<user>:<password>@<host>:<port>/<database>
```

Example:
```
DATABASE_URL=postgresql://testops:S3cur3Pa55@db.internal.example.com:5432/testops
```

**[DECISION NEEDED]** Connection pool sizing. Set `DATABASE_POOL_SIZE` in your env
file. Rule of thumb: `(2 * cpu_cores) + 1`. Default is 25 (suitable for a 4-core
server). For managed databases, check your plan's connection limit and set
accordingly.

### 3.3 Running Migrations Manually

If using an external database, run migrations before first startup:

```bash
cd backend
DATABASE_URL="postgresql://testops:password@your-host:5432/testops" \
  npx prisma migrate deploy
```

---

## 4. Vector Store Setup (Weaviate)

Weaviate is used for semantic search across test failures, log summaries, and
enriched context. It is **optional** -- the platform works without it, but AI
features like failure similarity search will be unavailable.

### 4.1 Option A -- Docker-managed Weaviate (recommended)

Included in the Compose files. Image: `semitechnologies/weaviate:1.35.10`.

Configuration in the production Compose file:
- **Persistence**: Data stored in the `weaviate_data` Docker volume at
  `/var/lib/weaviate`.
- **Authentication**: API key auth enabled in production
  (`AUTHENTICATION_APIKEY_ENABLED=true`). Set `WEAVIATE_API_KEY` in your env file.
- **Vectorizer**: `none` -- the backend generates embeddings via the configured AI
  provider and sends vectors directly.

Resource footprint: ~200 MB RAM at idle, growing with indexed data.

### 4.2 Option B -- External Weaviate

If you run Weaviate separately (e.g., Weaviate Cloud Services):

Set in your `.env.production`:
```
WEAVIATE_URL=https://your-cluster.weaviate.network
WEAVIATE_API_KEY=your-api-key
```

The backend creates required collections (schemas) automatically on first startup.

### 4.3 Skipping Weaviate

To deploy without vector search, ensure `WEAVIATE_URL` is unset or empty. The
platform will skip vector operations gracefully.

---

## 5. Application Deployment

### 5.1 Option A -- Docker with Pre-built Images (fastest)

This is the recommended approach for most deployments.

```bash
# 1. Clone the repository (for config files and Compose definitions)
git clone https://github.com/rayalon1984/testops-copilot.git
cd testops-copilot

# 2. Create production environment file
cp .env.production.example .env.production
```

**Edit `.env.production`** -- at minimum, set these three secrets:

```bash
# Generate secure values:
openssl rand -base64 48   # run three times, one for each secret

# Required in .env.production:
POSTGRES_PASSWORD=<generated-value-1>
JWT_SECRET=<generated-value-2>
JWT_REFRESH_SECRET=<generated-value-3>
```

**[DECISION NEEDED]** Review and configure the optional sections in
`.env.production` based on your needs:

| Section | When to configure |
|---------|-------------------|
| `CORS_ORIGIN` / `VITE_API_URL` | Always -- set to your actual domain (e.g., `https://testops.yourcompany.com`) |
| AI Provider keys | If you want AI features (root cause analysis, categorization, log summary) |
| `WEAVIATE_API_KEY` | If using Weaviate with authentication |
| Jira / Confluence / GitHub | If you want bidirectional integration with these tools |
| Azure DevOps (`AZDO_*`) | If your CI/CD runs on Azure DevOps |
| Slack / Email / Pushover | For alert notifications |
| SAML SSO | If using enterprise SSO instead of local auth |

```bash
# 3. Start all services
docker compose -f docker-compose.ghcr.yml up -d

# 4. Verify all containers are running
docker compose -f docker-compose.ghcr.yml ps
```

Expected output: 5 services running (frontend, backend, db, redis, weaviate).

The backend automatically:
1. Waits for PostgreSQL to be ready (up to 60 seconds)
2. Runs database migrations (`prisma migrate deploy`)
3. Starts the Node.js server on port 3000

The frontend (Nginx) serves the React SPA on port 80 and proxies `/api/` requests
to the backend.

### 5.2 Option B -- Docker with Source Build

Use this if you need to customize the build or cannot pull from GHCR.

```bash
git clone https://github.com/rayalon1984/testops-copilot.git
cd testops-copilot

cp .env.production.example .env.production
# Edit .env.production as described above

docker compose -f docker-compose.prod.yml up -d --build
```

Build time: approximately 3-5 minutes depending on hardware.

### 5.3 Option C -- Bare-metal Deployment

For environments where Docker is not available.

#### 5.3.1 Install System Dependencies

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y postgresql-15 redis-server nginx git curl

# Install Node.js 20 LTS via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

```bash
# RHEL/CentOS/Alma
sudo dnf install -y postgresql15-server redis nginx git curl
sudo dnf module enable nodejs:20
sudo dnf install -y nodejs

# Initialize PostgreSQL
sudo postgresql-setup --initdb
sudo systemctl enable --now postgresql redis nginx
```

#### 5.3.2 Configure PostgreSQL and Redis

Follow [Section 3.2](#32-option-b----existing--external-postgresql) to create the
database and role. Ensure Redis is running on `localhost:6379` (default).

#### 5.3.3 Build and Configure the Application

```bash
git clone https://github.com/rayalon1984/testops-copilot.git
cd testops-copilot

# Install all dependencies
npm run setup:install

# Configure backend
cp backend/.env.example backend/.env
# Edit backend/.env -- set DATABASE_URL, REDIS_URL, JWT_SECRET, etc.

# Configure frontend
cp frontend/.env.example frontend/.env
# Edit frontend/.env -- set VITE_API_URL to your domain

# Run database migrations
cd backend
npx prisma migrate deploy
cd ..

# Build everything
npm run build
```

#### 5.3.4 Configure Nginx

Create `/etc/nginx/sites-available/testops-copilot`:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate     /etc/ssl/certs/your-cert.pem;
    ssl_certificate_key /etc/ssl/private/your-key.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;

    client_max_body_size 50M;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;

    # Frontend static files
    location / {
        root /var/www/testops-copilot;
        try_files $uri $uri/ /index.html;
        expires -1;
        add_header Cache-Control "no-store, no-cache, must-revalidate";
    }

    # Cache-busted assets (Vite content-hashed)
    location /assets/ {
        root /var/www/testops-copilot;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # WebSocket proxy
    location /ws {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;
    }
}
```

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/testops-copilot /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Deploy frontend build
sudo mkdir -p /var/www/testops-copilot
sudo cp -r frontend/dist/* /var/www/testops-copilot/
```

**[DECISION NEEDED]** TLS certificates. Options:
- **Let's Encrypt** (free, auto-renewing): `sudo certbot --nginx -d your-domain.com`
- **Organization CA**: Place cert and key at the paths in the Nginx config above.
- **Load balancer termination**: If TLS is handled upstream, use `listen 80` only
  and remove the SSL block.

#### 5.3.5 Start the Backend with a Process Manager

```bash
# Install PM2 globally
sudo npm install -g pm2

# Start the backend
cd /path/to/testops-copilot/backend
NODE_ENV=production pm2 start dist/index.js --name testops-backend -i max

# Save PM2 process list and set up startup script
pm2 save
pm2 startup   # follow the printed command to enable on boot
```

#### 5.3.6 Install Weaviate (optional, bare-metal)

Weaviate does not provide native OS packages. The simplest option on bare-metal is
to run it as a single Docker container even if the rest of the stack is bare-metal:

```bash
docker run -d \
  --name weaviate \
  --restart always \
  -p 8081:8080 \
  -v weaviate_data:/var/lib/weaviate \
  -e QUERY_DEFAULTS_LIMIT=20 \
  -e AUTHENTICATION_ANONYMOUS_ACCESS_ENABLED=false \
  -e AUTHENTICATION_APIKEY_ENABLED=true \
  -e AUTHENTICATION_APIKEY_ALLOWED_KEYS=your-api-key \
  -e PERSISTENCE_DATA_PATH=/var/lib/weaviate \
  -e DEFAULT_VECTORIZER_MODULE=none \
  -e CLUSTER_HOSTNAME=node1 \
  semitechnologies/weaviate:1.35.10
```

Set `WEAVIATE_URL=http://localhost:8081` and `WEAVIATE_API_KEY=your-api-key` in the
backend `.env`.

---

## 6. Post-Install Verification

Run through this checklist after deployment to confirm the system is healthy.

### 6.1 Service Health (Docker)

```bash
# All 5 containers should show "Up" / "healthy"
docker compose -f docker-compose.ghcr.yml ps

# Check backend health endpoint
curl -s http://localhost:3000/health | jq .
# Expected: {"status":"ok", ...}

curl -s http://localhost:3000/health/ready | head -1
# Expected: HTTP 200

# Check frontend
curl -s -o /dev/null -w "%{http_code}" http://localhost/
# Expected: 200

# Check database connectivity
docker compose -f docker-compose.ghcr.yml exec db pg_isready -U postgres
# Expected: accepting connections

# Check Redis
docker compose -f docker-compose.ghcr.yml exec redis redis-cli ping
# Expected: PONG

# Check Weaviate (if enabled)
curl -s http://localhost:8081/v1/.well-known/ready
# Expected: HTTP 200
```

### 6.2 Application Verification

```bash
# Register the first admin user
curl -s -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@yourcompany.com",
    "password": "YourSecureP@ss1",
    "firstName": "Admin",
    "lastName": "User"
  }' | jq .
# Expected: user object with JWT tokens

# Verify login works
curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@yourcompany.com",
    "password": "YourSecureP@ss1"
  }' | jq .token
# Expected: a JWT string
```

> **Password requirements**: 8+ characters, at least one uppercase, one lowercase,
> one digit, and one special character (`@$!%*?&`).

### 6.3 Docker Logs Quick Check

```bash
# Check for errors in backend startup
docker compose -f docker-compose.ghcr.yml logs backend --tail 50

# Look for "Database is ready" and "Starting application..." messages
# Verify no unhandled promise rejections or connection errors
```

### 6.4 Checklist Summary

| Check | Command / Action | Expected Result |
|-------|------------------|-----------------|
| All containers running | `docker compose ps` | 5 services Up / healthy |
| Backend health | `curl localhost:3000/health` | `{"status":"ok"}` |
| Frontend loads | Open `http://<server>` in browser | Login page renders |
| Database migrations applied | Backend logs show "Running database migrations... done" | No migration errors |
| Redis connected | Backend logs show no Redis connection errors | Clean startup |
| User registration | POST to `/api/v1/auth/register` | 201 with user + tokens |
| User login | POST to `/api/v1/auth/login` | 200 with JWT |
| AI health (if enabled) | Backend logs or `/health` response | AI provider connected |
| WebSocket | Open browser DevTools Network tab, check WS connection | Connected |

---

## 7. Troubleshooting

### Backend won't start -- "Database not ready"

**Symptom**: Backend logs show repeated "Database not ready yet" and eventually exits.

**Cause**: PostgreSQL isn't accepting connections within the 60-second timeout.

**Fix**:
```bash
# Check if the DB container is running
docker compose -f docker-compose.ghcr.yml ps db

# Check PostgreSQL logs
docker compose -f docker-compose.ghcr.yml logs db

# Common causes:
# - POSTGRES_PASSWORD not set in .env.production (the Compose file will error)
# - Disk full (PostgreSQL refuses to start)
# - Port 5432 conflict with a host PostgreSQL instance
```

### Migration fails -- "relation already exists" or "permission denied"

**Symptom**: Backend crashes during `prisma migrate deploy`.

**Fix**:
```bash
# If using an external database, ensure the role has CREATE TABLE privileges:
GRANT ALL ON SCHEMA public TO testops;

# If a previous partial migration left the DB in a dirty state:
docker compose -f docker-compose.ghcr.yml exec backend \
  npx prisma migrate resolve --applied <migration-name>
```

### Frontend shows blank page or API errors

**Symptom**: Browser loads but shows a white screen or "Network Error" on API calls.

**Cause**: `VITE_API_URL` mismatch or Nginx proxy misconfigured.

**Fix**:
- For Docker deployments, `VITE_API_URL` should generally be empty (the frontend
  Nginx config proxies `/api/` to the backend container).
- For bare-metal, ensure `VITE_API_URL` matches your public URL
  (e.g., `https://testops.yourcompany.com`).
- Check Nginx error log: `sudo tail -f /var/log/nginx/error.log`

### Redis connection refused

**Symptom**: Backend logs show `ECONNREFUSED` on Redis.

**Fix**:
```bash
# Docker: ensure the redis container is running
docker compose -f docker-compose.ghcr.yml ps redis

# Bare-metal: ensure Redis is running and listening
sudo systemctl status redis
redis-cli ping   # should return PONG

# Check REDIS_URL in your env file
# Docker default: redis://redis:6379
# Bare-metal default: redis://localhost:6379
```

### Weaviate not responding

**Symptom**: AI semantic search fails; backend logs show Weaviate connection errors.

**Fix**:
```bash
# Check container status
docker compose -f docker-compose.ghcr.yml ps weaviate

# Test connectivity
curl http://localhost:8081/v1/.well-known/ready

# Common issue: port conflict. Weaviate listens on 8080 internally,
# mapped to 8081 externally. Ensure WEAVIATE_URL=http://localhost:8081
# (bare-metal) or WEAVIATE_URL=http://weaviate:8080 (Docker inter-container).
```

### AI features not working

**Symptom**: Copilot returns errors or "AI is not enabled."

**Fix**:
1. Ensure `AI_ENABLED=true` in your env file.
2. Ensure `AI_PROVIDER` matches a provider with a valid API key set (e.g.,
   `AI_PROVIDER=anthropic` requires `ANTHROPIC_API_KEY`).
3. Check the backend health endpoint -- it reports AI provider status.
4. Verify outbound HTTPS access to the provider's API endpoint.

### Cannot register first user

**Symptom**: Registration endpoint returns 500.

**Fix**:
```bash
# Check backend logs for the specific error
docker compose -f docker-compose.ghcr.yml logs backend --tail 20

# Common cause: DATABASE_URL is wrong or migrations haven't run
# Force re-run migrations:
docker compose -f docker-compose.ghcr.yml exec backend \
  npx prisma migrate deploy
```

### High memory usage

**Symptom**: Server runs low on RAM.

**Fix**:
- Weaviate is the most memory-hungry optional component. If not using AI semantic
  search, remove or stop the Weaviate container.
- Reduce PostgreSQL `shared_buffers` if on a memory-constrained server.
- Limit Node.js heap: add `--max-old-space-size=512` to the backend start command.

### Updating to a New Version

```bash
cd testops-copilot

# Pull latest images
docker compose -f docker-compose.ghcr.yml pull

# Restart (migrations run automatically on backend startup)
docker compose -f docker-compose.ghcr.yml up -d

# Verify health after update
curl -s http://localhost:3000/health | jq .
```

### Backup and Restore

```bash
# Backup database
docker compose -f docker-compose.ghcr.yml exec -T db \
  pg_dump -U postgres testops > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore database
docker compose -f docker-compose.ghcr.yml exec -T db \
  psql -U postgres -d testops < backup_20260312_120000.sql
```

---

## Appendix A: Full Environment Variable Reference

See `.env.production.example` in the repository root for every available variable
with descriptions. The table below summarizes the most important ones.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `POSTGRES_PASSWORD` | Yes | -- | PostgreSQL password |
| `JWT_SECRET` | Yes | -- | 64-char secret for signing access tokens |
| `JWT_REFRESH_SECRET` | Yes | -- | 64-char secret for signing refresh tokens |
| `POSTGRES_USER` | No | `postgres` | PostgreSQL user |
| `POSTGRES_DB` | No | `testops` | PostgreSQL database name |
| `DATABASE_URL` | No | Composed from above | Full PostgreSQL connection string |
| `DATABASE_POOL_SIZE` | No | `25` | Connection pool size |
| `PORT` | No | `3000` | Backend listen port |
| `NODE_ENV` | No | `production` | Environment mode |
| `CORS_ORIGIN` | No | -- | Allowed CORS origins (your domain) |
| `VITE_API_URL` | No | -- | Frontend API base URL (empty for Docker) |
| `LOG_LEVEL` | No | `info` | Logging verbosity (`debug`, `info`, `warn`, `error`) |
| `REDIS_URL` | No | `redis://redis:6379` | Redis connection string |
| `AI_ENABLED` | No | `false` | Enable AI features |
| `AI_PROVIDER` | No | `anthropic` | `anthropic`, `openai`, `google`, `azure`, `openrouter` |
| `ANTHROPIC_API_KEY` | If AI | -- | Anthropic Claude API key |
| `OPENAI_API_KEY` | If AI | -- | OpenAI API key |
| `GOOGLE_API_KEY` | If AI | -- | Google Gemini API key |
| `WEAVIATE_URL` | No | -- | Weaviate endpoint |
| `WEAVIATE_API_KEY` | No | -- | Weaviate auth key |
| `AI_MONTHLY_BUDGET_USD` | No | `100` | AI spend cap (requests rejected at 100%) |
| `BCRYPT_SALT_ROUNDS` | No | `12` | Password hashing cost factor |

## Appendix B: Architecture Diagram (text)

```
                  Internet
                     |
              [ Load Balancer / TLS ]        (optional)
                     |
              [ Nginx :80/:443 ]
              /              \
     Static SPA            /api/  +  /ws
   (React frontend)          |
                      [ Backend :3000 ]
                      /    |    \     \
              [Postgres] [Redis] [Weaviate]  [External AI APIs]
               :5432     :6379    :8081     (Anthropic/OpenAI/...)
```

## Appendix C: Docker Compose File Comparison

| File | Use Case | Builds from Source? | Images |
|------|----------|---------------------|--------|
| `docker-compose.yml` | Local development | Yes (dev target) | N/A |
| `docker-compose.prod.yml` | Production (source build) | Yes (prod target) | N/A |
| `docker-compose.ghcr.yml` | Production (pre-built) | No | `ghcr.io/rayalon1984/testops-copilot/*` |
