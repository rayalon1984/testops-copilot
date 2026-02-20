# DESIGN_LANG_V2.md — UI Design Language

> **Owner**: UX Designer · **Status**: Living document · **Version**: 2.9.0-rc.6 · **Last verified**: 2026-02-20

---

## 1. Design Principles

| Principle | Meaning |
|-----------|---------|
| **Clarity over cleverness** | Every element must have an obvious purpose. No decorative UI. |
| **Reduce cognitive load** | Show only what's needed for the current task. Progressive disclosure. |
| **Trust through transparency** | AI actions always explain reasoning. Costs always visible. Confirmations never skipped. |
| **Keyboard-first, mouse-friendly** | Power users navigate by keyboard. Casual users click. |
| **Consistent density** | Information-dense dashboards, breathing room in forms. |

---

## 2. Technology Stack

| Layer | Technology |
|-------|-----------|
| Component library | Material UI (MUI) v5 |
| Utility CSS | Tailwind CSS |
| Icons | MUI Icons |
| Charts | Recharts / MUI charts |
| Routing | React Router v6 |
| Responsive | Mobile-first, min 375px viewport |

---

## 3. Layout System

### 3.1 Standard Layout

```
┌──────────────────────────────────────────────────┐
│  Top Bar (64px) — Logo, nav, user menu, theme    │
├─────────┬────────────────────────────────────────┤
│ Sidebar │         Main Content Area              │
│ (240px) │                                        │
│ Nav     │  ┌──────────────────────────────────┐  │
│ links   │  │  Page Header                     │  │
│         │  ├──────────────────────────────────┤  │
│         │  │  Content                         │  │
│         │  │                                  │  │
│         │  └──────────────────────────────────┘  │
└─────────┴────────────────────────────────────────┘
```

### 3.2 Agentic Layout (Mission Control)

```
┌──────────────────────────────────────────────────┐
│  Top Bar (64px)                                  │
├─────────┬───────────────────┬────────────────────┤
│ Sidebar │   Main Content    │   AI Panel (360px) │
│ (240px) │   (flex)          │   Chat + Tools     │
│         │                   │   Confirmations    │
│         │                   │   Cost tracker     │
└─────────┴───────────────────┴────────────────────┘
```

### 3.3 Breakpoints

| Name | Width | Layout |
|------|-------|--------|
| Mobile | < 768px | Stack: top bar → content (sidebar collapsed) |
| Tablet | 768–1024px | Sidebar overlay, AI panel hidden |
| Desktop | 1024–1440px | Standard 2-column |
| Wide | > 1440px | 3-column with AI panel |

---

## 4. Color System

### 4.1 Semantic Colors

| Token | Light Mode | Dark Mode | Usage |
|-------|-----------|-----------|-------|
| `--color-success` | `#2e7d32` | `#66bb6a` | Pass, success, healthy |
| `--color-error` | `#d32f2f` | `#f44336` | Fail, error, critical |
| `--color-warning` | `#ed6c02` | `#ffa726` | Flaky, warning, degraded |
| `--color-info` | `#0288d1` | `#29b6f6` | Info, links, interactive |
| `--color-bg-primary` | `#ffffff` | `#121212` | Page background |
| `--color-bg-surface` | `#f5f5f5` | `#1e1e1e` | Card/panel background |
| `--color-text-primary` | `#212121` | `#e0e0e0` | Primary text |
| `--color-text-secondary` | `#757575` | `#9e9e9e` | Secondary text |

### 4.2 Test Status Colors

| Status | Color | Badge |
|--------|-------|-------|
| PASSED | Green (`success`) | Filled green chip |
| FAILED | Red (`error`) | Filled red chip |
| FLAKY | Orange (`warning`) | Filled orange chip |
| RUNNING | Blue (`info`) | Pulsing blue chip |
| PENDING | Grey | Outlined grey chip |
| SKIPPED | Grey (lighter) | Outlined grey chip, italic |

### 4.3 AI Confidence Indicator

| Range | Color | Label |
|-------|-------|-------|
| 0.0–0.3 | Red | Low confidence |
| 0.3–0.6 | Orange | Medium confidence |
| 0.6–0.8 | Blue | Good confidence |
| 0.8–1.0 | Green | High confidence |

