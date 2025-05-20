# Troubleshooting Guide

## Common Issues

### Environment Setup
- [Environment Configuration Guide](quickstart.md#environment-setup)
- [Port Conflicts](quickstart.md#port-conflicts)
- [Database Setup Issues](quickstart.md#database-setup-issues)

### Authentication
- [JWT Configuration](quickstart.md#authentication)
- [User Management](api.md#authentication-endpoints)
- [Session Handling](development.md#session-management)

### Pipeline Integration
- [GitHub Actions Setup](development.md#github-actions-integration)
- [Jenkins Configuration](development.md#jenkins-integration)
- [Custom Pipeline Setup](development.md#custom-pipelines)

## Support Resources

### Documentation
- [API Documentation](https://github.com/rayalon1984/testops-companion/blob/main/docs/api.md)
- [Architecture Guide](https://github.com/rayalon1984/testops-companion/blob/main/docs/architecture.md)
- [Deployment Guide](https://github.com/rayalon1984/testops-companion/blob/main/docs/deployment.md)
- [Development Guide](https://github.com/rayalon1984/testops-companion/blob/main/docs/development.md)

### Issue Tracking
- [GitHub Issues](https://github.com/rayalon1984/testops-companion/issues)
- [Bug Report Template](https://github.com/rayalon1984/testops-companion/issues/new?template=bug_report.md)
- [Feature Request Template](https://github.com/rayalon1984/testops-companion/issues/new?template=feature_request.md)

### Community
- [Discord Server](https://discord.gg/testops-companion)
- [Stack Overflow [testops-companion]](https://stackoverflow.com/questions/tagged/testops-companion)
- [GitHub Discussions](https://github.com/rayalon1984/testops-companion/discussions)

### Monitoring
- [Grafana Dashboard Setup](deployment.md#monitoring-setup)
- [Prometheus Metrics](deployment.md#available-metrics)
- [Error Tracking with Sentry](deployment.md#error-tracking)

## Quick Solutions

### Database Reset
```bash
# Stop all services
docker-compose down

# Remove existing database
rm -rf backend/prisma/migrations

# Start fresh
docker-compose up -d db
cd backend && npm run migrate:dev
```

### Environment Refresh
```bash
# Remove existing environment files
rm backend/.env frontend/.env

# Generate new environment files
npm run setup:env

# Restart services
npm run dev
```

### Cache Clear
```bash
# Clear Redis cache
docker-compose exec redis redis-cli FLUSHALL

# Clear browser cache
# In Chrome DevTools:
# 1. Application tab
# 2. Clear Storage
# 3. Clear site data
```

## Getting Help

If you're stuck:

1. Check the [Common Issues](#common-issues) section above
2. Search [existing issues](https://github.com/rayalon1984/testops-companion/issues)
3. Join our [Discord community](https://discord.gg/testops-companion)
4. Open a [new issue](https://github.com/rayalon1984/testops-companion/issues/new/choose)

For urgent production issues, please follow our [incident response process](deployment.md#incident-response).