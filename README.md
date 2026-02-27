<p align="center">
  <h1 align="center">TestOps Copilot</h1>
  <p align="center">
    <strong>Your test failures now have a detective on payroll.</strong>
  </p>
  <p align="center">
    An AI-powered test operations platform with an agentic copilot, a virtual team of 9 specialist personas, and graduated autonomy that lets you control how much the AI does on its own.
  </p>
</p>

<p align="center">
  <a href="https://github.com/rayalon1984/testops-companion/actions/workflows/ci.yml"><img src="https://github.com/rayalon1984/testops-companion/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="CHANGELOG.md"><img src="https://img.shields.io/badge/version-3.0.1-blue" alt="Version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-Apache%202.0-blue.svg" alt="License"></a>
  <a href="package.json"><img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen" alt="Node.js Version"></a>
  <a href="CHANGELOG.md"><img src="https://img.shields.io/badge/tests-760%20passing-brightgreen" alt="Tests"></a>
  <a href="specs/features/"><img src="https://img.shields.io/badge/spec%20assertions-229%2F229-brightgreen" alt="Spec Coverage"></a>
</p>

<p align="center">
  <a href="docs/quickstart.md"><strong>Quick Start</strong></a> ·
  <a href="docs/DEMO.md"><strong>Demo Guide</strong></a> ·
  <a href="docs/HOW_DOES_IT_WORK.md"><strong>How It Works</strong></a> ·
  <a href="docs/MCP_INTEGRATION.md"><strong>MCP Server</strong></a> ·
  <a href="CHANGELOG.md"><strong>Changelog</strong></a>
</p>

---

## The Pitch

Your CI pipeline breaks at 2 AM. By the time you open your laptop, the AI copilot has already searched Jira for similar failures, pulled the relevant Confluence runbook, identified the root cause from your failure knowledge base, and is waiting with a one-click fix.

You review it, hit approve, and move on with your coffee.

![TestOps Copilot - Agentic Command Center](docs/assets/screenshots/agentic-command-center.jpg)
*3-column Mission Control: navigation | main content | AI Copilot panel with persona routing*

---

## Get Running in 2 Minutes

```bash
git clone https://github.com/rayalon1984/testops-companion.git
cd testops-companion && npm install && npm run dev:simple
```

No PostgreSQL. No Redis. No API keys. Login with `engineer@testops.ai` / `demo123`.

That's it. You're talking to the copilot.

> **Want production mode?** See the **[Production Quickstart](docs/PRODUCTION_QUICKSTART.md)** for Docker + PostgreSQL + real AI providers.

---

## What Makes v3 Different

### Your AI Team, Not Just a Chatbot

Every query is routed to the right specialist *before* a single token is generated:

| You Ask | Routed To | Why |
|---------|-----------|-----|
| "Why are my tests flaky?" | **Test Engineer** | Flaky test analysis, coverage, CI quality |
| "Pipeline is broken" | **DevOps Engineer** | Pipelines, deployments, CI/CD infra |
| "Is there a security vulnerability?" | **Security Engineer** | Auth, secrets, vulnerabilities |
| "Schema migration failed" | **Data Engineer** | Database, schema, migrations |
| "Page loads too slowly" | **Performance Engineer** | Latency, throughput, profiling |
| "What can this tool do?" | **Product Manager** | Feature discovery, onboarding |

**9 personas** in total. Routing is two-tier: keyword rules fire in <1ms at zero cost. When that misses, a lightweight LLM micro-classification kicks in (~200 tokens). You see who's handling your query in real time: *"Test Engineer is on it."*

### Graduated Autonomy — You Set the Dial

Not everyone wants the same level of AI independence:

| Mode | What Happens |
|------|-------------|
| **Conservative** | AI investigates and recommends. You approve everything. |
| **Balanced** | Low-risk actions (searches, reads, labels) auto-execute. Team-visible actions show one-click approval cards. |
| **Autonomous** | The AI handles what it can, escalates what it should. Destructive actions always need your sign-off. |

22 tools. 8 auto-execute. 11 with tiered approval. 3 housekeeping. Every write operation goes through a human-in-the-loop confirmation gate with a 5-minute TTL.

### Bring Your Own Provider

Hot-swap AI providers mid-conversation from the in-chat picker:

| Provider | What You Get |
|----------|-------------|
| **Anthropic Claude** | Direct API — Opus, Sonnet, Haiku |
| **AWS Bedrock** | Claude via IAM role — zero credential management in AWS |
| **OpenAI** | GPT-4o, o1 |
| **Google Gemini** | Gemini Pro, Flash |
| **Azure OpenAI** | Enterprise Azure deployments |
| **OpenRouter** | 100+ models through a single gateway |

### Test Intelligence That Learns

Your failure knowledge base gets smarter with every test run:

- **Predictive Failure Analysis** — Risk scores per test, trend aggregation, z-score anomaly detection that catches problems before they become patterns
- **Flaky Test Detection** — Statistical scoring across historical pass/fail data surfaces the tests you can't trust
- **Smart Test Selection** — Changed 3 files? The platform tells you which 12 of your 400 tests actually need to run
- **Failure Fingerprinting** — Same root cause, different stack trace? The knowledge base links them automatically
- **Context Enrichment** — Pulls context from Jira, Confluence, and GitHub simultaneously so the AI has the full picture

### The Full Platform

| Area | What You Get |
|------|-------------|
| **Multi-Pipeline Dashboard** | Unified view for Jenkins, GitHub Actions, and custom CI |
| **3-Column Mission Control** | Real-time dashboard with integrated AI copilot panel |
| **Team Workspaces** | Teams, members (OWNER/ADMIN/MEMBER/VIEWER), scoped pipelines |
| **Collaborative RCA** | Comments on failures, version-tracked RCA revisions with optimistic locking |
| **Failure Knowledge Base** | Smart fingerprinting, historical trending, category analytics |
| **Auto-Fix Workflow** | Analyzes failure, creates branch, commits fix, opens PR |
| **Chat Session Persistence** | Full message history stored and retrievable across sessions |
| **Cost Tracking** | Per-session cost breakdown by tool and provider with budget alerts |

---

## Integrations

TestOps Copilot plugs into your existing stack:

| Service | What It Does | Setup |
|---------|-------------|-------|
| **Jira** | Issue creation, bi-directional sync, similar issue search (JQL) | `JIRA_BASE_URL` + `JIRA_API_TOKEN` |
| **GitHub** | Commit diffs, PR lookup, branch/file ops, workflow triggering | `GITHUB_TOKEN` |
| **Confluence** | Knowledge reader (CQL), RCA doc publishing, runbook lookup | `CONFLUENCE_BASE_URL` + `CONFLUENCE_API_TOKEN` |
| **Slack** | Push notifications on failures and pipeline status changes | `SLACK_WEBHOOK_URL` |
| **Monday.com** | Work OS integration for task management | `MONDAY_API_TOKEN` |
| **TestRail** | Test case management sync | `TESTRAIL_HOST` + `TESTRAIL_API_KEY` |
| **Grafana/Prometheus** | Metrics at `/metrics`, pre-built dashboards | Built-in |

---

## Production-Hardened

This isn't a prototype. v3 went through a dedicated security audit:

- **SQL injection prevention** — Prisma.sql tagged templates, no raw queries
- **CSRF protection** — Double-submit cookie pattern
- **Redis-backed sessions** — Automatic token blacklisting
- **Structured logging** — Every request gets an `X-Request-ID` you can trace end-to-end
- **Deep health checks** — `/health/ready` (DB + Redis), `/health/live` (liveness), `/health/full` (all services)
- **Enterprise auth** — SSO/SAML 2.0 (Okta, Azure AD), RBAC with 5 roles, audit logging with PII redaction
- **Clean audit** — 0 high/critical vulnerabilities

---

## Demo Mode vs Production Mode

| | Demo Mode | Production Mode |
|---|---|---|
| **Database** | SQLite (file-based) | PostgreSQL 14+ |
| **AI Provider** | Mock (realistic demo data) | Anthropic / OpenAI / Google / Azure / Bedrock |
| **Integrations** | Simulated responses | Real Jira, Slack, GitHub, Confluence |
| **Setup time** | ~2 minutes | ~15 minutes |
| **Docker required** | No | Yes |
| **Best for** | Evaluation, demos, training | Production deployments |

**Demo credentials** (all use password `demo123`):

| Email | Role |
|-------|------|
| `admin@testops.ai` | Site Admin |
| `lead@testops.ai` | QA Lead |
| `engineer@testops.ai` | QA Engineer |
| `viewer@testops.ai` | Stakeholder |

**Production setup:**

```bash
cp .env.production.example .env.production   # Edit secrets!
docker compose -f docker-compose.ghcr.yml up -d
```

---

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Backend** | Node.js 18+ · TypeScript · Express.js · Prisma ORM · PostgreSQL · Redis |
| **Frontend** | React 18 · TypeScript · Material-UI v5 · Zustand · React Query · Vite |
| **AI** | Anthropic Claude · OpenAI · Google Gemini · Azure OpenAI · AWS Bedrock · OpenRouter |
| **Vector DB** | Weaviate for semantic failure matching |
| **Infra** | Docker · GitHub Actions · Prometheus · Grafana · OpenTelemetry · Playwright E2E |

---

## Development

```bash
# Demo mode — SQLite, mock AI, auto-open browser
npm run dev:simple

# Full stack — PostgreSQL + Redis + Weaviate via Docker
npm run local:start && npm run dev
```

