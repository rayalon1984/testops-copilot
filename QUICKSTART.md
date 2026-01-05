# TestOps Companion - Quick Start Guide

Get TestOps Companion running in minutes with this step-by-step guide.

---

## Choose Your Installation Mode

### 🚀 Demo Mode (Fastest - No Database Setup)

**Best for**: Trying out the UI, demos, proof-of-concepts

**Time**: ~5 minutes

```bash
# 1. Clone repository
git clone https://github.com/rayalon1984/testops-companion.git
cd testops-companion

# 2. Install dependencies
npm install

# 3. Start in demo mode (auto-opens browser)
npm run dev:simple
```

**That's it!** The app will:
- Start backend with SQLite (in-memory)
- Load 1,600+ demo test failures
- Open browser to http://localhost:5173
- **Login**: \`demo@testops.ai\` / \`demo123\`

---

### 🏭 Production Mode (Full Features)

**Best for**: Actual use, team collaboration, production deployments

**Time**: ~15 minutes

**Prerequisites**:
- Node.js >= 18.0.0
- PostgreSQL >= 14 (or Docker)
- npm >= 9.0.0

#### Option A: Docker Production (Recommended)

**Time**: ~3 minutes

```bash
# 1. Clone repository
git clone https://github.com/rayalon1984/testops-companion.git
cd testops-companion

# 2. Start Production Stack
docker-compose -f docker-compose.prod.yml up -d
```

The stack will:
- 🐳 Build optimized Node 20 containers
- 🌐 Start Nginx (Frontend) on Port 80
- ⚙️ Start Backend API on Port 3000
- 🗄️ Setup PostgreSQL, Redis, and Weaviate
- 🔄 Run database migrations automatically

#### Stops & Updates
```bash
# Stop services
docker-compose -f docker-compose.prod.yml down

# Update and rebuild
git pull
docker-compose -f docker-compose.prod.yml up -d --build
```

---

## Access the Application

| Service | URL | Notes |
|---------|-----|-------|
| Service | URL | Notes |
|---------|-----|-------|
| **Frontend** | http://localhost | Production UI (Nginx) |
| **Backend API** | http://localhost:3000/health | API Health Check |
| **Adminer** | N/A | Not included in Prod |

---

## Troubleshooting

### Backend won't start

**Error**: `Error: connect ECONNREFUSED 127.0.0.1:5432`

**Solution**: PostgreSQL is not running
```bash
# Using Docker
docker-compose up -d db
```

### Frontend can't connect to backend

**Check**:
2. Port matches in \`frontend/.env\`: Should be \`VITE_API_URL=http://localhost:3000\`

---

## Next Steps

1. Explore the Dashboard
2. Try AI Features (if configured)
3. Set Up Integrations (Jira, Slack, etc.)
4. Read [README.md](README.md) for full documentation

---

**Happy Testing! 🚀**
