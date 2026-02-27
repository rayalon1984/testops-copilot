# TestRail Integration

> Seamlessly integrate TestOps Copilot with TestRail to automatically sync test results, create test runs, and maintain centralized test case management.

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

The TestRail integration allows TestOps Copilot to automatically sync test execution results with your TestRail test case management system. This creates a single source of truth for test case management while leveraging TestOps Copilot's advanced analytics and failure knowledge base.

### Use Cases

- ✅ Automatically create test runs in TestRail from CI/CD executions
- ✅ Sync test results from TestOps Copilot to TestRail
- ✅ Link test failures to existing test cases
- ✅ Track test execution history across both platforms
- ✅ Maintain centralized test case repository in TestRail
- ✅ Use TestOps Copilot's analytics on TestRail test data

---

## Features

### Automatic Test Run Creation
- Create TestRail test runs from TestOps Copilot test executions
- Map test cases between systems
- Include test metadata (branch, build number, environment)

### Bi-directional Sync
- Sync test results from TestOps Copilot to TestRail
- Update TestRail with pass/fail status
- Include execution time, error messages, and logs
- Attach screenshots and artifacts

### Test Case Management
- Fetch test cases from TestRail suites
- Map TestRail test cases to automated tests
- Maintain test case metadata

### Flexible Configuration
- Project-level configuration
- Suite-based test runs
- Milestone linking
- Custom field support

---

## Prerequisites

### TestRail Requirements

1. **TestRail Instance**
   - TestRail Cloud or self-hosted instance
   - Version 6.0 or higher recommended

2. **API Access**
   - API access enabled in TestRail settings
   - User account with appropriate permissions

3. **Permissions Required**
   - ✅ View test cases
   - ✅ Add test runs
   - ✅ Add test results
   - ✅ View projects
   - ✅ View milestones

### Getting a TestRail API Key

