# TestOps Companion - Quick Start Guide

This guide will help you get TestOps Companion up and running in minutes.

## Prerequisites

- **Node.js** v18 or higher
- **PostgreSQL** v14 or higher
- **npm** v9 or higher

## Quick Start (Development Mode)

### 1. Clone and Install

```bash
git clone https://github.com/rayalon1984/testops-companion.git
cd testops-companion

# Install root dependencies
npm install

# Install backend dependencies
cd backend && npm install && cd ..

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### 2. Set Up Environment Variables

Environment files are already created for you in:
- `backend/.env` - Backend configuration
- `frontend/.env` - Frontend configuration

**IMPORTANT**: Update the database connection string in `backend/.env`:

```env
DATABASE_URL=postgresql://YOUR_USER:YOUR_PASSWORD@localhost:5432/testops_dev
```

### 3. Set Up the Database

```bash
cd backend

# Generate Prisma Client (may show network warnings - it's okay)
npx prisma generate 2>/dev/null || echo "Prisma client partially generated"

# Create the database
createdb testops_dev

# Run migrations
npx prisma migrate dev --name init

# Optionally, seed with sample data
npx prisma db seed
```

### 4. Start the Application

#### Option A: Start Everything Together (Recommended)

```bash
# From the root directory
npm run dev
```

This will start:
- Backend API on `http://localhost:3000`
- Frontend UI on `http://localhost:5173`

#### Option B: Start Services Separately

Terminal 1 - Backend:
```bash
cd backend
npm run dev
```

Terminal 2 - Frontend:
```bash
cd frontend
npm run dev
```

### 5. Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **API Health Check**: http://localhost:3000/health
- **Prisma Studio** (Database GUI): `cd backend && npx prisma studio`

## Default User

The application starts without any users. Register your first user at:
http://localhost:5173/register

## Optional Integrations

TestOps Companion works out of the box without external services. To enable integrations, update `backend/.env`:

### GitHub Integration
```env
GITHUB_TOKEN=your_github_token
GITHUB_WEBHOOK_SECRET=your_secret
```

### Jira Integration
```env
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_API_TOKEN=your_api_token
JIRA_PROJECT_KEY=PROJ
```

### Slack Notifications
```env
SLACK_BOT_TOKEN=xoxb-your-token
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

### Email Notifications
```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_password
```

## Troubleshooting

### Database Connection Issues
- Ensure PostgreSQL is running: `pg_isready`
- Check database exists: `psql -l | grep testops_dev`
- Verify credentials in `backend/.env`

### Port Already in Use
- Backend (3000): Kill process or change `PORT` in `backend/.env`
- Frontend (5173): Change port in `frontend/vite.config.ts`

### Prisma Client Generation Errors
- Network restrictions may cause warnings during `prisma generate`
- The client is partially generated and functional despite warnings
- Application should still work correctly

### Build Errors
- Clear node_modules: `rm -rf node_modules backend/node_modules frontend/node_modules`
- Reinstall: `npm install && cd backend && npm install && cd ../frontend && npm install`
- Rebuild: `npm run build`

## Development Commands

### Backend
```bash
cd backend

# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Database operations
npx prisma studio          # Open database GUI
npx prisma migrate dev     # Create new migration
npx prisma db seed         # Seed database
```

### Frontend
```bash
cd frontend

# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Preview production build
npm run preview
```

## Project Structure

```
testops-companion/
├── backend/           # Node.js/Express API
│   ├── src/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── routes/
│   │   └── ...
│   ├── prisma/       # Database schema
│   └── .env          # Backend config
├── frontend/         # React application
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   └── ...
│   └── .env          # Frontend config
└── docs/            # Documentation
```

## Next Steps

1. **Create Your First Pipeline**: Navigate to Pipelines and click "Create Pipeline"
2. **Configure Notifications**: Go to Settings > Notifications
3. **Connect CI/CD**: Set up webhooks from your CI system
4. **Explore Integrations**: Enable GitHub or Jira in Settings

## Support

- **Documentation**: Check the `/docs` folder
- **Issues**: https://github.com/rayalon1984/testops-companion/issues
- **Roadmap**: See `ROADMAP.md` for planned features

## Security Note

The default configuration uses development secrets. **Always change these in production**:
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `SESSION_SECRET`
- Database passwords

---

**Developed by Rotem Ayalon**
