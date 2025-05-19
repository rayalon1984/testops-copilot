# TestOps Companion API Documentation

## Base URL
```
http://localhost:3000/api/v1
```

## Authentication

All API requests must include a valid JWT token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

### Authentication Endpoints

#### POST /auth/register
Register a new user.
```json
{
  "email": "user@example.com",
  "password": "securePassword123!",
  "firstName": "John",
  "lastName": "Doe"
}
```

#### POST /auth/login
Login and receive JWT token.
```json
{
  "email": "user@example.com",
  "password": "securePassword123!"
}
```

#### POST /auth/refresh-token
Refresh expired JWT token.
```json
{
  "refreshToken": "your_refresh_token"
}
```

## Pipeline Management

### Pipelines

#### GET /pipelines
Get all pipelines for the authenticated user.

Query Parameters:
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 25)
- `status`: Filter by status
- `type`: Filter by pipeline type
- `tags`: Filter by tags (comma-separated)

#### POST /pipelines
Create a new pipeline.
```json
{
  "name": "My Test Pipeline",
  "description": "Pipeline description",
  "type": "jenkins",
  "config": {
    "url": "https://jenkins.example.com",
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

#### GET /pipelines/:id
Get pipeline details by ID.

#### PUT /pipelines/:id
Update pipeline configuration.

#### DELETE /pipelines/:id
Delete a pipeline.

#### POST /pipelines/:id/run
Trigger pipeline execution.
```json
{
  "branch": "feature/new-test",
  "parameters": {
    "env": "staging",
    "suite": "regression"
  }
}
```

### Test Runs

#### GET /test-runs
Get all test runs.

Query Parameters:
- `pipelineId`: Filter by pipeline
- `status`: Filter by status
- `startDate`: Filter by start date
- `endDate`: Filter by end date
- `branch`: Filter by branch

#### GET /test-runs/:id
Get test run details.

#### POST /test-runs/:id/cancel
Cancel a running test.

#### POST /test-runs/:id/retry
Retry a failed test run.

#### GET /test-runs/:id/logs
Get test run logs.

#### GET /test-runs/:id/artifacts
Get test run artifacts.

## Notifications

#### GET /notifications/preferences
Get notification preferences.

#### PUT /notifications/preferences
Update notification preferences.
```json
{
  "email": {
    "enabled": true,
    "address": "user@example.com",
    "digest": true,
    "digestFrequency": "daily"
  },
  "slack": {
    "enabled": true,
    "channel": "#testing",
    "mentions": ["@user1", "@user2"]
  }
}
```

#### POST /notifications/test
Send test notification.

#### GET /notifications/history
Get notification history.

## Metrics and Analytics

#### GET /metrics/pipelines
Get pipeline execution metrics.

Query Parameters:
- `startDate`: Start date for metrics
- `endDate`: End date for metrics
- `groupBy`: Group by period (day/week/month)

#### GET /metrics/tests
Get test execution metrics.

#### GET /metrics/coverage
Get test coverage metrics.

## System Administration

#### GET /admin/users
Get all users (admin only).

#### GET /admin/system/health
Get system health status.

#### GET /admin/system/metrics
Get system-wide metrics.

## Error Responses

### Error Format
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error description"
  }
}
```

### Common Error Codes

- `UNAUTHORIZED`: Authentication required or failed
- `FORBIDDEN`: Permission denied
- `NOT_FOUND`: Resource not found
- `VALIDATION_ERROR`: Invalid input data
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `INTEGRATION_ERROR`: External service error
- `INTERNAL_ERROR`: Server error

## Rate Limiting

API requests are limited to:
- 100 requests per minute per IP
- 1000 requests per hour per user

Rate limit headers are included in all responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1623456789
```

## Pagination

Paginated endpoints return metadata:
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 100,
    "pages": 4
  }
}
```

## Versioning

The API version is included in the URL path (/api/v1/).
Breaking changes will result in a new API version.