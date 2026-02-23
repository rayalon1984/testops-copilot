# AI Chat UX Overhaul v3 — Definitive Full-Stack Plan

> **Date**: 2026-02-19
> **Status**: APPROVED
> **Primary Persona**: UX_DESIGNER
> **Supporting**: AI_ARCHITECT, SENIOR_ENGINEER, SECURITY_ENGINEER
> **Supersedes**: v2 and v2.1 — this is the single source of truth

---

## What Changed From v2

v2 was visionary but aspirational. v3 confronts the actual codebase.

| v2 Assumption | Reality | v3 Fix |
|---------------|---------|--------|
| Jenkins "Re-run" button | `jenkins_get_status` is the ONLY Jenkins tool — zero write tools | Card is read-only; no action buttons |
| GitHub workflow re-run/cancel | No workflow tools exist; only `create_pr`, `create_branch`, `update_file` | Remove aspirational workflow actions |
| 2-tier role model (Admin vs Viewer) | 5-level hierarchy: ADMIN(40) > EDITOR(30) = USER(30) > BILLING(20) > VIEWER(10) | Full 5-level role matrix for every card action |
| AI tools enforce roles | `ToolContext` has `userRole` but every `execute()` ignores it | Frontend-only role gating; backend gap documented |
| SSE sends structured `toolData` | SSE sends `toolResult.summary` string only (line 296 of AIChatService.ts); `data` feeds back to LLM only | Backend change: send `{ summary, data }` JSON |
| Confirmation shows service preview | Confirmation sends `{ actionId, tool, args, summary }` where summary = `"Call jira_create_issue with args: {...}"` | Frontend renders `tool` + `args` as service-native previews; no backend change needed |
| TestRun cancel/retry in chat | Service methods exist but no AI tools expose them | Deferred — document gap, don't fake it |

---

## The 14 Actual Tools — Truth Table

### Read Tools (8) — No Confirmation

| # | Tool | Category | `result.data` Shape | Card |
|---|------|----------|---------------------|------|
| 1 | `jira_search` | jira | `[{ key, summary, status, type, labels, assignee }]` | `JiraSearchCard` |
| 2 | `jira_get` | jira | `{ key, summary, status, type, description, labels, assignee }` | `JiraIssueCard` |
| 3 | `github_get_commit` | github | `{ message, filesChanged, files: [{ filename, status, additions, deletions, patch }] }` | `GitHubCommitCard` |
| 4 | `github_get_pr` | github | `{ number, title, author, url, body }` | `GitHubPRCard` |
| 5 | `confluence_search` | confluence | `[{ id, title, url, excerpt, labels }]` | `ConfluenceDocCard` |
| 6 | `jenkins_get_status` | jenkins | `{ pipeline: { id, name, type, ... }, recentRuns: [{ id, name, status, branch, passed, failed, skipped, duration, totalTests, startedAt, completedAt }] }` | `JenkinsStatusCard` **(READ-ONLY)** |
| 7 | `dashboard_metrics` | dashboard | `{ timeRange, totalTestRuns, passedRuns, failedRuns, passRate, failuresArchived, activePipelines }` | `MetricsCard` |
| 8 | `failure_predictions` | dashboard | Varies by `action`: `{ scores }` / `{ direction, rateOfChange, movingAverage7d, percentChange7d }` / `{ anomalies, flaggedCount }` | `PredictionCard` (3 variants) |

### Write Tools (6) — Require Confirmation

| # | Tool | Category | `args` Shape (from confirmation_request) | Preview |
|---|------|----------|------------------------------------------|---------|
| 9 | `jira_create_issue` | jira | `{ summary, description, type, labels? }` | `JiraCreatePreview` |
| 10 | `jira_transition_issue` | jira | `{ issueKey, status }` where status in `[TODO, IN_PROGRESS, DONE]` | `JiraTransitionPreview` |
| 11 | `jira_comment` | jira | `{ issueKey, body }` | `JiraCommentPreview` |
| 12 | `github_create_pr` | github | `{ owner, repo, title, body, head, base }` | `GitHubPRPreview` |
| 13 | `github_create_branch` | github | `{ owner, repo, branchName, baseBranch? }` | `GitHubBranchPreview` |
| 14 | `github_update_file` | github | `{ owner, repo, path, content, message, branch }` | `GitHubFileChangePreview` |

