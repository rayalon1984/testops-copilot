# Product Spec: Autonomous AI & Proactive UX (v3.0.0 Phase 3)

> **Owner**: AI Product Manager
> **Status**: Shipped (Sprint 6-7) · **Version**: 3.4.0
> **Date**: 2026-03-01
> **Supporting Personas**: AI_ARCHITECT, UX_DESIGNER, SENIOR_ENGINEER, SECURITY_ENGINEER

---

## Problem Statement

Today, the AI copilot is **purely reactive**: it waits for user prompts, reasons, and asks for confirmation on every write operation. This creates unnecessary friction for actions where:

1. **The outcome is obvious** — e.g., retrying a test that failed because the environment was down
2. **The AI already has the answer** — e.g., no Jira ticket exists, so why wait for the user to say "create one"?
3. **The user's next step is predictable** — e.g., after RCA → fix → PR, the user always wants to review the diff

The current system treats all write operations equally. But a test retry and a production PR merge have vastly different risk profiles. We need a **graduated autonomy model** — not a binary safe/unsafe switch.

---

## Core Concept: Three Autonomy Tiers

### The Bright-Line Rule

> **Visible to the team = user decides. Internal/reversible = AI acts.**
>
> If an action creates an artifact that other team members will see in their
> dashboards, backlogs, inboxes, or Slack channels — the user must approve it.
> If an action is internal metadata, reversible, or only visible to the
> requesting user — the AI can act autonomously and notify after.

### Decision Framework (Tier Assignment)

To classify any action into a tier, ask these questions in order:

```
1. Is it visible to the entire team the moment it happens?
   YES → Tier 2 minimum (user sees card, one-click approve)
   NO  → continue

2. Is it destructive or irreversible?
   YES → Tier 3 (full confirmation with TTL)
   NO  → continue

3. Can it trigger downstream automations (webhooks, CI, notifications)?
   YES → Tier 2 (user approves the card)
   NO  → continue

4. Is it internal metadata (links, labels, watchers, comments)?
   YES → Tier 1 (auto-execute, notify after, undo available)
   NO  → Tier 2 (default safe choice)
```

**Example: Why Jira _create_ is Tier 2 but Jira _link_ is Tier 1:**
- `jira_create_issue` → appears in team backlog, sprint boards, Slack notifications → **Tier 2** (AI pre-fills the card, user clicks `[Create]` / `[Edit First]` / `[Dismiss]`)
- `jira_link_issues` → internal metadata, no notifications triggered, easily reversible → **Tier 1** (AI links automatically, shows housekeeping card with `[Undo]`)

### Reference UX (Target Design)

The target interaction is a **stacked card flow** where three tiers work together:

```
┌─ CARD 1: Root Cause Identified ──────────────────────┐
│ (read-only output — no approval needed)               │
│                                                       │
│ 🔍 Root Cause: EU API latency spike causing           │
│    tax_calculation timeout. Config uses 2s timeout,   │
│    EU p99 is 3.2s.                                    │
└───────────────────────────────────────────────────────┘

┌─ CARD 2: Fix Proposed — PR #402 ─────────────────────┐
│ (Tier 2 — AI prepared the fix, user approves)         │
│                                                       │
│  config/tax.js                                        │
│  ┌──────────────────────────────────────────────┐     │
│  │ - timeout: 2000,                             │     │
│  │ + timeout: 5000, // Fix for EU latency       │     │
│  └──────────────────────────────────────────────┘     │
│                                                       │
│           [Review Diff]    [Merge PR ✓]               │
└───────────────────────────────────────────────────────┘

┌─ CARD 3: Jira Housekeeping ──────────────────────────┐
│ (Tier 1 — AI acted autonomously, user can undo)       │
│                                                       │
│ 🔗 Linked PROJ-1248 ↔ PROJ-1189                      │
│    (same root cause: EU timeout)                      │
│ 🏷️ Added label "investigated-by-ai"                  │
│                                                       │
│                                      [Undo All]       │
└───────────────────────────────────────────────────────┘
```

