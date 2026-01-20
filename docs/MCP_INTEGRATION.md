# MCP Server Integration Guide

> **Integrate TestOps Companion with Claude Code and other AI assistants**

---

## Overview

The TestOps Companion MCP Server enables AI assistants to intelligently analyze test failures, manage knowledge bases, and provide actionable insights. This guide covers setup, configuration, and best practices.

## What is MCP?

**Model Context Protocol (MCP)** is a standard way for AI assistants to access external tools and data. Instead of sending large codebases as context, AI assistants call focused tools that execute server-side.

### Benefits

- **98% Token Reduction**: Tools execute server-side, not in LLM context
- **Cost Savings**: $1-5/month instead of $100+/month
- **Live Data Access**: Real-time test results, pipelines, metrics
- **Team Knowledge**: Shared solutions in searchable knowledge base
- **Smart Batching**: Analyze 20 failures for $0.10 vs $1.00 individually

---

## Prerequisites

- TestOps Companion backend installed and running
- PostgreSQL database with migrations applied
- Node.js 18+ installed
- Claude Code or compatible MCP client

---

## Quick Start

### 1. Build MCP Server

```bash
cd mcp-server
npm install
npm run build
```

### 2. Configure Environment

```bash
cd mcp-server
cp .env.example .env

# Edit .env with your settings
nano .env
```

Minimum required configuration:
```env
DATABASE_URL=postgresql://testops:testops@localhost:5432/testops
```

Optional AI features:
```env
AI_ENABLED=true
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
```

### 3. Configure Claude Code

Edit your Claude Code MCP configuration:

**Location:** `~/.claude/config.json` (or `%APPDATA%\Claude\config.json` on Windows)

```json
{
  "mcpServers": {
    "testops": {
      "command": "node",
      "args": [
        "/absolute/path/to/testops-companion/mcp-server/dist/index.js"
      ],
      "env": {
        "DATABASE_URL": "postgresql://testops:testops@localhost:5432/testops",
        "AI_ENABLED": "true",
        "AI_PROVIDER": "anthropic",
        "ANTHROPIC_API_KEY": "your-key-here"
      }
    }
  }
}
```

### 4. Restart Claude Code

```bash
# The MCP server will start automatically when Claude Code launches
```

### 5. Verify Installation

In Claude Code, ask:
```
Can you check the health of TestOps services?
```

Claude should respond using `testops_health_check` tool.

---

## Configuration Options

### Full Configuration Example

```json
{
  "mcpServers": {
    "testops": {
      "command": "node",
      "args": ["/path/to/mcp-server/dist/index.js"],
      "env": {
        // Required
        "DATABASE_URL": "postgresql://testops:testops@localhost:5432/testops",

        // AI Configuration (optional but recommended)
        "AI_ENABLED": "true",
        "AI_PROVIDER": "anthropic",
        "ANTHROPIC_API_KEY": "sk-ant-...",

        // Vector Search (optional)
        "WEAVIATE_URL": "http://localhost:8081",
        "ENABLE_SEMANTIC_SEARCH": "true",

        // Cost Controls (optional)
        "ENABLE_COST_TRACKING": "true",
        "COST_ALERT_THRESHOLD_USD": "100",

        // Feature Flags (optional)
        "ENABLE_BATCH_ANALYSIS": "true",
        "ENABLE_AUTO_CATEGORIZATION": "true",

        // Logging (optional)
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

### Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | ✅ Yes | - | PostgreSQL connection string |
| `AI_ENABLED` | No | `false` | Enable AI-powered analysis |
| `AI_PROVIDER` | No | `anthropic` | AI provider (anthropic, openai, google, azure) |
| `ANTHROPIC_API_KEY` | If AI enabled | - | Anthropic API key |
| `WEAVIATE_URL` | No | - | Vector database URL for semantic search |
| `ENABLE_SEMANTIC_SEARCH` | No | `false` | Use vector similarity instead of text search |
| `ENABLE_COST_TRACKING` | No | `true` | Track AI usage and costs |
| `COST_ALERT_THRESHOLD_USD` | No | `100` | Alert when costs exceed threshold |
| `LOG_LEVEL` | No | `info` | Logging level (debug, info, warn, error) |

---

## Usage Examples

### Example 1: Analyze a Test Failure

```
User: "My login test failed with a timeout error. Can you help?"

Claude:
1. Searches knowledge base first
2. If not found, analyzes with AI
3. Provides categorization, similar failures, and solution
4. Asks if you want to add to knowledge base
```

**Tools used:**
- `testops_search_knowledge` ($0.001)
- `testops_analyze_failure` ($0.05) - only if not found in KB

### Example 2: CI Run Analysis

```
User: "My CI run 123e4567-... failed with 15 test failures. What's going on?"

Claude:
1. Batch analyzes all 15 failures
2. Identifies patterns (e.g., "10 are infrastructure issues")
3. Prioritizes which to fix first
4. Provides summary and recommendations
```

**Tools used:**
- `testops_batch_analyze` ($0.10)

**Cost savings:** 85% vs analyzing individually

### Example 3: Investigate Flaky Test

```
User: "Is 'user-registration-test' flaky?"

Claude:
1. Gets test history
2. Calculates flakiness score
3. Shows failure patterns
4. Recommends quarantine or fix
```

**Tools used:**
- `testops_get_test_history` (free - no AI)

### Example 4: Cost Monitoring

```
User: "How much have we spent on AI analysis this month?"

