# Quick Start Guide

Get started with TestOps Companion in minutes.

## Prerequisites

- Node.js 18.x or higher
- npm 9.x or higher
- Docker and Docker Compose (recommended)
- Git

## Quick Installation

### Using Docker (Recommended)

1. Clone the repository:
```bash
git clone https://github.com/yourusername/testops-companion.git
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

### Manual Installation

1. Clone and setup:
```bash
# Clone repository
git clone https://github.com/yourusername/testops-companion.git
cd testops-companion

# Install dependencies
npm run setup
```

2. Configure environment:
```bash
# Backend configuration
cp backend/.env.example backend/.env
# Edit backend/.env with your settings

# Frontend configuration
cp frontend/.env.example frontend/.env
# Edit frontend/.env with your settings
```

3. Start services:
```bash
# Start backend
cd backend
npm run dev

# Start frontend (new terminal)
cd frontend
npm start
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
- GitHub Issues: github.com/yourusername/testops-companion/issues
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