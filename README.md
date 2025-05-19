# TestOps Companion

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=flat&logo=docker&logoColor=white)](https://www.docker.com/)
[![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/react-%2320232a.svg?style=flat&logo=react&logoColor=%2361DAFB)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/node.js-6DA55F?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)

TestOps Companion is a powerful web application designed to streamline QA and automation workflows. It helps QA leads, testers, and engineers manage test pipelines, monitor results, and maintain quality metrics across their development lifecycle.

## 🎯 Features

- **Pipeline Management**
  - Define and schedule automated test pipelines
  - Integration with Jenkins and GitHub Actions
  - Real-time pipeline status monitoring

- **Smart Notifications**
  - Configurable alerts via Pushover, Slack, and Email
  - Customizable notification rules and thresholds
  - Team-wide notification management

- **Test Analytics**
  - Track flaky tests and test coverage
  - Monitor bug open/fix ratios
  - E2E test readiness tracking
  - Regression analysis

- **Documentation**
  - Auto-generate test plans
  - Release readiness reports
  - Confluence integration

- **Dashboard**
  - Real-time test status overview
  - Team performance metrics
  - Quality trend analysis
  - Customizable widgets

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Docker and Docker Compose (optional)
- PostgreSQL (if not using Docker)

### Quick Start with Docker

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
- Backend API: http://localhost:3000
- API Documentation: http://localhost:3000/api/docs
- Adminer (Database UI): http://localhost:8080
- MailHog (Email Testing): http://localhost:8025

### Local Development Setup

1. Install dependencies:
```bash
npm run setup
```

2. Start the backend:
```bash
cd backend
npm run dev
```

3. Start the frontend:
```bash
cd frontend
npm start
```

## 📖 Documentation

- [Architecture Overview](docs/architecture.md)
- [API Documentation](docs/api.md)
- [Contributing Guide](CONTRIBUTING.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security Policy](SECURITY.md)

## 🧪 Testing

```bash
# Run all tests
npm test

# Run backend tests
npm run test:backend

# Run frontend tests
npm run test:frontend

# Run E2E tests
npm run test:e2e
```

## 🔧 Configuration

### Backend Environment Variables

Key environment variables for backend configuration:

- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret key for JWT tokens
- `CORS_ORIGIN`: Allowed frontend origin
- See [backend/.env.example](backend/.env.example) for all options

### Frontend Environment Variables

Key environment variables for frontend configuration:

- `VITE_API_BASE_URL`: Backend API URL
- `VITE_AUTH_STORAGE_KEY`: Local storage key for auth
- See [frontend/.env.example](frontend/.env.example) for all options

## 🛠️ Tech Stack

### Frontend
- React with TypeScript
- Material UI / Tailwind CSS
- React Query
- Vite
- Vitest & Cypress

### Backend
- Node.js with Express
- TypeScript
- PostgreSQL with Sequelize
- Jest for testing

### DevOps
- Docker & Docker Compose
- GitHub Actions
- Jenkins integration

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details about:
- Code of conduct
- Development process
- How to submit pull requests
- Coding standards

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- All our contributors and community members
- Open source projects that made this possible
- QA community for valuable feedback and suggestions

## 📞 Support

- GitHub Issues: For bug reports and feature requests
- Email: support@yourdomain.com
- Documentation: Check our [wiki](docs/wiki.md)

## 🔮 Future Plans

- Enterprise version with advanced features
- Additional CI/CD integrations
- Machine learning for test failure prediction
- Mobile app development
- Plugin marketplace

---

Made with ❤️ by the TestOps Companion Team