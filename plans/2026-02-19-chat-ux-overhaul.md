# AI Chat UX Overhaul v2 — Service-Native Interactive Cards

> **Date**: 2026-02-19
> **Primary Persona**: UX_DESIGNER (interaction design, visual hierarchy)
> **Supporting**: AI_ARCHITECT (trust, tool policy, ReAct loop), AI_PRODUCT_MANAGER (user roles, outcomes), SENIOR_ENGINEER (implementation)
> **Scope**: Complete redesign of the AI Copilot chat — not just rendering, but **interactive service-native experiences**

---

## The Vision

The chat isn't a text log. It's a **command center where every tool result becomes a live, interactive card native to its source service**. A Jira card looks and feels like Jira. A Jenkins pipeline shows pass/fail bars with a re-run button. A GitHub PR shows review status with a link to approve. The user doesn't just read results — they **act on them without leaving the chat**.

---

## What's Wrong Today

| Problem | Impact |
|---------|--------|
| All tool results are plain text dumps | Users copy-paste data to act on it elsewhere |
| No service identity in cards | Can't tell Jira from GitHub at a glance |
| Confirmation cards show raw JSON args | Users can't validate what they're approving |
| No in-card actions | Every action requires leaving the chat |
| No role awareness | Admin sees same as Viewer |
| Assistant responses are unformatted text | Code, lists, bold — all rendered as flat strings |
| Empty state is generic | Missed onboarding moment |
| Input is single-line | Can't compose multi-line queries |

---

## Design Pillars

1. **Service-Native** — Every integration gets cards that match its identity (Jira blue, GitHub dark, Jenkins grey, Confluence blue-teal)
2. **Act Here, Not There** — In-card buttons for the most common next action (transition, re-run, comment, approve)
3. **Human-in-the-Loop as First Class** — Confirmations show structured previews native to the target service, not JSON
4. **Role-Aware** — Admins/Editors see action buttons; Viewers see read-only cards
5. **Progressive Disclosure** — Summary first, details on demand, raw data never unless requested
6. **Trust Through Transparency** — Show what the AI did, what it found, what it's about to do — always

---

## Architecture

### Component Tree

```
AICopilot/
├── AICopilot.tsx                         # Shell: header + messages + input
├── messages/
│   ├── UserMessage.tsx                   # User bubble
│   ├── AssistantMessage.tsx              # Markdown-rendered response + actions
│   ├── ThinkingIndicator.tsx             # Animated phase indicator
│   ├── ErrorMessage.tsx                  # Error display
│   └── ToolResultCard.tsx                # Router: dispatches to service card by toolName
├── cards/
│   ├── JiraIssueCard.tsx                 # Jira issue display + status transition
│   ├── JiraCreatePreview.tsx             # Pre-creation preview (for confirmations)
│   ├── GitHubCommitCard.tsx              # Commit with file diff summary
│   ├── GitHubPRCard.tsx                  # PR status, review, merge status
│   ├── JenkinsStatusCard.tsx             # Pipeline + runs with re-run action
│   ├── ConfluenceDocCard.tsx             # Doc snippet with "Read full page"
│   ├── MetricsCard.tsx                   # Dashboard numbers with sparklines
│   ├── PredictionCard.tsx                # Risk gauge + trend + anomaly alerts
│   └── GenericResultCard.tsx             # Fallback for unknown tools
├── cards/shared/
│   ├── ServiceBadge.tsx                  # Service icon + name badge (Jira/GitHub/etc.)
│   ├── StatusChip.tsx                    # Semantic status chip (maps to each service's statuses)
│   ├── CardActions.tsx                   # In-card action buttons (role-aware)
│   └── ExpandablePayload.tsx             # Show/hide raw details
├── ConfirmationCard.tsx                  # Redesigned approval flow
├── ChatInput.tsx                         # Multi-line + keyboard shortcuts
├── EmptyState.tsx                        # Quick actions + onboarding
├── MarkdownRenderer.tsx                  # Lightweight MD + code highlighting
└── MessageActions.tsx                    # Copy, feedback, timestamp
```

