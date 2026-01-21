# 🚀 Quick Start - Demo Mode (No Docker!)

**Want to see TestOps Companion in action? This takes 2 minutes.**

## Fresh Install (First Time)

```bash
# 1. Clone the repo
git clone https://github.com/rayalon1984/testops-companion.git
cd testops-companion

# 2. Install dependencies (this installs EVERYTHING automatically)
npm install

# 3. Start demo mode
npm run dev:simple
```

**That's it!** Open http://localhost:5173 in your browser.

## What You Get

- 150+ realistic test failures with AI analysis
- Beautiful dashboard with charts and metrics
- No Docker needed
- No database setup needed
- Perfect for demos and screenshots

## Already Have the Repo?

```bash
git pull origin main
npm install  # Make sure all dependencies are up to date
npm run dev:simple
```

## Troubleshooting

**"command not found" errors?**
```bash
# Run npm install again - it auto-installs backend and frontend
npm install
npm run dev:simple
```

**Port already in use?**
```bash
# Kill processes on ports 4000 and 5173
lsof -ti:4000 | xargs kill -9
lsof -ti:5173 | xargs kill -9
npm run dev:simple
```

**Need production mode with Docker?**
See [DEV_MODE.md](./DEV_MODE.md) for `npm run dev` with PostgreSQL/Redis/Weaviate.

---

**Next Steps**: Check out [DEV_MODE.md](./DEV_MODE.md) for full documentation on both demo and production modes.