1. Log in to your TestRail instance
2. Click on your profile name (top right)
3. Select "My Settings"
4. Under "API Keys", click "Add Key"
5. Enter a description (e.g., "TestOps Copilot Integration")
6. Click "Generate Key"
7. Copy the API key (you won't be able to see it again!)

---

## Configuration

### Environment Variables

Add these to your `backend/.env` file:

```env
# TestRail Integration
TESTRAIL_BASE_URL=https://your-company.testrail.io
TESTRAIL_USERNAME=your-email@example.com
TESTRAIL_API_KEY=your-api-key-here
TESTRAIL_PROJECT_ID=1
```

### Configuration Options

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `TESTRAIL_BASE_URL` | Yes | Your TestRail instance URL | `https://acme.testrail.io` |
| `TESTRAIL_USERNAME` | Yes | Your TestRail email address | `qa@example.com` |
| `TESTRAIL_API_KEY` | Yes | Your TestRail API key | `abc123...` |
| `TESTRAIL_PROJECT_ID` | No | Default project ID | `1` |

### Finding Your Project ID

1. Go to your TestRail dashboard
2. Open the project you want to use
3. Look at the URL: `https://your-company.testrail.io/index.php?/projects/overview/1`
4. The number at the end is your project ID (in this example: `1`)

---

## Usage

### 1. Basic Test Run Sync

```typescript
// Automatically sync test results after test execution
import { testRailService } from '@/services/testrail.service';

// After a test run completes
await testRailService.syncTestRunResults(testRunId);
```

### 2. Create TestRail Run Manually

```typescript
import { testRailService } from '@/services/testrail.service';

const testRailRun = await testRailService.createTestRun({
  name: 'Automated Test Run - Build #123',
  description: 'Nightly regression tests',
  suiteId: 5,
  milestoneId: 10,
  testRunId: 'our-internal-test-run-id',
  includeAll: true,
});

console.log(`Created TestRail run: ${testRailRun.id}`);
```

### 3. Add Test Results

```typescript
import { testRailService, TestRailStatus } from '@/services/testrail.service';

await testRailService.addTestResults(testRailRunId, [
  {
    testId: 101,
    statusId: TestRailStatus.PASSED,
    comment: 'Test passed successfully',
    elapsed: '2m 30s',
  },
  {
    testId: 102,
    statusId: TestRailStatus.FAILED,
    comment: 'Login failed: Invalid credentials error',
    elapsed: '45s',
    defects: 'BUG-123',
  },
]);
```

### 4. Close Test Run

```typescript
import { testRailService } from '@/services/testrail.service';

// Close the test run after all results are added
await testRailService.closeTestRun(testRailRunId);
```

---

## API Reference

### TestRail Status IDs

TestRail uses numeric status IDs. The standard statuses are:

| Status ID | Status Name | Description |
|-----------|-------------|-------------|
| `1` | Passed | Test passed successfully |
| `2` | Blocked | Test blocked by external issue |
| `3` | Untested | Test not yet executed |
| `4` | Retest | Test needs to be retested |
| `5` | Failed | Test failed |

```typescript
export enum TestRailStatus {
  PASSED = 1,
  BLOCKED = 2,
  UNTESTED = 3,
  RETEST = 4,
  FAILED = 5,
}
```

### Service Methods

#### `validateConnection(): Promise<boolean>`
Validates the connection to TestRail.

```typescript
const isValid = await testRailService.validateConnection();
```

#### `getProject(projectId?: number): Promise<TestRailProject>`
Get project details.

```typescript
const project = await testRailService.getProject(1);
console.log(project.name);
```

#### `getSuites(projectId?: number): Promise<TestRailSuite[]>`
Get all test suites for a project.

```typescript
const suites = await testRailService.getSuites(1);
suites.forEach(suite => {
  console.log(`Suite: ${suite.name} (ID: ${suite.id})`);
});
```

#### `getCases(projectId: number, suiteId: number): Promise<TestRailCase[]>`
Get test cases for a suite.

```typescript
const cases = await testRailService.getCases(1, 5);
console.log(`Found ${cases.length} test cases`);
```

#### `createTestRun(data: CreateTestRunDTO): Promise<TestRailRun>`
Create a new test run.

```typescript
const run = await testRailService.createTestRun({
  name: 'Sprint 42 Regression',
  description: 'Full regression suite for Sprint 42',
  suiteId: 5,
  milestoneId: 10,
  testRunId: 'internal-run-id',
  includeAll: false,
  caseIds: [101, 102, 103],
});
```

#### `addTestResults(runId: number, results: AddTestResultDTO[]): Promise<void>`
Add multiple test results to a run.

```typescript
await testRailService.addTestResults(runId, [
  { testId: 101, statusId: 1, comment: 'Passed' },
  { testId: 102, statusId: 5, comment: 'Failed', elapsed: '1m' },
]);
```

#### `syncTestRunResults(testRunId: string): Promise<void>`
Sync all results from a TestOps Copilot test run to TestRail.

```typescript
await testRailService.syncTestRunResults('test-run-uuid');
```

---

## Examples

### Complete Workflow Example

```typescript
import { testRailService, TestRailStatus } from '@/services/testrail.service';

async function runTestsAndSyncToTestRail() {
  try {
    // 1. Validate connection
    await testRailService.validateConnection();
    console.log('✓ Connected to TestRail');

    // 2. Get available test suites
    const suites = await testRailService.getSuites();
    console.log(`Found ${suites.length} test suites`);

    // 3. Create a test run
    const testRun = await testRailService.createTestRun({
      name: `Automated Run - ${new Date().toISOString()}`,
      description: 'Automated test execution from CI/CD',
      suiteId: suites[0].id,
      includeAll: true,
    });
    console.log(`✓ Created TestRail run: ${testRun.id}`);

    // 4. Execute your tests (simulated here)
    const testResults = [
      { testId: 101, passed: true, duration: 2500 },
      { testId: 102, passed: false, duration: 1200, error: 'Timeout' },
      { testId: 103, passed: true, duration: 800 },
    ];

    // 5. Send results to TestRail
    const results = testResults.map(result => ({
      testId: result.testId,
      statusId: result.passed ? TestRailStatus.PASSED : TestRailStatus.FAILED,
      comment: result.passed ? 'Test passed' : `Test failed: ${result.error}`,
      elapsed: `${Math.floor(result.duration / 1000)}s`,
    }));

    await testRailService.addTestResults(testRun.id, results);
    console.log(`✓ Added ${results.length} test results`);

    // 6. Close the test run
    await testRailService.closeTestRun(testRun.id);
    console.log('✓ Test run closed');

    // 7. Get run details
    const finalRun = await testRailService.getTestRun(testRun.id);
    console.log(`Final stats: ${finalRun.passed_count} passed, ${finalRun.failed_count} failed`);

  } catch (error) {
    console.error('TestRail sync failed:', error);
    throw error;
  }
}
```

### CI/CD Integration Example

```typescript
// In your CI/CD pipeline script
import { testRailService } from '@/services/testrail.service';

async function postTestExecution(testRunId: string) {
  if (!testRailService.isEnabled()) {
    console.log('TestRail integration not configured, skipping sync');
    return;
  }

  try {
    console.log('Syncing results to TestRail...');
    await testRailService.syncTestRunResults(testRunId);
    console.log('✓ Results synced to TestRail successfully');
  } catch (error) {
    console.error('Failed to sync to TestRail:', error);
    // Don't fail the build if TestRail sync fails
    process.exitCode = 0;
  }
}
```

---

## Best Practices

### 1. Test Case Mapping

**Use consistent test case IDs:**
```typescript
// Store TestRail case ID in your test metadata
describe('Login Tests', () => {
  it('should login with valid credentials', {
    testrailCaseId: 101
  }, async () => {
    // test code
  });
});
```

### 2. Error Handling

**Always handle TestRail API errors gracefully:**
```typescript
try {
  await testRailService.createTestRun(data);
} catch (error) {
  if (error.message.includes('not found')) {
    console.error('TestRail project or suite not found');
  } else if (error.message.includes('not enabled')) {
    console.log('TestRail integration disabled, skipping');
  } else {
    console.error('TestRail API error:', error);
  }
}
```

### 3. Performance

**Batch results instead of sending individually:**
```typescript
// Good - batch results
const results = testResults.map(r => ({
  testId: r.id,
  statusId: r.passed ? 1 : 5,
  comment: r.message,
}));
await testRailService.addTestResults(runId, results);

// Avoid - individual results
for (const result of testResults) {
  await testRailService.addTestResult(runId, result); // Slow!
}
```

### 4. Test Run Naming

**Use descriptive, consistent naming:**
```typescript
const name = `${environment} - ${branch} - Build #${buildNumber} - ${timestamp}`;
// Example: "Production - main - Build #123 - 2025-11-17T14:30:00Z"
```

### 5. Milestone Linking

**Link test runs to milestones for better tracking:**
```typescript
const testRun = await testRailService.createTestRun({
  name: 'Sprint 42 Tests',
  suiteId: 5,
  milestoneId: 42, // Link to Sprint 42 milestone
});
```

---

## Troubleshooting

### Connection Issues

**Problem:** `Failed to connect to TestRail`

**Solutions:**
1. Verify your `TESTRAIL_BASE_URL` is correct (no trailing slash)
2. Ensure API access is enabled in TestRail Admin settings
3. Check that your user has API permissions
4. Verify your API key is correct and not expired

### Authentication Errors

**Problem:** `401 Unauthorized`

**Solutions:**
1. Verify `TESTRAIL_USERNAME` matches your TestRail email
2. Regenerate your API key in TestRail settings
3. Check for special characters in API key (copy entire key)

### Test Case Not Found

**Problem:** `Test case ID not found in TestRail`

**Solutions:**
1. Verify the test case ID exists in the specified suite
2. Check that the case belongs to the project you're using
3. Ensure the case hasn't been deleted or archived

### Project/Suite Not Found

**Problem:** `Project or suite not found`

**Solutions:**
1. Verify `TESTRAIL_PROJECT_ID` is correct
2. Check that your user has access to the project
3. Ensure the suite ID is valid and belongs to the project

### Sync Failures

**Problem:** Results not appearing in TestRail

**Solutions:**
1. Check that the test run is not closed
2. Verify test IDs match TestRail case IDs
3. Review TestOps Copilot logs for sync errors
4. Ensure status IDs are valid (1-5)

### Rate Limiting

**Problem:** `429 Too Many Requests`

**Solutions:**
1. Implement retry logic with exponential backoff
2. Batch results instead of individual requests
3. Contact TestRail support to increase rate limits

---

## API Limits

TestRail API has the following limits:

- **Rate Limit:** 180 requests per minute (TestRail Cloud)
- **Payload Size:** 256 MB per request
- **Concurrent Connections:** 10 per account

---

## Additional Resources

- [TestRail API Documentation](https://www.gurock.com/testrail/docs/api)
- [TestRail REST API Reference](https://www.gurock.com/testrail/docs/api/reference)
- [TestOps Copilot API Documentation](../api/README.md)

---

## Need Help?

- 📖 [TestOps Copilot Documentation](../README.md)
- 🐛 [Report an Issue](https://github.com/rayalon1984/testops-companion/issues)
- 💬 [Discussions](https://github.com/rayalon1984/testops-companion/discussions)

---

**Happy Testing! 🚀**