---

## Role Matrix — 5-Level

From `backend/src/middleware/auth.ts` and `backend/src/constants/index.ts`:

```
ADMIN (40) > EDITOR (30) = USER (30) > BILLING (20) > VIEWER (10)
```

**Enforcement**: Frontend-only via `CardActions`. AI tools do NOT check roles in `execute()` — they receive `userRole` in `ToolContext` but ignore it. The REST `authorize()` middleware guards endpoints, not the ReAct loop. This gap is documented here; fixing it is out of scope for UX.

| Action | ADMIN | EDITOR/USER | BILLING | VIEWER |
|--------|-------|-------------|---------|--------|
| View any card content | Yes | Yes | Yes | Yes |
| External links (open in Jira/GitHub/Jenkins) | Yes | Yes | Yes | Yes |
| Copy / feedback / timestamps | Yes | Yes | Yes | Yes |
| Jira: "Move to Done" button | Yes | Yes | No | No |
| Jira: "Comment" inline form | Yes | Yes | No | No |
| Approve any write confirmation | Yes | Yes | No | No |
| Deny any confirmation | Yes | Yes | Yes | Yes |
| View cost/budget in MetricsCard | Yes | Yes | Yes | No |

Rule: `ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[EDITOR]` → show action buttons. Otherwise hide (not disable).

---

## Architecture

### Component Tree

```
frontend/src/components/AICopilot/
├── AICopilot.tsx                         # Shell: header + messages + input
├── messages/
│   ├── UserMessage.tsx                   # Blue bubble, right-aligned
│   ├── AssistantMessage.tsx              # Markdown + MessageActions
│   ├── ThinkingIndicator.tsx             # Animated dot pulse
│   ├── ErrorMessage.tsx                  # Red error display
│   └── ToolResultCard.tsx                # Router → card by toolName
├── cards/
│   ├── JiraIssueCard.tsx                 # Single issue + in-card actions
│   ├── JiraSearchCard.tsx                # Stacked sub-cards (array)
│   ├── JiraCreatePreview.tsx             # Confirmation: create issue
│   ├── JiraTransitionPreview.tsx         # Confirmation: status change
│   ├── JiraCommentPreview.tsx            # Confirmation: add comment
│   ├── GitHubCommitCard.tsx              # Commit + files changed
│   ├── GitHubPRCard.tsx                  # PR status
│   ├── GitHubPRPreview.tsx              # Confirmation: create PR
│   ├── GitHubBranchPreview.tsx           # Confirmation: create branch
│   ├── GitHubFileChangePreview.tsx       # Confirmation: update file
│   ├── JenkinsStatusCard.tsx             # Pipeline + runs (READ-ONLY)
│   ├── ConfluenceDocCard.tsx             # Doc snippet + labels
│   ├── MetricsCard.tsx                   # Dashboard tiles + trends
│   ├── PredictionCard.tsx                # Risk / trend / anomaly
│   └── GenericResultCard.tsx             # Fallback
├── cards/shared/
│   ├── ServiceBadge.tsx                  # Icon + name + colored left border
│   ├── StatusChip.tsx                    # Semantic status colors
│   ├── CardActions.tsx                   # Role-gated action buttons
│   ├── ExpandableSection.tsx             # Show/hide toggle
│   └── ConfirmationShell.tsx             # Countdown + approve/deny + kbd shortcuts
├── ChatInput.tsx                         # Multi-line textarea + hints
├── EmptyState.tsx                        # Quick actions + branding
├── MarkdownRenderer.tsx                  # MD → React + syntax highlight
└── MessageActions.tsx                    # Copy, thumbs, timestamp
```

### Backend Change — Single Line

Current (`AIChatService.ts` line 296):
```typescript
sendSSE(res, createEvent('tool_result', toolResult.summary, tool.name));
```

