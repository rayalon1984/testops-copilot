# Monday.com Integration

> Seamlessly integrate TestOps Copilot with Monday.com Work OS to automatically create and manage items from test failures.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Configuration](#configuration)
- [Usage](#usage)
- [API Reference](#api-reference)
- [Examples](#examples)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## Overview

The Monday.com integration allows TestOps Copilot to automatically create items (tasks) on your Monday boards when tests fail, add updates with detailed failure information, and sync test statuses with your project management workflow.

### Use Cases

- ✅ Automatically create Monday items from test failures
- ✅ Add detailed failure information as updates/comments
- ✅ Track test issues alongside other project work
- ✅ Get visibility into test health across your organization
- ✅ Link test failures to sprint planning and bug tracking

---

## Features

### Automatic Item Creation
- Create Monday items from failed tests
- Automatically populate item details with test information
- Add failure details as updates (comments)
- Link back to test run in TestOps Copilot

### Bi-directional Sync
- Update Monday items when tests are re-run
- Track resolution status
- Add notes and comments from test investigations

### Flexible Board Mapping
- Configure which board to use for test failures
- Organize by groups (e.g., "Bugs", "Test Issues")
- Custom column mapping for your board structure

### Search and Discovery
- Search for existing items before creating duplicates
- Find related test failures
- Link similar issues together

---

## Prerequisites

### Monday.com Requirements

1. **Monday.com Account**
   - Active Monday.com workspace
   - At least one board for test issues

2. **API Token**
   - Personal API token with appropriate permissions
   - Access to the boards you want to integrate

### Getting a Monday.com API Token

1. Go to your Monday.com account
2. Click on your profile picture (bottom left)
3. Select "Admin" → "API"
4. Click "Generate" or "Show" to get your API token
5. Copy the token (it looks like: `eyJhbGciOiJIUzI1NiJ9...`)

### Required Permissions

Your API token needs:
- ✅ Read access to boards
- ✅ Create items permission
- ✅ Update items permission
- ✅ Create updates (comments) permission

---

## Configuration

### Environment Variables

Add these to your `backend/.env` file:

```env
# Monday.com Configuration
MONDAY_API_TOKEN=your_monday_api_token_here
MONDAY_BOARD_ID=123456789                    # Optional: Default board ID
MONDAY_WORKSPACE_ID=987654321                # Optional: Workspace ID
```

### Example Configuration

```env
# Monday.com - Required
MONDAY_API_TOKEN=eyJhbGciOiJIUzI1NiJ9.eyJ0aWQiOjEyMzQ1Njc4OSwiaWF0IjoxNjQw.example

# Monday.com - Optional (can be set per request)
MONDAY_BOARD_ID=1234567890
MONDAY_WORKSPACE_ID=9876543210
```

### Testing the Connection

Test your Monday.com connection:

```bash
curl -X GET http://localhost:3000/api/v1/monday/test-connection \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Expected response:
```json
{
  "success": true,
  "message": "Monday.com API connection successful"
}
```

---

## Usage

### 1. Get Available Boards

Fetch all boards you have access to:

```bash
curl -X GET http://localhost:3000/api/v1/monday/boards \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": "1234567890",
      "name": "Test Issues",
      "description": "Board for tracking test failures",
      "state": "active",
      "board_kind": "public"
    }
  ]
}
```

### 2. Create Item from Test Failure

Automatically create a Monday item when a test fails:

```bash
curl -X POST http://localhost:3000/api/v1/monday/test-failures \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "boardId": "1234567890",
    "groupId": "topics",
    "testRunId": "test-run-123",
    "testName": "test_login_functionality",
    "errorMessage": "AssertionError: Expected login button to be visible",
    "stackTrace": "at Object.<anonymous> (tests/login.spec.js:45:12)"
  }'
```

Response:
```json
{
  "success": true,
  "data": {
    "id": "9876543210",
    "name": "Test Failure: test_login_functionality",
    "state": "active",
    "column_values": [...]
  },
  "message": "Monday item created successfully from test failure"
}
```

### 3. Add Update (Comment) to Item

Add detailed information or investigation notes:

```bash
curl -X POST http://localhost:3000/api/v1/monday/items/9876543210/updates \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "body": "Root cause identified: Login button CSS selector changed in latest deployment. Fixed in PR #456."
  }'
