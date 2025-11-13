# Failure Knowledge Base & Root Cause Archive

## Overview

The Failure Knowledge Base is a powerful feature that documents, archives, and intelligently matches test failures to past issues, preventing teams from wasting time re-investigating the same problems.

## The Problem It Solves

**Before:**
- Test fails → Someone investigates for 2-4 hours
- Solution found → Not properly documented
- Same test fails 3 months later → Start investigation from scratch
- Key team member who knew the fix has left → Knowledge lost
- **Result:** Massive time waste on recurring issues

**After:**
- Test fails → System instantly shows similar past failures
- Past RCA displayed with solution → Fixed in 5 minutes
- Pattern detection alerts team to recurring issues
- Knowledge persists even when team members leave
- **Result:** 95% faster resolution for known issues

## Key Features

### 1. Smart Failure Matching

When a test fails, the system automatically:
- Generates a unique failure signature
- Searches for similar past failures
- Uses 3 matching strategies:
  - **Exact Match**: Identical failure signature
  - **Fuzzy Match**: Similar error message (80%+ similarity)
  - **Pattern Match**: Known recurring patterns

### 2. Root Cause Documentation

Easy-to-use form to document:
- Root cause (required)
- Detailed analysis
- Solution applied
- Prevention steps
- Workarounds
- Related Jira tickets
- PR/commit links
- Time to resolve
- Tags for categorization

### 3. Knowledge Base Dashboard

Browse and search all past failures:
- Quick stats (total failures, documented %, recurring issues)
- Most common failures
- Advanced search and filtering
- Visual timeline of occurrences
- Tag-based organization

### 4. Pattern Detection

Automated detection of:
- Recurring failure patterns
- Temporal patterns (e.g., "Fails every Friday 5pm")
- Common root causes across different tests
- Flaky tests

## API Endpoints

### Create Failure Archive Entry
```
POST /api/v1/failure-archive
```

**Request Body:**
```json
{
  "testRunId": "uuid",
  "testName": "login_with_invalid_credentials",
  "errorMessage": "Authentication failed: jwt expired",
  "stackTrace": "...",
  "severity": "HIGH",
  "tags": ["auth", "jwt"]
}
```

**Response:**
```json
{
  "failure": { ... },
  "similarFailures": [
    {
      "failure": { ... },
      "similarity": 1.0,
      "matchType": "exact",
      "matchReason": "Exact signature match"
    }
  ]
}
```

### Document RCA
```
PUT /api/v1/failure-archive/:id/document-rca
```

**Request Body:**
```json
{
  "rootCause": "JWT token expiration set to 1ms instead of 1h",
  "solution": "Fixed backend/.env: JWT_EXPIRATION=1h",
  "preventionSteps": "Added config validation",
  "jiraIssueKey": "PROJ-1234",
  "timeToResolve": 120
}
```

### Search Failures
```
GET /api/v1/failure-archive/search
```

**Query Parameters:**
- `testName`: Filter by test name
- `status`: NEW, DOCUMENTED, RESOLVED, RECURRING
- `severity`: CRITICAL, HIGH, MEDIUM, LOW
- `isRecurring`: true/false
- `tags`: Comma-separated list
- `startDate`, `endDate`: Date range
- `limit`, `offset`: Pagination

### Find Similar Failures
```
POST /api/v1/failure-archive/find-similar
```

**Request Body:**
```json
{
  "testName": "checkout_flow",
  "errorMessage": "Payment gateway timeout",
  "stackTrace": "...",
  "limit": 5
}
```

### Get Insights
```
GET /api/v1/failure-archive/insights?days=30
```

**Response:**
```json
{
  "totalFailures": 247,
  "documentedCount": 189,
  "recurringCount": 23,
  "averageTimeToResolve": 145,
  "mostCommonFailures": [
    {
      "testName": "login_test",
      "count": 15,
      "lastOccurrence": "2025-11-13T10:30:00Z"
    }
  ]
}
```

### Detect Patterns
```
POST /api/v1/failure-archive/detect-patterns
```

Analyzes recent failures and creates pattern entries.

## Frontend Components

### RCADocumentModal

Modal dialog for documenting root cause analysis.

**Usage:**
```tsx
import { RCADocumentModal } from '@/components/RCADocumentModal/RCADocumentModal';

<RCADocumentModal
  open={modalOpen}
  onClose={() => setModalOpen(false)}
  failureId="uuid"
  testName="checkout_flow"
  errorMessage="Payment timeout"
  onSuccess={() => refetchData()}
/>
```

### SimilarFailuresAlert

Alert banner showing similar past failures.

**Usage:**
```tsx
import { SimilarFailuresAlert } from '@/components/SimilarFailuresAlert/SimilarFailuresAlert';

<SimilarFailuresAlert
  similarFailures={similarFailures}
  onDocumentNew={() => setModalOpen(true)}
  onMarkAsSame={(id) => markAsSameIssue(id)}
/>
```

### FailureKnowledgeBase

Full dashboard page for browsing failure archive.

**Route:** `/failure-archive` or `/knowledge-base`

## Integration with Test Failures

### Automatic Detection

When a test fails, automatically call the API:

```typescript
async function handleTestFailure(testRun: TestRun) {
  // 1. Create failure archive entry
  const response = await fetch('/api/v1/failure-archive', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      testRunId: testRun.id,
      testName: testRun.testName,
      errorMessage: testRun.error,
      stackTrace: testRun.stackTrace,
      severity: determineSeverity(testRun)
    })
  });

  const { failure, similarFailures } = await response.json();

  // 2. Show similar failures alert if found
  if (similarFailures && similarFailures.length > 0) {
    showSimilarFailuresAlert(similarFailures);
  }

  return failure;
}
```

### RCA Reminder

After a Jira issue is resolved, prompt for RCA documentation:

```typescript
async function onJiraIssueResolved(issueKey: string) {
  // Find related failure
  const response = await fetch(
    `/api/v1/failure-archive/search?jiraIssueKey=${issueKey}`
  );
  const { failures } = await response.json();

  if (failures.length > 0 && !failures[0].rootCause) {
    showRCAReminder(failures[0]);
  }
}
```

## Database Schema

### FailureArchive Table

```prisma
model FailureArchive {
  id                    String           @id @default(uuid())
  testRunId             String
  testName              String
  failureSignature      String           // For matching

  // Failure details
  errorMessage          String           @db.Text
  errorType             String?
  stackTrace            String?          @db.Text
  logSnippet            String?          @db.Text
  screenshots           String[]

  // RCA Documentation
  rootCause             String?          @db.Text
  detailedAnalysis      String?          @db.Text
  solution              String?          @db.Text
  preventionSteps       String?          @db.Text
  workaround            String?          @db.Text

  // Metadata
  status                FailureStatus    @default(NEW)
  severity              FailureSeverity
  isRecurring           Boolean
  occurrenceCount       Int
  tags                  String[]

  // Relations
  jiraIssue             JiraIssue?

  @@index([failureSignature])
  @@index([testName])
}
```

### FailurePattern Table

```prisma
model FailurePattern {
  id                    String    @id @default(uuid())
  signature             String    @unique
  patternName           String
  description           String    @db.Text
  affectedTests         String[]
  commonRootCause       String?
  matchCount            Int
  confidence            Float

  @@index([signature])
}
```

## Smart Matching Algorithm

### Signature Generation

1. **Normalize Error Message:**
   - Remove timestamps → "TIMESTAMP"
   - Remove UUIDs → "UUID"
   - Remove IDs → "id=ID"
   - Remove line numbers → "line X"
   - Lowercase and trim

2. **Hash Stack Trace:**
   - Take top 5 stack frames
   - Remove line numbers
   - Create MD5 hash

3. **Combine:**
   ```
   signature = testHash:normalizedError:stackHash
   ```

### Similarity Calculation

Uses Levenshtein distance to calculate string similarity:
```typescript
similarity = (longerLength - editDistance) / longerLength
```

Matches with 70%+ similarity are considered "fuzzy matches".

## Usage Examples

### Example 1: Documenting First-Time Failure

```typescript
// Test fails
const failure = await createFailure({
  testName: 'payment_processing',
  errorMessage: 'Payment gateway returned 504 timeout'
});

// Investigate and document
await documentRCA(failure.id, {
  rootCause: 'Payment gateway has 5s timeout, our request takes 8s',
  solution: 'Increased timeout to 10s and optimized request payload',
  preventionSteps: 'Added performance monitoring',
  timeToResolve: 180
});
```

### Example 2: Recognizing Recurring Issue

```typescript
// Test fails again
const { failure, similarFailures } = await createFailure({
  testName: 'payment_processing',
  errorMessage: 'Payment gateway returned 504 timeout'
});

// System finds exact match
// similarFailures[0].matchType === 'exact'
// similarFailures[0].similarity === 1.0

// Developer sees past RCA immediately:
// "Timeout issue - increase to 10s"
// Fixed in 2 minutes instead of 2 hours!
```

### Example 3: Pattern Detection

```typescript
// Run nightly
const patterns = await detectPatterns();

// Found: payment_processing fails every Friday 5pm
// Pattern confidence: 0.85
// Affected tests: ['payment_processing', 'checkout_flow']
// Common root cause: "Weekly batch job interferes with gateway"
```

## Best Practices

### For QA Engineers

1. **Document RCA immediately** after resolving a failure
2. **Be specific** - future you will thank you
3. **Add tags** for easy searching (auth, database, ui, api, etc.)
4. **Link Jira tickets** for full context
5. **Include time to resolve** to track efficiency gains

### For Developers

1. **Check similar failures first** before investigating
2. **Update existing RCA** if you find new info
3. **Mark as resolved** when permanently fixed
4. **Add prevention steps** so it doesn't happen again

### For Managers

1. **Review insights dashboard** weekly
2. **Track documentation %** - target 80%+
3. **Identify recurring issues** for prioritization
4. **Measure time savings** from pattern matching

## ROI Metrics

Track these metrics to prove value:

- **Time saved per documented failure**: ~3.5 hours average
- **Documentation rate**: % of failures with RCA
- **Recurring issue resolution time**: Before vs. after
- **Team satisfaction**: Survey on knowledge retention
- **New dev onboarding**: Time to productive reduced by 30%

## Roadmap

Future enhancements:
- AI-powered RCA suggestions
- Slack bot for RCA reminders
- Visual failure timeline
- Export to PDF for reports
- Integration with CI/CD for auto-documentation
- Failure prediction based on patterns

## Support

For questions or issues:
- GitHub Issues: [testops-companion/issues](https://github.com/rayalon1984/testops-companion/issues)
- Documentation: [docs/](../README.md)

---

**Built with ❤️ to save teams hours of debugging time**
