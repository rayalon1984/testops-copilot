# TestOps Companion

A comprehensive test operations companion for managing test pipelines and results.

## Features

- Pipeline management for various CI/CD systems (GitHub Actions, Jenkins)
- Test run tracking and analysis
- Failure analysis and trend reporting
- Integrations with issue tracking systems (Jira)
- Notification system (Email, Slack)
- User authentication and authorization

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm (v9 or higher)
- PostgreSQL (v14 or higher)

### Installation

The project includes a comprehensive setup script that handles all dependencies and database setup:

```bash
# Clone the repository
git clone https://github.com/rayalon1984/testops-companion.git
cd testops-companion

# Run the setup script
npm run setup
```

The setup script performs the following actions:
1. Cleans any existing node_modules directories
2. Installs all dependencies (root, frontend, backend)
3. Sets up environment files with guided prompts
4. Creates and configures the database

### Manual Setup

If you prefer to set up manually:

1. Install dependencies:
   ```bash
   npm install
   cd frontend && npm install
   cd ../backend && npm install
   ```

2. Create `.env` files in both frontend and backend directories (use the `.env.example` files as templates)

3. Set up the database:
   ```bash
   cd backend
   npx prisma generate
   npx prisma migrate deploy
   ```

## Development

Start the development servers:

```bash
# Start both frontend and backend
npm run dev

# Start only backend
npm run dev:backend

# Start only frontend
npm run dev:frontend
```

## Integrations

### Jira Integration

TestOps Companion integrates with Jira to provide seamless issue tracking and test result management. See [Jira Integration Documentation](docs/integrations/jira.md) for details.

Key features:
- Create Jira issues from failed test runs
- Link test runs to existing Jira issues
- Synchronize test status with Jira
- View Jira issue details within TestOps Companion

#### Configuration

Add the following to your `backend/.env`:

```env
# Jira Configuration
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_API_TOKEN=your-api-token
JIRA_PROJECT_KEY=PROJ
JIRA_DEFAULT_ISSUE_TYPE=Bug
JIRA_DEBUG=false
```

### GitHub Integration

TestOps Companion integrates with GitHub to trigger and monitor workflows:

```env
# GitHub Configuration
GITHUB_TOKEN=your-github-token
GITHUB_API_URL=https://api.github.com
GITHUB_WEBHOOK_SECRET=your-webhook-secret
```

## Project Structure

```
testops-companion/
├── backend/             # Backend API server
│   ├── prisma/          # Database schema and migrations
│   ├── scripts/         # Setup and utility scripts
│   └── src/             # Source code
│       ├── controllers/ # API controllers
│       ├── middleware/  # Express middleware
│       ├── routes/      # API routes
│       ├── services/    # Business logic
│       ├── types/       # TypeScript type definitions
│       └── utils/       # Utility functions
├── frontend/            # React frontend application
│   ├── public/          # Static assets
│   └── src/             # Source code
│       ├── components/  # React components
│       ├── contexts/    # React contexts
│       ├── hooks/       # Custom React hooks
│       └── pages/       # Page components
├── docs/                # Documentation
└── scripts/             # Project-level scripts
```

## Contributing               

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Developed by `Rotem Ayalon`
