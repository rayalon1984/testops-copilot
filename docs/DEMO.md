# TestOps Companion - Demo & Screenshots

> Visual guide to TestOps Companion's features and user interface

---

## 📸 Quick Preview

### Dashboard Overview

```mermaid
graph TD
    subgraph Dashboard["Main Dashboard"]
        Header[Navigation Bar - TestOps Companion]
        Stats[Statistics Cards]
        Charts[Test Trends & Charts]
        Recent[Recent Test Runs]
        Alerts[Failure Alerts]
    end

    Stats --> Card1[Total Tests: 1,245]
    Stats --> Card2[Pass Rate: 94.2%]
    Stats --> Card3[Flaky Tests: 12]
    Stats --> Card4[Active Failures: 8]

    Charts --> LineChart[7-Day Pass/Fail Trend]
    Charts --> PieChart[Failure Categories]

    Recent --> Run1[Test Run #423 - FAILED]
    Recent --> Run2[Test Run #422 - PASSED]
    Recent --> Run3[Test Run #421 - PASSED]

    Alerts --> Alert1[⚠️ Similar failure detected!]
```

**Placeholder:** `screenshots/dashboard.png`

---

## 🎯 Key Features in Action

### 1. Test Run Details

```mermaid
graph LR
    subgraph TestRunPage["Test Run Detail Page"]
        Header[Test Run 423 Login Suite]
        Status[Status: FAILED]
        FailedTests[Failed Tests List]
        Logs[Test Logs]
    end

    FailedTests --> Test1[test_login_with_invalid_credentials]
    FailedTests --> Test2[test_login_timeout]
    Test1 --> Error1[Connection timeout error]
    Test1 --> SimilarAlert[3 similar past failures found]
    SimilarAlert --> PastFix[See RCA from 2 months ago]
```

**Placeholder:** `screenshots/test-run-detail.png`

---

### 2. Failure Knowledge Base Dashboard

```mermaid
graph TD
    subgraph KnowledgeBase["Failure Knowledge Base"]
        Header[Failure Archive]
        Search[Search and Filters]
        Stats2[Quick Statistics]
        FailureList[Archived Failures]
    end

    Stats2 --> Total[Total Failures: 347]
    Stats2 --> Documented[Documented RCAs: 298]
    Stats2 --> Recurring[Recurring Issues: 23]
    Stats2 --> AvgTime[Avg Resolution: 12 min]

    FailureList --> Failure1[Database Connection Timeout]
    FailureList --> Failure2[Login API 500 Error]
    FailureList --> Failure3[Memory Leak in Payment Service]
    Failure1 --> RCA1[RCA Available]
```

**Placeholder:** `screenshots/knowledge-base.png`

---

### 3. RCA Documentation Modal

```mermaid
graph TD
    subgraph RCAModal["Document Root Cause Analysis"]
        Title[Failure: Database Connection Timeout]
        Form[RCA Documentation Form]
    end

    Form --> Field1[Root Cause*: Connection pool exhausted]
    Form --> Field2[Detailed Analysis: Under high load, max_connections=50 is insufficient]
    Form --> Field3[Solution: Increased max_connections to 200 in postgresql.conf]
    Form --> Field4[Prevention: Add monitoring alert at 80% pool usage]
    Form --> Field5[Workaround: Restart database service temporarily]
    Form --> Field6[Jira Ticket: INFRA-456]
    Form --> Field7[PR Link: github.com/org/repo/pull/123]
    Form --> Field8[Time to Resolve: 45 minutes]
    Form --> Field9[Tags: database, performance, connection-pool]

    Form --> Buttons[Save RCA | Cancel]
```

**Placeholder:** `screenshots/rca-modal.png`

---

### 4. Similar Failures Alert

```mermaid
graph LR
    subgraph Alert["🔍 Similar Past Failures Detected"]
        Message[We found 3 similar failures in the archive]
        TopMatch[Top Match: 95% similarity]
    end

    TopMatch --> Details[Failure from 2 months ago]

    Details --> RCAPreview[Root Cause Documented]

    RCAPreview --> Actions[View Full RCA | Mark as Same Issue]

    Alert --> ExpandMore[Show 2 more similar failures ▼]
```

