# ⚡ QUICKSTART - Get Running in 5 Minutes

## Prerequisites (One-Time Setup)
1. **Install Docker Desktop**: https://www.docker.com/products/docker-desktop
2. **Start Docker Desktop** (make sure it's running)
3. **Have Node.js 18+** installed

## Setup Commands (Run Once)

```bash
# Run automated setup (handles dependencies, Docker, DB, everything)
npm run local:setup

# During setup, press Enter to skip optional integrations (GitHub, Jira)
# unless you need them
```

## Start Development

```bash
# Start both frontend + backend
npm run dev
```

**Done!** Open http://localhost:5173 to see your beautiful AI-powered dashboard! 🎨✨

---

## If Something Goes Wrong

### Docker not running?
```bash
# 1. Start Docker Desktop app
# 2. Wait for it to fully start
# 3. Run: npm run local:setup
```

### Port conflicts?
```bash
# Stop everything and restart
npm run local:stop
npm run local:start
npm run dev
```

### Want to start fresh?
```bash
npm run local:stop
rm -rf node_modules backend/node_modules frontend/node_modules
rm backend/.env frontend/.env
npm run local:setup
```

---

## What's Running?

- **Frontend**: http://localhost:5173 (Your beautiful dashboard)
- **Backend**: http://localhost:4000 (API server)
- **DB Admin**: http://localhost:8080 (View your data)
  - Server: `db`
  - Username: `postgres`
  - Password: `postgres`
  - Database: `testops`

---

## Daily Workflow

```bash
# Morning: Start Docker services
npm run local:start

# Start coding
npm run dev

# Evening: Stop Docker services (optional - saves battery)
npm run local:stop
```

That's it! See [LOCAL_SETUP.md](./LOCAL_SETUP.md) for detailed docs.
