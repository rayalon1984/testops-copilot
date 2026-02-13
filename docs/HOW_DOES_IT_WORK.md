# How Does TestOps Companion Actually Work?

> A plain-English guide for anyone who wants to understand what happens under the hood.

---

## The 30-Second Version

You connect TestOps Companion to your CI/CD pipeline (Jenkins, GitHub Actions).
Every time your tests run, it automatically collects the results, uses AI to figure out **why** things failed, and builds a knowledge base so the **same failure never wastes your time twice**.

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

### 4. Context from Every Tool You Use (v2.8.0)

Before anyone on your team even looks at the failure, the system reaches out to three places simultaneously:

#### A. Jira: "Has anyone reported this before?"

The system searches your Jira project for issues with similar error messages or test names. It strips out noise (timestamps, UUIDs, memory addresses) and looks for the meaningful parts.

If it finds matches, you immediately see:

- Existing tickets that might be the same issue (no duplicate filing)
- Who's already working on it
- What priority and status it has

#### B. Confluence: "Is there a runbook for this?"

The system searches your wiki for pages tagged with `rca`, `runbook`, `architecture`, or `troubleshooting` that match the failure. If your team wrote a troubleshooting guide six months ago, it surfaces automatically.

#### C. GitHub: "What code changed?"

If the failure is tied to a specific commit, the system fetches the diff and finds the associated pull request. It then highlights which changed files are most relevant to the failing test.

#### D. The AI Connects the Dots

All three sources --- Jira issues, Confluence docs, and code changes --- are fed to the AI together. Instead of just categorizing the failure, the AI now produces a synthesis:

> "This failure matches open ticket PROJ-456. The Confluence runbook 'Connection Troubleshooting' has a documented fix. PR #123 by jane.smith modified the timeout configuration, which is likely the root cause. Recommended action: apply the fix from the runbook and link to PROJ-456."

```
  New Failure
      |
      v
  +---------+     +-----------+     +--------+
  |  Jira   |     | Confluence|     | GitHub |
  | search  |     |  search   |     |  diffs |
  +---------+     +-----------+     +--------+
       \               |               /
        \              |              /
         v             v             v
     +------------------------------+
     |   AI Synthesis Engine        |
     |   "Here's what happened and  |
     |    what to do about it"      |
     +------------------------------+
               |
               v
     Actionable Root Cause Analysis
```

### 5. Your Team Gets Notified

When tests finish, the people who need to know get told:

- **Slack**: A message drops into your channel with pass/fail counts, a summary, and a button to view details
- **Email**: Digest notifications for broader teams
- **Phone** (Pushover): For critical failures that need immediate attention

You configure which events trigger which channels. Only care about failures? Only get notified on failures.

### 5. Issues Flow to Your Tools

TestOps Companion doesn't replace your existing workflow --- it feeds into it:

- **Jira**: Automatically creates a bug ticket when a critical failure is detected. Links the test run to the ticket. Updates it when the failure is resolved.
- **Monday.com**: Creates a board item with all the failure details, so your project managers see it too.
- **TestRail**: Syncs automated test results back to your test management tool, keeping manual and automated testing in one view.
- **Confluence**: Publishes detailed Root Cause Analysis documents and test execution reports, so the knowledge lives where your team already reads documentation.

### 6. The Dashboard Tells the Story

Your dashboard is the command center:

| What You See | What It Tells You |
|---|---|
| Total tests analyzed | How much is being tested |
| Failure categories (pie chart) | Where your problems live --- bugs vs. flaky tests vs. environment |
| Time saved | How many hours the AI saved your team vs. manual investigation |
| Recent failures + root causes | What's breaking right now and why |
| AI costs | How much you're spending on analysis |
| Similar failure matches | How often the system found a past solution automatically |

---

## The Cycle That Makes It Smarter

This is the key insight. TestOps Companion creates a **feedback loop**:

```
  1. Tests fail
         |
  2. AI analyzes & categorizes
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

## What Connects to What

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
  |  (backend)       |       |   Gemini)        |
  +--------+---------+       +------------------+
           |                          |
           |                  Embeddings & Analysis
           v                          |
  +------------------+       +------------------+
  |  PostgreSQL      |       |  Weaviate        |
  |  (test data,     |       |  (failure        |
  |   pipelines,     |       |   fingerprints   |
  |   users)         |       |   for matching)  |
  +------------------+       +------------------+
           |
           | Sends notifications, creates tickets,
           | AND reads back context (v2.8.0)
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

## Frequently Asked Questions

**Does it need access to my source code?**
With the v2.8.0 GitHub code awareness feature, it *can* read commit diffs and PR file changes when investigating a failure --- but only for the specific commits tied to the failing test run. It does not clone your repo or scan your entire codebase. The feature is optional and can be disabled per-request.

**Does it slow down my pipeline?**
No. It observes from the outside. Your tests run exactly as they would without it. We poll for results after the fact.

**Which AI provider does it use?**
Your choice. It supports Anthropic Claude, OpenAI GPT-4, Google Gemini, and Azure OpenAI. You can switch providers at any time. The system tracks cost per provider so you can optimize.

**How does it find "similar" failures if the error text is different?**
It uses AI embeddings --- a technique that converts text into a mathematical representation of its *meaning*. Two errors about "connection refused to database" and "DB pool exhausted --- timeout waiting for connection" have different text but similar meaning, so the system recognizes them as related.

**What happens if the AI categorizes something wrong?**
Your team can override any AI categorization. The system learns from these corrections over time.

**How much does the AI cost?**
The dashboard tracks every AI call and its cost. You can set monthly budgets and alerts. The system also caches results aggressively --- if the same failure pattern appears twice, it reuses the previous analysis instead of calling the AI again, saving up to 80% on costs.

**Can I use it without the AI features?**
Yes. The pipeline monitoring, test tracking, notifications, and integrations all work without AI. The AI features (categorization, log summary, RCA matching) can be toggled on or off.

---

*That's it. Connect your pipeline, let it watch your tests, and let the AI handle the detective work --- now with context from Jira, Confluence, and GitHub built right in.*