**Placeholder:** `screenshots/similar-failures-alert.png`

---

### 5. Cross-Platform Context Enrichment (v2.8.0)

```mermaid
graph TD
    subgraph Enrichment["Context Enrichment Results"]
        Header[Failure: Connection Timeout in Login Test]
        Sources[Context Sources]
        Analysis[AI Analysis]
    end

    Sources --> JiraResults["Jira: PROJ-456 Connection timeout issues (In Progress)"]
    Sources --> ConfResults["Confluence: Connection Troubleshooting Runbook"]
    Sources --> GitResults["GitHub: PR #123 modified timeout config (jane.smith)"]

    Analysis --> Synthesis["AI says: This matches PROJ-456. PR #123 changed the timeout\nconfig which likely caused the regression. The Confluence\nrunbook has the documented fix. Confidence: 85%"]

    Synthesis --> Actions["Link to PROJ-456 | Apply Runbook Fix | Review PR #123"]
```

**Placeholder:** `screenshots/context-enrichment.png`

---

### 6. Pipeline Management

```mermaid
graph TD
    subgraph Pipelines["Pipeline Management"]
        Header[Active Pipelines]
        List[Pipeline List]
        Filters[Filters: All | GitHub Actions | Jenkins]
    end

    List --> P1[Main CI Pipeline - PASSING]
    List --> P2[E2E Test Suite - FAILING]
    List --> P3[Performance Tests - FLAKY]

    P2 --> Actions[View Results | Re-run | Configure]
```

**Placeholder:** `screenshots/pipeline-list.png`

---

### 7. Notifications & Integrations

```mermaid
graph LR
    subgraph Notifications["Notification Center"]
        Bell[🔔 5 New Notifications]
        List2[Notification List]
    end

    List2 --> N1[Test Run 423 Failed]
    List2 --> N2[Similar Failure Detected]
    List2 --> N3[Jira Issue Created]

    subgraph Integrations["Integration Status"]
        Jira[✅ Jira Connected]
        Slack[✅ Slack Notifications Active]
        GitHub2[✅ GitHub Actions Linked]
        Email[✅ Email Alerts On]
        Grafana[✅ Grafana Metrics Enabled]
        Monday[✅ Monday.com Synced]
    end
```

**Placeholder:** `screenshots/notifications.png`

---

### 8. Grafana Metrics Dashboard

```mermaid
graph TB
    subgraph GrafanaDashboard["Grafana TestOps Overview Dashboard"]
        Row1[Key Metrics Row]
        Row2[Trends Row]
        Row3[Performance Row]
    end

    Row1 --> Stat1[Total Test Runs: 1245]
    Row1 --> Gauge1[Pass Rate: 94.2%]
    Row1 --> Stat2[Failures Archived: 347]
    Row1 --> Gauge2[RCA Coverage: 86%]

    Row2 --> LineChart[Test Runs Over Time]
    Row2 --> PieChart[Top Failing Tests]

    Row3 --> PerfChart[Execution Time Percentiles]
```

**Metrics Dashboard Panels:**
1. **Total Test Runs** - Stat panel showing cumulative count with trend
2. **Pass Rate Gauge** - Visual health indicator (green >90%, yellow 70-90%, red <70%)
3. **Failures Archived** - Knowledge base size with RCA documentation count
4. **RCA Coverage** - Percentage of failures with documented root causes
5. **Test Runs Over Time** - Time series comparing passed vs failed tests
6. **Top Failing Tests** - Pie chart of most common failures
7. **Execution Time Percentiles** - P50, P95, P99 performance tracking

**Prometheus Metrics Exposed:**
- `testops_test_runs_total` - Total number of test runs
- `testops_pass_rate_percent` - Current pass rate (0-100%)
- `testops_execution_time_p95_seconds` - 95th percentile execution time
- `testops_rca_coverage_percent` - RCA documentation coverage
- `testops_test_failures_count{test_name="..."}` - Per-test failure counts
- And 15+ more metrics for comprehensive monitoring

