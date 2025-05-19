# TestOps Companion

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=flat&logo=docker&logoColor=white)](https://www.docker.com/)
[![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/react-%2320232a.svg?style=flat&logo=react&logoColor=%2361DAFB)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/node.js-6DA55F?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)

TestOps Companion is a comprehensive test automation management platform that helps QA teams and developers manage their test pipelines, monitor results, and maintain quality metrics across their development lifecycle.

## Architecture

### System Overview
```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Frontend     │     │     Backend     │     │    External     │
│   (React SPA)   │────▶│  (Node.js API)  │────▶│    Services    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                      │                        │
         │                      │                        │
         ▼                      ▼                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    WebSocket    │     │    Database     │     │     Jenkins     │
│  Notifications  │     │   (Postgres)    │     │  GitHub Actions │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Component Architecture

#### Frontend Layer
- **React SPA**: Single-page application built with React 18 and TypeScript
- **State Management**: React Query for server state, Zustand for local state
- **UI Framework**: Material UI with custom theme
- **Real-time Updates**: WebSocket connection for live notifications
- **Testing**: Vitest + React Testing Library

#### Backend Layer
- **API Server**: Express.js with TypeScript
- **Database ORM**: Prisma with PostgreSQL
- **Authentication**: JWT-based auth with refresh tokens
- **Caching**: Redis for session and response caching
- **Monitoring**: Prometheus + Grafana dashboards

#### Infrastructure
- **Containerization**: Docker with multi-stage builds
- **Load Balancing**: Nginx with SSL termination
- **CI/CD**: GitHub Actions for automated testing and deployment
- **Monitoring**: Prometheus for metrics, Grafana for visualization

### Data Flow
1. **Authentication Flow**
   ```
   Client ─► Auth Request ─► Validate Credentials ─► Generate JWT ─► Return Token
      ▲                                                                  │
      └──────────────────── Store Token ◄────────────────────────────────┘
   ```

2. **Test Pipeline Flow**
   ```
   Pipeline Trigger ─► Queue Job ─► Execute Tests ─► Collect Results ─► Store Data
         │                                                   │
         └───────────────► Send Notifications ◄──────────────┘
   ```

### Security Measures
- JWT-based authentication
- Rate limiting on API endpoints
- CORS configuration
- Helmet.js security headers
- Input validation with Zod
- SQL injection prevention with Prisma
- XSS protection
- CSRF tokens

## Quick Start

### Prerequisites
- Node.js 18.x or higher
- npm 9.x or higher
- Docker and Docker Compose
- Git

### Installation Steps

1. Clone the repository:
```bash
git clone https://github.com/rayalon1984/testops-companion.git
cd testops-companion
```

2. Install global dependencies:
```bash
npm install -g typescript ts-node
```

3. Set up environment files:
```bash
# Copy environment templates
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Configure required settings:
# backend/.env:
# - JWT_SECRET (required for authentication)
# - DATABASE_URL (if using custom database)
# - GITHUB_API_TOKEN (for GitHub integration)
# frontend/.env:
# - VITE_API_URL (if using different port)
```

4. Install project dependencies:
```bash
# Install backend dependencies including:
# - @octokit/rest (for GitHub integration)
# - tsconfig-paths (for module resolution)
cd backend && npm install
cd ..

# Install frontend dependencies
cd frontend && npm install
cd ..
```

5. Ensure prerequisites:
```bash
# Verify Docker is running
docker ps

# Start database container
docker-compose up -d db
```

6. Run the automated setup:
```bash
npm run setup
```

7. Start the development servers:
```bash
npm run dev
```

For detailed configuration options and troubleshooting, see the [Quick Start Guide](docs/quickstart.md).

The setup script will handle:
- Clean existing node_modules
- Install all dependencies (root, frontend, backend)
- Set up environment files
- Start database container and run migrations/seeds

Access the application:
- Frontend: http://localhost:5173
- API: http://localhost:3000
- API Documentation: http://localhost:3000/api/docs

Note: If any of these ports are already in use, see the [Quick Start Guide](docs/quickstart.md#port-conflicts) for instructions on changing ports.

### Troubleshooting Setup

If you encounter issues during setup:

1. **Port Conflicts**: See [Port Configuration Guide](docs/quickstart.md#port-conflicts)
2. **Database Issues**: See [Database Troubleshooting](docs/quickstart.md#database-setup-issues)
3. **Seed Script Errors**: See [Seed Troubleshooting](docs/quickstart.md#seed-script-errors)

The setup process includes automatic retries for database operations. For manual intervention:
```bash
# Retry database initialization
npm run db:init

# Complete database reset if needed
docker-compose down
rm -rf backend/prisma/migrations
npm run setup:db
```

For more detailed troubleshooting steps, see the [Quick Start Guide](docs/quickstart.md#troubleshooting).

## Documentation

- [Quick Start Guide](docs/quickstart.md)
- [API Documentation](docs/api.md)
- [Development Guide](docs/development.md)
- [Deployment Guide](docs/deployment.md)
- [Contributing Guide](CONTRIBUTING.md)

## Features

- Pipeline Management
  - Jenkins integration
  - GitHub Actions integration
  - Custom CI/CD support
- Test Execution
  - Real-time monitoring
  - Test result analysis
  - Coverage tracking
- Notifications
  - Slack integration
  - Email notifications
  - Custom notification rules
- Analytics
  - Performance metrics
  - Quality trends
  - Team dashboards

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## Support

- Documentation: [docs/README.md](docs/README.md)
- Issues: [GitHub Issues](https://github.com/rayalon1984/testops-companion/issues)
- Contact: rayalon@gmail.com

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.