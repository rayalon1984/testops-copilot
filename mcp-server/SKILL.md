# TestOps Companion MCP Server - Development Guide

> **Comprehensive guide for AI assistants and developers working on the MCP server**

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Tool Catalog](#tool-catalog)
4. [Cost Optimization](#cost-optimization)
5. [Development Workflows](#development-workflows)
6. [Best Practices](#best-practices)
7. [Troubleshooting](#troubleshooting)

---

## Overview

### What is This?

The TestOps Companion MCP Server is a **Model Context Protocol** server that provides AI-powered test failure analysis tools. It allows AI assistants (like Claude) to intelligently analyze test failures, search knowledge bases, and provide actionable recommendations.

### Why MCP?

**Without MCP:**
- AI needs full codebase context every time
- Expensive token usage (sending thousands of lines of code)
- No access to live database
- Can't execute complex operations
- Generic advice without team-specific context

**With MCP:**
- AI calls focused tools with specific inputs
- 98% reduction in token usage
- Direct database access
- Team-specific solutions from knowledge base
- Cost-effective ($1-5/month vs $100+/month)

### Key Benefits

1. **Token Efficiency**: Tools execute server-side, not in LLM context
2. **Cost Savings**: Search knowledge base ($0.001) before AI analysis ($0.05)
3. **Team Knowledge**: Store and retrieve team-specific solutions
4. **Smart Batching**: Analyze 20 failures for $0.10 vs $1.00 individually
5. **Live Data**: Real-time access to test runs, pipelines, metrics

---

## Architecture

### System Overview

```
┌─────────────────┐
│  Claude Code    │ (AI Assistant)
│  (or any LLM)   │
└────────┬────────┘
         │ MCP Protocol
         │ (JSON-RPC via stdio)
         ▼
┌─────────────────┐
│   MCP Server    │ (This project)
│   (Node.js)     │
└────────┬────────┘
         │
         ├─────▶ PostgreSQL DB (TestOps data)
         ├─────▶ AI Providers (Anthropic, OpenAI, etc.)
         ├─────▶ Vector DB (Weaviate - semantic search)
         └─────▶ Cache (Redis - optional)
```

### Project Structure

```
mcp-server/
├── src/
│   ├── index.ts          # MCP server entry point
│   ├── types.ts          # TypeScript type definitions
│   ├── db.ts             # Database connection & queries
│   └── tools/            # Tool implementations
│       ├── analyze.ts    # Single failure analysis
│       ├── batch.ts      # Batch failure analysis
│       ├── knowledge.ts  # Knowledge base tools
│       └── stats.ts      # Statistics tools
├── dist/                 # Compiled JavaScript (after build)
├── package.json          # Dependencies & scripts
├── tsconfig.json         # TypeScript configuration
├── .env                  # Environment variables
├── README.md             # User documentation
└── SKILL.md              # This file
```

### MCP Protocol Flow

```
1. Claude Code sends request:
   {
     "method": "tools/call",
     "params": {
       "name": "testops_analyze_failure",
       "arguments": { "testName": "...", "errorMessage": "..." }
     }
   }

2. MCP Server receives request → routes to tool handler

3. Tool executes:
   - Validates input (Zod schema)
   - Queries database
   - Calls AI services (if needed)
   - Returns structured result

4. MCP Server sends response:
   {
     "content": [{
       "type": "text",
       "text": "{ ... JSON result ... }"
     }]
   }

5. Claude Code interprets result → presents to user
```

---

## Tool Catalog

### 1. testops_analyze_failure

**Purpose:** Comprehensive analysis of a single test failure

**Input:**
```typescript
{
  testName: string;        // Required
  errorMessage: string;    // Required
  stackTrace?: string;     // Optional
  logs?: string;           // Optional (last 5000 chars recommended)
  pipeline?: string;       // Optional
  branch?: string;         // Optional
}
```

**Output:**
```typescript
{
  categorization: {
    category: string;      // INFRASTRUCTURE_ISSUE, APPLICATION_BUG, etc.
    subcategory?: string;
    confidence: number;    // 0-1
    reasoning: string;
  };
  similarFailures: Array<{
    id: string;
    testName: string;
    similarity: number;    // 0-1
    resolution?: string;   // How it was fixed
    resolvedBy?: string;
    ticketUrl?: string;
  }>;
  logSummary?: {
    summary: string;
    rootCause: string;
    technicalDetails: string;
    suggestedFix: string;
  };
  estimatedCostUSD: number;
}
```

**Cost:** $0.01-0.05 (varies with log size)

**Implementation Notes:**
- Located in `src/tools/analyze.ts`
- Uses 3 sub-operations:
  1. Categorization (~$0.005)
  2. Similarity search (~$0.01)
  3. Log summarization (~$0.01-0.04)
- Can skip logs to save cost
- Caching reduces repeat costs by 80%

**Example Usage:**
```typescript
// Quick categorization (no logs)
{
  testName: "payment-test",
  errorMessage: "Timeout waiting for response",
}
// Cost: ~$0.01

// Full analysis with logs
{
  testName: "payment-test",
  errorMessage: "Timeout waiting for response",
  logs: "... last 5000 chars ...",
}
// Cost: ~$0.05
```

---

### 2. testops_batch_analyze

**Purpose:** Analyze multiple failures efficiently

**Input:**
```typescript
{
  testRunId?: string;      // Option 1: Load from test run
  failures?: Array<{       // Option 2: Provide failures directly
    testName: string;
    errorMessage: string;
    stackTrace?: string;
    logs?: string;
  }>;
  maxFailures?: number;    // Default: 20
  priorityThreshold?: number; // Default: 0.7
}
```

**Output:**
```typescript
{
  totalFailures: number;
  analyzedFailures: number;
  summary: string;         // Human-readable summary
  patterns: Array<{
    category: string;
    count: number;
    examples: string[];    // Example test names
  }>;
  priorities: {
    high: TestFailure[];   // Fix these first
    medium: TestFailure[];
    low: TestFailure[];    // Flaky tests, low confidence
  };
  estimatedTotalCostUSD: number;
}
```

**Cost:** $0.05-0.30 (depends on number of failures)

**Cost Savings:**
- Individual analysis: 10 failures × $0.05 = $0.50
- Batch analysis: 10 failures = $0.10
- **Savings: 80%**

**Why It's Cheaper:**
- Skips detailed log analysis
- Focuses on patterns
- Batches AI calls efficiently

**Implementation Notes:**
- Located in `src/tools/batch.ts`
- Pattern detection groups failures by category
- Priority ranking uses confidence + category
- Automatically limits to `maxFailures` to control cost

**Example Usage:**
```typescript
// Analyze a test run
{
  testRunId: "123e4567-e89b-12d3-a456-426614174000"
}

// Analyze specific failures
{
  failures: [
    { testName: "test1", errorMessage: "..." },
    { testName: "test2", errorMessage: "..." },
  ],
  maxFailures: 15
}
```

---

### 3. testops_search_knowledge

**Purpose:** Search knowledge base for similar past failures

**Input:**
```typescript
{
  query: string;           // Search text
  category?: string;       // Optional filter
  limit?: number;          // Default: 10
  onlyResolved?: boolean;  // Default: true
}
```

**Output:**
```typescript
Array<{
  id: string;
  testName: string;
  errorMessage: string;
  category: string;
  resolution: string;      // How it was fixed!
  resolvedBy: string;
  ticketUrl?: string;
  createdAt: Date;
  similarity?: number;     // If using vector search
}>
```

**Cost:** $0.001 per search

**Why Use This First:**
- 98% cheaper than AI analysis ($0.001 vs $0.05)
- Instant results (no AI inference delay)
- Team-specific solutions (not generic advice)
- Includes links to tickets/PRs

**Implementation Notes:**
- Located in `src/tools/knowledge.ts`
- Currently uses PostgreSQL full-text search
- Can be upgraded to vector similarity search for better results
- Searches: test name, error message, resolution text

**Example Usage:**
```typescript
// Search by error message
{
  query: "database connection refused"
}

// Search with category filter
{
  query: "timeout",
  category: "INFRASTRUCTURE_ISSUE",
  limit: 5
}
```

---

### 4. testops_add_knowledge

**Purpose:** Add a resolved failure to the knowledge base

**Input:**
```typescript
{
  testName: string;        // Required
  errorMessage: string;    // Required
  stackTrace?: string;
  category: string;        // Required - see categories below
  resolution: string;      // Required - be specific!
  resolvedBy: string;      // Required - email or username
  ticketUrl?: string;      // Optional - link to issue/PR
  pipeline?: string;
  branch?: string;
}
```

**Categories:**
- `INFRASTRUCTURE_ISSUE` - Network, database, services
- `APPLICATION_BUG` - Code bugs
- `TEST_ISSUE` - Test code problems
- `FLAKY_TEST` - Intermittent failures
- `ENVIRONMENT_ISSUE` - Config, env vars, dependencies
- `TIMEOUT` - Timeout-related failures
- `DEPENDENCY_FAILURE` - External service failures

**Output:**
```typescript
{
  id: string;
  message: string;
}
```

**Cost:** $0.001 per entry

**Best Practices:**
- Be specific in resolution (not just "fixed it")
- Include links to PRs/issues
- Add context about why it failed
- Mention if it's a known flaky test

**Example:**
```typescript
{
  testName: "checkout-payment-test",
  errorMessage: "Connection timeout to payment gateway",
  category: "INFRASTRUCTURE_ISSUE",
  resolution: "Increased timeout from 5s to 15s in config/test.yml. Payment gateway has 10s latency in staging.",
  resolvedBy: "alice@example.com",
  ticketUrl: "https://github.com/org/repo/pull/456",
  pipeline: "e2e-tests"
}
```

---

### 5. testops_get_pipeline_stats

**Purpose:** Get pipeline health metrics and recent runs

**Input:**
```typescript
{
  pipelineId?: string;     // Optional - omit for all pipelines
  limit?: number;          // Default: 10 recent runs
  daysBack?: number;       // Default: 30 days
}
```

**Output:**
```typescript
Array<{
  id: string;
  name: string;
  type: string;            // GITHUB_ACTIONS, JENKINS, etc.
  recentRuns: Array<{
    id: string;
    status: string;
    startedAt: Date;
    duration?: number;
    failed: number;
  }>;
  successRate: number;     // Percentage
  avgDuration: number;     // Milliseconds
  commonFailures: Array<{
    testName: string;
    count: number;
    lastOccurrence: Date;
  }>;
}>
```

**Use Cases:**
- Monitor pipeline health
- Identify problematic pipelines
- Track improvements over time
- Find most common failures

---

### 6. testops_get_test_history

**Purpose:** Get detailed history and flakiness analysis for a test

**Input:**
```typescript
{
  testName: string;        // Required
  daysBack?: number;       // Default: 90
  limit?: number;          // Default: 20
}
```

**Output:**
```typescript
{
  testName: string;
  totalRuns: number;
  failures: number;
  flakinessScore: number;  // 0 = stable, 1 = very flaky
  failurePatterns: Array<{
    errorMessage: string;
    count: number;
    lastOccurrence: Date;
  }>;
  recentRuns: Array<{
    id: string;
    status: string;
    timestamp: Date;
    pipeline: string;
    branch: string;
  }>;
}
```

**Flakiness Score Calculation:**
- 0.0-0.2: Stable test
- 0.2-0.5: Somewhat flaky
- 0.5-0.8: Very flaky
- 0.8-1.0: Extremely flaky

Factors:
- Failure rate (20-80% indicates flakiness)
- Pass/fail alternation pattern
- Recent trends

**Use Cases:**
- Investigate flaky tests
- Decide if test should be quarantined
- Understand failure patterns
- Prioritize test fixes

---

### 7. testops_get_cost_stats

**Purpose:** Get AI usage and cost statistics

**Input:**
```typescript
{
  startDate?: string;      // ISO format, default: 30 days ago
  endDate?: string;        // ISO format, default: now
}
```

**Output:**
```typescript
{
  period: {
    start: Date;
    end: Date;
  };
  totalCostUSD: number;
  breakdown: Array<{
    feature: string;       // categorization, rca_matching, etc.
    calls: number;
    totalTokens: number;
    costUSD: number;
  }>;
  topExpensiveOperations: Array<{
    timestamp: Date;
    feature: string;
    costUSD: number;
    tokens: number;
  }>;
}
```

**Use Cases:**
- Monitor AI spending
- Identify costly operations
- Budget planning
- Optimize usage patterns

---

### 8. testops_health_check

**Purpose:** Check health of all services

**Input:** None required

**Output:**
```typescript
{
  healthy: boolean;
  services: {
    database?: {
      healthy: boolean;
      error?: string;
    };
    aiProvider?: {
      healthy: boolean;
      name?: string;
      error?: string;
    };
    vectorDB?: {
      healthy: boolean;
      error?: string;
    };
    cache?: {
      healthy: boolean;
      stats?: any;
    };
  };
}
```

**Use Cases:**
- Diagnose issues before expensive operations
- Monitor system health
- Troubleshooting

---

## Cost Optimization

### Cost Hierarchy (Cheapest to Most Expensive)

1. **Knowledge Base Search** - $0.001
   - Use FIRST, always
   - 98% cheaper than AI analysis

2. **Quick Categorization** - $0.01
   - No logs, just error message
   - Good for triage

3. **Full Analysis (no logs)** - $0.01
   - Categorization + similarity search
   - Skip logs to save cost

4. **Full Analysis (with logs)** - $0.05
   - Complete RCA with log analysis
   - Use when you need deep insights

5. **Batch Analysis** - $0.10
   - 10-20 failures analyzed
   - 80% cheaper than individual

### Optimization Strategies

#### Strategy 1: Search-First Pattern

```
❌ BAD: Analyze every failure
User: "Test X failed"
→ testops_analyze_failure ($0.05)

✅ GOOD: Search first, analyze if needed
User: "Test X failed"
→ testops_search_knowledge ($0.001)
   ↓
   Found solution? → Use it (saved $0.049)
   Not found? → testops_analyze_failure ($0.05)
```

**Savings:** If 50% of failures are known issues: 50% × $0.049 = $0.0245 per failure

#### Strategy 2: Batch Instead of Individual

```
❌ BAD: Analyze 10 failures individually
10 × testops_analyze_failure = $0.50

✅ GOOD: Batch analyze
testops_batch_analyze = $0.10

**Savings:** $0.40 (80%)
```

#### Strategy 3: Limit Log Size

```
❌ BAD: Include entire 500KB log file
→ ~125,000 tokens
→ ~$0.40 per analysis

✅ GOOD: Include last 5000 chars
→ ~1,250 tokens
→ ~$0.004 per analysis

**Savings:** $0.396 per analysis (99%)
```

#### Strategy 4: Build Knowledge Base

```
Scenario: "Login timeout" failure occurs monthly

Without knowledge base:
- 12 months × $0.05 = $0.60/year

With knowledge base:
- First occurrence: $0.05 (analysis) + $0.001 (add to KB)
- Next 11 occurrences: 11 × $0.001 (search) = $0.011
- Total: $0.061/year

**Savings:** $0.539/year (90%) for just one recurring issue
```

### Monthly Budget Examples

#### Small Team (100 test runs/month, 10% failure rate)

**Conservative Approach (analyze everything):**
- 10 failures × $0.05 = $0.50/month
- **Annual:** $6/year

**Optimized Approach:**
- Search first: 10 × $0.001 = $0.01
- 50% found in KB: 5 × $0 = $0
- 50% need analysis: 5 × $0.05 = $0.25
- **Monthly:** $0.26
- **Annual:** $3.12/year
- **Savings:** 48%

#### Medium Team (500 test runs/month, 15% failure rate)

**Conservative Approach:**
- 75 failures × $0.05 = $3.75/month
- **Annual:** $45/year

**Optimized Approach:**
- Batch analyze CI runs: 30 runs × $0.10 = $3.00
- Search for individual failures: 75 × $0.001 = $0.075
- **Monthly:** $3.075
- **Annual:** $36.90/year
- **Savings:** 18%

#### Large Team (2000 test runs/month, 20% failure rate)

**Conservative Approach:**
- 400 failures × $0.05 = $20/month
- **Annual:** $240/year

**Optimized Approach:**
- Batch analyze: 100 runs × $0.10 = $10
- Search first: 400 × $0.001 = $0.40
- Deep analysis (20%): 80 × $0.05 = $4
- **Monthly:** $14.40
- **Annual:** $172.80/year
- **Savings:** 28%

---

## Development Workflows

### Adding a New Tool

1. **Define Types** (`src/types.ts`):
```typescript
export interface MyToolInput {
  param1: string;
  param2?: number;
}

export interface MyToolOutput {
  result: string;
  metadata: any;
}
```

2. **Create Tool File** (`src/tools/mytool.ts`):
```typescript
import { z } from 'zod';

const MyToolInputSchema = z.object({
  param1: z.string(),
  param2: z.number().optional(),
});

export async function myTool(input: MyToolInput): Promise<MyToolOutput> {
  const validated = MyToolInputSchema.parse(input);

  // Implementation

  return {
    result: '...',
    metadata: {},
  };
}

export const myToolDefinition = {
  name: 'testops_my_tool',
  description: '...',
  inputSchema: {
    type: 'object',
    properties: {
      param1: {
        type: 'string',
        description: '...',
      },
    },
    required: ['param1'],
  },
};
```

3. **Register Tool** (`src/index.ts`):
```typescript
import { myTool, myToolDefinition } from './tools/mytool.js';

const tools: Tool[] = [
  // ... existing tools
  myToolDefinition as Tool,
];

// In CallToolRequestSchema handler
case 'testops_my_tool':
  result = await myTool(args);
  break;
```

4. **Test**:
```bash
npm run build
npm run inspector
# Use MCP inspector to test the tool
```

### Database Queries Best Practices

**Use prepared statements:**
```typescript
// ✅ Good - prevents SQL injection
await query('SELECT * FROM tests WHERE name = $1', [testName]);

// ❌ Bad - vulnerable to SQL injection
await query(`SELECT * FROM tests WHERE name = '${testName}'`);
```

**Use transactions for multi-step operations:**
```typescript
import { transaction } from '../db.js';

await transaction(async (client) => {
  await client.query('INSERT INTO failures ...');
  await client.query('UPDATE stats ...');
  // Both succeed or both roll back
});
```

**Handle errors gracefully:**
```typescript
try {
  const results = await query('...');
  return results;
} catch (error) {
  console.error('Query failed:', error);
  throw new Error(`Failed to fetch data: ${error}`);
}
```

### Testing Locally

**Development mode with auto-reload:**
```bash
npm run dev
```

**Use MCP Inspector:**
```bash
npm run inspector
# Opens interactive web UI for testing tools
```

**Manual testing with Claude Code:**
1. Build the server: `npm run build`
2. Update Claude Code config
3. Restart Claude Code
4. Test tools interactively

---

## Best Practices

### For AI Assistants Using These Tools

#### 1. Always Search Knowledge Base First

```
User: "Why did test X fail?"

CORRECT FLOW:
1. testops_search_knowledge({ query: "test X" })
   ↓
   Found? → Present solution
   Not found? → Continue to step 2

2. testops_analyze_failure({ testName: "test X", ... })
   ↓
   Present analysis + ask if they want to add to KB

3. (After resolution) testops_add_knowledge(...)
```

#### 2. Use Batch Analysis for Multiple Failures

```
User: "CI run failed with 15 test failures"

CORRECT FLOW:
1. testops_batch_analyze({ testRunId: "..." })
   ↓
   Get summary + priorities

2. Focus on high-priority failures
   ↓
   testops_search_knowledge for each

3. Deep dive if needed
   ↓
   testops_analyze_failure (with logs) for complex cases
```

#### 3. Be Cost-Conscious with Logs

```
❌ BAD:
testops_analyze_failure({
  testName: "...",
  errorMessage: "...",
  logs: entireLogFile  // 500KB
})

✅ GOOD:
testops_analyze_failure({
  testName: "...",
  errorMessage: "...",
  logs: lastNLines(logFile, 200)  // ~5000 chars
})
```

#### 4. Build Knowledge Base Over Time

```
After helping user resolve a failure:

"I've helped you fix this issue. Would you like me to add it to
the knowledge base so you (or teammates) can find the solution
instantly next time?"

→ testops_add_knowledge(...)
```

### For Developers Extending the Server

#### 1. Input Validation

Always use Zod schemas:
```typescript
const InputSchema = z.object({
  required: z.string(),
  optional: z.number().optional(),
});

export async function myTool(input: any) {
  const validated = InputSchema.parse(input);  // Throws if invalid
  // ... use validated data
}
```

#### 2. Error Handling

Provide helpful error messages:
```typescript
try {
  // ... operation
} catch (error) {
  console.error('Operation failed:', error);
  throw new Error(
    `Failed to perform operation: ${error instanceof Error ? error.message : 'Unknown error'}`
  );
}
```

#### 3. Cost Tracking

Track AI usage for analysis:
```typescript
let cost = 0;

// Track embedding generation
cost += 0.001;

// Track AI completion
const tokens = estimateTokens(prompt);
cost += (tokens / 1000000) * 3;  // $3 per million tokens

return {
  ...result,
  estimatedCostUSD: Math.round(cost * 1000) / 1000,
};
```

#### 4. Database Performance

Use indexes for common queries:
```sql
-- In backend/prisma/schema.prisma
@@index([testName])
@@index([status, createdAt])
```

Limit results:
```typescript
await query(`
  SELECT * FROM tests
  WHERE status = 'FAILED'
  ORDER BY created_at DESC
  LIMIT 100  -- Always limit!
`, []);
```

---

## Troubleshooting

### Common Issues

#### "DATABASE_URL not set"

**Symptoms:**
```
⚠️  WARNING: DATABASE_URL not set
Error: Connection string is not set
```

**Solution:**
```bash
cp .env.example .env
# Edit .env and set DATABASE_URL
DATABASE_URL=postgresql://user:pass@localhost:5432/testops
```

#### "Table 'failure_records' does not exist"

**Symptoms:**
```
Error: relation "failure_records" does not exist
```

**Solution:**
Run backend migrations first:
```bash
cd ../backend
npm run db:migrate
```

#### "AI features are disabled"

**Symptoms:**
```
⚠️  WARNING: AI features are disabled
```

**Solution:**
```bash
# In .env
AI_ENABLED=true
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
```

#### "Connection timeout"

**Symptoms:**
```
Error: connect ETIMEDOUT
```

**Solutions:**
1. Check database is running:
   ```bash
   docker-compose up -d db
   ```

2. Verify connection string:
   ```bash
   psql $DATABASE_URL
   ```

3. Check network/firewall

#### "Module not found"

**Symptoms:**
```
Error: Cannot find module './tools/analyze.js'
```

**Solution:**
Rebuild the project:
```bash
npm run build
```

#### Tool Returns Empty Results

**Debug steps:**
1. Check database has data:
   ```sql
   SELECT COUNT(*) FROM failure_records;
   SELECT COUNT(*) FROM test_runs;
   ```

2. Check query filters:
   ```typescript
   // Add logging
   console.log('Query params:', params);
   ```

3. Test query directly:
   ```bash
   psql $DATABASE_URL -c "SELECT * FROM failure_records LIMIT 1"
   ```

### Debugging Tips

#### Enable Verbose Logging

```bash
LOG_LEVEL=debug npm run dev
```

#### Check MCP Communication

```bash
# In one terminal
npm run dev

# In another terminal
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node dist/index.js
```

#### Test Database Connection

```typescript
// src/db.ts
export async function testConnection() {
  const client = getPool();
  const result = await client.query('SELECT version()');
  console.log('Database version:', result.rows[0]);
}
```

#### Monitor Token Usage

```typescript
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

console.log('Estimated tokens:', estimateTokens(inputText));
```

---

## Performance Optimization

### Database Query Optimization

**Use indexes:**
```prisma
model FailureRecord {
  // ...
  @@index([testName])
  @@index([category])
  @@index([resolvedAt])
}
```

**Limit results:**
```typescript
// ❌ Bad - returns all rows
SELECT * FROM test_results

// ✅ Good - limits results
SELECT * FROM test_results
ORDER BY created_at DESC
LIMIT 100
```

**Use aggregations:**
```typescript
// ❌ Bad - fetch all then count in JS
const rows = await query('SELECT * FROM tests');
const count = rows.length;

// ✅ Good - count in database
const result = await query('SELECT COUNT(*) as count FROM tests');
const count = result[0].count;
```

### Caching

Implement caching for expensive operations:

```typescript
const cache = new Map<string, { data: any; expires: number }>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && entry.expires > Date.now()) {
    return entry.data as T;
  }
  return null;
}

function setCache(key: string, data: any, ttlMs: number): void {
  cache.set(key, {
    data,
    expires: Date.now() + ttlMs,
  });
}
```

### Batch Operations

Process multiple items efficiently:

```typescript
// ❌ Bad - N queries
for (const test of tests) {
  await query('SELECT * FROM results WHERE test_name = $1', [test.name]);
}

// ✅ Good - 1 query with IN clause
const testNames = tests.map(t => t.name);
await query(
  'SELECT * FROM results WHERE test_name = ANY($1)',
  [testNames]
);
```

---

## Security Considerations

### Input Validation

Always validate and sanitize inputs:

```typescript
// ✅ Good - use Zod for validation
const InputSchema = z.object({
  testName: z.string().max(500),  // Limit length
  errorMessage: z.string().max(5000),
});

const validated = InputSchema.parse(input);
```

### SQL Injection Prevention

Always use prepared statements:

```typescript
// ✅ Good
await query('SELECT * FROM tests WHERE id = $1', [testId]);

// ❌ Bad
await query(`SELECT * FROM tests WHERE id = '${testId}'`);
```

### Environment Variables

Never commit sensitive data:

```bash
# ✅ Good - in .env (gitignored)
ANTHROPIC_API_KEY=sk-ant-...

# ❌ Bad - hardcoded
const apiKey = 'sk-ant-...';
```

### Error Messages

Don't leak sensitive information:

```typescript
// ✅ Good
throw new Error('Failed to fetch data');

// ❌ Bad
throw new Error(`Failed: ${DATABASE_URL} connection failed`);
```

---

## Future Enhancements

### Planned Features

1. **Vector Similarity Search**
   - Replace text search with semantic embeddings
   - More accurate similar failure matching
   - Cost: ~$0.001 per search (same as current)

2. **Real-time AI Integration**
   - Direct calls to backend AI services
   - Remove mock implementations
   - Enable full RCA analysis

3. **Webhook Integration**
   - Notify on high-priority failures
   - Auto-create knowledge base entries
   - Slack/Teams notifications

4. **Advanced Analytics**
   - Trend analysis over time
   - Predictive failure detection
   - Team performance metrics

5. **Multi-tenant Support**
   - Isolated knowledge bases per team
   - Cost tracking per team
   - Role-based access control

### Contributing

Want to add a feature? Here's the process:

1. **Discuss** - Open an issue describing the feature
2. **Design** - Document the tool interface
3. **Implement** - Follow patterns in existing tools
4. **Test** - Use MCP inspector to test
5. **Document** - Update this file and README
6. **Submit** - Create a pull request

---

## Resources

### MCP Documentation
- [Model Context Protocol Docs](https://modelcontextprotocol.io/)
- [MCP SDK Reference](https://github.com/modelcontextprotocol/sdk)

### TestOps Companion
- [Main Documentation](../docs/)
- [Backend Architecture](../backend/README.md)
- [API Reference](../docs/api/)

### Development Tools
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Zod Validation](https://zod.dev/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

---

**Last Updated:** 2026-01-20

**Version:** 1.0.0

**Maintained by:** TestOps Companion Team
