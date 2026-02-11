# Confluence Integration

TestOps Companion integrates with Atlassian Confluence to automatically publish test documentation, Root Cause Analysis (RCA) documents, and test execution reports to your Confluence workspace.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Configuration](#configuration)
- [Usage](#usage)
  - [Publishing RCA Documents](#publishing-rca-documents)
  - [Publishing Test Reports](#publishing-test-reports)
  - [Managing Pages](#managing-pages)
- [API Reference](#api-reference)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)
- [Examples](#examples)

## Overview

The Confluence integration allows you to:
- **Automatically publish RCA documents** from the Failure Knowledge Base to Confluence
- **Generate test execution reports** with pass/fail statistics and failure details
- **Link documentation to Jira issues** for complete traceability
- **Organize documentation** in spaces with parent pages and labels
- **Track publishing history** and update existing pages

## Features

### 1. Knowledge Search and Retrieval (v2.8.0)

**New in v2.8.0:** Confluence is no longer write-only. The integration now reads *from* Confluence to surface relevant documentation when analyzing test failures.

- **CQL semantic search** across your wiki for pages matching a failure's error message or test name
- **Label-based filtering**: automatically scopes searches to pages tagged `rca`, `runbook`, `architecture`, or `troubleshooting`
- **Excerpt extraction**: returns the first 500 characters of matching pages as plain text
- Used automatically by the [Context Enrichment API](../api.md#context-enrichment-v280) (`POST /api/ai/enrich`)

**Example: How it surfaces knowledge**

When a test fails with "Connection timeout", the system searches Confluence and finds:
- A runbook titled "Connection Troubleshooting" with the fix documented
- An architecture page explaining the connection pool configuration

This context is fed to the AI alongside Jira and GitHub data to produce a complete root cause analysis.

**Usage via Context Enrichment:**
```json
POST /api/ai/enrich
{
  "failure": {
    "testId": "test-123",
    "errorMessage": "Connection timeout after 30s",
    "testName": "testLoginFlow"
  },
  "sources": { "confluence": true }
}
```

**Direct service usage:**
```typescript
const pages = await confluenceService.searchContent(
  'Connection timeout login',
  {
    spaceKey: 'OPS',
    maxResults: 5,
    labels: ['rca', 'runbook']
  }
);
// Returns: [{ id, title, url, excerpt, labels }]
```

### 2. RCA Document Publishing
- Publish detailed Root Cause Analysis documents from the Failure Knowledge Base
- Include failure details, error messages, stack traces, and screenshots
- Document root cause, detailed analysis, solutions, and prevention steps
- Link to related Jira issues automatically
- Apply labels for categorization (rca, test-failure, severity levels)
- Track temporal data (environment, build number, commit SHA, branch)

### 3. Test Execution Reports
- Generate comprehensive test run reports with statistics
- Include pass/fail rates, execution time, and test counts
- Optional detailed failure information with error messages
- Track test status distribution (passed, failed, skipped, error)
- Automatic labeling (test-report, status-based tags)

### 4. Page Management
- Create new Confluence pages with rich HTML content
- Update existing pages while preserving version history
- Apply labels for categorization and searchability
- Organize pages within spaces and under parent pages
- Track all published pages in the database

## Prerequisites

Before setting up the Confluence integration, you need:

1. **Atlassian Confluence Cloud** account
2. **Confluence Space** where you want to publish documents
3. **Confluence API Token** with permissions to create and edit pages
4. **User Email** associated with the Confluence account

### Creating a Confluence API Token

1. Log in to https://id.atlassian.com/manage-profile/security/api-tokens
2. Click **Create API token**
3. Give it a name (e.g., "TestOps Companion")
4. Copy the token (you won't be able to see it again)
5. Store it securely in your environment variables

### Required Permissions

The Confluence user account needs:
- **View** permission on the target space
- **Add** permission to create new pages
- **Edit** permission to update pages
- **Delete** permission (optional, for cleanup)

## Setup

### 1. Install Dependencies

The Confluence integration uses `axios` for HTTP requests, which is already included in the project dependencies.

### 2. Database Migration

Run the Prisma migration to add Confluence models to your database:

```bash
cd backend
npx prisma migrate dev --name add_confluence_integration
```

This creates three models:
- `ConfluenceConfig` - Stores Confluence credentials and settings
- `ConfluencePage` - Tracks published pages and their mappings
- `ConfluencePublishLog` - Logs all publishing activities

### 3. Environment Variables

Add the following variables to your `.env` file:

```env
# Confluence Integration
CONFLUENCE_BASE_URL=https://your-domain.atlassian.net
CONFLUENCE_USERNAME=your-email@example.com
CONFLUENCE_API_TOKEN=your-api-token
CONFLUENCE_SPACE_KEY=TEST
CONFLUENCE_PARENT_PAGE_ID=123456
```

**Variable Descriptions:**

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `CONFLUENCE_BASE_URL` | Yes | Your Confluence instance URL | `https://mycompany.atlassian.net` |
| `CONFLUENCE_USERNAME` | Yes | Email address of the Confluence user | `testops@example.com` |
| `CONFLUENCE_API_TOKEN` | Yes | API token for authentication | `ATATT3xFfGF0...` |
| `CONFLUENCE_SPACE_KEY` | No | Default space key for pages | `TEST` or `DOCS` |
| `CONFLUENCE_PARENT_PAGE_ID` | No | Default parent page ID | `123456789` |

### 4. Finding Your Space Key and Parent Page ID

**Space Key:**
1. Navigate to your Confluence space
2. Look at the URL: `https://your-domain.atlassian.net/wiki/spaces/SPACEKEY/...`
3. The `SPACEKEY` is your space key (usually 3-4 uppercase letters)

**Parent Page ID:**
1. Navigate to the page you want to use as parent
2. Click the three dots (•••) and select "Page information"
3. Look at the URL: `https://your-domain.atlassian.net/wiki/pages/viewinfo.action?pageId=123456789`
4. The number after `pageId=` is your parent page ID

## Configuration

The Confluence integration is configured through environment variables and the `config.ts` file. All Confluence-related configuration is optional - if not provided, the integration will be disabled.

### Config Object Structure

```typescript
confluence?: {
  baseUrl: string;         // e.g., "https://mycompany.atlassian.net"
  username: string;        // e.g., "testops@example.com"
  apiToken: string;        // API token for authentication
  spaceKey?: string;       // Default space key (optional)
  parentPageId?: string;   // Default parent page ID (optional)
}
```

The integration is automatically enabled when `CONFLUENCE_BASE_URL`, `CONFLUENCE_USERNAME`, and `CONFLUENCE_API_TOKEN` are all provided.

## Usage

### Publishing RCA Documents

Publish Root Cause Analysis documents from the Failure Knowledge Base to Confluence:

```typescript
import { confluenceService } from './services/confluence.service';

// Basic RCA publishing
const confluenceUrl = await confluenceService.publishRCADocument(
  'failure-archive-id-123'
);

console.log(`RCA published: ${confluenceUrl}`);

// Advanced options
const customUrl = await confluenceService.publishRCADocument(
  'failure-archive-id-123',
  {
    spaceKey: 'CUSTOMSPACE',           // Override default space
    parentPageId: '987654321',          // Override default parent
    addLabels: ['custom-label'],        // Additional labels
    linkToJira: true                    // Include Jira link (default: true)
  }
);
```

**Generated RCA Document Includes:**

1. **Failure Overview**
   - Test name and failure signature
   - Occurrence count and recurrence status
   - First seen and last seen timestamps
   - Current status and severity

2. **Error Details**
   - Error type and message
   - Complete stack trace
   - Log snippets
   - Screenshots (if available)

3. **Temporal Information**
   - Environment details
   - Build number
   - Commit SHA and branch
   - Occurred at timestamp

4. **Root Cause Analysis**
   - Detailed root cause description
   - In-depth analysis
   - Solution and workaround
   - Prevention steps
   - Related documentation links

5. **Resolution Tracking**
   - Resolution status
   - Resolved by and timestamp
   - Time to resolve
   - Related Jira issue link

6. **Metadata**
   - Tags for categorization
   - Related failures
   - Custom labels

### Publishing Test Reports

Generate and publish comprehensive test execution reports:

```typescript
import { confluenceService } from './services/confluence.service';

// Basic test report
const reportUrl = await confluenceService.publishTestReport(
  'test-run-id-456'
);

console.log(`Test report published: ${reportUrl}`);

// Include failure details
const detailedReport = await confluenceService.publishTestReport(
  'test-run-id-456',
  {
    spaceKey: 'REPORTS',
    parentPageId: '111222333',
    includeFailureDetails: true  // Include error messages for failed tests
  }
);
```

**Generated Test Report Includes:**

1. **Executive Summary**
   - Total test count
   - Pass/fail/skip/error counts
   - Pass rate percentage
   - Total execution time

2. **Test Run Details**
   - Pipeline name and type
   - Branch and commit information
   - Start and end time
   - Duration

3. **Status Distribution**
   - Visual breakdown of test statuses
   - Percentage calculations
   - Color-coded status indicators

4. **Failure Details** (if `includeFailureDetails: true`)
   - Failed test names
   - Error messages
   - Stack traces
   - Duration for each failed test

### Managing Pages

#### Updating Existing Pages

If you publish to the same test run or failure archive again, the integration will automatically update the existing page:

```typescript
// First publish creates a new page
const url1 = await confluenceService.publishRCADocument('failure-123');

// Second publish updates the same page
const url2 = await confluenceService.publishRCADocument('failure-123');

console.log(url1 === url2); // true - same page updated
```

#### Adding Labels

Labels are automatically added based on content type:

**RCA Documents:**
- `rca` - Marks as Root Cause Analysis
- `test-failure` - Indicates test failure documentation
- `{severity}` - Severity level (critical, high, medium, low)
- `{status}` - Current status (new, investigating, documented, resolved)
- Custom labels from options

**Test Reports:**
- `test-report` - Marks as test execution report
- `{status}` - Overall status (success, failure, partial)
- Custom labels from options

#### Direct Page Creation

For advanced use cases, you can create pages directly:

```typescript
const page = await confluenceService.createPage(
  'My Custom Page Title',
  '<p>This is <strong>HTML</strong> content in Confluence storage format</p>',
  'MYSPACE',
  '123456789'  // parent page ID
);

console.log(`Page created: ${page.id}`);
```

## API Reference

### ConfluenceService

#### `publishRCADocument(failureArchiveId, options?)`

Publishes a Root Cause Analysis document to Confluence.

**Parameters:**
- `failureArchiveId` (string): ID of the failure archive entry
- `options` (RCADocumentOptions, optional):
  - `spaceKey` (string): Confluence space key (overrides default)
  - `parentPageId` (string): Parent page ID (overrides default)
  - `addLabels` (string[]): Additional labels to apply
  - `linkToJira` (boolean): Include Jira issue link (default: true)

**Returns:** `Promise<string>` - Confluence page URL

**Throws:**
- Error if Confluence is not enabled
- Error if failure archive not found
- Error if no RCA documentation available
- Error if page creation fails

**Example:**
```typescript
const url = await confluenceService.publishRCADocument(
  'fa-123',
  {
    spaceKey: 'TEST',
    addLabels: ['backend', 'api'],
    linkToJira: true
  }
);
```

#### `publishTestReport(testRunId, options?)`

Publishes a test execution report to Confluence.

**Parameters:**
- `testRunId` (string): ID of the test run
- `options` (TestReportOptions, optional):
  - `spaceKey` (string): Confluence space key (overrides default)
  - `parentPageId` (string): Parent page ID (overrides default)
  - `includeFailureDetails` (boolean): Include detailed failure info (default: false)

**Returns:** `Promise<string>` - Confluence page URL

**Throws:**
- Error if Confluence is not enabled
- Error if test run not found
- Error if page creation fails

**Example:**
```typescript
const url = await confluenceService.publishTestReport(
  'tr-456',
  {
    includeFailureDetails: true
  }
);
```

#### `createPage(title, content, spaceKey?, parentPageId?)`

Creates a new Confluence page.

**Parameters:**
- `title` (string): Page title
- `content` (string): HTML content in Confluence storage format
- `spaceKey` (string, optional): Space key (uses default if not provided)
- `parentPageId` (string, optional): Parent page ID (uses default if not provided)

**Returns:** `Promise<ConfluencePage>` - Created page object

**Example:**
```typescript
const page = await confluenceService.createPage(
  'API Documentation',
  '<h2>Overview</h2><p>This is the API docs</p>',
  'DOCS'
);
```

#### `updatePage(pageId, title, content, currentVersion)`

Updates an existing Confluence page.

**Parameters:**
- `pageId` (string): Confluence page ID
- `title` (string): Updated page title
- `content` (string): Updated HTML content
- `currentVersion` (number): Current version number

**Returns:** `Promise<ConfluencePage>` - Updated page object

#### `addLabels(pageId, labels)`

Adds labels to a Confluence page.

**Parameters:**
- `pageId` (string): Confluence page ID
- `labels` (string[]): Array of label names

**Returns:** `Promise<void>`

## Best Practices

### 1. Space Organization

Create dedicated spaces or parent pages for different types of documentation:

```
TEST Space
├── RCA Documents (parent page)
│   ├── Backend Failures
│   ├── Frontend Failures
│   └── Integration Failures
└── Test Reports (parent page)
    ├── Daily Reports
    ├── Sprint Reports
    └── Release Reports
```

Set appropriate parent page IDs in your configuration:

```env
CONFLUENCE_SPACE_KEY=TEST
CONFLUENCE_PARENT_PAGE_ID=<RCA Documents page ID>
```

### 2. Labeling Strategy

Use consistent labels to make documentation searchable:

**RCA Documents:**
- Component labels: `backend`, `frontend`, `database`, `api`
- Team labels: `team-alpha`, `team-beta`
- Sprint labels: `sprint-24`, `sprint-25`

**Test Reports:**
- Environment labels: `staging`, `production`, `qa`
- Type labels: `smoke-test`, `regression`, `e2e`

### 3. Update vs. Create

The integration automatically updates existing pages instead of creating duplicates. This is controlled by:

```typescript
// Checks database for existing page
const existingPage = await prisma.confluencePage.findFirst({
  where: {
    sourceId: failureArchiveId,
    type: 'rca_document'
  }
});

if (existingPage) {
  // Update existing page
} else {
  // Create new page
}
```

### 4. Error Handling

Always wrap Confluence operations in try-catch blocks:

```typescript
try {
  const url = await confluenceService.publishRCADocument(failureId);
  logger.info(`Published RCA to Confluence: ${url}`);
} catch (error) {
  logger.error('Failed to publish RCA:', error);
  // Optionally notify team
  await notificationService.sendAlert({
    type: 'error',
    message: `Confluence publishing failed: ${error.message}`
  });
}
```

### 5. Bulk Publishing

When publishing multiple documents, use appropriate delays to avoid rate limiting:

```typescript
const failureIds = ['fa-1', 'fa-2', 'fa-3', ...];

for (const failureId of failureIds) {
  try {
    await confluenceService.publishRCADocument(failureId);
    await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
  } catch (error) {
    logger.error(`Failed to publish ${failureId}:`, error);
  }
}
```

### 6. Monitoring Publishing Activity

Track publishing success rates:

```typescript
const logs = await prisma.confluencePublishLog.findMany({
  where: {
    publishedAt: {
      gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
    }
  }
});

const successRate = logs.filter(l => l.success).length / logs.length;
console.log(`Confluence success rate: ${(successRate * 100).toFixed(2)}%`);
```

## Troubleshooting

### Issue: "Confluence integration is not enabled"

**Cause:** Missing required environment variables

**Solution:**
1. Verify all required variables are set:
   ```bash
   echo $CONFLUENCE_BASE_URL
   echo $CONFLUENCE_USERNAME
   echo $CONFLUENCE_API_TOKEN
   ```
2. Restart the backend server after adding variables
3. Check that variables are loaded in config:
   ```typescript
   console.log(config.confluence); // Should not be undefined
   ```

### Issue: "401 Unauthorized" or "403 Forbidden"

**Cause:** Invalid credentials or insufficient permissions

**Solution:**
1. Verify API token is correct and not expired
2. Check username matches the email of the token owner
3. Verify the user has permissions in the target space:
   - Space Settings → Permissions → Verify user has "Add" and "Edit" permissions
4. Test authentication manually:
   ```bash
   curl -u your-email@example.com:your-api-token \
     https://your-domain.atlassian.net/wiki/rest/api/space
   ```

### Issue: "Space not found" or "Parent page not found"

**Cause:** Invalid space key or parent page ID

**Solution:**
1. Verify space key is correct (case-sensitive)
2. Verify parent page ID exists and is accessible
3. Try creating without parent first:
   ```typescript
   await confluenceService.createPage('Test', '<p>Test</p>', 'YOURSPACE');
   ```

### Issue: "Cannot update page - version conflict"

**Cause:** Page was modified externally between read and update

**Solution:**
1. The service automatically fetches current version before updates
2. If conflict persists, check for concurrent updates
3. Implement retry logic:
   ```typescript
   async function publishWithRetry(failureId, maxRetries = 3) {
     for (let i = 0; i < maxRetries; i++) {
       try {
         return await confluenceService.publishRCADocument(failureId);
       } catch (error) {
         if (i === maxRetries - 1) throw error;
         await new Promise(r => setTimeout(r, 1000 * (i + 1)));
       }
     }
   }
   ```

### Issue: "Content not rendering correctly"

**Cause:** Invalid HTML in Confluence storage format

**Solution:**
1. Ensure HTML is well-formed (all tags closed)
2. Use Confluence-supported HTML tags
3. Test content with Confluence validator:
   ```typescript
   // Use built-in content builders
   const content = confluenceService.buildRCAContent(failure, true);
   ```

### Issue: "Rate limit exceeded"

**Cause:** Too many API requests in short time

**Solution:**
1. Add delays between bulk operations
2. Implement exponential backoff:
   ```typescript
   async function withBackoff(fn, maxRetries = 3) {
     for (let i = 0; i < maxRetries; i++) {
       try {
         return await fn();
       } catch (error) {
         if (error.response?.status === 429) {
           const delay = Math.pow(2, i) * 1000;
           await new Promise(r => setTimeout(r, delay));
         } else {
           throw error;
         }
       }
     }
   }
   ```

### Debugging Tips

1. **Enable detailed logging:**
   ```env
   LOG_LEVEL=debug
   ```

2. **Inspect API requests:**
   ```typescript
   // In confluence.service.ts, log requests
   logger.debug('Confluence API request:', {
     method: 'POST',
     url: endpoint,
     data: requestData
   });
   ```

3. **Check publishing logs:**
   ```typescript
   const recentLogs = await prisma.confluencePublishLog.findMany({
     take: 10,
     orderBy: { publishedAt: 'desc' }
   });
   console.table(recentLogs);
   ```

## Examples

### Example 1: Automated RCA Publishing on Failure Detection

```typescript
// In your test failure handler
async function handleTestFailure(testRunId: string, testCaseId: string) {
  // Create failure archive entry
  const failure = await prisma.failureArchive.create({
    data: {
      testRunId,
      testCaseId,
      testName: 'User Login Test',
      failureSignature: 'login_timeout_error',
      errorMessage: 'Connection timeout after 30s',
      // ... other fields
    }
  });

  // Check if RCA is available
  if (failure.rootCause) {
    try {
      // Publish to Confluence
      const confluenceUrl = await confluenceService.publishRCADocument(
        failure.id,
        {
          addLabels: ['backend', 'authentication'],
          linkToJira: true
        }
      );

      logger.info(`RCA published to Confluence: ${confluenceUrl}`);

      // Optionally notify team
      await slackService.sendMessage({
        channel: '#test-failures',
        text: `New RCA documented: ${confluenceUrl}`
      });
    } catch (error) {
      logger.error('Failed to publish RCA to Confluence:', error);
    }
  }
}
```

### Example 2: Daily Test Report Publishing

```typescript
// Scheduled job (e.g., with node-cron)
import cron from 'node-cron';

// Run every day at 9 AM
cron.schedule('0 9 * * *', async () => {
  // Get yesterday's test runs
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const testRuns = await prisma.testRun.findMany({
    where: {
      createdAt: {
        gte: yesterday
      },
      status: {
        in: ['SUCCESS', 'FAILURE']
      }
    }
  });

  for (const testRun of testRuns) {
    try {
      const reportUrl = await confluenceService.publishTestReport(
        testRun.id,
        {
          spaceKey: 'REPORTS',
          parentPageId: process.env.DAILY_REPORTS_PAGE_ID,
          includeFailureDetails: true
        }
      );

      logger.info(`Daily report published: ${reportUrl}`);
    } catch (error) {
      logger.error(`Failed to publish report for ${testRun.id}:`, error);
    }
  }
});
```

### Example 3: Sprint Summary Page

```typescript
async function publishSprintSummary(sprintNumber: number) {
  const sprintStart = new Date('2024-01-01');
  const sprintEnd = new Date('2024-01-14');

  // Get all test runs in sprint
  const testRuns = await prisma.testRun.findMany({
    where: {
      createdAt: {
        gte: sprintStart,
        lte: sprintEnd
      }
    },
    include: {
      testCases: true
    }
  });

  // Calculate statistics
  const totalTests = testRuns.reduce((sum, run) => sum + run.testCases.length, 0);
  const passedTests = testRuns.reduce(
    (sum, run) => sum + run.testCases.filter(tc => tc.status === 'PASSED').length,
    0
  );
  const passRate = (passedTests / totalTests * 100).toFixed(2);

  // Build custom content
  const content = `
    <h2>Sprint ${sprintNumber} Test Summary</h2>
    <p><strong>Period:</strong> ${sprintStart.toDateString()} - ${sprintEnd.toDateString()}</p>

    <h3>Statistics</h3>
    <table>
      <tr><th>Metric</th><th>Value</th></tr>
      <tr><td>Total Test Runs</td><td>${testRuns.length}</td></tr>
      <tr><td>Total Tests</td><td>${totalTests}</td></tr>
      <tr><td>Passed</td><td>${passedTests}</td></tr>
      <tr><td>Pass Rate</td><td>${passRate}%</td></tr>
    </table>

    <h3>Test Runs</h3>
    <ul>
      ${testRuns.map(run => `
        <li>
          <strong>${run.pipeline?.name}</strong> -
          ${run.status} -
          ${new Date(run.createdAt).toLocaleString()}
        </li>
      `).join('')}
    </ul>
  `;

  // Create page
  const page = await confluenceService.createPage(
    `Sprint ${sprintNumber} - Test Summary`,
    content,
    'SPRINTS'
  );

  await confluenceService.addLabels(page.id, [
    'test-summary',
    `sprint-${sprintNumber}`,
    'automated'
  ]);

  return page._links.webui;
}
```

### Example 4: Linking RCA to Jira and Confluence

```typescript
async function documentFailureWithJira(failureId: string) {
  // Get failure details
  const failure = await prisma.failureArchive.findUnique({
    where: { id: failureId },
    include: { jiraIssue: true }
  });

  // Create Jira issue if not exists
  let jiraIssue = failure.jiraIssue;
  if (!jiraIssue) {
    const jiraResponse = await jiraService.createIssue({
      summary: `Test Failure: ${failure.testName}`,
      description: failure.errorMessage,
      issueType: 'Bug',
      priority: failure.severity
    });

    jiraIssue = await prisma.jiraIssue.create({
      data: {
        issueKey: jiraResponse.key,
        summary: jiraResponse.fields.summary,
        // ... other fields
      }
    });

    // Link to failure
    await prisma.failureArchive.update({
      where: { id: failureId },
      data: { jiraIssueId: jiraIssue.id }
    });
  }

  // Publish RCA to Confluence with Jira link
  const confluenceUrl = await confluenceService.publishRCADocument(
    failureId,
    {
      linkToJira: true,
      addLabels: [jiraIssue.issueKey]
    }
  );

  // Add Confluence link to Jira issue
  await jiraService.addComment(
    jiraIssue.issueKey,
    `Detailed RCA documentation: ${confluenceUrl}`
  );

  logger.info('Complete documentation chain created', {
    failure: failureId,
    jira: jiraIssue.issueKey,
    confluence: confluenceUrl
  });

  return {
    failureId,
    jiraUrl: `${config.jira.baseUrl}/browse/${jiraIssue.issueKey}`,
    confluenceUrl
  };
}
```

## Additional Resources

- [Confluence Cloud REST API Documentation](https://developer.atlassian.com/cloud/confluence/rest/v2/intro/)
- [Confluence Storage Format](https://confluence.atlassian.com/doc/confluence-storage-format-790796544.html)
- [Atlassian API Authentication](https://developer.atlassian.com/cloud/confluence/basic-auth-for-rest-apis/)
- [Confluence Labels Best Practices](https://confluence.atlassian.com/doc/labels-139497.html)

## Support

For issues or questions:
- Check the [Troubleshooting](#troubleshooting) section
- Review Confluence API logs in the application
- Verify permissions in Confluence space settings
- Contact your Confluence administrator for space access issues

## Future Enhancements

Planned improvements for future versions:
- Confluence comments integration for team discussions
- Automatic page archiving for resolved failures
- Custom page templates
- Bulk export/import functionality
- ~~Confluence search integration~~ *(Shipped: v2.8.0)*
- Page analytics and view tracking
