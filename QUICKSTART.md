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

#### Option A: Automated Setup (Recommended)

```bash
# 1. Clone repository
git clone https://github.com/rayalon1984/testops-companion.git
cd testops-companion

# 2. Run validated setup script
bash scripts/setup-validated.sh
```

The script will:
- ✅ Check prerequisites (Node, npm, PostgreSQL)
- ✅ Install all dependencies
- ✅ Generate secure JWT secrets
- ✅ Create .env files
- ✅ Set up database
- ✅ Run migrations
- ✅ Verify installation

---

## Access the Application

| Service | URL | Notes |
|---------|-----|-------|
| **Frontend** | http://localhost:5173 | React app |
| **Backend API** | http://localhost:3000/api/v1 | REST API |
| **Adminer** (Docker) | http://localhost:8080 | Database admin |

---

## Troubleshooting

### Backend won't start

**Error**: \`Error: connect ECONNREFUSED 127.0.0.1:5432\`

**Solution**: PostgreSQL is not running
```bash
# Using Docker
docker-compose up -d db
```

### Frontend can't connect to backend

**Check**:
1. Backend is running: \`curl http://localhost:3000/health\`
2. Port matches in \`frontend/.env\`: Should be \`VITE_API_URL=http://localhost:3000\`

---

## Next Steps

1. Explore the Dashboard
2. Try AI Features (if configured)
3. Set Up Integrations (Jira, Slack, etc.)
4. Read [README.md](README.md) for full documentation

---

**Happy Testing! 🚀**
