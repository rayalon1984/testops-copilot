# 🚀 Development Modes

TestOps Companion supports two development modes:

## 🎨 Demo Mode (dev:simple) - For YOU

**Perfect for**: Demos, screenshots, UI development, showing off the product

**What you get**:
- ✅ SQLite database (no Docker needed!)
- ✅ 1,600+ realistic test failures pre-loaded
- ✅ AI categorization across all types
- ✅ Beautiful dashboard with real-looking data
- ✅ AI performance metrics and cost tracking
- ✅ Works in seconds - no complicated setup

**Usage**:
```bash
# One command - that's it!
npm run dev:simple

# Frontend: http://localhost:5173
# Backend:  http://localhost:3000
```

**First time setup** (fresh clone):
```bash
npm install  # Installs ALL dependencies (root, backend, frontend)
npm run dev:simple
```

**If you already have node_modules**:
```bash
git pull origin main
npm run dev:simple
```

**Login** — all accounts use password `demo123`:
- `admin@testops.ai` — Site Admin
- `lead@testops.ai` — QA Lead
- `engineer@testops.ai` — QA Engineer
- `viewer@testops.ai` — Stakeholder

The dashboard will show:
- 1,600+ failure archive entries across all categories
- 150 test runs with varying success rates
- 15 pipelines (Jenkins, GitHub Actions, custom)
- Full AI analysis with root causes and solutions
- Provider comparison (Anthropic, OpenAI, Google)
- Cost tracking and cache hit rates
- 26,500+ total data points

## 🏢 Production Mode (dev) - For COMPANIES

**Perfect for**: Beta users, real deployments, production testing

**What you get**:
- ✅ PostgreSQL database (persistent, scalable)
- ✅ Redis caching (fast AI responses)
- ✅ Weaviate vector DB (AI similarity search)
- ✅ Production-ready architecture
- ✅ All features enabled

**Usage**:
```bash
# First time setup (automatic)
npm run local:setup

# Daily development
npm run dev

# Frontend: http://localhost:5173
# Backend:  http://localhost:3000
```

**Requirements**:
- Docker Desktop installed and running
- 5 minutes for first-time setup

## 📊 Comparison

| Feature | dev:simple | dev (production) |
|---------|-----------|------------------|
| **Setup Time** | 30 seconds | 5 minutes |
| **Docker Required** | ❌ No | ✅ Yes |
| **Database** | SQLite (file) | PostgreSQL (Docker) |
| **Data** | Mock data | Real data |
| **Caching** | None | Redis |
| **AI Search** | Disabled | Weaviate |
| **Use Case** | Demos, UI dev | Real deployments |
| **Perfect For** | You! | Beta users |

## 🎯 When to Use What

**Use `npm run dev:simple` when**:
- Demoing to potential customers
- Taking screenshots for marketing
- Developing UI components
- Quick testing without Docker
- Showing the product to investors

**Use `npm run dev` when**:
- Testing with real test data
- Developing backend features
- Preparing for production deployment
- Testing with beta users
- Full integration testing

## 📝 Switching Between Modes

### Switch to Simple Mode:
```bash
cd backend
cp .env.dev .env
npm run dev:simple:setup  # Re-setup database
cd ..
npm run dev:simple
```

### Switch to Full Mode:
```bash
cd backend
cp .env.full .env
npm run db:migrate  # Run migrations
cd ..
npm run local:start  # Start Docker services
npm run dev
```

> **Tip:** Simple mode automatically overwrites `.env` when you run `npm run dev:simple`. Backup your `.env` before switching if you have custom settings.

## 🔧 Troubleshooting

### dev:simple issues

**"Prisma client not found"**
```bash
cd backend
npm run dev:simple:generate
```

**"Database is locked"**
```bash
# Delete the SQLite database and regenerate
rm backend/prisma/dev.db
npm run dev:simple
```

### dev (production) issues

**"Can't reach database"**
```bash
# Make sure Docker is running
docker ps

# Restart services
npm run local:stop
npm run local:setup
```

**"Port already in use"**
```bash
# Check what's using the port
lsof -i :3000  # Backend
lsof -i :5173  # Frontend

# Kill or change ports
```

## 📝 Mock Data Details

The `dev:simple` mode includes:

**Failure Archive** (1,600+ entries):
- Payment processing errors (critical)
- OAuth timeout issues (high)
- Email validation bugs (medium)
- Database deadlocks (critical)
- Flaky search tests (low)
- Configuration errors (medium)
- Memory issues (critical)
- Network failures (high)

**AI Usage** (~23,600 calls over 30 days):
- Claude Opus 4.6: 65% cache hit, $3.5/month
- GPT-4.1: 35% cache hit, $12/month
- Gemini 3.0 Flash: 70% cache hit, $0.15/month

**Test Runs**: 150 runs with varying success rates
**Pipelines**: 15 pipelines (Jenkins, GitHub Actions, custom)
**Time Range**: Last 30 days of data
**Environments**: Production, Staging, Development
**Total Data Points**: ~26,500

## 🎨 Perfect for Demos!

The mock data is designed to:
- Show all failure categories
- Demonstrate AI categorization
- Display meaningful root causes
- Showcase the beautiful UI
- Look like a real production system

**Demo Flow**:
1. Run `npm run dev:simple`
2. Open http://localhost:5173
3. Show the dashboard with full data
4. Click through recent failures
5. Demonstrate AI analysis quality
6. Show provider comparison
7. Highlight cost savings from caching

Looks amazing for screenshots and investor presentations! 🚀