New:
```typescript
sendSSE(res, createEvent('tool_result', JSON.stringify({
    summary: toolResult.summary,
    data: toolResult.data,
}), tool.name));
```

That's it. The `data` field is already returned by every tool's `execute()`. We just pipe it to the frontend.

### Frontend Hook Changes — `useAICopilot.ts`

Extended `ChatMessage`:
```typescript
export interface ChatMessage {
    id: string;
    role: MessageRole;
    content: string;           // summary text (always present)
    toolName?: string;
    timestamp: Date;
    // NEW
    toolData?: Record<string, unknown>;                    // structured tool output
    cardState?: 'idle' | 'action_pending' | 'updated';    // card lifecycle
    // Existing confirmation fields (unchanged)
    actionId?: string;
    toolArgs?: Record<string, unknown>;
    confirmationStatus?: 'pending' | 'approved' | 'denied';
}
```

Extended return:
```typescript
interface UseAICopilotReturn {
    messages: ChatMessage[];
    isStreaming: boolean;
    error: string | null;
    sendMessage: (message: string) => void;
    confirmAction: (actionId: string, approved: boolean) => Promise<void>;
    clearMessages: () => void;
    // NEW
    updateMessage: (id: string, patch: Partial<ChatMessage>) => void;
    sendActionPrompt: (prompt: string, sourceMessageId: string) => void;
}
```

SSE `tool_result` handler change:
```typescript
case 'tool_result': {
    let content = event.data;
    let toolData: Record<string, unknown> | undefined;
    try {
        const parsed = JSON.parse(event.data);
        if (parsed.summary !== undefined) {
            content = parsed.summary;
            toolData = parsed.data;
        }
    } catch {
        // Legacy string format — content is already the summary
    }
    setMessages(prev => [...prev, {
        id: generateId(),
        role: 'tool_result',
        content,
        toolName: event.tool,
        toolData,
        cardState: 'idle',
        timestamp: new Date(),
    }]);
    break;
}
```

---

## Service Card Designs

### Design Tokens

| Service | Icon | Accent | Border |
|---------|------|--------|--------|
| Jira | `⬡` | `#0052CC` | 3px left blue |
| GitHub | `◑` | `#24292f` | 3px left charcoal |
| Jenkins | `⚙` | `#D33833` | 3px left red |
| Confluence | `📄` | `#1868DB` | 3px left teal-blue |
| Dashboard | `📊` | `#6366F1` | 3px left indigo |
| Predictions | `🔮` | `#8B5CF6` | 3px left purple |
| Generic | `🔧` | `#64748B` | 3px left slate |

### Status Chip Colors

| Status | Background | Text | Service |
|--------|-----------|------|---------|
| To Do / PENDING | `#E2E8F0` | `#475569` | Jira, Jenkins |
| In Progress / RUNNING | `#DBEAFE` | `#1D4ED8` | Jira, Jenkins |
| Done / PASSED | `#D1FAE5` | `#065F46` | Jira, Jenkins |
| FAILED | `#FEE2E2` | `#991B1B` | Jenkins |
| Open (PR) | `#D1FAE5` | `#065F46` | GitHub |
| Closed (PR) | `#FEE2E2` | `#991B1B` | GitHub |
| Merged (PR) | `#EDE9FE` | `#5B21B6` | GitHub |

### 1. JiraIssueCard (`jira_get`)

```
┌─[blue]───────────────────────────────────┐
│  ⬡ Jira                                  │
│                                           │
│  BUG-1234                       ┌──────┐ │
│  NullPointer in UserService.ts  │In Prg│ │
│                                 └──────┘ │
│  ┌────┐ ┌──────┐ ┌─────┐                │
│  │ Bug│ │P-High│ │ auth│                 │
│  └────┘ └──────┘ └─────┘                │
│  Assignee: John Doe                       │
│                                           │
│  [→ Move to Done] [💬 Comment] [↗ Open] │  ← EDITOR+ only (except ↗)
└───────────────────────────────────────────┘
```