Claude:
1. Gets cost stats
2. Shows breakdown by feature
3. Identifies most expensive operations
4. Suggests optimizations
```

**Tools used:**
- `testops_get_cost_stats` (free - no AI)

---

## Best Practices

### 1. Build Knowledge Base

**Always add resolved failures:**
```
After fixing: "Can you add this to the knowledge base?"
→ Claude calls testops_add_knowledge
→ Future similar failures resolve instantly
```

**Cost benefit:** 90% reduction for recurring issues

### 2. Use Batch Analysis

**For multiple failures:**
```
❌ "Analyze test1, then test2, then test3..."
✅ "Analyze all failures from run abc123"
```

**Cost benefit:** 80% reduction

### 3. Search Before Analyzing

**Claude does this automatically:**
```
1. Search KB first ($0.001)
2. Only analyze if not found ($0.05)
```

**Cost benefit:** 98% reduction on known issues

### 4. Limit Log Size

**When providing logs:**
```
❌ "Here's the entire 500KB log file"
✅ "Here are the last 200 lines around the error"
```

**Cost benefit:** 99% reduction in token costs

---

## Troubleshooting

### Server Not Starting

**Check logs:**
```bash
tail -f ~/.claude/logs/mcp-testops.log
```

**Common issues:**
- DATABASE_URL not set → Check config.json
- Path incorrect → Use absolute path
- Build not done → Run `npm run build` in mcp-server/

### "Database connection failed"

**Verify database:**
```bash
psql $DATABASE_URL -c "SELECT 1"
```

**Common issues:**
- Database not running → `docker-compose up -d db`
- Wrong credentials → Check DATABASE_URL
- Firewall blocking → Check network settings

### "AI features disabled"

**Check configuration:**
```json
{
  "env": {
    "AI_ENABLED": "true",
    "ANTHROPIC_API_KEY": "sk-ant-..."
  }
}
```

### Tools Not Appearing

**Restart Claude Code:**
```bash
# Kill Claude Code process
# Restart Claude Code
```

**Verify server is running:**
```bash
ps aux | grep "mcp-server"
```

### High Costs

**Review usage:**
```
Ask Claude: "Show me cost stats for this month"
→ testops_get_cost_stats
```

**Common causes:**
- Not searching KB first → Update workflow
- Including full logs → Limit log size
- Analyzing individually → Use batch analysis

**Solutions:**
- Enable `ENABLE_COST_TRACKING=true`
- Set `COST_ALERT_THRESHOLD_USD=50`
- Review and optimize usage patterns

---

## Advanced Configuration

### Using Multiple AI Providers

```json
{
  "mcpServers": {
    "testops-anthropic": {
      "command": "node",
      "args": ["/path/to/mcp-server/dist/index.js"],
      "env": {
        "AI_PROVIDER": "anthropic",
        "ANTHROPIC_API_KEY": "..."
      }
    },
    "testops-openai": {
      "command": "node",
      "args": ["/path/to/mcp-server/dist/index.js"],
      "env": {
        "AI_PROVIDER": "openai",
        "OPENAI_API_KEY": "..."
      }
    }
  }
}
```

### Remote Database

```json
{
  "env": {
    "DATABASE_URL": "postgresql://user:pass@remote-host:5432/testops?sslmode=require"
  }
}
```

### Docker Deployment

```dockerfile
# Dockerfile for MCP server
FROM node:18-alpine

WORKDIR /app
COPY mcp-server/package*.json ./
RUN npm ci --production

COPY mcp-server/dist ./dist

CMD ["node", "dist/index.js"]
```

---

## Monitoring and Maintenance

### Health Checks

```bash
# Check server health
echo '{"method":"tools/call","params":{"name":"testops_health_check","arguments":{}}}' | \
  node mcp-server/dist/index.js
```

### Log Monitoring

```bash
# Real-time logs
tail -f ~/.claude/logs/mcp-testops.log

# Search for errors
grep ERROR ~/.claude/logs/mcp-testops.log
```

### Database Maintenance

```bash
# Clean old records (from backend)
cd backend
npm run db:cleanup
```

### Cost Monitoring

Regular reviews:
```
Weekly: Check cost stats
Monthly: Review and optimize usage
Quarterly: Audit knowledge base quality
```

---

## Migration from Manual Analysis

### Before MCP (Manual Process)

1. Test fails
2. Copy logs to ChatGPT
3. Ask for analysis
4. Lose conversation history
5. Repeat for next failure

**Cost:** ~$0.10 per failure (large context)
**Time:** 5-10 minutes per failure

### After MCP (Automated Process)

1. Test fails
2. Ask Claude Code: "Why did test X fail?"
3. Claude searches KB → instant answer (if known)
4. Or analyzes with AI → categorization + solution
5. Add to KB for future

**Cost:** $0.001-0.05 per failure (tools only)
**Time:** 30 seconds per failure

**Savings:** 90% cost reduction, 95% time reduction

---

## Security Considerations

### API Keys

- Store in environment variables, not code
- Use different keys for dev/prod
- Rotate keys regularly
- Set usage limits in provider dashboard

### Database Access

- Use read-only user if possible
- Restrict network access
- Use SSL/TLS for connections
- Don't expose database publicly

### MCP Configuration

- Use absolute paths to prevent injection
- Validate all environment variables
- Log access for audit trail
- Monitor for unusual activity

---

## Support and Resources

### Documentation

- [MCP Server README](../mcp-server/README.md)
- [SKILL.md](../mcp-server/SKILL.md) - Developer guide
- [API Documentation](./api/)

### Getting Help

- GitHub Issues: https://github.com/rayalon1984/testops-companion/issues
- Discussions: https://github.com/rayalon1984/testops-companion/discussions

### Contributing

Want to improve the MCP server? See [CONTRIBUTING.md](../CONTRIBUTING.md)

---

**Last Updated:** 2026-01-20

**Version:** 1.0.0
