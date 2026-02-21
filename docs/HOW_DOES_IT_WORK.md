# How Does TestOps Companion Actually Work?

> A plain-English guide for anyone who wants to understand what happens under the hood.
> Updated for v3.0.0 — Graduated Autonomy, Proactive Suggestions, Global AI Context.

---

## The 30-Second Version

You connect TestOps Companion to your CI/CD pipeline (Jenkins, GitHub Actions).
Every time your tests run, it automatically collects the results, uses AI to figure out **why** things failed, and builds a knowledge base so the **same failure never wastes your time twice**.

**New in v2.9+:** An AI copilot you can talk to in natural language. It searches Jira, checks pipelines, queries your wiki, and even creates PRs --- all through a chat interface. Queries are routed to a virtual team of specialists (Test Engineer, DevOps Engineer, Security Engineer, etc.) who bring domain expertise to every answer.

---

## Step by Step

### 1. You Connect Your Pipeline

TestOps Companion plugs into the tools you already use:

```
Your Code Repo (GitHub)  --->  CI/CD (Jenkins / GitHub Actions)
                                        |
                                        v
                              TestOps Companion
```

You provide the URL of your Jenkins server or GitHub repo, plus an API token so we can talk to it. That's it. No agents to install, no code changes, no SDK. We use the same APIs your CI/CD tools already expose.

### 2. Tests Run, We Listen

When a test run kicks off --- whether you triggered it manually, on a schedule, or from a code push --- TestOps Companion starts watching:

- **Starts tracking** the run (pipeline name, branch, commit, start time)
- **Polls for progress** every few seconds until the run finishes
- **Pulls the results** when it's done: how many tests passed, failed, were skipped, and how long it all took

Nothing changes about how your tests run. We're an observer, not a participant.

### 3. Failures Get Analyzed Automatically

This is where the magic happens. When tests fail, three things kick in at once:

#### A. The AI Reads the Failure

The AI (Claude, GPT-4, or Gemini --- your choice) reads the error message, the stack trace, and the logs. It then:

- **Categorizes** the failure: Is this a real bug? An environment issue? A flaky test? A config problem?
- **Summarizes** the logs: Instead of reading 10,000 lines of output, you get a 5-line summary of what actually went wrong
- **Pinpoints** the location: Which file, which line, what function

Think of it as having a senior engineer glance at every failure and give you the TL;DR.

#### B. The System Searches Its Memory

Every failure you've ever seen is stored as a mathematical "fingerprint" in a vector database. When a new failure comes in, the system asks:

> "Have I seen something like this before?"

It doesn't just match on exact text. It understands **meaning**. So even if the error message is slightly different, it'll find the match if the root cause is the same.

If it finds a match, it shows you:

- When this happened before
- What the root cause turned out to be
- **How it was fixed last time**
- The Jira ticket or PR that resolved it

#### C. The Knowledge Base Grows

Every failure is automatically archived. When your team investigates and documents the root cause + solution, that knowledge becomes permanently searchable. Next time the same pattern appears --- even months later, even by a different team --- the answer is already there.

```
  New Failure
      |
      v
  AI Categorizes It  --->  "Environment Issue, High Confidence"
      |
      v
  Search Memory      --->  "Found 3 similar failures from last month"
      |
      v
  Show Resolution    --->  "Last time: DB connection pool was exhausted.
                            Fix: Increased pool size in config.
                            Jira: INFRA-1234"
```

### 4. Context from Every Tool You Use

Before anyone on your team even looks at the failure, the system reaches out to three places simultaneously:

#### A. Jira: "Has anyone reported this before?"

The system searches your Jira project for issues with similar error messages or test names. It strips out noise (timestamps, UUIDs, memory addresses) and looks for the meaningful parts.

#### B. Confluence: "Is there a runbook for this?"

The system searches your wiki for pages tagged with `rca`, `runbook`, `architecture`, or `troubleshooting` that match the failure.

#### C. GitHub: "What code changed?"

If the failure is tied to a specific commit, the system fetches the diff and finds the associated pull request. It highlights which changed files are most relevant to the failing test.

#### D. The AI Connects the Dots

All three sources --- Jira issues, Confluence docs, and code changes --- are fed to the AI together:

> "This failure matches open ticket PROJ-456. The Confluence runbook 'Connection Troubleshooting' has a documented fix. PR #123 by jane.smith modified the timeout configuration, which is likely the root cause."

---

### 5. The AI Copilot: Your Virtual Team (v2.9+)

This is the big one. Instead of just automated analysis, you can **talk** to the system through a chat interface in the AI Copilot panel.

#### How the Chat Works

You type a question in natural language:

> "Why are my login tests flaky this week?"

Here's what happens behind the scenes:

```
  Your Question
      |
      v
  PersonaRouter (classify the query)
      |
      v
  "Test Engineer" selected (keyword match: "flaky")
      |
      v
  Persona instructions injected into system prompt
      |
      v
  ReAct Loop (Reason -> Act -> Observe -> Answer)
      |
      +---> Calls dashboard_metrics tool
      |         |
      |         v
      |     "3 flaky tests found"
      |
      +---> Reasons about the data
      |
      v
  Streamed answer with analysis + recommendations
```

#### The Virtual Team

Not all questions are the same. A question about flaky tests needs different expertise than a question about security vulnerabilities or database migrations. The system routes each query to the right specialist:

| You Ask | Handled By | Their Expertise |
|---------|------------|-----------------|
| "Why are my tests flaky?" | **Test Engineer** | Test strategy, flaky analysis, coverage |
| "Pipeline is broken" | **DevOps Engineer** | CI/CD, Docker, Jenkins, deployments |
| "What can this tool do?" | **Product Manager** | Feature discovery, capabilities |
| "Auth token is leaking" | **Security Engineer** | Authentication, secrets, vulnerabilities |
| "Schema migration failed" | **Data Engineer** | Database, Prisma, migrations |
| "API response is slow" | **Performance Engineer** | Latency, profiling, optimization |
| General questions | **Senior Engineer** | Generalist, cross-cutting concerns |

This routing happens in two tiers:
1. **Keyword matching** (instant, free): If your question contains "flaky" or "test fail", it goes to the Test Engineer
2. **LLM classification** (fallback, ~200 tokens): If no keyword matches, a quick AI call classifies the intent

The persona badge appears in the chat: *"Test Engineer is handling this"*

#### The ReAct Loop: Reason - Act - Observe - Answer

The copilot doesn't just answer from memory. It has **18 tools** it can use:

**Read tools** (auto-approved):
- Search Jira issues, get issue details
- Get GitHub commits and PRs
- Search Confluence for docs
- Check Jenkins pipeline status
- Query dashboard metrics and failure predictions

**Write tools** (require your approval):
- Create Jira issues, transition status, add comments
- Create GitHub PRs, branches, update files
- Trigger Jenkins builds, retry/cancel test runs

When you ask a question, the AI reasons about what tools it needs, calls them, looks at the results, and either calls more tools or gives you an answer. This is the ReAct loop (Reason - Act - Observe - Answer), and you see every step in real time via streaming SSE events.

#### Human-in-the-Loop Confirmation

Write tools never execute silently. When the AI wants to create a Jira ticket or open a PR, you see a preview card with all the details and Approve/Deny buttons. The card has a 5-minute TTL --- if you don't respond, it expires safely. Nothing mutates without your explicit approval.

### 6. Your Team Gets Notified

When tests finish, the people who need to know get told:

- **Slack**: A message drops into your channel with pass/fail counts and a summary
- **Email**: Digest notifications for broader teams
- **Phone** (Pushover): For critical failures that need immediate attention

You configure which events trigger which channels. Only care about failures? Only get notified on failures.

### 7. Issues Flow to Your Tools

TestOps Companion doesn't replace your existing workflow --- it feeds into it:

- **Jira**: Automatically creates a bug ticket when a critical failure is detected
- **Monday.com**: Creates a board item with all the failure details
- **TestRail**: Syncs automated test results back to your test management tool
- **Confluence**: Publishes Root Cause Analysis documents

### 8. The Dashboard Tells the Story

Your dashboard is the command center:

| What You See | What It Tells You |
|---|---|
| Total tests analyzed | How much is being tested |
| Failure categories (pie chart) | Where your problems live |
| Recent failures + root causes | What's breaking right now and why |
| Failure trends | Are things getting better or worse? |
| Risk scores per test | Which tests are most likely to fail next |
| AI costs | How much you're spending on analysis |