**Placeholder:** `screenshots/grafana-dashboard.png`

---

## 🎬 User Workflows

### Workflow 1: Investigating a Test Failure

```mermaid
sequenceDiagram
    participant User
    participant Dashboard
    participant TestRun
    participant KnowledgeBase
    participant RCA

    User->>Dashboard: Opens dashboard
    Dashboard->>User: Shows 1 failed test run
    User->>TestRun: Clicks failed test run
    TestRun->>User: Displays test details
    TestRun->>KnowledgeBase: Auto-checks for similar failures
    KnowledgeBase->>User: "🔍 3 similar failures found!"
    User->>RCA: Clicks "View RCA"
    RCA->>User: Shows previous solution
    Note over User,RCA: Resolution in 5 minutes instead of 2 hours
```

**Placeholder:** `screenshots/workflow-investigation.png`

---

### Workflow 2: Cross-Platform Context Enrichment (v2.8.0)

```mermaid
sequenceDiagram
    participant User
    participant TestRun
    participant Enrichment
    participant Jira
    participant Confluence
    participant GitHub
    participant AI

    User->>TestRun: Views failed test
    TestRun->>Enrichment: Request context enrichment
    par Parallel Context Gathering
        Enrichment->>Jira: Search similar issues (JQL)
        Enrichment->>Confluence: Search runbooks (CQL)
        Enrichment->>GitHub: Fetch commit diff + PR
    end
    Jira-->>Enrichment: 2 matching issues
    Confluence-->>Enrichment: 1 relevant runbook
    GitHub-->>Enrichment: PR #123 with 3 changed files
    Enrichment->>AI: Synthesize all context
    AI-->>Enrichment: Actionable analysis (85% confidence)
    Enrichment-->>User: "Matches PROJ-456, runbook has fix, PR #123 is root cause"
    Note over User: Full picture in 30 seconds, not 30 minutes
```

**Placeholder:** `screenshots/workflow-enrichment.png`

---

### Workflow 3: Documenting a New Failure

```mermaid
sequenceDiagram
    participant User
    participant TestRun
    participant RCAModal
    participant KnowledgeBase
    participant Team

    User->>TestRun: Investigates new failure
    User->>TestRun: Identifies root cause
    User->>RCAModal: Clicks "Document RCA"
    RCAModal->>User: Shows documentation form
    User->>RCAModal: Fills in root cause, solution, prevention
    RCAModal->>KnowledgeBase: Saves to archive
    KnowledgeBase->>Team: Future failures auto-matched
    Note over Team: Knowledge persists forever!
```

**Placeholder:** `screenshots/workflow-documentation.png`

---

## 📊 Data Visualizations

### Test Trends Chart

```mermaid
graph TB
    subgraph TrendsChart["7-Day Test Execution Trends"]
        Title[Pass/Fail Rate Over Time]
        Legend[Green: Passed | Red: Failed | Yellow: Flaky]
    end

    Title --> Day1["Mon: 95% pass"]
    Title --> Day2["Tue: 94% pass"]
    Title --> Day3["Wed: 92% pass ⚠️"]
    Title --> Day4["Thu: 96% pass"]
    Title --> Day5["Fri: 97% pass"]
    Title --> Day6["Sat: 98% pass"]
    Title --> Day7["Sun: 95% pass"]

    Day3 --> Insight[Insight: Wednesday spike in failures]
```

**Placeholder:** `screenshots/test-trends.png`

---

### Failure Categories Breakdown

```mermaid
pie title Failure Categories (Last 30 Days)
    "Connection Timeouts" : 35
    "Authentication Errors" : 25
    "Memory Issues" : 15
    "API 500 Errors" : 12
    "UI Rendering Bugs" : 8
    "Other" : 5
```

**Placeholder:** `screenshots/failure-breakdown.png`

---

## 🎨 UI Components

### Statistics Cards

