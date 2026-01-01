# Development Modes Guide

TestOps Companion supports two development modes:

## 🚀 Quick Start (Simple Mode) - SQLite
**Perfect for demos and quick development**

```bash
npm run dev:simple
```

This mode:
- ✅ No Docker required
- ✅ Uses SQLite database (local file)
- ✅ Includes mock data seeding
- ✅ Fastest setup (under 1 minute)
- ✅ Redis and Weaviate disabled
- ✅ Perfect for UI development and demos

**What happens:**
1. Automatically sets up SQLite database
2. Generates Prisma client
3. Seeds demo data (1,450+ failures, 15 pipelines, 150 test runs)
4. Starts backend on port 4000
5. Frontend runs on port 5173

## 🔧 Full Development Mode - PostgreSQL + Redis + Weaviate
**For full feature development with all services**

```bash
# 1. Start Docker services
npm run local:start

# 2. Switch to full dev environment
cd backend && cp .env.full .env && cd ..

# 3. Run migrations and start
npm run dev
```

This mode:
- ✅ Full PostgreSQL database
- ✅ Redis for caching and queues
- ✅ Weaviate for AI vector similarity search
- ✅ All AI features enabled
- ✅ Production-like environment

**What happens:**
1. Docker containers start (PostgreSQL, Redis, Weaviate)
2. Uses `.env.full` configuration
3. Requires manual database migrations
4. Full AI provider integration

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

## 🔒 Important Notes

1. **Simple mode automatically overwrites `.env`** when you run `npm run dev:simple`
2. **Backup your `.env` before switching modes** if you have custom settings
3. **Use `.env.full` as template** for full development mode
4. **Never commit your `.env` file** - it's in `.gitignore`

## 🎯 Which Mode Should I Use?

| Use Case | Recommended Mode |
|----------|-----------------|
| UI Development | Simple Mode |
| Demo/Presentation | Simple Mode |
| Frontend-only work | Simple Mode |
| Testing AI features | Full Mode |
| Performance testing | Full Mode |
| Integration testing | Full Mode |
| Production simulation | Full Mode |

## 🐛 Troubleshooting

### "Database doesn't exist" error in Full Mode:
```bash
npm run db:migrate
```

### Simple mode not seeding data:
```bash
cd backend
npm run dev:simple:setup
```

### Port conflicts:
- Backend default: 4000
- Frontend default: 5173
- PostgreSQL: 5432
- Redis: 6379
- Weaviate: 8081

Check for conflicts with: `lsof -i :PORT_NUMBER`