**Key UX principle**: Information flows top-down (RCA → Fix → Housekeeping). Each card is self-contained. The user can act on Card 2 without waiting for Card 3, and Card 3 already happened by the time they see it.

### Tier 1: Full Autonomy (AI acts, notifies after)
Actions where the blast radius is zero and the outcome is reversible.

| Action | Why Safe | Notification |
|--------|----------|-------------|
| Retry failed test (env-down root cause) | Reversible, no data mutation, user intended to run it | Toast: "Retried `checkout-flow.spec.ts` — env was unreachable" |
| Re-run GitHub Actions workflow (flaky) | Reversible, no code change | Toast: "Re-ran CI for PR #247 — previous failure was transient" |
| Add internal comment on Jira issue (status update) | Low-risk metadata, AI is documenting what it found | Chat message: "Added investigation notes to PROJ-1234" |

### Tier 2: AI-in-the-Loop (AI proposes with pre-built card, user one-clicks)
Actions where the AI has enough context to **prepare the action** and present it ready-to-go. The user saves time because the card is pre-filled — they just approve.

| Scenario | What AI Does | Card UX |
|----------|-------------|---------|
| RCA complete, no Jira ticket found | Searches Jira, finds nothing, **pre-fills a create-issue card** with title from failure, description from RCA, suggested labels | `[Create Issue]` `[Edit First]` |
| Fix proposed, branch + PR ready | Creates branch, commits fix, **shows PR card with inline diff** | `[Approve PR]` `[Review Diff]` |
| Related Jira tickets found during investigation | Links them automatically in the background, **shows housekeeping card** | `[Undo]` (if user disagrees with linkage) |
| Test failure pattern matches known flaky test | Shows prediction card with retry suggestion and **play button** | `[Retry Now]` `[Skip]` |
| Pipeline failure matches previous RCA in KB | Shows KB match card with resolution steps | `[Apply Fix]` `[View Details]` |

### Tier 3: Human-in-the-Loop (current model, unchanged)
Actions where the risk is high, irreversible, or affects shared state.

| Action | Why Gated | Stays As-Is |
|--------|-----------|-------------|
| Transition Jira issue status | Affects team workflow, may trigger automations | Confirmation card with 5-min TTL |
| Create PR to `main` | Code change visible to entire team | Confirmation card |
| Trigger Jenkins production build | Could deploy | Confirmation card |
| Delete or cancel running test suite | Destructive | Confirmation card |

---

## Feature 1: Proactive Action Cards ("AI-in-the-Loop")

### Concept
Instead of waiting for the user to ask, the AI **anticipates the next step** and presents a ready-to-go action card. The card includes all the data the user needs to decide — no back-and-forth.

### New SSE Event: `proactive_suggestion`
```typescript
{
  type: 'proactive_suggestion',
  data: {
    suggestionId: string,
    tool: string,           // e.g., 'jira_create_issue'
    confidence: number,     // 0.0–1.0 — how confident the AI is this is the right action
    reason: string,         // "No existing Jira issue found for this failure pattern"
    preparedAction: object, // Pre-filled tool parameters
    tier: 1 | 2,           // Autonomy tier
  }
}
```

### Frontend Card Pattern
```
┌─────────────────────────────────────────┐
│ 💡 Suggestion: Create Jira Issue        │
│                                         │
│ No existing ticket found for this       │
│ failure. Here's a draft:                │
│                                         │
│ ┌─ JIRA ─────────────────────────────┐  │
│ │ 🐛 Bug: checkout-flow.spec.ts     │  │
│ │    assertion timeout in CI          │  │
│ │                                     │  │
│ │ Labels: flaky, ci-env, P2          │  │
│ │ Assignee: (from git blame)         │  │
│ │                                     │  │
│ │ ▸ Description (click to expand)    │  │
│ └─────────────────────────────────────┘  │
│                                         │
│         [Create Issue]  [Edit First]    │
└─────────────────────────────────────────┘
```

