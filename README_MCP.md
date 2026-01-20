# 🤖 TestOps Companion MCP Server

> **AI-Powered Test Failure Analysis for Claude Code and other AI Assistants**

---

## What's This?

The TestOps Companion MCP (Model Context Protocol) Server enables AI assistants like Claude Code to intelligently analyze test failures, manage knowledge bases, and provide actionable insights - all while dramatically reducing token usage and costs.

## Quick Facts

- **98% Token Reduction**: Tools execute server-side, not in LLM context
- **Cost Effective**: $1-5/month instead of $100+/month
- **8 Powerful Tools**: Analysis, knowledge base, statistics, health checks
- **Smart Batching**: Analyze 20 failures for $0.10 vs $1.00 individually
- **Team Knowledge**: Build and search organizational failure solutions

---

## Quick Start

### 1. Install Dependencies

```bash
cd mcp-server
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your DATABASE_URL
```

### 3. Build Server

```bash
npm run build
```

### 4. Configure Claude Code

Edit `~/.claude/config.json`:

```json
{
  "mcpServers": {
    "testops": {
      "command": "node",
      "args": ["/absolute/path/to/testops-companion/mcp-server/dist/index.js"],
      "env": {
        "DATABASE_URL": "postgresql://testops:testops@localhost:5432/testops"
      }
    }
  }
}
```

### 5. Test

Restart Claude Code and ask:
```
Can you check the health of TestOps services?
```

---

## Available Tools

### 🔍 Analysis Tools

- **`testops_analyze_failure`** - Comprehensive single failure analysis
  - Cost: $0.01-0.05 per analysis
  - Provides: Categorization, similar failures, root cause, solution

- **`testops_batch_analyze`** - Batch analyze multiple failures from CI runs
  - Cost: $0.05-0.30 for 10-20 failures
  - 80% cheaper than analyzing individually

### 📚 Knowledge Base Tools

- **`testops_search_knowledge`** - Search historical failures with solutions
  - Cost: $0.001 per search (very cheap!)
  - Returns: Team-specific solutions with ticket links

- **`testops_add_knowledge`** - Add resolved failures to knowledge base
  - Cost: $0.001 per entry
  - Builds: Organizational knowledge over time

- **`testops_get_knowledge_stats`** - Knowledge base statistics
  - Cost: Free (no AI)

### 📊 Statistics Tools

- **`testops_get_pipeline_stats`** - Pipeline health and metrics
  - Cost: Free (no AI)

- **`testops_get_test_history`** - Test flakiness analysis
  - Cost: Free (no AI)

- **`testops_get_cost_stats`** - AI usage and cost tracking
  - Cost: Free (no AI)

- **`testops_health_check`** - Service health monitoring
  - Cost: Free (no AI)

---

## Cost Optimization

### Search-First Pattern

```
❌ Bad: Analyze every failure → $0.05 each
✅ Good: Search KB first → $0.001, only analyze if not found

Savings: 98% for known issues
```

### Batch Analysis

```
❌ Bad: 10 individual analyses → $0.50
✅ Good: 1 batch analysis → $0.10

Savings: 80%
```

### Build Knowledge Base

```
First time: Analyze ($0.05) + Add to KB ($0.001)
Next 11 times: Search KB ($0.001 each)

Annual savings: $0.54 per recurring issue (90%)
```

---

## Documentation

- **[README.md](mcp-server/README.md)** - User documentation
- **[SKILL.md](mcp-server/SKILL.md)** - Comprehensive developer guide
- **[MCP_INTEGRATION.md](docs/MCP_INTEGRATION.md)** - Integration guide
- **[CHANGELOG.md](mcp-server/CHANGELOG.md)** - Version history

---

## Usage Examples

### Example 1: Single Test Failure

```
User: "My login test is timing out, can you help?"

Claude:
1. Searches knowledge base first ($0.001)
2. If not found, analyzes with AI ($0.05)
3. Provides categorization + similar failures + solution
4. Asks if you want to add to knowledge base
```

### Example 2: CI Run Analysis

```
User: "CI run failed with 15 test failures"

Claude:
1. Batch analyzes all failures ($0.10)
2. Identifies patterns (e.g., "10 infrastructure issues")
3. Prioritizes fixes (high/medium/low)
4. Provides actionable summary
```

### Example 3: Investigate Flaky Test

```
User: "Is 'checkout-test' flaky?"

Claude:
1. Gets test history (free)
2. Calculates flakiness score (0-1)
3. Shows failure patterns
4. Recommends fix or quarantine
```

---

## Development

### Build

```bash
npm run mcp:build
# or
cd mcp-server && npm run build
```

### Development Mode

```bash
npm run mcp:dev
# or
cd mcp-server && npm run dev
```

### Testing with MCP Inspector

```bash
npm run mcp:inspector
# or
cd mcp-server && npm run inspector
```

### Type Checking

```bash
npm run typecheck:mcp
# or
cd mcp-server && npm run typecheck
```

---

## Architecture

```
┌─────────────────┐
│  Claude Code    │ (AI Assistant)
└────────┬────────┘
         │ MCP Protocol (stdio/JSON-RPC)
         ▼
┌─────────────────┐
│   MCP Server    │ (Node.js)
└────────┬────────┘
         │
         ├─────▶ PostgreSQL (TestOps data)
         ├─────▶ AI Providers (Anthropic/OpenAI/etc)
         ├─────▶ Vector DB (Weaviate - semantic search)
         └─────▶ Cache (Redis - optional)
```

---

## Troubleshooting

### Server Not Starting

```bash
# Check logs
tail -f ~/.claude/logs/mcp-testops.log

# Verify build
cd mcp-server && npm run build

# Check config path
grep testops ~/.claude/config.json
```

### Database Connection Issues

```bash
# Test connection
psql $DATABASE_URL -c "SELECT 1"

# Start database
docker-compose up -d db
```

### Tools Not Appearing

```bash
# Restart Claude Code
# Verify server is running:
ps aux | grep mcp-server
```

---

## Requirements

- Node.js 18+
- PostgreSQL database (same as TestOps Companion)
- Claude Code or compatible MCP client

---

## License

Apache-2.0 - See [LICENSE](LICENSE)

---

## Support

- **Documentation**: [docs/MCP_INTEGRATION.md](docs/MCP_INTEGRATION.md)
- **Issues**: https://github.com/rayalon1984/testops-companion/issues
- **Discussions**: https://github.com/rayalon1984/testops-companion/discussions

---

**Built with ❤️ by the TestOps Companion Team**