```
┌─────────────────────────┐  ┌─────────────────────────┐
│   Total Test Runs       │  │    Overall Pass Rate    │
│       1,245             │  │        94.2%            │
│   ↑ 12% from last week  │  │    ↑ 2.1% this week     │
└─────────────────────────┘  └─────────────────────────┘

┌─────────────────────────┐  ┌─────────────────────────┐
│    Active Failures      │  │   Knowledge Base Docs   │
│          8              │  │         298             │
│   3 have similar past   │  │    ✅ 86% coverage       │
└─────────────────────────┘  └─────────────────────────┘
```

**Placeholder:** `screenshots/stats-cards.png`

---

### Alert Banners

```
╔══════════════════════════════════════════════════════════════════╗
║  🔍 SIMILAR FAILURE DETECTED                                     ║
║                                                                   ║
║  We found a match from 2 months ago with documented solution:    ║
║                                                                   ║
║  Root Cause: Database connection pool exhausted                  ║
║  Solution: Increase max_connections to 200 in postgresql.conf    ║
║  Time to Fix: 45 minutes (documented in INFRA-456)               ║
║                                                                   ║
║  [View Full RCA]  [Mark as Same]  [Dismiss]                      ║
╚══════════════════════════════════════════════════════════════════╝
```

**Placeholder:** `screenshots/alert-banner.png`

---

## 🎥 Video Demo Suggestions

When creating actual demo videos, cover these scenarios:

### 1. **Quick Start Demo (2 minutes)**
- Dashboard overview
- Click into a failed test
- View similar past failures
- See the documented RCA
- Resolution in seconds

### 2. **RCA Documentation Demo (3 minutes)**
- Investigate a new failure
- Document the root cause
- Add solution and prevention steps
- Link to Jira ticket
- Save to knowledge base

### 3. **Context Enrichment Demo (3 minutes)** *(v2.8.0)*
- Trigger a test failure with a known commit hash
- Watch the enrichment service query Jira, Confluence, and GitHub in parallel
- See the AI synthesis: matching Jira ticket + relevant runbook + PR that caused the issue
- One-click to link the failure to the existing Jira ticket
- Show the confidence score and how it changes with more context sources

### 4. **Integration Demo (2 minutes)**
- Configure Jira integration
- Configure Slack notifications
- Set up Grafana dashboard
- Test fails → Jira ticket auto-created
- Team receives Slack alert
- Similar failure alert shows up
- Metrics update in real-time on Grafana

### 5. **Knowledge Base Tour (3 minutes)**
- Browse archived failures
- Search for specific error patterns
- View statistics and insights
- See recurring failure patterns
- Export data

### 6. **Grafana Metrics Demo (2 minutes)**
- View real-time test metrics dashboard
- Explore pass rate trends over time
- Check execution time percentiles (P50, P95, P99)
- Review RCA coverage gauge
- See top failing tests breakdown
- Configure custom alerts for failure spikes

---

## 📸 Screenshot Checklist

When capturing actual screenshots, include:

### Essential Screenshots:
- [ ] Main dashboard (full view)
- [ ] Test run list page
- [ ] Test run detail page with failures
- [ ] Similar failures alert (expanded)
- [ ] RCA documentation modal
- [ ] Knowledge base dashboard
- [ ] Failure detail view with full RCA
- [ ] Pipeline management page
- [ ] Notification center
- [ ] Settings page with integrations
- [ ] Grafana metrics dashboard (full view)
- [ ] Grafana pass rate gauge
- [ ] Grafana execution time trends

### Feature Highlights:
- [ ] Smart matching in action (side-by-side comparison)
- [ ] Context enrichment results panel (Jira + Confluence + GitHub context)
- [ ] AI synthesis output with confidence score
- [ ] Jira integration working (ticket creation + similar issue search)
- [ ] Monday.com integration (item creation)
- [ ] Slack notification example
- [ ] Search and filter functionality
- [ ] Pattern detection results
- [ ] Grafana real-time metrics update
- [ ] Prometheus metrics endpoint response
- [ ] Mobile responsive views