```

### 4. Update Item Status

Update column values (e.g., status, assignee):

```bash
curl -X PUT http://localhost:3000/api/v1/monday/items/9876543210 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "boardId": "1234567890",
    "columnValues": {
      "status": {
        "label": "Fixed"
      }
    }
  }'
```

### 5. Search for Items

Search for existing items before creating duplicates:

```bash
curl -X GET "http://localhost:3000/api/v1/monday/boards/1234567890/search?q=login" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## API Reference

### Endpoints

#### `GET /api/v1/monday/boards`
Get all accessible Monday boards.

**Response:**
```typescript
{
  success: boolean;
  data: MondayBoard[];
}
```

#### `GET /api/v1/monday/boards/:boardId`
Get a specific board by ID.

**Parameters:**
- `boardId` (path): Monday board ID

**Response:**
```typescript
{
  success: boolean;
  data: MondayBoard;
}
```

#### `GET /api/v1/monday/boards/:boardId/items`
Get items from a board.

**Parameters:**
- `boardId` (path): Monday board ID
- `limit` (query): Number of items to fetch (default: 25)

**Response:**
```typescript
{
  success: boolean;
  data: MondayItem[];
}
```

#### `POST /api/v1/monday/items`
Create a new Monday item.

**Request Body:**
```typescript
{
  boardId: string;
  groupId?: string;
  itemName: string;
  columnValues?: Record<string, any>;
}
```

**Response:**
```typescript
{
  success: boolean;
  data: MondayItem;
}
```

#### `PUT /api/v1/monday/items/:itemId`
Update an existing Monday item.

**Parameters:**
- `itemId` (path): Monday item ID

**Request Body:**
```typescript
{
  boardId: string;
  columnValues?: Record<string, any>;
}
```

#### `POST /api/v1/monday/items/:itemId/updates`
Create an update (comment) on an item.

**Parameters:**
- `itemId` (path): Monday item ID

**Request Body:**
```typescript
{
  body: string; // Comment text (supports Markdown)
}
```

#### `POST /api/v1/monday/test-failures`
Create a Monday item from a test failure (recommended).

**Request Body:**
```typescript
{
  boardId: string;
  groupId?: string;
  testRunId: string;
  testName: string;
  errorMessage: string;
  stackTrace?: string;
}
```

#### `GET /api/v1/monday/boards/:boardId/search`
Search for items on a board.

**Parameters:**
- `boardId` (path): Monday board ID
- `q` (query): Search query

#### `GET /api/v1/monday/test-connection`
Test Monday.com API connection.

**Response:**
```typescript
{
  success: boolean;
  message: string;
}
```

---

## Examples

### Example 1: Automatic Integration with Test Runs

When a test fails, automatically create a Monday item:

```typescript
// In your test run handler
if (testResult.status === 'failed') {
  await fetch('http://localhost:3000/api/v1/monday/test-failures', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      boardId: process.env.MONDAY_BOARD_ID,
      groupId: 'bugs',
      testRunId: testRun.id,
      testName: testResult.name,
      errorMessage: testResult.error.message,
      stackTrace: testResult.error.stack,
    }),
  });
}
```

### Example 2: Linking to Failure Knowledge Base

Create a Monday item and link to RCA documentation:

```typescript
// Create Monday item
const mondayItem = await createMondayItem({
  boardId: '1234567890',
  testName: 'test_payment_processing',
  errorMessage: 'Payment gateway timeout',
  testRunId: 'run-456',
});

// Add RCA as an update
await createMondayUpdate({
  itemId: mondayItem.id,
  body: `**Root Cause Analysis:**\n\nSee full RCA: /failure-archive/${rcaId}\n\n**Solution:** Increased payment gateway timeout from 5s to 30s`,
});
```

### Example 3: Custom Column Values

Create item with custom column values:

```typescript
await fetch('http://localhost:3000/api/v1/monday/items', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    boardId: '1234567890',
    groupId: 'bugs',
    itemName: 'Test Failure: Login timeout',
    columnValues: {
      status: { label: 'In Progress' },
      priority: { label: 'High' },
      text: 'Login test failed due to timeout after 30 seconds',
      date: { date: '2025-11-16' },
      people: {
        personsAndTeams: [
          { id: 'user123', kind: 'person' }
        ]
      }
    }
  }),
});
```

---

## Best Practices

### 1. Board Organization

**Create a Dedicated Board:**
- Create a specific "Test Issues" board
- Use groups to organize by priority or test suite
- Add custom columns for test-specific data

**Example Board Structure:**
```
Board: Test Issues
├── Group: Critical Failures
├── Group: Regression Issues
├── Group: Flaky Tests
└── Group: Fixed/Resolved

Columns:
- Status (Status column)
- Test Name (Text)
- Error Message (Long Text)
- Test Run Link (Link)
- Priority (Status)
- Assignee (People)
- Date Detected (Date)
```

### 2. Avoid Duplicates

Always search for existing items before creating new ones:

```typescript
// Search for existing item
const existingItems = await searchMondayItems(boardId, testName);

if (existingItems.length > 0) {
  // Update existing item
  await updateMondayItem({
    itemId: existingItems[0].id,
    boardId,
    columnValues: { /* updated values */ }
  });
} else {
  // Create new item
  await createMondayItemFromTestFailure({ /* ... */ });
}
```

### 3. Use Groups Effectively

Organize items into meaningful groups:
- **By Priority:** Critical, High, Medium, Low
- **By Status:** New, In Progress, Fixed, Closed
- **By Test Suite:** E2E Tests, API Tests, Unit Tests
- **By Sprint:** Current Sprint, Backlog

### 4. Link to Test Runs

Always include a link back to the test run:

```typescript
columnValues: {
  link: {
    url: `${TESTOPS_URL}/test-runs/${testRunId}`,
    text: `Test Run #${testRunId}`
  }
}
```

### 5. Add Context in Updates

When creating updates, include:
- Test failure details
- Investigation notes
- Root cause (if known)
- Solution applied
- Related PRs or tickets

---

## Troubleshooting

### Error: "MONDAY_API_TOKEN environment variable is not set"

**Solution:**
Add your Monday API token to `backend/.env`:
```env
MONDAY_API_TOKEN=your_token_here
```

### Error: "Monday.com API request failed: 401 Unauthorized"

**Causes:**
- Invalid API token
- Expired API token
- Token doesn't have required permissions

**Solution:**
1. Verify your API token in Monday.com settings
2. Generate a new token if needed
3. Ensure the token has board access permissions

### Error: "Board with ID X not found"

**Solution:**
1. Verify the board ID is correct
2. Ensure your API token has access to that board
3. Check if the board is archived or deleted

### Items Not Appearing

**Check:**
1. Board ID is correct
2. Group ID exists on the board
3. Column mappings match your board structure
4. API token has create permissions

### Column Values Not Updating

**Issue:** Column values in Monday might have specific format requirements.

**Solution:**
Check Monday's column type documentation:
- Status: `{ "label": "Status Name" }`
- Date: `{ "date": "YYYY-MM-DD" }`
- People: `{ "personsAndTeams": [{ "id": "userId", "kind": "person" }] }`
- Link: `{ "url": "https://...", "text": "Link Text" }`

### Rate Limiting

Monday.com has API rate limits:
- **Free plan:** ~1,000 requests/day
- **Paid plans:** Higher limits

**Solution:**
- Cache board/item data when possible
- Batch operations where applicable
- Implement exponential backoff for retries

---

## Additional Resources

- [Monday.com API Documentation](https://developer.monday.com/api-reference/docs)
- [Monday GraphQL Playground](https://monday.com/developers/v2/try-it-yourself)
- [TestOps Copilot Documentation](../../README.md)
- [Failure Knowledge Base Integration](../features/FAILURE_KNOWLEDGE_BASE.md)

---

## Support

For issues or questions:
- Check the [FAQ](../project/faq.md)
- Open an issue on [GitHub](https://github.com/rayalon1984/testops-copilot/issues)
- Review Monday.com API documentation

---

**Happy Testing! 🚀**