Actions (EDITOR+ only via `CardActions`):
- "Move to Done" → `sendActionPrompt('Transition BUG-1234 to Done', msgId)`
- "Comment" → expand inline textarea → on submit: `sendActionPrompt('Add comment to BUG-1234: <text>', msgId)`
- "↗ Open" → `window.open(...)` (all roles)

### 2. JiraSearchCard (`jira_search`)

```
┌─ ⬡ Jira Search: 3 results ──────────────┐
│  ┌─ BUG-1234 ─────────────── In Prg ──┐ │
│  │  NullPointer in UserService.ts      │ │
│  │  Bug · P-High · @john   [Actions ▾] │ │
│  └─────────────────────────────────────┘ │
│  ┌─ BUG-1189 ─────────────── To Do ───┐ │
│  │  UserService.findById crash         │ │
│  │  Bug · P-Med · unassigned           │ │
│  └─────────────────────────────────────┘ │
└───────────────────────────────────────────┘
```

Each sub-card is individually expandable with its own actions.

### 3. GitHubCommitCard (`github_get_commit`)

```
┌─[charcoal]───────────────────────────────┐
│  ◑ GitHub                                 │
│  Fix null check in UserService            │
│  a3f2b1c · 4 files changed              │
│  +12 -3                                   │
│  ▸ src/services/UserSvc.ts          +8   │
│  ▸ src/tests/UserSvc.test.ts        +3   │
│  ▸ package.json                     +1   │
│  ▸ package-lock.json                -3   │
│                                    [↗]   │
└───────────────────────────────────────────┘
```

Read-only. File list expandable to show patches.

### 4. GitHubPRCard (`github_get_pr`)

```
┌─[charcoal]───────────────────────────────┐
│  ◑ GitHub  Pull Request                   │
│  #347  Fix null pointer in auth flow      │
│  ┌──────┐  by @john.doe                  │
│  │ Open │  main ← fix/null-check         │
│  └──────┘                                 │
│                         [ Review ↗ ]      │
└───────────────────────────────────────────┘
```

Read-only. External link to PR.

### 5. JenkinsStatusCard (`jenkins_get_status`) — READ-ONLY

```
┌─[red]────────────────────────────────────┐
│  ⚙ Jenkins                                │
│  auth-service-pipeline      ┌──────────┐ │
│                              │ PASSING  │ │
│                              └──────────┘ │
│  Recent runs:                             │
│  #482  main  ██████████░░  92%  1m32s    │
│  #481  main  ████████████  100% 1m28s    │
│  #480  feat  ██████░░░░░░  54%  2m01s    │
│                                    [↗]   │
└───────────────────────────────────────────┘
```

**NO action buttons.** No `jenkins_trigger_build` tool exists. Pass-rate bars proportional green/red. External link only.

### 6. ConfluenceDocCard (`confluence_search`)

```
┌─[teal]───────────────────────────────────┐
│  📄 Confluence                            │
│  Auth Service Runbook                     │
│  "...when UserService throws a            │
│  NullPointer, check the session token..." │
│  ┌───────┐ ┌──────────┐                 │
│  │runbook│ │auth-team │                 │
│  └───────┘ └──────────┘                 │
│                      [ Read Full Page ↗ ]│
└───────────────────────────────────────────┘
```

### 7. MetricsCard (`dashboard_metrics`)

```
┌─[indigo]─────────────────────────────────┐
│  📊 Dashboard Metrics (Last 30 days)      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │   142    │ │  93.7%   │ │    12    │ │
│  │ Test Runs│ │ Pass Rate│ │ Archived │ │
│  └──────────┘ └──────────┘ └──────────┘ │
│  Active Pipelines: 7                      │
└───────────────────────────────────────────┘
```

Pass rate color: green >90%, amber 70-90%, red <70%.

### 8. PredictionCard (`failure_predictions`) — 3 Variants

Detects variant by checking which fields exist in `toolData`:

- `data.scores` → **Risk Scores** (severity-colored list, filled/empty dots)
- `data.direction` → **Trend** (direction arrow, rate, moving average, % change)
- `data.anomalies` → **Anomaly** (date table with expected/actual/z-score)

### 9. GenericResultCard — Fallback

```
┌─[slate]──────────────────────────────────┐
│  🔧 tool_name                             │
│  Summary text from tool result            │
│  ▸ Show raw data                          │
└───────────────────────────────────────────┘
```

---

## Confirmation Previews — Service-Native

### ConfirmationShell (shared wrapper)

Every write-tool confirmation wraps in this:

```typescript
interface ConfirmationShellProps {
    tool: string;
    actionId: string;
    status: 'pending' | 'approved' | 'denied';
    createdAt: Date;
    userRole: string;
    onConfirm: () => void;
    onDeny: () => void;
    children: React.ReactNode; // service-specific preview
}
```

Features:
- **Countdown timer**: 5min TTL, progress bar green → amber (2min left) → red (30s left)
- **Keyboard**: `Enter` = approve, `Escape` = deny (when focused)
- **VIEWER/BILLING**: approve hidden, deny visible, message "Requires Editor role"
- **Post-approve**: green border + checkmark animation
- **Post-deny**: grey border + strikethrough text

### Preview Components

**`JiraCreatePreview`** — `jira_create_issue` confirmation:
```
┌─ ⬡ Create Jira Issue ───────── REVIEW ─┐
│  Type       Bug                          │
│  Summary    NullPointer in UserSvc.ts    │
│  Labels     regression, auth             │
│  Description                             │
│  ┌──────────────────────────────────┐   │
│  │ Stack trace from test run #482: │   │
│  │ TypeError: Cannot read proper...│   │
│  └──────────────────────────────────┘   │
│  ████████████░░░░░░  3:42 remaining     │
│  [ Deny  ⎋ ]           [ ✓ Create  ⏎ ] │
└──────────────────────────────────────────┘
```

**`JiraTransitionPreview`** — `jira_transition_issue`:
```
┌─ ⬡ Transition Issue ────────── REVIEW ─┐
│  BUG-1234                                │
│  ┌──────┐      ┌──────┐                │
│  │In Prg│  →   │ Done │                │
│  └──────┘      └──────┘                │
│   (blue)        (green)                  │
│  [ Deny  ⎋ ]     [ ✓ Transition  ⏎ ]   │
└──────────────────────────────────────────┘
```

**`JiraCommentPreview`** — `jira_comment`:
```
┌─ ⬡ Add Comment ─────────────── REVIEW ─┐
│  BUG-1234                                │
│  ┌── Comment ────────────────────────┐  │
│  │ This was caused by the session    │  │
│  │ token expiry change in PR #347.   │  │
│  └───────────────────────────────────┘  │
│  [ Deny  ⎋ ]          [ ✓ Comment  ⏎ ] │
└──────────────────────────────────────────┘
```

**`GitHubPRPreview`** — `github_create_pr`:
```
┌─ ◑ Create Pull Request ───────── REVIEW ┐
│  Fix null pointer in auth flow           │
│  main ← fix/null-check                  │
│  ┌── Description ────────────────────┐  │
│  │ Adds null check before            │  │
│  │ UserService query to prevent...   │  │
│  └───────────────────────────────────┘  │
│  [ Deny  ⎋ ]       [ ✓ Create PR  ⏎ ]  │
└──────────────────────────────────────────┘
```

**`GitHubBranchPreview`** — `github_create_branch`:
```
┌─ ◑ Create Branch ─────────────── REVIEW ┐
│  fix/null-check                          │
│  branching from: main                    │
│  [ Deny  ⎋ ]    [ ✓ Create Branch  ⏎ ] │
└──────────────────────────────────────────┘
```

**`GitHubFileChangePreview`** — `github_update_file`:
```
┌─ ◑ Update File ───────────────── REVIEW ┐
│  src/services/UserService.ts             │
│  on branch: fix/null-check               │
│  Commit: "Add null check to findById"    │
│  ▸ Preview content                       │
│  [ Deny  ⎋ ]     [ ✓ Commit File  ⏎ ]  │
└──────────────────────────────────────────┘
```

