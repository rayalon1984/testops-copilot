# Jira Integration

## Overview

TestOps Copilot integrates with Jira to provide seamless issue tracking and test result management. This integration allows you to:

- Create Jira issues from failed test runs
- Link test runs to existing Jira issues
- Synchronize test status with Jira
- View Jira issue details within TestOps Copilot
- **Search for similar existing issues** *(v2.8.0)* before creating duplicates

## Setup

### 1. Prerequisites

- Jira Cloud instance or Jira Server/Data Center
- Jira API token with appropriate permissions
- Project key where issues will be created

### 2. Configuration

Add the following to your `backend/.env`:

```env
# Jira Configuration
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_API_TOKEN=your-api-token
JIRA_PROJECT_KEY=PROJ
JIRA_DEFAULT_ISSUE_TYPE=Bug
```

### 3. Permissions

The Jira API token needs the following permissions:
- Read/Write issue data
- Create issues
- Add comments
- Link issues
- Read project data

## Usage

### Creating Issues from Test Runs

1. Navigate to a failed test run
2. Click "Create Jira Issue"
3. Fill in issue details
4. Submit to create and link the issue

### Linking Existing Issues

1. Open test run details
2. Click "Link Jira Issue"
3. Enter the Jira issue key (e.g., PROJ-123)
4. Confirm to create the link

### Automatic Issue Creation

Configure automatic issue creation in pipeline settings:

1. Go to Pipeline Settings
2. Enable "Automatic Jira Issues"
3. Configure:
   - Project Key
   - Issue Type
   - Labels
   - Components
   - Custom Fields

### Status Synchronization

Test run statuses are automatically synchronized with linked Jira issues:

- Failed → Open/To Do
- Passed → Resolved
- Skipped → Won't Fix
- Running → In Progress

## Similar Issue Search (v2.8.0)

When a test failure occurs, the system can automatically search Jira for existing issues that match the failure before creating a duplicate ticket.

### How It Works

1. The error message is cleaned: timestamps, UUIDs, memory addresses, and file paths with line numbers are stripped
2. Meaningful search terms are extracted (first 200 characters)
3. A JQL text search runs against issue summaries and descriptions
4. Results are returned sorted by most recently updated

### Usage via Context Enrichment

The search is automatically invoked when using the `POST /api/ai/enrich` endpoint with `sources.jira: true`. It can also be called directly:

```typescript
import { jiraService } from '@/services/jira.service';

const similarIssues = await jiraService.searchSimilarIssues(
  'Connection timeout after 30s waiting for database',
  'testLoginFlow',
  {
    maxResults: 5,
    projectKey: 'PROJ',
    statusFilter: ['Open', 'In Progress']
  }
);
```

### Example Response

```json
[
  {
    "key": "PROJ-456",
    "summary": "Connection timeout issues in login flow",
    "status": "In Progress",
    "type": "Bug",
    "priority": "High",
    "assignee": "john.doe"
  }
]
```

## API Endpoints

### Create Issue
```http
POST /api/v1/jira/issues
Content-Type: application/json

{
  "summary": "Test failure in login flow",
  "description": "Login test failed in production environment",
  "type": "Bug",
  "labels": ["automated-test", "regression"],
  "testRunId": "123e4567-e89b-12d3-a456-426614174000"
}
```

### Search Similar Issues (v2.8.0)
```http
POST /api/ai/enrich
Content-Type: application/json

{
  "failure": {
    "testId": "test-123",
    "errorMessage": "Connection timeout after 30s",
    "testName": "testLoginFlow"
  },
  "sources": { "jira": true, "confluence": false, "github": false }
}
```

### Link Issue
```http
POST /api/v1/jira/issues/{issueKey}/link
Content-Type: application/json

{
  "testRunId": "123e4567-e89b-12d3-a456-426614174000"
}
```

### Get Issue Status
```http
GET /api/v1/jira/issues/{issueKey}/status
```

## Troubleshooting

### Common Issues

1. Authentication Errors
   - Verify API token is valid
   - Check base URL format
   - Ensure token has required permissions

2. Issue Creation Fails
   - Verify project key exists
   - Check issue type is valid
   - Ensure required fields are provided

3. Status Sync Issues
   - Check Jira workflow allows transitions
   - Verify issue is not in a locked state
   - Check for custom workflow restrictions

### Logs

Enable debug logging for Jira integration:

```env
LOG_LEVEL=debug
JIRA_DEBUG=true
```

## Support

For issues with the Jira integration:

1. Check the [troubleshooting guide](#troubleshooting)
2. Review [GitHub issues](https://github.com/rayalon1984/testops-copilot/issues)
3. Join our [Discord community](https://discord.gg/testops-copilot)