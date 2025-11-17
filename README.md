# TestOps Companion

> A comprehensive test operations platform for managing CI/CD pipelines, tracking test results, and analyzing failures across your entire testing infrastructure.

[![CI](https://github.com/rayalon1984/testops-companion/actions/workflows/ci.yml/badge.svg)](https://github.com/rayalon1984/testops-companion/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](package.json)

## 📋 Table of Contents

- [Screenshots & Demo](#-screenshots--demo)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
- [Development](#-development)
- [Testing](#-testing)
- [Integrations](#-integrations)
- [Project Structure](#-project-structure)
- [API Documentation](#-api-documentation)
- [Contributing](#-contributing)
- [License](#-license)

## 📸 Screenshots & Demo

Want to see TestOps Companion in action? Check out our **[Visual Demo Guide](DEMO.md)** with:
- 🎨 Interactive UI mockups using Mermaid diagrams
- 📊 Dashboard and analytics visualizations
- 🔍 Failure Knowledge Base in action
- 📚 RCA documentation workflow
- 🎬 User journey flows and scenarios

**[View Demo & Screenshots →](DEMO.md)**

## ✨ Features

### Core Capabilities

- **🔄 Multi-Pipeline Management**
  - Support for GitHub Actions, Jenkins, and custom CI/CD systems
  - Real-time pipeline status monitoring
  - Automated test run tracking and historical analysis

- **📊 Advanced Test Analytics**
  - Comprehensive test run tracking and visualization
  - Failure analysis with trends and patterns
  - Flaky test detection and reporting
  - Performance metrics and regression tracking

- **🔍 Intelligent Failure Analysis**
  - Automatic failure categorization
  - Root cause analysis suggestions
  - Historical failure pattern matching
  - Log aggregation and smart search

- **📚 Failure Knowledge Base & RCA Archive**
  - Smart failure fingerprinting with exact, fuzzy, and pattern matching
  - Root Cause Analysis (RCA) documentation and archiving
  - Automatic detection of recurring issues and patterns
  - Instant lookup of similar past failures with documented solutions
  - Knowledge retention: Never lose institutional knowledge when team members leave
  - 95% faster resolution for known issues

- **🔗 Powerful Integrations**
  - **Jira**: Automatic issue creation and synchronization
  - **Monday.com**: Work OS integration for task management
  - **Grafana & Prometheus**: Metrics visualization and alerting
  - **GitHub**: Workflow triggers and status updates
  - **Slack**: Real-time notifications and alerts
  - **Email**: Customizable notification templates
  - **Pushover**: Mobile push notifications

- **👥 User Management**
  - Role-based access control (Admin, Developer, Viewer)
  - JWT-based authentication
  - User preferences and notification settings
  - Team collaboration features

- **⚡ Real-time Updates**
  - WebSocket-based live updates
  - Dashboard auto-refresh
  - Live test execution monitoring

## 🛠 Tech Stack

### Backend
- **Runtime**: Node.js 18+ with TypeScript
- **Framework**: Express.js with Helmet security
- **Database**: PostgreSQL 14+ with Prisma ORM
- **Authentication**: JWT with refresh tokens
- **Validation**: Zod schema validation
- **Testing**: Jest with supertest
- **Logging**: Winston

### Frontend
- **Framework**: React 18 with TypeScript
- **UI Library**: Material-UI (MUI) v5
- **State Management**: Zustand
- **Data Fetching**: TanStack Query (React Query)
- **Charts**: Chart.js with react-chartjs-2
- **Forms**: React Hook Form with Zod validation
- **Testing**: Vitest with Testing Library
- **Build Tool**: Vite

### DevOps
- **Containerization**: Docker with multi-stage builds
- **CI/CD**: GitHub Actions
- **Linting**: ESLint with TypeScript rules
- **Code Quality**: Prettier, Husky pre-commit hooks

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **PostgreSQL**: v14.0 or higher
- **Redis** (optional): For caching and session management

### Quick Setup (Recommended)

The automated setup script handles all installation and configuration:

```bash
# Clone the repository
git clone https://github.com/rayalon1984/testops-companion.git
cd testops-companion

# Run the automated setup
npm run setup
```

The setup script will:
1. Clean any existing installations
2. Install all dependencies (root, frontend, backend)
3. Guide you through environment configuration
4. Set up and migrate the PostgreSQL database
5. Generate Prisma client

### Manual Setup

If you prefer manual configuration:

#### 1. Install Dependencies

```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install
```

#### 2. Configure Environment Variables

Create `.env` files in both backend and frontend directories:

**Backend** (`backend/.env`):
```env
# Server Configuration
NODE_ENV=development
PORT=3000
HOST=localhost

# Database
DATABASE_URL=postgresql://testops:testops@localhost:5432/testops_companion

# Authentication
JWT_SECRET=your-secret-key-here
JWT_REFRESH_SECRET=your-refresh-secret-here
JWT_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# CORS
CORS_ORIGIN=http://localhost:5173

# Optional Integrations
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_API_TOKEN=your-jira-token
GITHUB_TOKEN=your-github-token
SLACK_WEBHOOK_URL=your-slack-webhook
```

**Frontend** (`frontend/.env`):
```env
VITE_API_URL=http://localhost:3000/api
VITE_WS_URL=ws://localhost:3000
```

#### 3. Database Setup

```bash
cd backend

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# (Optional) Seed the database
npx prisma db seed
```

#### 4. Verify Installation

```bash
# Run linting
npm run lint

# Run type checking
npm run typecheck

# Run tests
npm run test
```

## 💻 Development

### Starting Development Servers

```bash
# Start both frontend and backend concurrently
npm run start

# Or start individually:
npm run start:backend    # Backend on http://localhost:3000
npm run start:frontend   # Frontend on http://localhost:5173
```

### Development Commands

```bash
# Linting
npm run lint              # Lint both frontend and backend
npm run lint:backend      # Lint backend only
npm run lint:frontend     # Lint frontend only

# Type Checking
npm run typecheck         # Type check both projects
npm run typecheck:backend # Type check backend
npm run typecheck:frontend # Type check frontend

# Building
npm run build             # Build both projects
npm run build:backend     # Build backend
npm run build:frontend    # Build frontend

# Database Management
cd backend
npm run db:migrate        # Run migrations
npm run db:generate       # Generate Prisma client
npm run db:seed           # Seed database
npm run db:studio         # Open Prisma Studio
npm run db:reset          # Reset database (caution!)
```

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm run test

# Backend tests
npm run test:backend
npm run test:backend -- --watch      # Watch mode
npm run test:backend -- --coverage   # With coverage

# Frontend tests
npm run test:frontend
npm run test:frontend -- --watch     # Watch mode
npm run test:frontend -- --coverage  # With coverage
npm run test:frontend -- --ui        # UI mode
```

### Test Configuration

- **Backend**: Jest with ts-jest preset
  - Configuration: `backend/jest.config.js`
  - Tests: `backend/src/**/*.test.ts`

- **Frontend**: Vitest with jsdom environment
  - Configuration: `frontend/vitest.config.ts`
  - Tests: `frontend/src/**/*.test.{ts,tsx}`
  - Setup: `frontend/src/test/setup.ts`

## 🔗 Integrations

### Jira Integration

Seamlessly integrate with Jira for issue tracking and test management.

**Features:**
- Automatic issue creation from failed tests
- Link test runs to existing issues
- Bi-directional status synchronization
- Custom field mapping

**Configuration:**
```env
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your-api-token
JIRA_PROJECT_KEY=PROJ
JIRA_DEFAULT_ISSUE_TYPE=Bug
```

📖 [Full Jira Integration Guide](docs/integrations/jira.md)

### Monday.com Integration

Integrate with Monday.com Work OS to manage test failures and track issues.

**Features:**
- Automatic item creation from test failures
- Add detailed failure information as updates
- Search and link similar issues
- Bi-directional sync with test status

**Configuration:**
```env
MONDAY_API_TOKEN=your_monday_api_token
MONDAY_BOARD_ID=123456789                    # Optional: Default board
MONDAY_WORKSPACE_ID=987654321                # Optional: Workspace
```

📖 [Full Monday.com Integration Guide](docs/integrations/monday.md)

### TestRail Integration

Integrate with TestRail test case management system for automated test result synchronization.

**Features:**
- Automatic test run creation in TestRail
- Sync test results (pass/fail status, execution time, errors)
- Link test executions to test cases
- Support for test suites, milestones, and projects
- Bi-directional test case mapping

**Configuration:**
```env
TESTRAIL_BASE_URL=https://your-company.testrail.io
TESTRAIL_USERNAME=your-email@example.com
TESTRAIL_API_KEY=your-api-key
TESTRAIL_PROJECT_ID=1                             # Optional: Default project
```

📖 [Full TestRail Integration Guide](docs/integrations/testrail.md)

### Grafana & Prometheus Integration

Visualize test metrics and set up alerts with industry-standard monitoring tools.

**Features:**
- Prometheus metrics endpoint at `/metrics`
- Pre-built Grafana dashboards
- Real-time test metrics visualization
- Custom alerting rules
- Performance tracking and analysis

**Configuration:**
```bash
# Metrics are automatically exposed at:
http://localhost:3000/metrics

# Configure Prometheus to scrape metrics
# See docs/integrations/grafana.md for setup
```

**Metrics Exposed:**
- Test run counts and rates
- Pass/fail percentages
- Execution time percentiles
- RCA coverage statistics
- Integration metrics (Jira, Monday, notifications)

📖 [Full Grafana Integration Guide](docs/integrations/grafana.md)

### GitHub Integration

Trigger and monitor GitHub Actions workflows directly from TestOps Companion.

**Features:**
- Workflow triggering
- Status monitoring
- PR status checks integration
- Commit status updates

**Configuration:**
```env
GITHUB_TOKEN=ghp_your_personal_access_token
GITHUB_API_URL=https://api.github.com
GITHUB_WEBHOOK_SECRET=your-webhook-secret
```

### Notification Integrations

**Slack:**
```env
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

**Email (SMTP):**
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=TestOps Companion <noreply@example.com>
```

**Pushover:**
```env
PUSHOVER_USER_KEY=your-user-key
PUSHOVER_API_TOKEN=your-api-token
```

## 📁 Project Structure

```
testops-companion/
├── backend/                    # Backend API server
│   ├── prisma/
│   │   ├── schema.prisma      # Database schema
│   │   ├── migrations/        # Database migrations
│   │   └── seed.ts            # Database seeding
│   ├── scripts/
│   │   └── db-setup.js        # Database setup script
│   ├── src/
│   │   ├── controllers/       # Route controllers
│   │   ├── middleware/        # Express middleware
│   │   │   ├── auth.ts        # Authentication middleware
│   │   │   ├── errorHandler.ts
│   │   │   └── validation.ts  # Request validation
│   │   ├── routes/            # API routes
│   │   ├── services/          # Business logic
│   │   │   ├── github.service.ts
│   │   │   ├── jenkins.service.ts
│   │   │   ├── jira.service.ts
│   │   │   └── notification.service.ts
│   │   ├── types/             # TypeScript definitions
│   │   ├── utils/             # Utility functions
│   │   ├── config.ts          # Configuration
│   │   └── index.ts           # Entry point
│   ├── jest.config.js         # Jest configuration
│   ├── tsconfig.json          # TypeScript config
│   └── package.json
│
├── frontend/                   # React frontend
│   ├── public/                # Static assets
│   ├── src/
│   │   ├── components/        # Reusable components
│   │   │   ├── ConfirmDialog/
│   │   │   ├── FormField/
│   │   │   ├── LogViewer/
│   │   │   ├── NotificationBadge/
│   │   │   ├── PageHeader/
│   │   │   └── SearchField/
│   │   ├── contexts/          # React contexts
│   │   ├── hooks/             # Custom hooks
│   │   ├── pages/             # Page components
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Login.tsx
│   │   │   ├── PipelineList.tsx
│   │   │   ├── PipelineDetail.tsx
│   │   │   ├── TestRunList.tsx
│   │   │   ├── TestRunDetail.tsx
│   │   │   ├── Settings.tsx
│   │   │   └── NotificationList.tsx
│   │   ├── services/          # API clients
│   │   ├── test/              # Test utilities
│   │   │   ├── setup.ts       # Test setup
│   │   │   └── vitest.d.ts    # Type definitions
│   │   ├── types/             # TypeScript definitions
│   │   ├── utils/             # Utility functions
│   │   ├── App.tsx            # Root component
│   │   └── main.tsx           # Entry point
│   ├── vitest.config.ts       # Vitest configuration
│   ├── tsconfig.json          # TypeScript config
│   └── package.json
│
├── docs/                       # Documentation
│   ├── api/                   # API documentation
│   ├── integrations/          # Integration guides
│   └── setup/                 # Setup guides
│
├── scripts/                    # Project scripts
│   └── setup-env.js           # Environment setup
│
├── .github/
│   └── workflows/
│       ├── ci.yml             # Continuous Integration
│       ├── dependencies.yml   # Dependency management
│       └── release.yml        # Release automation
│
├── docker-compose.yml         # Docker composition
├── package.json               # Root package.json
└── README.md                  # This file
```

## 📚 API Documentation

### Authentication Endpoints

```
POST   /api/auth/register     # Register new user
POST   /api/auth/login        # Login
POST   /api/auth/refresh      # Refresh access token
POST   /api/auth/logout       # Logout
GET    /api/auth/me           # Get current user
```

### Pipeline Endpoints

```
GET    /api/pipelines         # List all pipelines
POST   /api/pipelines         # Create pipeline
GET    /api/pipelines/:id     # Get pipeline details
PUT    /api/pipelines/:id     # Update pipeline
DELETE /api/pipelines/:id     # Delete pipeline
POST   /api/pipelines/:id/trigger  # Trigger pipeline
```

### Test Run Endpoints

```
GET    /api/test-runs         # List test runs
POST   /api/test-runs         # Create test run
GET    /api/test-runs/:id     # Get test run details
PUT    /api/test-runs/:id     # Update test run
GET    /api/test-runs/:id/logs # Get test logs
```

### Notification Endpoints

```
GET    /api/notifications     # List notifications
POST   /api/notifications     # Create notification
PUT    /api/notifications/:id # Mark as read
DELETE /api/notifications/:id # Delete notification
```

### Failure Archive Endpoints

```
POST   /api/v1/failure-archive                  # Create failure entry
PUT    /api/v1/failure-archive/:id/document-rca # Document root cause analysis
GET    /api/v1/failure-archive/:id              # Get failure by ID
GET    /api/v1/failure-archive/search           # Search failures with filters
POST   /api/v1/failure-archive/find-similar     # Find similar past failures
GET    /api/v1/failure-archive/insights         # Get statistics and analytics
PUT    /api/v1/failure-archive/:id/resolve      # Mark failure as resolved
POST   /api/v1/failure-archive/detect-patterns  # Detect recurring patterns
```

📖 For complete API documentation, see [API Reference](docs/api/README.md)
📚 For Failure Knowledge Base documentation, see [Feature Guide](docs/features/FAILURE_KNOWLEDGE_BASE.md)

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. **Fork the repository**
   ```bash
   git fork https://github.com/rayalon1984/testops-companion.git
   ```

2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```

3. **Make your changes**
   - Write tests for new features
   - Ensure all tests pass
   - Follow the existing code style
   - Update documentation as needed

4. **Commit your changes**
   ```bash
   git commit -m 'feat: add amazing feature'
   ```

   We follow [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` New features
   - `fix:` Bug fixes
   - `docs:` Documentation changes
   - `style:` Code style changes
   - `refactor:` Code refactoring
   - `test:` Test changes
   - `chore:` Build process or auxiliary tool changes

5. **Push to your fork**
   ```bash
   git push origin feature/amazing-feature
   ```

6. **Open a Pull Request**

### Development Guidelines

- **Code Style**: We use ESLint and Prettier for consistent code formatting
- **Testing**: All new features must include tests
- **Type Safety**: Maintain strict TypeScript typing
- **Documentation**: Update docs for any API or feature changes
- **Commits**: Use conventional commit messages

### Running Quality Checks

Before submitting a PR, ensure all checks pass:

```bash
npm run lint           # Linting
npm run typecheck      # Type checking
npm run test           # All tests
npm run build          # Build verification
```

## 📄 License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

Apache License 2.0 is a permissive open source license that:
- ✅ Allows commercial use
- ✅ Allows modification and distribution
- ✅ Includes patent grant for protection
- ✅ Requires preserving copyright and license notices
- ✅ Provides clear terms for contributions

## 👨‍💻 Author

**Rotem Ayalon**

- GitHub: [@rayalon1984](https://github.com/rayalon1984)

## 🙏 Acknowledgments

- Built with [Express.js](https://expressjs.com/) and [React](https://react.dev/)
- UI components from [Material-UI](https://mui.com/)
- Database ORM by [Prisma](https://www.prisma.io/)
- State management with [Zustand](https://github.com/pmndrs/zustand)
- Data fetching with [TanStack Query](https://tanstack.com/query)

---

**⭐ If you find this project useful, please consider giving it a star!**

For questions, issues, or feature requests, please [open an issue](https://github.com/rayalon1984/testops-companion/issues).
