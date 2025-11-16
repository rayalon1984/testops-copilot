# TestOps Companion Documentation

Welcome to the TestOps Companion documentation. This guide will help you understand, install, and use TestOps Companion effectively.

## 📚 Table of Contents

### Getting Started
- [Quick Start Guide](quickstart.md) - Get up and running quickly
- [Installation Guide](deployment.md) - Detailed installation instructions
- [FAQ](faq.md) - Frequently asked questions

### Architecture & Design
- [Architecture Overview](architecture.md) - System architecture and design
- [Project Structure](project-structure.md) - Codebase organization
- [Database Schema](database.md) - Database design and relationships

### Development
- [Development Guide](development.md) - Guide for developers
- [Contributing Guide](../CONTRIBUTING.md) - How to contribute
- [Code of Conduct](../CODE_OF_CONDUCT.md) - Community guidelines
- [Testing Guide](testing.md) - Testing practices and procedures

### API & Integration
- [API Documentation](api.md) - REST API reference
- [Jira Integration](integrations/jira.md) - Jira ticket creation and tracking
- [Monday.com Integration](integrations/monday.md) - Monday.com Work OS integration
- [Grafana Integration](integrations/grafana.md) - Prometheus metrics and Grafana dashboards
- [Authentication](authentication.md) - Authentication and authorization

### Operations
- [Deployment Guide](deployment.md) - Deployment instructions
- [Monitoring Guide](monitoring.md) - Monitoring and logging
- [Security Guide](security.md) - Security best practices
- [Performance Guide](performance.md) - Performance optimization

### Features
- [Failure Knowledge Base](features/FAILURE_KNOWLEDGE_BASE.md) - RCA documentation and intelligent failure matching

### User Guides
- [Pipeline Management](guides/pipelines.md) - Managing test pipelines
- [Test Execution](guides/test-execution.md) - Running and managing tests
- [Notifications](guides/notifications.md) - Setting up notifications
- [Dashboard](guides/dashboard.md) - Using the dashboard
- [Reports](guides/reports.md) - Generating and viewing reports

### Reference
- [Configuration](reference/configuration.md) - Configuration options
- [Environment Variables](reference/environment-variables.md) - Available environment variables
- [CLI Commands](reference/cli-commands.md) - Command line interface
- [Error Codes](reference/error-codes.md) - Error code reference

### Project Information
- [Changelog](../CHANGELOG.md) - Version history
- [Roadmap](../ROADMAP.md) - Future plans
- [License](../LICENSE) - Project license
- [Security Policy](../SECURITY.md) - Security information

## 🚀 Quick Links

### For Users
- [Installation](quickstart.md#installation)
- [First Steps](quickstart.md#first-steps)
- [Basic Usage](quickstart.md#basic-usage)
- [Troubleshooting](troubleshooting.md)
- [Support](faq.md#support)

### For Developers
- [Development Setup](development.md#development-environment-setup)
- [Coding Standards](development.md#coding-standards)
- [Testing](testing.md)
- [Contributing](../CONTRIBUTING.md)
- [API Reference](api.md)

### For Operations
- [Deployment Options](deployment.md)
- [Monitoring Setup](monitoring.md)
- [Security Guidelines](security.md)
- [Performance Tuning](performance.md)
- [Backup & Recovery](database.md#backup-and-recovery)

## 📦 Features

### Pipeline Management
- Create and manage test pipelines
- Configure pipeline settings
- Schedule test runs
- Monitor execution status
- View test results

### Test Execution
- Run tests manually
- Schedule automated runs
- View test results
- Analyze test coverage
- Track flaky tests

### Failure Knowledge Base
- Smart failure fingerprinting and matching
- Root Cause Analysis (RCA) documentation
- Automatic detection of recurring issues
- Instant lookup of similar past failures
- Knowledge retention across team changes
- 95% faster resolution for known issues

### Notifications
- Email notifications
- Slack integration
- Pushover alerts
- Custom notification rules
- Notification templates

### Dashboard & Reports
- Real-time dashboard
- Custom widgets
- Test result trends
- Performance metrics
- Custom reports

### Integrations

#### CI/CD Platforms
- Jenkins integration
- GitHub Actions

#### Work Management
- **Jira** - Automatic issue creation and tracking
- **Monday.com** - Work OS integration for task management

#### Monitoring & Observability
- **Grafana & Prometheus** - Real-time metrics visualization and alerting
  - Pre-built dashboards
  - 20+ test metrics
  - Custom alerting rules

#### Notifications
- Email notifications
- Slack integration
- Pushover alerts

## 🔧 Configuration

### Backend Configuration
```env
# Server
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/testops

# Authentication
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h
```

### Frontend Configuration
```env
# API
VITE_API_BASE_URL=http://localhost:3000/api/v1

# Features
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_NOTIFICATIONS=true
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](../CONTRIBUTING.md) for details.

## 📝 License

This project is licensed under the Apache License 2.0 - see the [LICENSE](../LICENSE) file for details.

## 🆘 Support

- Documentation: [docs.testops-companion.com](https://docs.testops-companion.com)
- Discord: [discord.gg/testops-companion](https://discord.gg/testops-companion)
- GitHub Issues: [github.com/yourusername/testops-companion/issues](https://github.com/yourusername/testops-companion/issues)
- Email: support@testops-companion.com

## 🔄 Updates

Stay updated with the latest changes:
- Follow our [Changelog](../CHANGELOG.md)
- Check our [Roadmap](../ROADMAP.md)
- Join our [Newsletter](https://newsletter.testops-companion.com)
- Follow us on [Twitter](https://twitter.com/testops-companion)