### Data Flow Change

**Current**: `tool_result` SSE event → `{ data: "summary string" }` → plain text
**New**: `tool_result` SSE event → `{ data: JSON.stringify({ summary, toolData, tool }) }` → dispatched to service card

The hook `useAICopilot.ts` gets a new field on `ChatMessage`:
```typescript
interface ChatMessage {
    // ... existing fields
    toolData?: Record<string, unknown>;  // Structured data from tool execution
}
```

The `tool_result` handler parses the JSON data to extract both `summary` (fallback text) and `toolData` (structured payload for rich cards).

Backend change: `AIChatService` sends `result.data` alongside `result.summary` in the SSE event.

---

## Service Card Designs

### 1. Jira Issue Card — `JiraIssueCard.tsx`

For: `jira_search` results, `jira_get` result

```
┌─────────────────────────────────────────────┐
│  ⬡ Jira                                     │
│                                              │
│  BUG-1234                          ┌──────┐ │
│  NullPointer in UserService.ts     │In Prg│ │
│                                    └──────┘ │
│  ┌────┐  ┌──────┐  ┌─────┐                 │
│  │ Bug│  │ P-High│  │ Auth│                 │
│  └────┘  └──────┘  └─────┘                 │
│                                              │
│  Assignee: John Doe                          │
│                                              │
│  [ → Move to Done ]  [ 💬 Comment ]  [ ↗ ] │
└─────────────────────────────────────────────┘
```

- **Service badge**: Jira icon + blue accent left border
- **Issue key** as prominent badge (clickable → opens in Jira)
- **Status chip**: uses Jira color mapping (To Do=grey, In Progress=blue, Done=green)
- **Type + Priority + Labels** as compact chips
- **Actions** (role-aware):
  - Editor+: "Move to Done" button → triggers `jira_transition_issue` (with confirmation)
  - Editor+: "Comment" button → inline text input → triggers `jira_comment`
  - All: External link (↗) opens issue in Jira
  - Viewer: sees card but no action buttons
- **Search results**: Shows as stacked mini-cards (key + summary + status), expandable

### 2. Jira Create Preview — `JiraCreatePreview.tsx`

For: `jira_create_issue` confirmation

```
┌─────────────────────────────────────────────┐
│  ⬡ Create Jira Issue                 REVIEW │
│                                              │
│  ┌─ Preview ──────────────────────────────┐ │
│  │                                        │ │
│  │  Type       Bug  🔴                    │ │
│  │  Summary    NullPointer in UserSvc.ts  │ │
│  │  Labels     regression, auth           │ │
│  │  Project    TESTOPS                    │ │
│  │                                        │ │
│  │  Description                           │ │
│  │  ┌──────────────────────────────────┐  │ │
│  │  │ Stack trace from test run #482:  │  │ │
│  │  │ TypeError: Cannot read proper... │  │ │
│  │  └──────────────────────────────────┘  │ │
│  └────────────────────────────────────────┘ │
│                                              │
│  ████████████░░░░░░░░░  3:42 remaining      │
│                                              │
│  [ Deny  ⎋ ]                [ ✓ Create  ⏎ ] │
└─────────────────────────────────────────────┘
```

- Looks like a Jira issue being composed (not raw JSON)
- Countdown timer (5min TTL) with color: green→amber→red
- Keyboard shortcuts: Enter=approve, Esc=deny
- After approval: card transforms into a `JiraIssueCard` showing the created issue

### 3. GitHub Commit Card — `GitHubCommitCard.tsx`

For: `github_get_commit` result

```
┌─────────────────────────────────────────────┐
│  ◑ GitHub                                    │
│                                              │
│  Fix null check in UserService               │
│  a3f2b1c · 4 files changed                  │
│                                              │
│  +12  -3  ┌──────────────────────────────┐  │
│           │ ▸ src/services/UserSvc.ts +8 │  │
│           │ ▸ src/tests/UserSvc.test.ts  │  │
│           │ ▸ package.json +1            │  │
│           │ ▸ package-lock.json +3       │  │
│           └──────────────────────────────┘  │
│                                     [ ↗ ]   │
└─────────────────────────────────────────────┘
```