### Decision Logic (in ReAct loop)
After tool execution, before generating the answer, the AI evaluates:
1. **Did I search for something and find nothing?** → Suggest creating it
2. **Did I identify a root cause with a known fix?** → Suggest applying it
3. **Did I find a test failed due to env/infra?** → Suggest retry
4. **Did I find related but unlinked issues?** → Suggest linking them

This logic lives in a new `ProactiveSuggestionEngine` service that runs post-tool-result, pre-answer.

---

## Feature 2: Inline Code Diff in PR Cards

### Problem
Current `GitHubPRPreview` shows: title, branches, repo, description. The user must leave the chat to review the actual code changes. This breaks flow.

### Solution
New `GitHubPRCard` with embedded diff viewer:

```
┌─────────────────────────────────────────────┐
│ GITHUB  Pull Request                        │
│                                             │
│ fix: resolve checkout timeout in CI (#312)  │
│ fix/checkout-timeout ← main                 │
│                                             │
│ ┌─ src/services/checkout.service.ts ──────┐ │
│ │  @@ -45,7 +45,7 @@                     │ │
│ │ - const timeout = 5000;                 │ │
│ │ + const timeout = getEnvTimeout(15000); │ │
│ │                                         │ │
│ │  @@ -112,3 +112,8 @@                   │ │
│ │ + function getEnvTimeout(fallback) {    │ │
│ │ +   return parseInt(                    │ │
│ │ +     process.env.CI_TIMEOUT ?? ''      │ │
│ │ +   ) || fallback;                      │ │
│ │ + }                                     │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│  +8 -1 across 1 file                       │
│                                             │
│       [Approve & Merge]   [Review Diff]     │
└─────────────────────────────────────────────┘
```

### Key UX Details
- **Diff is syntax-highlighted** — green for additions, red for removals (respects dark mode palette)
- **Collapsed by default** if diff > 20 lines — expandable
- **Two buttons**: `[Approve & Merge]` triggers the merge directly (Tier 2 — one click). `[Review Diff]` opens GitHub PR in new tab for full review
- **File count badge** — "+8 -1 across 1 file" summary line
- Uses `github_get_pr` tool's existing `files` data (already returns diff hunks)

### Backend Change
Extend `github_get_pr` tool response to include `patch` content (GitHub API already provides this via `Accept: application/vnd.github.v3.diff`).

---

## Feature 3: Giphy Integration — Personality Layer

### Concept
The AI copilot communicates status with contextual, work-appropriate GIFs. This adds personality and reduces the cognitive load of reading status text — a GIF of celebration vs. a wall of text saying "all tests passed" is instantly recognizable.

### New Integration: `GiphyService`
```typescript
// backend/src/services/giphy.service.ts
class GiphyService {
  async searchGif(context: GifContext): Promise<GiphyResult> {
    // Calls Giphy API with curated search terms
    // Returns URL + alt text
  }
}

type GifContext =
  | { event: 'pipeline_broken', severity: 'high' | 'critical' }
  | { event: 'all_tests_passed' }
  | { event: 'fix_merged' }
  | { event: 'flaky_test_detected' }
  | { event: 'env_down' }
  | { event: 'investigation_complete' }
  | { event: 'first_time_user' }
  | { event: 'long_running_task' };
```

### Content Policy (Non-Negotiable)
| Rule | Enforcement |
|------|-------------|
| Work-appropriate only | Giphy content rating filter: `rating=g` (all audiences) |
| No repeat GIFs | Track last 20 GIF IDs per user session, re-roll if duplicate |
| Positive tone bias | Search terms curated per event (never angry, violent, or offensive) |
| User can disable | `GIPHY_ENABLED=false` env var + per-user setting in preferences |
| Fallback to emoji | If Giphy API is down or disabled, use a text emoji instead |

