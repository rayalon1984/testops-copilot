# AI_TOOLS.md — AI Tool Registry

> **Owner**: AI Architect · **Status**: Living document · **Version**: 3.1.1 · **Last verified**: 2026-03-01

---

## 1. Tool Classification

| Category | Count | Confirmation | Policy |
|----------|-------|-------------|--------|
| **Read-only** | 8 | No | Auto-approved — safe, no side effects |
| **Write** | 6 | Yes | Requires explicit user approval (5-min TTL) |

---

## 2. Read-Only Tools (Auto-Approved)

### `jira_search`
- **Description**: Search Jira issues by error message or keywords
- **Parameters**:
  - `query` (string, required) — Search text
  - `maxResults` (number, optional) — Limit results
  - `statusFilter` (string[], optional) — Filter by status
- **Returns**: Array of matching Jira issues

### `jira_get`
- **Description**: Get full details of a specific Jira issue by key
- **Parameters**:
  - `issueKey` (string, required) — e.g. "PROJ-123"
- **Returns**: Issue object with summary, description, status, assignee, comments

### `github_get_commit`
- **Description**: Get files changed in a specific Git commit
- **Parameters**:
  - `owner` (string, required) — Repository owner
  - `repo` (string, required) — Repository name
  - `commitSha` (string, required) — Commit SHA
- **Returns**: Commit details with file changes and diffs (truncated to 2,000 chars)

### `github_get_pr`
- **Description**: Find pull request associated with a commit SHA
- **Parameters**:
  - `owner` (string, required) — Repository owner
  - `repo` (string, required) — Repository name
  - `commitSha` (string, required) — Commit SHA
- **Returns**: PR details with title, body, status, changed files (top 5 by relevance)

### `confluence_search`
- **Description**: Search Confluence for documentation, RCAs, and runbooks
- **Parameters**:
  - `query` (string, required) — CQL search text
  - `maxResults` (number, optional) — Limit results
  - `labels` (string[], optional) — Filter by label
- **Returns**: Array of matching Confluence pages with title, excerpt, URL

### `jenkins_get_status`
- **Description**: Get pipeline status and recent build results
- **Parameters**:
  - `pipelineName` (string, required) — Pipeline/job name
  - `limit` (number, optional) — Number of recent builds
- **Returns**: Pipeline health with recent build statuses, durations, results

### `dashboard_metrics`
- **Description**: Get dashboard metrics (test counts, failure rates, pipeline health)
- **Parameters**:
  - `timeRange` (string, optional) — Enum: `7d`, `30d`, `90d`
- **Returns**: Aggregated metrics: total tests, pass/fail/flaky rates, top failures

### `rca_identify`
- **Description**: Identify root cause of a test failure using AI analysis. Returns structured RCA data with confidence score, failure category, and related issues.
- **Parameters**:
  - `testName` (string, required) — Fully qualified test name (e.g. `PaymentProcessor.processCheckout`)
  - `testRunId` (string, optional) — Specific test run to analyze
- **Returns**: Root cause analysis: title, rootCause description, confidence (0–1), category (timeout/assertion/env/flaky), relatedIssue key

---

## 3. Write Tools (Confirmation Required)

### `jira_create_issue`
- **Description**: Create a new Jira issue
- **Parameters**:
  - `summary` (string, required) — Issue title
  - `description` (string, required) — Issue body
  - `type` (enum, required) — `BUG` | `TASK` | `STORY` | `EPIC`
  - `labels` (string[], optional) — Issue labels
- **Returns**: Created issue key and URL

### `jira_transition_issue`
- **Description**: Move a Jira issue to a new status
- **Parameters**:
  - `issueKey` (string, required) — e.g. "PROJ-123"
  - `status` (enum, required) — `TODO` | `IN_PROGRESS` | `DONE`
- **Returns**: Updated issue status

### `jira_comment`
- **Description**: Add a comment to an existing Jira issue
- **Parameters**:
  - `issueKey` (string, required) — e.g. "PROJ-123"
  - `body` (string, required) — Comment text (Markdown)
- **Returns**: Created comment ID

### `github_create_pr`
- **Description**: Create a pull request on GitHub
- **Parameters**:
  - `owner` (string, required) — Repository owner
  - `repo` (string, required) — Repository name
  - `title` (string, required) — PR title
  - `body` (string, required) — PR description
  - `head` (string, required) — Source branch
  - `base` (string, required) — Target branch
- **Returns**: PR number and URL

### `github_create_branch`
- **Description**: Create a new feature branch
- **Parameters**:
  - `owner` (string, required) — Repository owner
  - `repo` (string, required) — Repository name
  - `branchName` (string, required) — New branch name
  - `baseBranch` (string, optional, default: `main`) — Branch to fork from
- **Returns**: Branch name and SHA

### `github_update_file`
- **Description**: Commit changes to a specific file in a repository
- **Parameters**:
  - `owner` (string, required) — Repository owner
  - `repo` (string, required) — Repository name
  - `path` (string, required) — File path
  - `content` (string, required) — New file content
  - `message` (string, required) — Commit message
  - `branch` (string, required) — Target branch
- **Returns**: Commit SHA and URL

---

## 4. Confirmation Flow (Write Tools)

```
User message → LLM reasons → LLM proposes write tool
    ↓
ConfirmationService.createPendingAction()
    ↓
PendingAction saved to DB (status: PENDING)
    ↓
SSE event: "confirmation_request" { actionId, toolName, description, parameters }
    ↓
ReAct loop PAUSES — waits for user
    ↓
User clicks Approve/Deny in frontend
    ↓
POST /api/v1/ai/confirm { actionId, approved: true/false }
    ↓
IF approved → tool.execute(args, context) → result to chat history
IF denied → "Action denied by user" → chat history
IF expired (>5 min) → "Action expired" → cannot approve
```