- **GitHub identity**: Octocat icon + dark accent (charcoal border)
- Short SHA as code badge
- File list expandable (click to see patch/diff)
- Additions (green) / deletions (red) counts

### 4. GitHub PR Card — `GitHubPRCard.tsx`

For: `github_get_pr` result, `github_create_pr` confirmation/result

```
┌─────────────────────────────────────────────┐
│  ◑ GitHub  Pull Request                      │
│                                              │
│  #347  Fix null pointer in auth flow         │
│                                              │
│  ┌──────┐  by @john.doe                     │
│  │ Open │  main ← fix/null-check            │
│  └──────┘                                    │
│                                              │
│  Reviewers: 1/2 approved                     │
│                                              │
│                          [ Review ↗ ]        │
└─────────────────────────────────────────────┘
```

- PR number as prominent identifier
- Status badge: Open (green), Closed (red), Merged (purple)
- Branch arrow showing head → base
- Review status indicator

### 5. Jenkins Pipeline Card — `JenkinsStatusCard.tsx`

For: `jenkins_get_status` result

```
┌─────────────────────────────────────────────┐
│  ⚙ Jenkins                                   │
│                                              │
│  auth-service-pipeline          ┌─────────┐ │
│                                 │ PASSING │ │
│                                 └─────────┘ │
│                                              │
│  Recent runs:                                │
│  ┌───────────────────────────────────────┐  │
│  │ #482  main  ██████████░░  92%  1m32s │  │
│  │ #481  main  ████████████  100% 1m28s │  │
│  │ #480  feat  ██████░░░░░░  54%  2m01s │  │
│  └───────────────────────────────────────┘  │
│                                              │
│  [ ▶ Re-run #482 ]                  [ ↗ ]   │
└─────────────────────────────────────────────┘
```

- **Pipeline name** + overall status badge (PASSING/FAILING/UNSTABLE)
- **Recent runs** with inline pass-rate bars (green/red proportional)
- **Run metadata**: number, branch, percentage, duration
- **Actions** (Editor+):
  - "Re-run" button → triggers pipeline re-run (with confirmation)
  - External link to Jenkins dashboard
- Color coding: green=passing, red=failing, amber=unstable

### 6. Confluence Doc Card — `ConfluenceDocCard.tsx`

For: `confluence_search` results

```
┌─────────────────────────────────────────────┐
│  📄 Confluence                               │
│                                              │
│  Auth Service Runbook                        │
│  "...when UserService throws a NullPointer,  │
│  check the session token expiry first..."    │
│                                              │
│  ┌──────┐  ┌─────────┐                      │
│  │runbook│  │auth-team│                      │
│  └──────┘  └─────────┘                      │
│                                              │
│                        [ Read Full Page ↗ ] │
└─────────────────────────────────────────────┘
```

- Doc title as heading
- Excerpt/snippet with search match highlighting
- Label chips
- "Read Full Page" links to Confluence

### 7. Metrics Card — `MetricsCard.tsx`

For: `dashboard_metrics` result

```
┌─────────────────────────────────────────────┐
│  📊 Dashboard Metrics (30d)                  │
│                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │   142    │ │  93.7%   │ │    12    │    │
│  │ Test Runs│ │ Pass Rate│ │ Archived │    │
│  │   ↑ 8%  │ │   ↑ 2.1% │ │   ↓ 3   │    │
│  └──────────┘ └──────────┘ └──────────┘    │
│                                              │
│  Active Pipelines: 7                         │
└─────────────────────────────────────────────┘
```

- Compact metric tiles with trend arrows
- Pass rate with color coding (green >90%, amber 70-90%, red <70%)
- Time range shown in header

### 8. Prediction Card — `PredictionCard.tsx`

For: `failure_predictions` result (risk_scores, trends, anomalies)