| Command | What It Does |
|---------|-------------|
| `npm run test` | Run all 760 tests (Jest + Vitest) |
| `npm run typecheck` | Type check backend + frontend |
| `npm run lint` | ESLint both projects |
| `npm run build` | Build all packages |
| `npm run check:architecture` | Verify no layer violations |
| `npm run check:health` | Flag oversized files/functions |

---

## API Reference

### Core

```
POST /api/auth/login                          # Login
POST /api/auth/register                       # Register
GET  /api/pipelines                           # List pipelines
GET  /api/test-runs                           # List test runs
```

### AI Copilot

```
POST /api/v1/ai/chat                         # SSE streaming chat (ReAct loop)
GET  /api/v1/ai/personas                      # List virtual team personas
GET  /api/v1/ai/config                        # Current provider config
PUT  /api/v1/ai/config                        # Update provider (admin)
POST /api/v1/ai/config/test                   # Test provider connection
POST /api/v1/ai/confirm                       # Approve/deny pending action
GET  /api/v1/ai/health                        # AI services health
GET  /api/v1/ai/costs                         # Cost summary
```

### Failure Knowledge Base

```
POST /api/v1/failure-archive                  # Create failure entry
PUT  /api/v1/failure-archive/:id/document-rca # Document RCA (version-aware)
GET  /api/v1/failure-archive/trends           # Time-series failure trends
GET  /api/v1/failure-archive/predictions      # Risk scores per test
GET  /api/v1/failure-archive/anomalies        # Anomaly detection
```

Full API reference: **[docs/api.md](docs/api.md)**

---

## Project Structure

```
testops-companion/
├── backend/
│   ├── prisma/                          # Schema (dev + production) & migrations
│   └── src/
│       ├── routes/ai/                   # AI & copilot REST routes
│       ├── services/ai/
│       │   ├── AIChatService.ts         # ReAct loop + SSE streaming
│       │   ├── PersonaRouter.ts         # Two-tier query classifier
│       │   ├── tools/                   # 22 agentic tool wrappers
│       │   ├── providers/               # 6 AI provider adapters
│       │   └── features/               # RCA, categorization, enrichment
│       ├── middleware/                   # Auth, validation, error handling
│       └── utils/                       # Logger, validators, helpers
├── frontend/
│   └── src/
│       ├── components/AICopilot/        # Copilot panel + cards + persona badge
│       ├── hooks/useAICopilot.ts        # SSE chat hook with persona support
│       ├── pages/                       # Dashboard, KB, Teams, Settings
│       └── services/                    # API clients
├── mcp-server/                          # Model Context Protocol server (8 tools)
├── specs/                               # Living specification documents
│   ├── features/                        # 16 YAML feature manifests (229 assertions)
│   └── team/                            # 9 persona specs + routing rubric
├── docs/                                # User & developer documentation
└── .github/workflows/                   # CI/CD pipelines
```

---

## Documentation

| Document | Description |
|----------|-------------|
| **[Quick Start](docs/quickstart.md)** | Get running in 5 minutes |
| **[How Does It Work?](docs/HOW_DOES_IT_WORK.md)** | Plain-English guide to the platform |
| **[Demo Guide](docs/DEMO.md)** | Visual guide with workflow diagrams |
| **[UI Tour](docs/UI_TOUR.md)** | Visual walkthrough with annotated screenshots |
| **[API Reference](docs/api.md)** | Full REST API documentation |
| **[Architecture](docs/architecture.md)** | System design and components |
| **[MCP Server](docs/MCP_INTEGRATION.md)** | Model Context Protocol integration |
| **[Development Guide](docs/development.md)** | Coding standards, testing, git workflow |
| **[Roadmap](specs/ROADMAP.md)** | What's shipped and what's next |
| **[Changelog](CHANGELOG.md)** | Full version history |
| **[Lessons Learned](docs/LESSONS_LEARNED.md)** | Living error pattern registry |

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/amazing-feature`
3. Make changes, write tests, update docs
4. Commit: `git commit -m 'feat: add amazing feature'` ([Conventional Commits](https://www.conventionalcommits.org/))
5. Push and open a Pull Request

Before submitting:
```bash
npm run lint && npm run typecheck && npm run test && npm run build
```

---

## License

Apache License 2.0 — see [LICENSE](LICENSE).

---

<p align="center">
  Built by <a href="https://github.com/rayalon1984"><strong>Rotem Ayalon</strong></a>
</p>

<p align="center">
  <a href="https://github.com/rayalon1984/testops-companion/issues">Report a Bug</a> ·
  <a href="https://github.com/rayalon1984/testops-companion/issues">Request a Feature</a>
</p>

<p align="center">
  If you find this project useful, give it a <a href="https://github.com/rayalon1984/testops-companion">star</a>!
</p>
