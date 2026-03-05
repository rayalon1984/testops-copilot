# Database Schema Documentation

> Updated for v3.4.0 | **Canonical schema**: [`backend/prisma/schema.prisma`](../backend/prisma/schema.prisma) (24 models) | **Architecture**: [`specs/ARCHITECTURE.md`](../specs/ARCHITECTURE.md) §4

## Overview

TestOps Copilot uses PostgreSQL as its primary database. The schema is managed using Prisma ORM with TypeScript.

## Entity Relationship Diagram

```mermaid
erDiagram
    User ||--o{ Pipeline : creates
    User ||--o{ TestRun : owns
    User ||--o{ NotificationPreference : has
    User ||--o{ NotificationHistory : receives
    Pipeline ||--o{ TestRun : has
    Pipeline ||--o{ PipelineSchedule : has
    TestRun ||--o{ TestResult : contains
    TestRun ||--o{ TestArtifact : produces
    TestRun ||--o{ NotificationHistory : triggers

    User {
        uuid id PK
        string email UK
        string password
        string firstName
        string lastName
        enum role
        string refreshToken
        string passwordResetToken
        datetime passwordResetExpires
        datetime createdAt
        datetime updatedAt
    }

    Pipeline {
        uuid id PK
        string name
        string description
        enum type
        jsonb config
        jsonb notifications
        int timeout
        int retryCount
        string[] tags
        uuid userId FK
        datetime createdAt
        datetime updatedAt
    }

    TestRun {
        uuid id PK
        uuid pipelineId FK
        uuid userId FK
        enum status
        datetime startTime
        datetime endTime
        int duration
        string branch
        string commit
        jsonb parameters
        jsonb results
        text logs
        text error
        int retryCount
        enum priority
        string[] tags
        datetime createdAt
        datetime updatedAt
    }

    TestResult {
        uuid id PK
        uuid testRunId FK
        string name
        enum status
        int duration
        text error
        boolean flaky
        jsonb metadata
        datetime createdAt
        datetime updatedAt
    }

    TestArtifact {
        uuid id PK
        uuid testRunId FK
        string name
        string type
        string path
        bigint size
        string checksum
        jsonb metadata
        datetime createdAt
        datetime updatedAt
    }

    PipelineSchedule {
        uuid id PK
        uuid pipelineId FK
        string cronExpression
        string timezone
        boolean enabled
        jsonb parameters
        datetime lastRun
        datetime nextRun
        datetime createdAt
        datetime updatedAt
    }

    NotificationPreference {
        uuid id PK
        uuid userId FK
        jsonb email
        jsonb slack
        jsonb pushover
        jsonb conditions
        datetime createdAt
        datetime updatedAt
    }

    NotificationHistory {
        uuid id PK
        uuid userId FK
        uuid testRunId FK
        enum type
        enum channel
        string message
        enum status
        text error
        int deliveryTime
        jsonb metadata
        datetime createdAt
        datetime updatedAt
    }
```

## Table Descriptions

### Users
Stores user account information and authentication details.
- Primary key: `id` (UUID)
- Unique constraints: `email`
- Indexes: `email`, `role`

### Pipelines
Stores pipeline configurations and metadata.
- Primary key: `id` (UUID)
- Foreign keys: `userId` references Users(id)
- Indexes: `userId`, `type`, `tags`

### TestRuns
Records individual test execution instances.
- Primary key: `id` (UUID)
- Foreign keys: 
  - `pipelineId` references Pipelines(id)
  - `userId` references Users(id)
- Indexes: `pipelineId`, `userId`, `status`, `createdAt`

### TestResults
Stores detailed test case results.
- Primary key: `id` (UUID)
- Foreign keys: `testRunId` references TestRuns(id)
- Indexes: `testRunId`, `status`, `flaky`

### TestArtifacts
Manages test-related files and artifacts.
- Primary key: `id` (UUID)
- Foreign keys: `testRunId` references TestRuns(id)
- Indexes: `testRunId`, `type`

### PipelineSchedules
Manages scheduled pipeline executions.
- Primary key: `id` (UUID)
- Foreign keys: `pipelineId` references Pipelines(id)
- Indexes: `pipelineId`, `enabled`, `nextRun`

### NotificationPreferences
Stores user notification settings.
- Primary key: `id` (UUID)
- Foreign keys: `userId` references Users(id)
- Indexes: `userId`

### NotificationHistory
Records notification delivery attempts and status.
- Primary key: `id` (UUID)
- Foreign keys: 
  - `userId` references Users(id)
  - `testRunId` references TestRuns(id)
- Indexes: `userId`, `testRunId`, `type`, `status`, `createdAt`

## JSON Schemas

### Pipeline Config
```json
{
  "url": "string",
  "credentials": {
    "username": "string",
    "apiToken": "string"
  },
  "repository": "string?",
  "branch": "string?",
  "triggers": ["push" | "pull_request" | "schedule" | "manual"]?,
  "schedule": "string?"
}
```

### Notification Config
```json
{
  "enabled": "boolean",
  "channels": ["slack" | "email" | "pushover"],
  "conditions": ["success" | "failure" | "started" | "completed"]
}
```

### Test Results
```json
{
  "total": "number",
  "passed": "number",
  "failed": "number",
  "skipped": "number",
  "flaky": "number",
  "coverage": "number?",
  "reportUrl": "string?"
}
```

## Enums

### UserRole
- `admin`
- `user`

### PipelineType
- `jenkins`
- `github-actions`
- `custom`

### TestStatus
- `pending`
- `running`
- `success`
- `failure`
- `cancelled`
- `timeout`

### NotificationType
- `pipeline`
- `test`
- `system`
- `broadcast`
- `test-flaky`
- `coverage`

### NotificationChannel
- `email`
- `slack`
- `pushover`

### NotificationStatus
- `pending`
- `sent`
- `failed`
- `delivered`

## Migrations

Migrations are managed using Prisma Migrate:

```bash
# Create a new migration
npx prisma migrate dev --name add_user_role

# Apply pending migrations
npx prisma migrate deploy

# Reset database
npx prisma migrate reset
```

## Indexes

Important indexes for performance:

1. Users
   - `email` (unique)
   - `role`

2. Pipelines
   - `userId`
   - `type`
   - `tags` (GIN)

3. TestRuns
   - `pipelineId`
   - `userId`
   - `status`
   - `createdAt`
   - `tags` (GIN)

4. NotificationHistory
   - `userId`
   - `testRunId`
   - `type`
   - `status`
   - `createdAt`

## Backup and Recovery

1. Regular backups:
```bash
pg_dump -U postgres testops > backup.sql
```

2. Point-in-time recovery:
```bash
psql -U postgres testops < backup.sql
```

## Performance Considerations

1. Use appropriate indexes
2. Implement pagination
3. Use efficient queries
4. Regular maintenance
5. Monitor performance

## Data Retention

- Test runs: 90 days
- Test artifacts: 30 days
- Notification history: 30 days
- Logs: 14 days