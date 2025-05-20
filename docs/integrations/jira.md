# Jira Integration

## Overview

TestOps Companion integrates with Jira to provide seamless issue tracking and test result management. This integration allows you to:

- Create Jira issues from failed test runs
- Link test runs to existing Jira issues
- Synchronize test status with Jira
- View Jira issue details within TestOps Companion

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
2. Review [GitHub issues](https://github.com/rayalon1984/testops-companion/issues)
3. Join our [Discord community](https://discord.gg/testops-companion)