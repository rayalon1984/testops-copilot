# Deployment Guide

> Updated for v3.5.0 | **Quick start**: [`docs/PRODUCTION_QUICKSTART.md`](PRODUCTION_QUICKSTART.md) | **Dev modes**: [`docs/DEV_MODE.md`](DEV_MODE.md) | **DevOps spec**: [`specs/team/DEVOPS_ENGINEER.md`](../specs/team/DEVOPS_ENGINEER.md)

This guide covers different deployment options for TestOps Copilot, from development to production environments.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Development Deployment](#development-deployment)
- [Docker Deployment](#docker-deployment)
- [Production Deployment](#production-deployment)
- [CI/CD Setup](#cicd-setup)
- [Monitoring Setup](#monitoring-setup)

## Prerequisites

### System Requirements
- Node.js 18.x or higher
- PostgreSQL 15.x
- Redis 7.x
- Docker & Docker Compose (optional)
- Nginx (for production)

### Required Access
- GitHub repository access
- CI/CD platform access (Jenkins/GitHub Actions/Azure DevOps)
- Cloud platform access (if deploying to cloud)
- Domain name and SSL certificates

## Development Deployment

1. Clone the repository:
```bash
git clone https://github.com/yourusername/testops-copilot.git
cd testops-copilot
```

2. Install dependencies:
```bash
npm run setup
```

3. Configure environment variables:
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# Edit .env files with your configuration
```

**Azure DevOps** (optional — set all three to enable):
```bash
AZDO_ORG_URL=https://dev.azure.com/your-org
AZDO_PAT=your-personal-access-token
AZDO_PROJECT=your-project-name
AZDO_TEAM=your-team-name  # optional, defaults to project default team
```

4. Start development servers:
```bash
# Start backend
cd backend
npm run dev

# Start frontend (new terminal)
cd frontend
npm run dev
```

## Docker Deployment

### Local Docker Deployment

1. Build and start containers:
```bash
docker-compose up -d
```

2. Monitor logs:
```bash
docker-compose logs -f
```

3. Stop containers:
```bash
docker-compose down
```

### Production Docker Deployment

See the **[Production Quickstart](PRODUCTION_QUICKSTART.md)** for the recommended path using pre-built images.

To build from source instead:

1. Configure production environment:
```bash
cp .env.production.example .env.production
# Edit .env.production: set POSTGRES_PASSWORD, JWT_SECRET, JWT_REFRESH_SECRET
```

2. Build and deploy with production configuration:
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

## Production Deployment

### Backend Deployment

1. Build the application:
```bash
cd backend
npm run build
```

2. Set up environment variables:
```bash
# Create production .env file
cp .env.example .env.production
# Edit with production values
```

3. Install PM2:
```bash
npm install -g pm2
```

4. Create PM2 ecosystem file:
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'testops-backend',
    script: 'dist/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env_production: {
      NODE_ENV: 'production'
    }
  }]
}
```

5. Start the application:
```bash
pm2 start ecosystem.config.js --env production
```

### Frontend Deployment

1. Build the application:
```bash
cd frontend
npm run build
```

2. Configure Nginx:
```nginx
# /etc/nginx/sites-available/testops-copilot
server {
    listen 80;
    server_name your-domain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Frontend
    location / {
        root /var/www/testops-copilot;
        try_files $uri $uri/ /index.html;
        expires -1;
        add_header Cache-Control "no-store, no-cache, must-revalidate";
    }

    # API proxy
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

3. Deploy frontend files:
```bash
sudo cp -r dist/* /var/www/testops-copilot/
```

## CI/CD Setup

### GitHub Actions

1. Create workflow file:
```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm ci
      - name: Run tests
        run: npm test
      - name: Build
        run: npm run build
      # Add deployment steps
```

### Jenkins Pipeline

1. Create Jenkinsfile:
```groovy
// Jenkinsfile
pipeline {
    agent any
    stages {
        stage('Build') {
            steps {
                sh 'npm ci'
                sh 'npm run build'
            }
        }
        stage('Test') {
            steps {
                sh 'npm test'
            }
        }
        stage('Deploy') {
            steps {
                // Add deployment steps
            }
        }
    }
}
```

## Monitoring Setup

### Application Monitoring

1. Set up Sentry:
```javascript
// Add to backend/src/config.ts
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV
});
```

2. Configure logging:
```javascript
// Add to backend/src/utils/logger.ts
winston.configure({
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});
```

### Server Monitoring

1. Install Prometheus and Grafana:
```bash
docker-compose -f docker-compose.monitoring.yml up -d
```

2. Configure metrics collection:
```javascript
// Add to backend/src/middleware/metrics.ts
const metrics = new Metrics();
app.use(metrics.collectMetrics);
```

### Health Checks

1. Implement health check endpoint:
```javascript
// Add to backend/src/routes/health.ts
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version
  });
});
```

2. Configure uptime monitoring:
```bash
# Set up Uptime Robot or similar service
curl -X POST "https://api.uptimerobot.com/v2/newMonitor" \
  -H "Content-Type: application/json" \
  -d '{
    "type": 1,
    "url": "https://your-domain.com/api/health",
    "friendly_name": "TestOps API"
  }'
```

## Backup Strategy

1. Database backups:
```bash
# Add to crontab
0 0 * * * pg_dump -U postgres testops > /backups/testops_$(date +\%Y\%m\%d).sql
```

2. Application backups:
```bash
# Add to crontab
0 0 * * * tar -czf /backups/testops_$(date +\%Y\%m\%d).tar.gz /var/www/testops-copilot
```

## SSL Certificate Setup

1. Install Certbot:
```bash
sudo apt-get install certbot python3-certbot-nginx
```

2. Generate certificate:
```bash
sudo certbot --nginx -d your-domain.com
```

3. Auto-renewal:
```bash
# Add to crontab
0 0 1 * * /usr/bin/certbot renew --quiet
```