**Risk Scores variant:**
```
┌─────────────────────────────────────────────┐
│  🔮 Risk Analysis                            │
│                                              │
│  ┌─ High Risk ────────────────────────────┐ │
│  │ ●  auth.login.test      87  CRITICAL   │ │
│  │ ●  user.create.test     72  HIGH       │ │
│  │ ○  api.health.test      34  MODERATE   │ │
│  └────────────────────────────────────────┘ │
│                                              │
│  auth.login.test predicted to fail within   │
│  48h based on increasing flakiness trend.   │
└─────────────────────────────────────────────┘
```

**Anomaly variant:**
```
┌─────────────────────────────────────────────┐
│  ⚠ Anomaly Detected                         │
│                                              │
│  3 anomalies flagged in the last 7 days     │
│                                              │
│  Feb 17  Expected: 4  Actual: 12  z: 3.2   │
│  Feb 15  Expected: 3  Actual: 9   z: 2.8   │
│  Feb 12  Expected: 5  Actual: 11  z: 2.4   │
│                                              │
│  ████████████████▓▓░░░░  Sensitivity: High  │
└─────────────────────────────────────────────┘
```

- Risk scores with color-coded severity (critical=red, high=orange, moderate=amber, low=green)
- Filled/empty dot indicates above/below threshold
- AI prediction text shown as narrative
- Anomalies show expected vs actual with z-score

---

## Confirmation Card v2 — Service-Aware

The key insight: **confirmation cards should look like the service they target**.

| Tool | Confirmation Preview |
|------|---------------------|
| `jira_create_issue` | `JiraCreatePreview` — looks like a Jira issue form |
| `jira_transition_issue` | Shows current status → new status with Jira colors |
| `jira_comment` | Shows comment preview under issue context |
| `github_create_pr` | Shows PR title, description, branch arrows |
| `github_create_branch` | Shows branch name + base branch |
| `github_update_file` | Shows file path + change preview |

Common elements:
- **Countdown timer**: progress bar (5min TTL), green→amber→red
- **Keyboard shortcuts**: Enter=approve, Esc=deny (shown as kbd badges)
- **Status states**: pending (amber left border + pulse), approved (green + checkmark), denied (grey + strikethrough)

---

## In-Card Actions — Human-in-the-Loop

When a user clicks an action button inside a card (e.g., "Move to Done" on a Jira card):

1. **Button click** → generates a prompt message as if user typed it:
   `"Transition BUG-1234 to Done"`
2. **Sent to chat** → AI processes → hits the write tool → confirmation flow triggers
3. **Confirmation card** appears inline below, service-native
4. **User approves** → tool executes → original card updates to reflect new state

This creates a **conversational action loop** — cards trigger prompts, prompts trigger cards.

---

## Role-Aware Rendering

User role comes from the auth context (JWT). Cards adapt:

| Element | Admin/Editor | Viewer |
|---------|-------------|--------|
| Jira status transition button | Visible | Hidden |
| Jira comment button | Visible | Hidden |
| Jenkins re-run button | Visible | Hidden |
| GitHub external links | Visible | Visible |
| Confluence read link | Visible | Visible |
| Copy/feedback actions | Visible | Visible |
| Metrics data | Full | Full |
| Predictions | Full + actions | Read-only |

The `CardActions` component checks user role and renders accordingly.

---

## Assistant Message — Markdown Rendering

```typescript
// MarkdownRenderer.tsx — lightweight, no deps
// Supports: **bold**, *italic*, `code`, ```code blocks```,
// [links](url), - lists, ## headers, > blockquotes
```

- Uses `react-syntax-highlighter` (already installed) for fenced code blocks
- Copy button on every code block
- All other markdown via simple regex transforms → React elements
- No npm dependency (react-markdown is overkill for our use case)

---

## Chat Input v2

- **Multi-line textarea** with auto-grow (up to 120px / ~5 lines)
- **Enter** sends (single line), **Shift+Enter** for newline
- **Keyboard hint** subtle text below input
- **Disabled state** during streaming with pulse animation
- **Clear button** in header (existing, keep)

