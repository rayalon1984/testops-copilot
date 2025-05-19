# Quick Start Guide

Get started with TestOps Companion in minutes.

## Prerequisites

- Node.js 18.x or higher
- npm 9.x or higher
- Docker and Docker Compose (required for database)
- Git

## Environment Setup

Before installation, you'll need to configure the following:

### Backend Environment (.env)
Key configurations in `backend/.env`:
```env
# Required minimal configuration
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/testops
JWT_SECRET=your-super-secret-jwt-key
CORS_ORIGIN=http://localhost:5173
```

### Frontend Environment (.env)
Key configurations in `frontend/.env`:
```env
# Required minimal configuration
VITE_API_URL=http://localhost:3000
VITE_WEBSOCKET_URL=ws://localhost:3000
VITE_AUTH_PROVIDER=local
```

Full environment templates are available in `.env.example` files in both frontend and backend directories.

## Installation

### Using Docker (Recommended)

1. Clone the repository:
```bash
git clone https://github.com/rayalon1984/testops-companion.git
cd testops-companion
```

2. Copy environment files:
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

3. Start the application:
```bash
docker-compose up -d
```

4. Access the application:
- Frontend: http://localhost:5173
- API: http://localhost:3000
- API Documentation: http://localhost:3000/api/docs
- Adminer (Database UI): http://localhost:8080
- MailHog (Email Testing): http://localhost:8025

### Standard Installation

1. Clone and prepare the repository:
```bash
# Clone repository
git clone https://github.com/rayalon1984/testops-companion.git
cd testops-companion

# Install required global dependencies
npm install -g typescript ts-node
```

2. Set up environment files:
```bash
# Copy environment templates
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Edit the .env files with your settings
# Minimum required changes:
# - backend/.env: JWT_SECRET
# - backend/.env: DATABASE_URL (if using custom database)
```

3. Run the automated setup:
```bash
# This will:
# - Clean existing node_modules
# - Install all dependencies (root, frontend, backend)
# - Set up environment files
# - Start database container
# - Run database migrations and seeds
npm run setup
```

4. Start the development servers:
```bash
# Start both frontend and backend
npm run dev

# The application will be available at:
# - Frontend: http://localhost:5173
# - Backend API: http://localhost:3000
# - API Documentation: http://localhost:3000/api/docs
```

## First Steps

### 1. Create Admin Account

```bash
# Using the registration API
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "SecurePass123!",
    "firstName": "Admin",
    "lastName": "User",
    "role": "admin"
  }'
```

### 2. Configure External Services

#### Jenkins Integration
```env
# backend/.env
JENKINS_URL=http://your-jenkins-url
JENKINS_USERNAME=your-username
JENKINS_API_TOKEN=your-token
```

#### GitHub Integration
```env
# backend/.env
GITHUB_API_TOKEN=your-github-token
GITHUB_WEBHOOK_SECRET=your-webhook-secret
```

#### Notification Services
```env
# backend/.env
SLACK_WEBHOOK_URL=your-slack-webhook-url
SLACK_BOT_TOKEN=your-slack-bot-token

PUSHOVER_USER_KEY=your-pushover-user-key
PUSHOVER_APP_TOKEN=your-pushover-app-token
```

### 3. Create First Pipeline

1. Log in to the web interface
2. Navigate to Pipelines
3. Click "Create Pipeline"
4. Select pipeline type (Jenkins/GitHub Actions)
5. Configure pipeline settings
6. Save and test

Example pipeline configuration:
```json
{
  "name": "Test Pipeline",
  "type": "jenkins",
  "config": {
    "url": "http://jenkins.example.com",
    "credentials": {
      "username": "jenkins_user",
      "apiToken": "jenkins_token"
    },
    "repository": "owner/repo",
    "branch": "main"
  },
  "notifications": {
    "enabled": true,
    "channels": ["slack", "email"],
    "conditions": ["failure", "success"]
  }
}
```

### 4. Configure Notifications

1. Go to Settings → Notifications
2. Configure notification channels:
   - Email
   - Slack
   - Pushover
3. Set notification rules
4. Test notifications

### 5. View Dashboard

1. Navigate to Dashboard
2. Add widgets:
   - Pipeline Status
   - Test Results
   - Recent Runs
   - Success Rate
3. Customize layout

## Basic Usage

### Managing Pipelines

```bash
# Create pipeline
curl -X POST http://localhost:3000/api/v1/pipelines \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d @pipeline-config.json

# Run pipeline
curl -X POST http://localhost:3000/api/v1/pipelines/PIPELINE_ID/run \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get pipeline status
curl http://localhost:3000/api/v1/pipelines/PIPELINE_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Managing Test Runs

```bash
# Get test runs
curl http://localhost:3000/api/v1/test-runs \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get test run details
curl http://localhost:3000/api/v1/test-runs/TEST_RUN_ID \
  -H "Authorization: Bearer YOUR_TOKEN"

# Cancel test run
curl -X POST http://localhost:3000/api/v1/test-runs/TEST_RUN_ID/cancel \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Managing Notifications

```bash
# Update notification preferences
curl -X PUT http://localhost:3000/api/v1/notifications/preferences \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": {
      "enabled": true,
      "address": "user@example.com"
    },
    "slack": {
      "enabled": true,
      "channel": "#testing"
    }
  }'
```

## Next Steps