**Database**: `PendingAction` table with audit trail (`resolvedBy`, `resolvedAt`).

---

## 5. ReAct Loop

```
FOR iteration = 0 TO 7 (max 8 iterations):
  1. SSE emit "thinking"
  2. provider.chat(messages, { tools })
  3. IF no tool calls → SSE emit "answer" → DONE
  4. FOR each tool call:
     a. Lookup in ToolRegistry
     b. IF write tool → confirmation flow (pause)
     c. IF read tool → execute, SSE emit "tool_result"
     d. Append result to message history
  5. IF toolCallCount >= 5 → stop calling tools
  6. Loop with updated history
```

**SSE Event Types**: `thinking`, `tool_start`, `tool_result`, `confirmation_request`, `confirmation_resolved`, `answer`, `error`, `done`

---

## 6. Provider Registry

| Provider | Model | Input Cost | Output Cost | Context | Env Var |
|----------|-------|-----------|------------|---------|---------|
| Anthropic (default) | Claude Opus 4.6 | $15/1M | $75/1M | 200k | `ANTHROPIC_API_KEY` |
| OpenAI | GPT-4.1 | Varies | Varies | 128k | `OPENAI_API_KEY` |
| Google | Gemini 3.0 Flash | Varies | Varies | 1M | `GOOGLE_API_KEY` |
| Azure OpenAI | GPT-4.1 | Varies | Varies | 128k | `AZURE_OPENAI_KEY` |
| OpenRouter | Claude Sonnet 4.5 | Varies | Varies | 200k | `OPENROUTER_API_KEY` |
| AWS Bedrock | Claude Sonnet 4.5 | $3/1M | $15/1M | 200k | `AWS_BEDROCK_REGION` + IAM or explicit keys |
| Mock | — | $0 | $0 | — | None |

**Selection**: `AI_PROVIDER` env var. Factory via `ProviderRegistry.createFromEnv()`.

**Base interface**: `chat()`, `embed()`, `healthCheck()`, `calculateCost()`

---

## 7. Cost Management

### 7.1 Tracking

Every AI call logged to `ai_usage` table:
- `provider`, `model`, `feature`, `input_tokens`, `output_tokens`, `cost_usd`
- `cached` flag, `user_id`, `request_id`, `response_time_ms`

### 7.2 Budget

| Setting | Env Var | Default |
|---------|---------|---------|
| Monthly budget | `AI_MONTHLY_BUDGET_USD` | $100 |
| Alert threshold | `AI_ALERT_THRESHOLD_PERCENT` | 80% |
| Alert email | `AI_ALERT_EMAIL` | (optional) |

### 7.3 Caching (3-Tier Redis)

| Tier | Key Pattern | TTL | Purpose |
|------|-------------|-----|---------|
| Response | `ai:response:{sha256(prompt)}` | 7d | Full LLM responses |
| Embedding | `ai:embedding:{sha256(text)}` | 7d | Vector embeddings |
| Summary | `ai:summary:{logHash}` | 7d | Log summaries |

Target: >50% cache hit rate. Controlled by `AI_CACHE_ENABLED` and `AI_CACHE_TTL_SECONDS`.

---

## 8. AI Feature Flags

| Feature | Env Var | Default | Description |
|---------|---------|---------|-------------|
| AI system | `AI_ENABLED` | `false` | Master toggle |
| RCA matching | `AI_FEATURE_RCA_MATCHING` | `true` | Vector similarity search |
| Categorization | `AI_FEATURE_CATEGORIZATION` | `true` | Failure classification |
| Log summary | `AI_FEATURE_LOG_SUMMARY` | `true` | Log analysis |
| NL queries | `AI_FEATURE_NL_QUERIES` | `false` | Natural language queries (not yet shipped) |
| Ticket generation | `AI_FEATURE_TICKET_GENERATION` | `true` | Auto-generate tickets |

---

## 9. MCP Server Tools (External)

Standalone Node.js process for Claude Code / Cursor / IDE integration.

| Tool | Purpose | Cost |
|------|---------|------|
| `testops_analyze_failure` | Single failure analysis + categorization + RCA | $0.01–0.05 |
| `testops_batch_analyze` | Multi-failure analysis with pattern detection | 80% savings vs individual |
| `testops_search_knowledge` | Search historical failures (full-text) | $0.001 |
| `testops_add_knowledge` | Store resolved failures with solutions | — |
| `testops_get_knowledge_stats` | KB metrics: total, resolution rate, by category | — |
| `testops_get_pipeline_stats` | Recent runs, success rate, common failures | — |
| `testops_get_test_history` | Flakiness score, failure pattern grouping | — |
| `testops_get_cost_stats` | Cost by date range, by feature | — |
| `testops_health_check` | DB + AI + vector DB + cache health | — |

**Connection**: stdio transport, same PostgreSQL database, optional AI provider.

---

## 10. System Prompt Structure

Built by `AIChatService.buildSystemPrompt(userRole)`:

1. **Role greeting** — Tailored to user role (Admin/Engineer/Viewer)
2. **Tool definitions** — From `toolRegistry.formatForSystemPrompt()`
3. **Calling convention** — JSON blocks with `tool` + `args`
4. **Rules**:
   - Always use tools for real data (never fabricate)
   - Max 5 tool calls per request
   - Max 8 ReAct iterations
   - Format responses in Markdown
   - Be concise but thorough

---

## 11. Configuration

Priority order (highest wins):
1. Environment variables
2. YAML config file (`config/ai.yml` or `.testops/ai.yml`)
3. Built-in defaults

Hot-reload: `AIConfigManager.reload()` re-reads from disk without restart.

---

*Canonical source. Update when tools, providers, or policies change — not after.*
