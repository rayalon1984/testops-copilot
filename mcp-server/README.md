# TestOps Copilot MCP Server

> **AI-Powered Test Failure Analysis via Model Context Protocol**

MCP server providing intelligent test failure analysis, knowledge base management, and comprehensive statistics for TestOps Copilot.

## 🚀 Quick Start

### Installation

```bash
# From project root
cd mcp-server
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your configuration
# Minimum required: DATABASE_URL

# Build the server
npm run build
```

### Configuration

Add to your Claude Code MCP settings (`~/.claude/config.json`):

```json
{
  "mcpServers": {
    "testops": {
      "command": "node",
      "args": ["/path/to/testops-copilot/mcp-server/dist/index.js"],
      "env": {
        "DATABASE_URL": "postgresql://user:pass@localhost:5432/testops"
      }
    }
  }
}
```

### Development Mode

```bash
# Watch mode with auto-reload
npm run dev

# Or use the MCP inspector for testing
npm run inspector
```

## 🛠️ Available Tools

### 1. **testops_analyze_failure**
Analyze a single test failure using AI.

**Use when:**
- You have a failing test and want to understand why
- You need categorization, similar failures, and root cause
- You want AI-powered recommendations

**Cost:** ~$0.01-0.05 per analysis (varies with log size)

**Example:**
```typescript
{
  "testName": "login-test-timeout",
  "errorMessage": "Timeout waiting for element #login-button",
  "logs": "... last 5000 chars of log output ...",
  "pipeline": "frontend-ci",
  "branch": "main"
}
```

### 2. **testops_batch_analyze**
Analyze multiple failures from a CI run at once.

**Use when:**
- Multiple tests failed in a CI run
- You want to detect common patterns
- You need to prioritize which failures to fix first

**Cost:** ~$0.05-0.30 (cheaper per failure than individual analysis)

**Example:**
```typescript
{
  "testRunId": "uuid-of-test-run"
  // OR
  "failures": [
    { "testName": "test1", "errorMessage": "..." },
    { "testName": "test2", "errorMessage": "..." }
  ],
  "maxFailures": 20
}
```

### 3. **testops_search_knowledge**
Search the knowledge base for similar past failures.

**Use when:**
- You want to check if someone already solved this
- You need quick answers without AI analysis
- You want team-specific solutions

**Cost:** ~$0.001 per search (very cheap!)

**Example:**
```typescript
{
  "query": "database connection refused",
  "category": "INFRASTRUCTURE_ISSUE",
  "limit": 10
}
```

### 4. **testops_add_knowledge**
Add a resolved failure to the knowledge base.

**Use when:**
- You've resolved a failure and want to help future you
- You want to build organizational knowledge
- You want to reduce repetitive debugging

**Cost:** ~$0.001 per entry

**Example:**
```typescript
{
  "testName": "payment-processing-test",
  "errorMessage": "Connection timeout to payment gateway",
  "category": "INFRASTRUCTURE_ISSUE",
  "resolution": "Increased timeout from 5s to 15s in config",
  "resolvedBy": "alice@example.com",
  "ticketUrl": "https://github.com/org/repo/pull/123"
}
```

### 5. **testops_get_pipeline_stats**
Get statistics and health metrics for pipelines.

**Example:**
```typescript
{
  "pipelineId": "uuid-of-pipeline", // optional
  "limit": 10,
  "daysBack": 30
}
```

### 6. **testops_get_test_history**
Get detailed history and flakiness analysis for a test.

**Example:**
```typescript
{
  "testName": "user-registration-test",
  "daysBack": 90,
  "limit": 20
}
```

### 7. **testops_get_cost_stats**
Get AI usage and cost statistics.

**Example:**
```typescript
{
  "startDate": "2024-01-01",
  "endDate": "2024-01-31"
}
```

### 8. **testops_health_check**
Check health status of all services.

**Example:**
```typescript
{} // no arguments needed
```

## 💡 Best Practices

### 1. Search Knowledge Base First
Always use `testops_search_knowledge` before expensive AI analysis:

```
❌ Bad: Immediately run testops_analyze_failure
✅ Good: Search knowledge base first, then analyze if not found
```