---

## Empty State

- Animated indigo diamond (CSS keyframes, no deps)
- "TestOps Copilot" branding
- 4 quick-action cards in a 2x2 grid:
  1. "Analyze last failure" → sends prompt
  2. "Show test trends" → sends prompt
  3. "Check pipeline health" → sends prompt
  4. "Find related issues" → sends prompt
- Cards use glassmorphism from theme, hover with subtle lift

---

## Implementation Phases

### Phase 1: Data Pipeline + Message Architecture
- Extend `useAICopilot.ts` with `toolData` on ChatMessage
- Modify backend SSE to include structured `result.data` in tool_result events
- Create `ToolResultCard.tsx` router that dispatches by `toolName`
- Extract `MarkdownRenderer.tsx`

### Phase 2: Service Cards (Read Tools)
- `JiraIssueCard.tsx` — for jira_search / jira_get
- `GitHubCommitCard.tsx` — for github_get_commit
- `GitHubPRCard.tsx` — for github_get_pr
- `JenkinsStatusCard.tsx` — for jenkins_get_status
- `ConfluenceDocCard.tsx` — for confluence_search
- `MetricsCard.tsx` — for dashboard_metrics
- `PredictionCard.tsx` — for failure_predictions
- `GenericResultCard.tsx` — fallback
- Shared: `ServiceBadge.tsx`, `StatusChip.tsx`, `ExpandablePayload.tsx`

### Phase 3: Interactive Cards (Write Tools + Actions)
- `JiraCreatePreview.tsx` — confirmation for jira_create_issue
- Service-aware confirmation rendering for all 6 write tools
- In-card action buttons with prompt generation
- `CardActions.tsx` with role-aware visibility
- Countdown timer component
- Keyboard shortcuts (Enter/Esc) for confirmations

### Phase 4: Shell Polish
- `AssistantMessage.tsx` with markdown + message actions
- `ThinkingIndicator.tsx` — premium animated phase indicator
- `ChatInput.tsx` — multi-line with keyboard hints
- `EmptyState.tsx` — branded quick actions
- `MessageActions.tsx` — copy, feedback, timestamps
- Wire into `AICopilot.tsx`

### Phase 5: Verify + Ship
- TypeScript clean (`npm run typecheck`)
- Tests pass (`npm run test`)
- Build succeeds (`npm run build`)
- Dark/light mode verified
- WCAG AA contrast check
- Commit + push + PR

---

## Backend Changes (Minimal)

**Single change**: In `AIChatService.ts`, the SSE `tool_result` event currently sends:
```typescript
sendSSE({ type: 'tool_result', tool: toolName, data: result.summary });
```
Change to:
```typescript
sendSSE({ type: 'tool_result', tool: toolName, data: JSON.stringify({ summary: result.summary, toolData: result.data }) });
```

This gives the frontend structured data to render service cards, while maintaining backward compatibility (the `summary` is still there as fallback text).

---

## What This Does NOT Change

- Authentication/authorization model
- Backend AI tool implementations (tools still return same ToolResult shape)
- Layout grid (360px AI panel)
- SSE event types (same 8 types)
- ReAct loop limits (5 tools, 8 iterations)

---

## Success Criteria

- [ ] User can see a Jira issue card (with status chip, labels, assignee) directly in chat
- [ ] User can click "Move to Done" on a Jira card and have it trigger a confirmation flow
- [ ] Confirmation cards show service-native previews, not raw JSON
- [ ] Jenkins card shows pipeline runs with pass-rate bars and a re-run button
- [ ] GitHub PR card shows review status
- [ ] Viewer role sees cards but not action buttons
- [ ] Code blocks in assistant messages have syntax highlighting and copy buttons
- [ ] Empty state shows 4 clickable quick-action cards
- [ ] Input supports multiline with keyboard shortcuts

---

*Team: UX_DESIGNER (primary) + AI_ARCHITECT + AI_PRODUCT_MANAGER + SENIOR_ENGINEER*