1. Read the [full documentation](docs/README.md)
2. Explore [API documentation](docs/api.md)
3. Set up [CI/CD integration](docs/ci-cd.md)
4. Configure [monitoring](docs/monitoring.md)
5. Join our [community](https://discord.gg/testops-companion)

## Common Issues

### Database Connection Failed
```
Error: ECONNREFUSED 127.0.0.1:5432
```
Solution: Ensure PostgreSQL is running and credentials are correct.

### Authentication Failed
```
Error: Invalid token
```
Solution: Check JWT configuration and token expiration.

### Pipeline Execution Failed
```
Error: Pipeline execution failed
```
Solution: Verify external service connectivity and credentials.

## Getting Help

- Documentation: docs.testops-companion.com
- Discord: discord.gg/testops-companion
- GitHub Issues: github.com/rayalon1984/testops-companion/issues
- Email: support@testops-companion.com

## Security Notes

1. Change default credentials
2. Use strong passwords
3. Keep secrets secure
4. Enable security features
5. Monitor access logs

## Maintenance

1. Regular backups
2. Monitor resources
3. Update dependencies
4. Check logs
5. Review metrics

## Troubleshooting

### Environment Variables

Important: Make sure these environment variables match exactly:
```env
# Authentication (in backend/.env)
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h
JWT_REFRESH_SECRET=your-refresh-secret-key
JWT_REFRESH_EXPIRES_IN=7d
```

If you encounter authentication errors, verify that:
1. Variable names match exactly (e.g., JWT_REFRESH_SECRET, not REFRESH_TOKEN_SECRET)
2. All required variables are present
3. Expiration times are in the correct format (e.g., '24h', '7d')

### TypeScript and Module Resolution

If you encounter TypeScript or module resolution errors:

1. Install required dependencies:
```bash
cd backend
npm install -g typescript ts-node
npm install tsconfig-paths
```

2. Verify tsconfig setup:
```bash
# Check if tsconfig.seed.json exists for database seeding
ls backend/prisma/tsconfig.seed.json

# If missing, create it:
cat > backend/prisma/tsconfig.seed.json << EOL
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "module": "CommonJS",
    "outDir": "../dist"
  },
  "include": [
    "seed.ts"
  ]
}
EOL
```

3. Restart TypeScript server:
```bash
# In VS Code:
# 1. Press Cmd+Shift+P (Mac) or Ctrl+Shift+P (Windows)
# 2. Type "TypeScript: Restart TS Server"
# 3. Press Enter
```

### GitHub Integration

If you encounter GitHub API errors:

1. Install required dependencies:
```bash
cd backend
npm install @octokit/rest
```

2. Verify GitHub configuration:
```bash
# Check GitHub token in backend/.env
GITHUB_API_TOKEN=your-token

# Test GitHub connection
curl -H "Authorization: Bearer $GITHUB_API_TOKEN" \
     https://api.github.com/user
```

3. Common GitHub issues:
- 401 Unauthorized: Check your token permissions
- 404 Not Found: Verify repository path and access
- Rate Limit: Use authenticated requests

### Missing Dependencies

If you encounter other module not found errors:

1. Install project dependencies:
```bash
# In the backend directory
cd backend
npm install

# Or in the root directory
npm run setup:backend
```

2. If specific modules are missing:
```bash
cd backend
npm install [module-name] @types/[module-name]
```

3. Restart the development servers:
```bash
# Stop the current process (Ctrl+C)
# Then restart:
npm run dev
```

### Database Setup Issues

If you encounter database-related errors during setup:

1. Ensure PostgreSQL container is running:
```bash
docker ps | grep testops-companion-db
```

2. Check database logs:
```bash
docker-compose logs db
```

3. If the seed fails, it will automatically retry once. If it still fails:
```bash
# Manually retry database initialization
npm run db:init
```

4. To completely reset the database:
```bash
docker-compose down
rm -rf backend/prisma/migrations
npm run setup:db
```

### Seed Script Errors

If you encounter TypeScript/Node.js related errors during seeding:

1. Ensure TypeScript dependencies are installed:
```bash
npm install -g typescript ts-node
```

2. Verify the seed configuration:
```bash
# Check if tsconfig.seed.json exists
ls backend/prisma/tsconfig.seed.json

# If missing, create it with:
cat > backend/prisma/tsconfig.seed.json << EOL
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "module": "CommonJS",
    "outDir": "../dist"
  },
  "include": [
    "seed.ts"
  ]
}
EOL
```

3. Try running the seed script directly:
```bash
cd backend
npm run prisma:generate
npm run seed
```

4. If issues persist, try manual seeding:
```bash
cd backend
npx prisma db seed
```


### Port Conflicts

If you encounter port conflicts, you can modify the ports in the environment files:

#### Backend Port (3000)
If port 3000 is already in use:
1. Edit `backend/.env`:
```env
PORT=3001  # or any available port
```
2. Update frontend configuration in `frontend/.env`:
```env
VITE_API_URL=http://localhost:3001
VITE_WEBSOCKET_URL=ws://localhost:3001
```

#### Frontend Port (5173)
If port 5173 is already in use:
1. Create or edit `frontend/.env.local`:
```env
VITE_PORT=5174  # or any available port
```
2. Update backend CORS configuration in `backend/.env`:
```env
CORS_ORIGIN=http://localhost:5174
```

#### Database Port (5432)
If port 5432 is already in use:
1. Edit `backend/.env`:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/testops  # change port to 5433
```
2. Update `docker-compose.yml` postgres service:
```yaml
ports:
  - "5433:5432"  # map host port 5433 to container port 5432
```

After changing any ports, restart the affected services:
```bash
# If changing backend/frontend ports
npm run dev

# If changing database port
docker-compose down
docker-compose up -d db
npm run db:migrate
npm run db:seed
```