---

## Dynamic Card Behavior

### Card State Machine

```
IDLE ──[click action]──→ ACTION_PENDING ──[complete]──→ UPDATED
  ↑                            │                           │
  └──────[timeout/cancel]──────┘                           │
  └────────────────────────────────────────────────────────┘
```

### In-Card Action Flow

1. User clicks "Move to Done" on `JiraIssueCard`
2. Button → spinner, `cardState` → `action_pending`
3. `sendActionPrompt('Transition BUG-1234 to Done', cardMsgId)`
4. AI processes → `jira_transition_issue` → confirmation card appears
5. User approves → tool executes → `confirmation_resolved`
6. Hook finds source card by `cardMsgId`, calls `updateMessage(id, { cardState: 'updated', toolData: { ...prev, status: 'Done' } })`
7. Status chip animates blue → green (300ms CSS transition)

### Inline Comment Form

On "Comment" click, card expands:
```
│  ┌─ Add Comment ──────────────────────┐ │
│  │ [textarea]                         │ │
│  └────────────────────────────────────┘ │
│                       [ Cancel ] [ Send ]│
```

No modal. Form lives inside the card. "Send" → `sendActionPrompt(...)`.

### Action Button States

```
[ → Move to Done ]  →  [ ◌ Moving... ]  →  [ ✓ Done ]  →  (card updates)
     (idle)              (pending)         (success 1s)
```

---

## ToolResultCard Router

```typescript
function ToolResultCard({ toolName, toolData, content, userRole, onAction }: Props) {
    if (!toolData) return <GenericResultCard toolName={toolName} summary={content} />;

    switch (toolName) {
        case 'jira_get':         return <JiraIssueCard data={toolData} userRole={userRole} onAction={onAction} />;
        case 'jira_search':      return <JiraSearchCard results={toolData} userRole={userRole} onAction={onAction} />;
        case 'github_get_commit': return <GitHubCommitCard data={toolData} />;
        case 'github_get_pr':    return <GitHubPRCard data={toolData} />;
        case 'confluence_search': return <ConfluenceDocCard results={toolData} />;
        case 'jenkins_get_status': return <JenkinsStatusCard data={toolData} />;
        case 'dashboard_metrics': return <MetricsCard data={toolData} />;
        case 'failure_predictions': return <PredictionCard data={toolData} />;
        default:                 return <GenericResultCard toolName={toolName} summary={content} data={toolData} />;
    }
}
```

Confirmation routing (in `AICopilot.tsx`):
```typescript
function ConfirmationPreview({ toolName, args, ...shell }: Props) {
    const inner = (() => {
        switch (toolName) {
            case 'jira_create_issue':     return <JiraCreatePreview args={args} />;
            case 'jira_transition_issue': return <JiraTransitionPreview args={args} />;
            case 'jira_comment':          return <JiraCommentPreview args={args} />;
            case 'github_create_pr':      return <GitHubPRPreview args={args} />;
            case 'github_create_branch':  return <GitHubBranchPreview args={args} />;
            case 'github_update_file':    return <GitHubFileChangePreview args={args} />;
            default:                      return <GenericResultCard toolName={toolName} data={args} />;
        }
    })();
    return <ConfirmationShell {...shell}>{inner}</ConfirmationShell>;
}
```

---

## Chat Shell Components

### AssistantMessage
- `MarkdownRenderer` for content
- Copy button on fenced code blocks (uses `react-syntax-highlighter`, already installed)
- `MessageActions` below: copy, thumbs up/down, timestamp

### ThinkingIndicator
- `◌ Analyzing your question...` with CSS dot-pulse
- Text from SSE `thinking` event

### ChatInput v2
- `textarea` with auto-grow (1 → 5 lines max, 120px)
- `Enter` sends, `Shift+Enter` newline
- Disabled + pulse during streaming
- Hint: "Enter to send · Shift+Enter for newline"