### Search Term Curation (Examples)
| Event | Search Terms (rotated) |
|-------|----------------------|
| `pipeline_broken` | "this is fine fire", "everything is fine", "debug mode", "houston we have a problem" |
| `all_tests_passed` | "celebration", "success dance", "high five", "nailed it", "thumbs up" |
| `fix_merged` | "ship it", "mission accomplished", "mic drop", "smooth sailing" |
| `flaky_test_detected` | "suspicious", "hmm interesting", "detective", "something fishy" |
| `env_down` | "waiting patiently", "any day now", "loading", "coffee break" |
| `investigation_complete` | "case closed", "mystery solved", "sherlock", "found it" |

### Frontend Rendering
```
┌──────────────────────────────────────┐
│ ✅ All 247 tests passed!             │
│                                      │
│ ┌──────────────────────────────────┐ │
│ │  [celebration GIF - 200x150]     │ │
│ │  via Giphy                       │ │
│ └──────────────────────────────────┘ │
│                                      │
│ Pipeline: checkout-service (main)    │
│ Duration: 4m 32s                     │
└──────────────────────────────────────┘
```

- GIF renders inline in the chat message, max 200px wide
- "via Giphy" attribution required by Giphy API TOS
- Click to dismiss / collapse
- Never blocks the information — GIF is supplementary, status text always visible

### Environment
```env
GIPHY_API_KEY=your-api-key
GIPHY_ENABLED=true
GIPHY_RATING=g
```

---

## Feature 4: Autonomous Jira Housekeeping

### Concept
During investigation, the AI naturally discovers relationships between issues. Instead of reporting "I found related issues" and waiting, it **links them automatically** (Tier 1 — reversible metadata) and shows a summary card.

### Actions (All Tier 1 — Auto-Execute)
| Action | Trigger | Reversible? |
|--------|---------|-------------|
| Link related Jira issues | AI finds issues with same root cause | Yes (remove link) |
| Add "investigated-by-ai" label | AI completes RCA on an issue | Yes (remove label) |
| Update issue description with RCA findings | AI has high-confidence RCA | Yes (revert edit) |
| Add watcher (requesting user) | User investigates issue they don't watch | Yes (remove watcher) |

### Housekeeping Card
```
┌─────────────────────────────────────────┐
│ 🔗 Jira Housekeeping (3 actions taken)  │
│                                         │
│ • Linked PROJ-1234 ↔ PROJ-1189         │
│   (same root cause: Redis timeout)      │
│                                         │
│ • Added label "investigated-by-ai"      │
│   to PROJ-1234                          │
│                                         │
│ • Added you as watcher on PROJ-1189     │
│                                         │
│                        [Undo All]       │
└─────────────────────────────────────────┘
```

---

## Feature 5: Smart Retry with Play Button

### Concept
When a test failure's root cause is environmental (env down, network timeout, resource exhaustion), show a retry card with a prominent play button. If AI confidence is > 0.9 that the failure is transient, auto-retry (Tier 1).

### Card UX
```
┌──────────────────────────────────────────────┐
│ 🔄 Transient Failure Detected                │
│                                              │
│ checkout-flow.spec.ts                        │
│ Root cause: CI environment unreachable       │
│ Confidence: 94%                              │
│ Previous runs: ✅ ✅ ✅ ❌ (this one)         │
│                                              │
│          [ ▶ Retry Now ]   [ Skip ]          │
│                                              │
│ ℹ️ 3 other tests in this suite also failed   │
│   for the same reason.                       │
│          [ ▶ Retry All 4 ]                   │
└──────────────────────────────────────────────┘
```

### Auto-Retry Logic (Tier 1)
```
IF failure_cause IN ['env_unreachable', 'network_timeout', 'resource_exhaustion']
AND confidence > 0.9
AND retry_count < 2 (prevent infinite loops)
AND test_was_passing_in_last_3_runs
THEN → auto-retry + notify user
ELSE → show card with play button (Tier 2)
```

---

## Tool-by-Tool Autonomy Classification

### Current 18 Tools — Reclassified