### Before/After Comparisons:
- [ ] Investigation time: Without KB vs With KB
- [ ] Manual process vs Automated process
- [ ] Knowledge loss vs Knowledge retention

---

## 🎨 Branding & Style Guide

### Color Scheme:
- **Primary**: Blue (#1976d2) - Actions, links
- **Success**: Green (#2e7d32) - Passing tests
- **Error**: Red (#d32f2f) - Failed tests
- **Warning**: Orange (#ed6c02) - Flaky tests
- **Info**: Light Blue (#0288d1) - Information

### Typography:
- **Headers**: Roboto Bold
- **Body**: Roboto Regular
- **Code**: Fira Code / Monaco

### Icons:
- Material-UI icons throughout
- Custom icons for RCA knowledge base
- Integration logos (Jira, Slack, GitHub)

---

## 🚀 Creating Your Own Demo

### Quick Demo Setup:

1. **Start the app**:
   ```bash
   npm run start
   ```

2. **Seed demo data**:
   ```bash
   cd backend
   npm run db:seed
   ```

3. **Take screenshots**:
   - Use browser at 1920x1080 resolution
   - Clear, well-lit interface
   - Show real-world scenarios
   - Include diverse test cases

4. **Record screen**:
   - Use OBS Studio or QuickTime
   - 1080p resolution
   - Show cursor movements
   - Include voiceover explanation

5. **Create GIFs**:
   - Convert key interactions to GIFs
   - Max 10 seconds per GIF
   - Use tools like Gifski or ScreenToGif

---

## 📁 Screenshot Organization

```
screenshots/
├── dashboard/
│   ├── main-view.png
│   ├── stats-cards.png
│   └── test-trends.png
├── test-runs/
│   ├── list-view.png
│   ├── detail-view.png
│   └── logs-view.png
├── knowledge-base/
│   ├── dashboard.png
│   ├── failure-detail.png
│   ├── rca-modal.png
│   └── similar-failures-alert.png
├── integrations/
│   ├── jira-config.png
│   ├── slack-notification.png
│   ├── monday-config.png
│   ├── github-actions.png
│   └── grafana-datasource.png
├── grafana/
│   ├── dashboard-overview.png
│   ├── pass-rate-gauge.png
│   ├── test-trends-graph.png
│   ├── execution-time-percentiles.png
│   ├── top-failures-piechart.png
│   ├── rca-coverage-gauge.png
│   └── prometheus-metrics-endpoint.png
├── workflows/
│   ├── investigation-flow.gif
│   ├── documentation-flow.gif
│   ├── resolution-flow.gif
│   └── metrics-monitoring-flow.gif
└── mobile/
    ├── dashboard-mobile.png
    ├── notifications-mobile.png
    └── test-detail-mobile.png
```

---

## 💡 Tips for Great Screenshots

1. **Use realistic data**: Not "Test 1", "Test 2" - use real test names
2. **Show context**: Include navigation, breadcrumbs, timestamps
3. **Highlight features**: Use arrows or callouts for key elements
4. **Keep it clean**: Close unnecessary tabs, use consistent data
5. **Tell a story**: Screenshots should show a user journey
6. **Include state variations**: Empty states, loading states, error states

---

## 🎯 Interactive Demo Ideas

### Live Demo Site:
- Deploy to demo.testops-companion.com
- Pre-populated with realistic data
- Read-only access for public
- Auto-resets every 24 hours

### Guided Tour:
- Use tools like Intro.js or Shepherd.js
- Step-by-step walkthrough
- Highlight key features
- "Try it yourself" mode

### Video Tutorials:
- 1-minute feature highlights
- 5-minute getting started guide
- 10-minute deep dive
- Upload to YouTube/Vimeo

---

## 📞 Need Help?

For questions about creating demos or screenshots:
- See [Contributing Guide](CONTRIBUTING.md)
- Open an issue with the `documentation` label
- Check existing screenshots in the community

---

**Note**: This file contains visual mockups using Mermaid diagrams. Actual screenshots will be added as the application evolves. Contributors are welcome to submit screenshots following the guidelines above!