### EmptyState
- Diamond icon with CSS pulse
- "TestOps Copilot" heading
- 4 quick-action cards (2x2): "Analyze last failure", "Show test trends", "Check pipelines", "Find related issues"
- Click → `sendMessage(promptText)`

### MarkdownRenderer
Lightweight, no `react-markdown` dep. Regex transforms:
- `**bold**` → `<strong>`, `*italic*` → `<em>`, `` `code` `` → `<code>`
- ```` ```lang ``` ```` → `<SyntaxHighlighter>`, `[text](url)` → `<a>`
- `- item` → `<ul><li>`, `## heading` → `<h3>`, `> quote` → `<blockquote>`

---

## Implementation Phases

### Phase 1: Data Pipeline + Message Foundation

| File | Action | What |
|------|--------|------|
| `backend/src/services/ai/AIChatService.ts` | MODIFY (line 296) | Send `{ summary, data }` in `tool_result` SSE |
| `frontend/src/hooks/useAICopilot.ts` | MODIFY | Add `toolData`, `cardState`, `updateMessage`, `sendActionPrompt`; parse new SSE format with legacy fallback |
| `frontend/src/components/AICopilot/messages/ToolResultCard.tsx` | CREATE | Router dispatching by `toolName` |
| `frontend/src/components/AICopilot/MarkdownRenderer.tsx` | CREATE | MD → React with syntax highlighting |
| `frontend/src/components/AICopilot/messages/AssistantMessage.tsx` | CREATE | Markdown-rendered response + MessageActions |
| `frontend/src/components/AICopilot/messages/ThinkingIndicator.tsx` | CREATE | Dot-pulse animation |

### Phase 2: Service Cards (Read Tools)

| Component | Tool | Notes |
|-----------|------|-------|
| `JiraIssueCard.tsx` | `jira_get` | With action button slots (wired in Phase 3) |
| `JiraSearchCard.tsx` | `jira_search` | Stacked mini-cards |
| `GitHubCommitCard.tsx` | `github_get_commit` | Expandable file list |
| `GitHubPRCard.tsx` | `github_get_pr` | Status badge + branch arrows |
| `JenkinsStatusCard.tsx` | `jenkins_get_status` | Pass-rate bars, **no actions** |
| `ConfluenceDocCard.tsx` | `confluence_search` | Excerpt + labels |
| `MetricsCard.tsx` | `dashboard_metrics` | Compact tiles |
| `PredictionCard.tsx` | `failure_predictions` | 3 variants |
| `GenericResultCard.tsx` | fallback | Summary + expandable raw |
| `ServiceBadge.tsx` | shared | Icon + accent color |
| `StatusChip.tsx` | shared | Semantic colors |
| `ExpandableSection.tsx` | shared | Show/hide toggle |

### Phase 3: Interactive Cards (Write Tools + Actions)

| Component | Tool | Notes |
|-----------|------|-------|
| `ConfirmationShell.tsx` | all write tools | Countdown, kbd, role gating |
| `JiraCreatePreview.tsx` | `jira_create_issue` | Form preview |
| `JiraTransitionPreview.tsx` | `jira_transition_issue` | Status → Status |
| `JiraCommentPreview.tsx` | `jira_comment` | Comment preview |
| `GitHubPRPreview.tsx` | `github_create_pr` | PR preview |
| `GitHubBranchPreview.tsx` | `github_create_branch` | Branch + base |
| `GitHubFileChangePreview.tsx` | `github_update_file` | File + commit msg |
| `CardActions.tsx` | shared | Role-gated buttons |
| `AICopilot.tsx` | MODIFY | Wire confirmation routing |

### Phase 4: Shell Polish

| Component | Action | Notes |
|-----------|--------|-------|
| `ChatInput.tsx` | CREATE | Multi-line, auto-grow, kbd hints |
| `EmptyState.tsx` | CREATE | Diamond + 4 quick-action cards |
| `MessageActions.tsx` | CREATE | Copy, thumbs, timestamp |
| `UserMessage.tsx` | CREATE | Right-aligned blue bubble |
| `ErrorMessage.tsx` | CREATE | Red error display |
| `AICopilot.tsx` | MODIFY | Replace inline rendering with components |

