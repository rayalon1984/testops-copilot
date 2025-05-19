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

```bash
# 1. Clone the repository
git clone https://github.com/rayalon1984/testops-companion.git
cd testops-companion

# 2. Install global dependencies
npm install -g typescript ts-node

# 3. Run the automated setup script (this will handle everything including database)
npm run setup

# 4. Start the development servers
npm run dev
```

The setup script will automatically:
- Clean existing node_modules
- Install all dependencies (root, frontend, backend)
- Set up environment files
- Start database container and run migrations/seeds

Access the application:
- Frontend: http://localhost:5173
- API: http://localhost:3000
- API Documentation: http://localhost:3000/api/docs

Note: If any of these ports are already in use, see the [Quick Start Guide](docs/quickstart.md#port-conflicts) for instructions on changing ports.

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