---

## The Architecture

Here's the complete picture of what talks to what:

```
  +------------------+
  |  Your CI/CD      |  Jenkins / GitHub Actions
  |  (runs tests)    |
  +--------+---------+
           |
           | API calls (poll for results)
           v
  +------------------+       +------------------+
  |  TestOps         | ----> |  AI Providers    |
  |  Companion       |       |  (Claude/GPT-4/  |
  |  (backend)       |       |   Gemini/Azure)  |
  +--------+---------+       +------------------+
           |                          |
           |                  Embeddings & Analysis
           |                          |
           |                 +------------------+
           |                 |  PersonaRouter   |
           |                 |  (classify query |
           |                 |   -> specialist) |
           |                 +--------+---------+
           |                          |
           v                          v
  +------------------+       +------------------+
  |  PostgreSQL      |       |  Weaviate        |
  |  (test data,     |       |  (failure        |
  |   pipelines,     |       |   fingerprints   |
  |   chat history)  |       |   for matching)  |
  +------------------+       +------------------+
           |
           | Sends notifications, creates tickets,
           | AND reads back context
           v
  +--------------------------------------------------+
  |  Jira  |  Slack  |  Confluence  |  Monday  |  TestRail  |
  |  (read |         |  (read &     |          |            |
  |  &write)         |   write)     |          |            |
  +--------------------------------------------------+
           ^                 ^              ^
           |                 |              |
           +--------+--------+--------------+
                    |
           GitHub API (commit diffs, PRs)
```

---

## The Cycle That Makes It Smarter

This is the key insight. TestOps Companion creates a **feedback loop**:

```
  1. Tests fail
         |
  2. AI analyzes & categorizes (routed to specialist persona)
         |
  3. System searches for past matches
         |
  4. Team investigates & documents the fix
         |
  5. Knowledge base grows
         |
  6. Next similar failure? Instant answer.
         |
     (back to 1)
```

The more you use it, the faster it gets. After a few weeks, the most common failures resolve in minutes instead of hours because the answer is already in the system.

---

## Frequently Asked Questions

**Does it need access to my source code?**
With the GitHub code awareness feature, it *can* read commit diffs and PR file changes when investigating a failure --- but only for the specific commits tied to the failing test run. It does not clone your repo or scan your entire codebase. The feature is optional.

**Does it slow down my pipeline?**
No. It observes from the outside. Your tests run exactly as they would without it. We poll for results after the fact.

**Which AI provider does it use?**
Your choice. It supports Anthropic Claude, OpenAI GPT-4, Google Gemini, Azure OpenAI, and OpenRouter. You can switch providers mid-session using the in-chat provider picker. The system tracks cost per provider so you can optimize.

**How does it find "similar" failures if the error text is different?**
It uses AI embeddings --- a technique that converts text into a mathematical representation of its *meaning*. Two errors about "connection refused to database" and "DB pool exhausted" have different text but similar meaning, so the system recognizes them as related.

**What is persona routing?**
Every question you ask the AI copilot is classified and routed to a virtual team specialist. A question about flaky tests goes to the "Test Engineer" persona, a question about pipelines goes to the "DevOps Engineer", etc. Each persona brings domain-specific expertise, preferred tools, and tailored system instructions. You see a badge in the chat showing which specialist is handling your query.

**Can the AI modify things without my permission?**
No. Read operations (searching Jira, checking pipelines) happen automatically. But any write operation (creating issues, opening PRs, modifying files) requires your explicit approval through a confirmation card with a 5-minute timeout.

**How much does the AI cost?**
The dashboard tracks every AI call and its cost. You can set monthly budgets and alerts. The system caches results aggressively --- if the same failure pattern appears twice, it reuses the previous analysis. Persona routing adds minimal overhead: keyword matching is free, LLM classification (fallback only) costs ~$0.001 per query.

**Can I use it without the AI features?**
Yes. The pipeline monitoring, test tracking, notifications, and integrations all work without AI. The AI features can be toggled on or off.

---

*Connect your pipeline, let it watch your tests, and let the virtual team handle the detective work.*