### Phase 5: Verify + Ship

- `npm run typecheck` — zero errors
- `npm run test` — all pass
- `npm run build` — succeeds
- Manual: dark mode card readability
- Commit + push

---

## What This Does NOT Change

- Backend tool implementations (same `ToolResult` shape)
- ReAct loop limits (5 tools, 8 iterations)
- Authentication / JWT flow
- SSE event types (same 8 types)
- 360px AI panel width
- Database schema
- ConfirmationService / PendingAction model

## What This Explicitly Defers

| Item | Why | Future |
|------|-----|--------|
| Jenkins write tools (re-run, cancel) | No backend tool exists | Create `jenkins_trigger_build` tool |
| GitHub workflow control (re-run, cancel) | No backend tool exists | Create `github_rerun_workflow` tool |
| TestRun cancel/retry via chat | Service methods exist, no AI tools | Create `testrun_cancel`/`testrun_retry` tools |
| AI-layer role enforcement | Tools ignore `userRole` | Add role checks in `Tool.execute()` |
| Token-by-token streaming | SSE sends complete answer | Implement chunked answer streaming |
| Auto-resume after confirmation | Backend stops ReAct loop on confirmation | Implement confirmation-resume flow |

---

## File Count Summary

| Phase | New | Modified | Total |
|-------|-----|----------|-------|
| Phase 1 | 4 | 2 | 6 |
| Phase 2 | 12 | 0 | 12 |
| Phase 3 | 8 | 1 | 9 |
| Phase 4 | 5 | 1 | 6 |
| **Total** | **29** | **4** | **33** |

---

## Success Criteria

### Cards (all 14 tools mapped)
- [ ] `jira_get` → JiraIssueCard with status chip, labels, type/priority, assignee
- [ ] `jira_search` → JiraSearchCard with stacked expandable sub-cards
- [ ] `github_get_commit` → GitHubCommitCard with SHA, files, +/-
- [ ] `github_get_pr` → GitHubPRCard with status, branches, author
- [ ] `jenkins_get_status` → JenkinsStatusCard with pass-rate bars, **no action buttons**
- [ ] `confluence_search` → ConfluenceDocCard with title, excerpt, labels
- [ ] `dashboard_metrics` → MetricsCard with tiles and color-coded pass rate
- [ ] `failure_predictions` → PredictionCard with 3 variants
- [ ] Unknown tools → GenericResultCard with summary + expandable raw

### Confirmations (all 6 write tools)
- [ ] `jira_create_issue` → JiraCreatePreview (form-like)
- [ ] `jira_transition_issue` → Status → Status with colors
- [ ] `jira_comment` → Comment preview with issue context
- [ ] `github_create_pr` → PR preview with branch arrows
- [ ] `github_create_branch` → Branch + base
- [ ] `github_update_file` → File + commit message
- [ ] Countdown timer (5min, green → amber → red)
- [ ] Keyboard: Enter=approve, Esc=deny

### Roles (5-level)
- [ ] ADMIN/EDITOR/USER: action buttons + can approve
- [ ] BILLING: content visible, cannot approve
- [ ] VIEWER: read-only, no actions

### Dynamic
- [ ] Card state: idle → action_pending → updated
- [ ] Status chip animates on transition
- [ ] Inline comment form expands inside card
- [ ] Button loading states

### Shell
- [ ] Markdown + syntax highlighting on assistant messages
- [ ] Copy button on code blocks
- [ ] Multi-line input (Shift+Enter)
- [ ] Thinking indicator
- [ ] Empty state with 4 quick actions
- [ ] Copy + feedback on messages

### Backend
- [ ] Single line change: `tool_result` SSE sends `{ summary, data }`
- [ ] Backward compatible (frontend handles old string format)

---

*Personas: UX_DESIGNER (primary), AI_ARCHITECT (tool policy), SENIOR_ENGINEER (implementation), SECURITY_ENGINEER (role gap documented)*