| Tool | Current | Proposed | Rationale |
|------|---------|----------|-----------|
| `jira_search` | Read (auto) | Read (auto) | No change |
| `jira_get` | Read (auto) | Read (auto) | No change |
| `jira_create_issue` | Write (confirm) | **Tier 2 (AI proposes)** | AI pre-fills from RCA context, user one-clicks |
| `jira_transition_issue` | Write (confirm) | Write (confirm) | Affects workflow, keep gated |
| `jira_comment` | Write (confirm) | **Tier 1 (auto) for investigation notes; Tier 2 for user-facing comments** | Internal AI notes are low-risk; comments visible to team need approval |
| `github_get_commit` | Read (auto) | Read (auto) | No change |
| `github_get_pr` | Read (auto) | Read (auto) | No change — but add diff data to response |
| `github_create_pr` | Write (confirm) | **Tier 2 (AI proposes with inline diff)** | Show diff + Approve/Review buttons |
| `github_create_branch` | Write (confirm) | **Tier 1 (auto)** | Branches are cheap and reversible |
| `github_update_file` | Write (confirm) | Write (confirm) | Direct code mutation, keep gated |
| `github_rerun_workflow` | Write (confirm) | **Tier 1 (auto) if transient failure; Tier 2 otherwise** | Re-running CI is safe and reversible |
| `confluence_search` | Read (auto) | Read (auto) | No change |
| `jenkins_get_status` | Read (auto) | Read (auto) | No change |
| `jenkins_trigger_build` | Write (confirm) | **Tier 2 if non-prod; Tier 3 (confirm) if prod** | Environment-aware gating |
| `dashboard_metrics` | Read (auto) | Read (auto) | No change |
| `failure_predictions` | Read (auto) | Read (auto) | No change |
| `testrun_cancel` | Write (confirm) | Write (confirm) | Destructive, keep gated |
| `testrun_retry` | Write (confirm) | **Tier 1 (auto) if env-caused; Tier 2 otherwise** | Transient retries are safe |

### New Tools Needed

| Tool | Tier | Purpose |
|------|------|---------|
| `jira_link_issues` | Tier 1 | Link related issues discovered during investigation |
| `jira_add_label` | Tier 1 | Tag issues with investigation metadata |
| `github_merge_pr` | Tier 2 | Merge an approved PR from within the chat |
| `giphy_search` | Read (auto) | Fetch contextual GIF for status messages |

---

## Architecture Changes Required

### 1. ProactiveSuggestionEngine (new service)
- Runs after each tool result in the ReAct loop
- Evaluates post-conditions: "search returned empty → suggest create"
- Emits `proactive_suggestion` SSE events
- Respects user preferences (autonomy level setting)

### 2. AutonomyClassifier (new service)
- Maps tool + context → autonomy tier
- Inputs: tool name, parameters, environment (prod/staging/dev), confidence score
- Output: `{ tier: 1 | 2 | 3, reason: string }`

### 3. GiphyService (new integration)
- Giphy API client with caching (same search → same GIF for 1 hour)
- Deduplication ring buffer (last 20 per session)
- Content rating enforcement
- Graceful fallback

### 4. Enhanced Card Components (frontend)
- `InlineDiffViewer` — syntax-highlighted unified diff
- `ProactiveSuggestionCard` — wraps any action card with "AI suggests" header + reason
- `GiphyEmbed` — inline GIF with attribution and dismiss
- `RetryCard` — play button, confidence meter, batch retry option
- `HousekeepingCard` — multi-action summary with undo

### 5. User Preferences (new settings)
| Setting | Options | Default |
|---------|---------|---------|
| Autonomy level | Conservative / Balanced / Autonomous | Balanced |
| Giphy in chat | On / Off | On |
| Auto-retry transient failures | On / Off | On |
| Jira auto-housekeeping | On / Off | On |

**Conservative**: All writes require confirmation (current behavior)
**Balanced**: Tier 1 auto-executes, Tier 2 shows cards (recommended)
**Autonomous**: Tier 1+2 auto-execute, only Tier 3 requires confirmation (power users)

