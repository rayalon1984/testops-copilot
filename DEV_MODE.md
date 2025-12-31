# 🚀 Development Modes

TestOps Companion supports two development modes:

## 🎨 Demo Mode (dev:simple) - For YOU

**Perfect for**: Demos, screenshots, UI development, showing off the product

**What you get**:
- ✅ SQLite database (no Docker needed!)
- ✅ 150+ realistic test failures pre-loaded
- ✅ AI categorization across all types
- ✅ Beautiful dashboard with real-looking data
- ✅ AI performance metrics and cost tracking
- ✅ Works in seconds - no complicated setup

**Usage**:
```bash
# One command - that's it!
npm run dev:simple

# Opens on http://localhost:5173
# Backend: http://localhost:4000
```

**First time setup**:
```bash
git pull origin main
npm install  # If you haven't already
npm run dev:simple
```

The dashboard will show:
- 45 critical bugs
- 38 minor bugs
- 28 environment issues
- 22 flaky tests
- 17 configuration problems
- Full AI analysis with root causes and solutions
- Provider comparison (Anthropic, OpenAI, Google)
- Cost tracking and cache hit rates

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

# Opens on http://localhost:5173
# Backend: http://localhost:4000
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
lsof -i :4000  # Backend
lsof -i :5173  # Frontend

# Kill or change ports
```

## 📝 Mock Data Details

The `dev:simple` mode includes:

**Test Failures** (150 total):
- Payment processing errors (critical)
- OAuth timeout issues (high)
- Email validation bugs (medium)
- Database deadlocks (critical)
- Flaky search tests (low)
- Configuration errors (medium)
- Memory issues (critical)
- Network failures (high)

**AI Usage** (~2,100 calls over 30 days):
- Claude Sonnet 4: 65% cache hit, $1.2/month
- GPT-4 Turbo: 35% cache hit, $15/month
- Gemini Flash: 70% cache hit, $0.20/month

**Test Runs**: 20 runs with varying success rates
**Time Range**: Last 30 days of data
**Environments**: Production, Staging, Development

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