---

## 5. Typography

| Element | Font | Size | Weight |
|---------|------|------|--------|
| H1 (page title) | System / Roboto | 24px | 600 |
| H2 (section) | System / Roboto | 20px | 600 |
| H3 (card title) | System / Roboto | 16px | 600 |
| Body | System / Roboto | 14px | 400 |
| Caption | System / Roboto | 12px | 400 |
| Code / logs | `monospace` | 13px | 400 |
| AI chat | System / Roboto | 14px | 400 |

---

## 6. Component Patterns

### 6.1 Status Badge

Used everywhere to represent pipeline/test/run status. MUI Chip with semantic color fill.

```
[● PASSED]  [● FAILED]  [● FLAKY]  [◌ PENDING]  [↻ RUNNING]
```

### 6.2 Data Table

- MUI DataGrid for sortable, filterable tables
- Row click → detail view
- Status column always first visual anchor
- Timestamps in relative format ("2 hours ago") with absolute on hover

### 6.3 Metric Card

```
┌─────────────────┐
│ Total Tests      │
│     1,247        │  ← Large number
│  ▲ 12% vs last  │  ← Trend indicator
└─────────────────┘
```

### 6.4 AI Chat Panel

```
┌─────────────────────────┐
│ 🤖 Thinking...          │  ← Animated dots
├─────────────────────────┤
│ 🔧 Searching Jira...    │  ← Tool indicator
├─────────────────────────┤
│ ⚠️ Confirm: Create      │  ← Confirmation card
│    JIRA issue BUG-123?  │
│    [Approve] [Deny]     │
├─────────────────────────┤
│ Based on my analysis... │  ← Final answer (Markdown)
└─────────────────────────┘
│ Type a message...    [→]│  ← Input
└─────────────────────────┘
```

### 6.5 Confirmation Card

- Yellow/amber border (warning semantic)
- Tool name + parameter summary
- Approve (green) + Deny (red) buttons
- Countdown timer showing TTL remaining (5 min)
- Expired state: greyed out, non-interactive

### 6.6 Cost Tracker Widget

```
┌─────────────────────────┐
│ AI Costs: $42.50 / $100 │
│ ████████████░░░░░░  42% │
│ Cache hit rate: 63%     │
└─────────────────────────┘
```

Progress bar changes color: green (<60%), orange (60–80%), red (>80%).

---

## 7. Animation & Motion

| Interaction | Animation | Duration |
|-------------|-----------|----------|
| Page transition | None (instant) | 0ms |
| Panel open/close | Slide | 200ms ease-out |
| Loading spinner | Rotate | Infinite |
| AI thinking dots | Pulse | 1.5s loop |
| Status badge update | Color fade | 300ms |
| Toast notification | Slide in from top | 300ms |
| Toast dismiss | Fade out | 200ms |

**Rule**: No animation > 300ms. No animation that blocks interaction.

---

## 8. Accessibility (WCAG 2.1 AA)

- Color contrast: minimum 4.5:1 for text, 3:1 for large text
- All interactive elements keyboard-focusable
- `aria-label` on icon-only buttons
- Screen reader announcements for status changes
- Focus trap in modals
- Skip-to-content link
- Reduced motion: respect `prefers-reduced-motion`

---

## 9. Dark Mode

- Toggle in top bar (user preference, persisted)
- Uses MUI theme provider for automatic component theming
- Custom CSS variables swap for semantic colors
- Charts and graphs adapt colors automatically
- No white flash on page load (theme loaded from localStorage)

---

## 10. Error & Empty States

| State | Display |
|-------|---------|
| Loading | Skeleton placeholders (MUI Skeleton) |
| Empty list | Illustration + "No [items] yet" + action button |
| API error | Red alert banner with retry button |
| 404 | Centered message + "Go to Dashboard" link |
| AI unavailable | Grey AI panel with "AI services offline" message |
| Offline | Yellow banner: "Connection lost. Retrying..." |

---

*Canonical source. Update when UI patterns change — not after.*