---

## Success Metrics

| Metric | Current | Target | How Measured |
|--------|---------|--------|-------------|
| Avg. clicks to resolve failure | ~8 | ~3 | Track click events per resolution |
| Time from RCA to Jira ticket | ~2 min (manual) | ~5 sec (AI pre-fills) | Timestamp delta |
| Test retry success rate (transient) | N/A | >80% | Auto-retry outcomes |
| User engagement (Giphy) | N/A | >60% keep it enabled after 1 week | Settings toggle tracking |
| Proactive suggestion acceptance rate | N/A | >50% | Accepted / shown ratio |

---

## Out of Scope (This Phase)

- Slack/Teams bot autonomy (Tier 1 in chat only, not cross-channel)
- Auto-merging PRs without any user interaction (always Tier 2 minimum)
- Giphy in Slack notifications (separate feature, separate approval)
- Custom autonomy rules per team/project (v3.1)
- ML-based confidence scoring for autonomy decisions (v3.1 — start with heuristics)

---

## Acceptance Criteria

### AC-1: Proactive Suggestion Engine
```
GIVEN the AI searched Jira for a failure pattern and found no matching issues
WHEN the search result returns empty
THEN the AI emits a proactive_suggestion event with a pre-filled jira_create_issue card
AND the card shows title, description from RCA, suggested labels
AND the user can approve with one click or edit before creating
```

### AC-2: Inline Diff in PR Card
```
GIVEN the AI created a PR or the user asks about a PR
WHEN the PR card renders in the chat
THEN the card shows a syntax-highlighted unified diff of changed files
AND displays file count, line additions/removals summary
AND offers [Approve & Merge] and [Review Diff] buttons
```

### AC-3: Giphy Integration
```
GIVEN a significant event occurs (tests pass, pipeline breaks, fix merged)
WHEN the AI generates a status message
THEN a contextual, work-appropriate GIF is embedded inline
AND the GIF is never repeated within the same session (last 20 tracked)
AND content rating is enforced (G-rated only)
AND users can disable GIFs in settings
```

### AC-4: Autonomous Retry
```
GIVEN a test failed with root cause classified as environment/transient
AND AI confidence > 0.9
AND the test passed in at least 2 of the last 3 runs
WHEN the failure is analyzed
THEN the test is automatically retried (Tier 1)
AND the user is notified with a toast message
AND if retry also fails, escalate to Tier 2 card (no infinite loops)
```

### AC-5: Jira Housekeeping
```
GIVEN the AI discovers related Jira issues during investigation
WHEN the issues share a root cause (same error signature or linked failure)
THEN the AI links them automatically and shows a housekeeping summary card
AND the user can undo all actions with one click
```

### AC-6: User Autonomy Preferences
```
GIVEN the user navigates to Settings > AI Preferences
WHEN they select an autonomy level (Conservative / Balanced / Autonomous)
THEN all future AI actions respect that tier classification
AND the setting persists across sessions
```

---

## Implementation Priority (Sprint Sequence)

| Sprint | Feature | Complexity | User Impact |
|--------|---------|-----------|-------------|
| Sprint 6 | Proactive Suggestion Engine + Tier 1/2 framework | High | High — core paradigm shift |
| Sprint 6 | Inline diff in PR cards | Medium | High — most requested UX gap |
| Sprint 7 | Giphy integration | Low | Medium — personality/delight |
| Sprint 7 | Smart retry with play button | Medium | High — saves real time |
| Sprint 8 | Jira housekeeping (auto-link, auto-label) | Medium | Medium — reduces manual work |
| Sprint 8 | User autonomy preferences | Low | Medium — user control |
| Sprint 8 | 4 new tools (link, label, merge, giphy) | Medium | Enables above features |

---

*This spec should be reviewed by AI_ARCHITECT (trust/autonomy model), SECURITY_ENGINEER (auto-execute risk), and UX_DESIGNER (card patterns) before implementation begins.*