Cost savings: ~98% ($0.001 vs $0.05)

### 2. Use Batch Analysis for Multiple Failures
```
❌ Bad: Analyze 10 failures individually = $0.50
✅ Good: Batch analyze all 10 = $0.10
```

Cost savings: ~80%

### 3. Limit Log Size
Only include relevant log portions (last 5000 chars recommended):

```
❌ Bad: Include entire 500KB log file
✅ Good: Include last 5000 chars around the error
```

Cost savings: ~90%

### 4. Build Knowledge Base
Always add resolutions to the knowledge base:

```typescript
// After fixing a failure
await testops_add_knowledge({
  testName: "...",
  category: "...",
  resolution: "Clear description of what fixed it",
  resolvedBy: "your-email@example.com"
});
```

Future benefit: Others find solution instantly without AI analysis

## 📊 Cost Optimization

### Typical Costs

| Tool | Average Cost | Use Case |
|------|-------------|----------|
| search_knowledge | $0.001 | First line of defense |
| analyze_failure (no logs) | $0.01 | Quick categorization |
| analyze_failure (with logs) | $0.05 | Full RCA |
| batch_analyze | $0.10 | 10-20 failures |
| add_knowledge | $0.001 | Build knowledge base |

### Monthly Budget Example

**Small team (100 test runs/month):**
- Search first: 100 × $0.001 = $0.10
- Full analysis when needed: 20 × $0.05 = $1.00
- **Total: ~$1.10/month**

**Medium team (500 test runs/month):**
- Search first: 500 × $0.001 = $0.50
- Batch analysis: 50 runs × $0.10 = $5.00
- **Total: ~$5.50/month**

## 🔧 Advanced Configuration

### Environment Variables

```env
# Required
DATABASE_URL=postgresql://user:pass@localhost:5432/testops

# Optional - AI Configuration
AI_ENABLED=true
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Optional - Vector Search
WEAVIATE_URL=http://localhost:8081
ENABLE_SEMANTIC_SEARCH=true

# Optional - Feature Flags
ENABLE_BATCH_ANALYSIS=true
ENABLE_AUTO_CATEGORIZATION=true

# Optional - Cost Controls
ENABLE_COST_TRACKING=true
COST_ALERT_THRESHOLD_USD=100
```

### Database Setup

The MCP server uses the same database as TestOps Copilot backend:

```sql
-- Required tables
- failure_records (knowledge base)
- test_runs (test execution data)
- test_results (individual test results)
- pipelines (pipeline configuration)
- ai_usage (cost tracking)
```

These are automatically created by TestOps Copilot migrations.

## 🧪 Testing

### Manual Testing

```bash
# Start in development mode
npm run dev

# In another terminal, use MCP inspector
npm run inspector

# Or test individual tools
node dist/index.js
```

### Integration Testing

```bash
# Run with Claude Code
# The server will be started automatically by Claude Code

# Check logs
tail -f ~/.claude/logs/mcp-testops.log
```

## 🐛 Debugging

### Enable Verbose Logging

```bash
LOG_LEVEL=debug npm run dev
```

### Common Issues

**"DATABASE_URL not set"**
- Solution: Copy `.env.example` to `.env` and configure

**"AI features are disabled"**
- Solution: Set `AI_ENABLED=true` in `.env`
- Add API key: `ANTHROPIC_API_KEY=...`

**"Table 'failure_records' does not exist"**
- Solution: Run TestOps Copilot migrations first
- `cd backend && npm run db:migrate`

**"Connection timeout"**
- Solution: Check database is running
- `docker-compose up -d db` (from project root)

## 📚 See Also

- [SKILL.md](./SKILL.md) - Comprehensive development guide
- [TestOps Copilot Docs](../docs/)
- [Model Context Protocol Docs](https://modelcontextprotocol.io/)

## 📝 License

Apache-2.0 - See [LICENSE](../LICENSE)

## 🤝 Contributing

Contributions welcome! See main project [CONTRIBUTING.md](../CONTRIBUTING.md)

---

**Need help?** Open an issue at https://github.com/rayalon1984/testops-copilot/issues
