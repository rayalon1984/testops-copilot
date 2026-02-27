#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# push-all-releases.sh
# Pushes all version tags and creates/updates GitHub Releases with rich notes.
# Requires: gh CLI (brew install gh) and git
# Usage: bash scripts/push-all-releases.sh
#   also works piped: git show origin/branch:scripts/push-all-releases.sh | bash
# ============================================================================

# When piped (stdin is not a terminal), heredocs can't read from stdin.
# Re-execute from a temp file so heredocs work correctly.
if [ ! -t 0 ]; then
  _tmp=$(mktemp)
  cat > "$_tmp"
  bash "$_tmp"
  _rc=$?
  rm -f "$_tmp"
  exit $_rc
fi

REPO="rayalon1984/testops-copilot"

echo "==> Pushing all tags to origin..."
git push origin --tags
echo ""
echo "==> All tags pushed. Waiting 15s for release workflow to start..."
sleep 15

# --------------------------------------------------------------------------
# Helper: create or edit a release
# Uses a temp file for notes to avoid bash 3.2 heredoc-in-$() parsing bugs.
# --------------------------------------------------------------------------
_notes_file=$(mktemp)
trap 'rm -f "$_notes_file"' EXIT

upsert_release() {
  local tag="$1"
  local title="$2"
  local prerelease="$3"
  # Notes are pre-written to $_notes_file before each call

  echo ""
  echo "--- ${tag}: ${title}"

  if gh release view "$tag" --repo "$REPO" &>/dev/null; then
    gh release edit "$tag" \
      --repo "$REPO" \
      --title "$title" \
      --notes-file "$_notes_file"
    echo "    ✓ Updated existing release"
  else
    local flags=""
    if [ "$prerelease" = "true" ]; then
      flags="--prerelease"
    fi
    gh release create "$tag" \
      --repo "$REPO" \
      --title "$title" \
      --notes-file "$_notes_file" \
      $flags
    echo "    ✓ Created new release"
  fi
}

# ==========================================================================
# v2.8.5 — Enterprise Readiness
# ==========================================================================
cat > "$_notes_file" <<'NOTES'
## Enterprise Readiness

Production-grade security, compliance, and scalability foundations.

### Highlights

- **SAML 2.0 SSO** — Okta, Azure AD, Keycloak with JIT provisioning
- **Role-Based Access Control** — Viewer, Editor, Admin, Billing
- **SOC 2 / ISO 27001** compliant audit logging
- **Redis Cluster** support for high availability
- **Stateless backend** ready for Kubernetes autoscaling
- **OpenTelemetry** distributed tracing and metrics
- **Alpine Docker images** (~80% smaller)
- **CI/CD pipeline** with automated quality gates
NOTES
upsert_release "v2.8.5" \
  "TestOps Copilot v2.8.5 — Enterprise Readiness" \
  "false"

# ==========================================================================
# v2.9.0-rc.1 — Agentic AI Copilot
# ==========================================================================
cat > "$_notes_file" <<'NOTES'
## Agentic AI Copilot

Full agentic backend + 3-column Mission Control UI + production hardening.

### Highlights

- **ReAct reasoning loop** with streaming SSE
- **13 AI tools** — 7 read (auto-approved), 6 write (with confirmation)
- **Human-in-the-loop** confirmation with 5-minute TTL
- **Role-aware system prompts** — Admin, Engineer, Viewer
- **Chat session persistence** across sessions
- **3-column Mission Control** layout
- **Flaky test detection** and smart test selection
- **Token blacklist** migrated to Redis
- **SSRF validation** on all external service constructors
- **AIConfigManager** — consolidated AI config
NOTES
upsert_release "v2.9.0-rc.1" \
  "TestOps Copilot v2.9.0-rc.1 — Agentic AI Copilot" \
  "true"

# ==========================================================================
# v2.9.0-rc.2 — Virtual Team Persona Routing
# ==========================================================================
cat > "$_notes_file" <<'NOTES'
## Virtual Team Persona Routing

AI queries routed to specialist personas for domain-expert responses.

### Highlights

- **PersonaRouter** — 2-tier classification (keyword rules + LLM fallback)
- **9 specialist personas** — Security, AI, Data, UX, Perf, Test, DevOps, PM, Senior
- **persona_selected SSE event** with frontend badge display
- **dotenv fallback chain** — no more crash on missing `.env`
- **Schema parity CI guardrail** preventing model drift
- **Comprehensive documentation overhaul** — README, DEMO, HOW_IT_WORKS
NOTES
upsert_release "v2.9.0-rc.2" \
  "TestOps Copilot v2.9.0-rc.2 — Virtual Team Persona Routing" \
  "true"

# ==========================================================================
# v2.9.0-rc.3 — Sprint 5 Stabilization
# ==========================================================================
cat > "$_notes_file" <<'NOTES'
## Sprint 5 Stabilization

Type safety, schema integrity, security audit, CI hardening.

### Highlights

- **passport-saml** v3 → @node-saml/passport-saml v5 (critical vuln fix)
- **bcrypt** 5 → 6 (native crypto, eliminates tar dependency)
- **40 vulnerabilities → 8** moderate (all in ESLint devDeps)
- **40 fields reconciled** across 7 models (zero schema drift)
- **`--strict-fields` CI gate** for field-level drift prevention
- **Bedrock provider import fix** unblocking `tsc --noEmit`
NOTES
upsert_release "v2.9.0-rc.3" \
  "TestOps Copilot v2.9.0-rc.3 — Sprint 5 Stabilization" \
  "true"

# ==========================================================================
# v2.9.0-rc.4 — Graduated Autonomy + Backend Stability
# ==========================================================================
cat > "$_notes_file" <<'NOTES'
## Graduated Autonomy + Backend Stability

Three-tier autonomy model and backend stability refactor.

### Highlights

- **AutonomyClassifier** — 3-tier tool classification engine
- **ProactiveSuggestionEngine** — 5 post-tool-result suggestion rules
- **ReAct loop** upgraded from binary to graduated autonomy
- **InlineDiffViewer** — GitHub-style syntax-highlighted diffs
- **ProactiveSuggestionCard** — AI suggestion cards with one-click approve
- **Settings > AI Copilot tab** for autonomy preference
- **4 fat controllers** extracted to thin adapters + services
- **AI route split** from 778-line monolith to 3 focused modules
NOTES
upsert_release "v2.9.0-rc.4" \
  "TestOps Copilot v2.9.0-rc.4 — Graduated Autonomy + Backend Stability" \
  "true"

# ==========================================================================
# v2.9.0-rc.5 — Autonomy Tests + New Tools + Proactive UX
# ==========================================================================
cat > "$_notes_file" <<'NOTES'
## Autonomy Tests + New Tools + Proactive UX

95 new tests for graduated autonomy. 4 new AI tools (22 total).

### Highlights

- **47 AutonomyClassifier tests** — all 22 tools, all overrides
- **29 ProactiveSuggestionEngine tests** — all 5 rules
- **19 integration tests** — end-to-end autonomy flows
- **giphy_search** — contextual GIFs with G-rating and dedup
- **jira_link_issues + jira_add_label** — autonomous housekeeping (Tier 1)
- **github_merge_pr** — merge PRs from chat (Tier 2)
- **GiphyEmbedCard, RetryCard, HousekeepingCard** frontend components
NOTES
upsert_release "v2.9.0-rc.5" \
  "TestOps Copilot v2.9.0-rc.5 — Autonomy Tests + New Tools + Proactive UX" \
  "true"

# ==========================================================================
# v2.9.0-rc.6 — Global AI Context + High-Fidelity Seeding
# ==========================================================================
cat > "$_notes_file" <<'NOTES'
## Global AI Context + High-Fidelity Seeding

Page-aware AI assistance and production-realistic seed data.

### Highlights

- **AIContext** — global React Context for page-level awareness
- **usePageContext hook** on 7 pages
- **Context injection** into every AI message
- **seed.dev.ts** — TypeScript seeder covering all 20 Prisma models
- **200 test runs, 1,600 failure archives, 20K+ AI usage records**
- **CLAUDE.md** simplified to 6-line pointer to AGENTS.md
NOTES
upsert_release "v2.9.0-rc.6" \
  "TestOps Copilot v2.9.0-rc.6 — Global AI Context + High-Fidelity Seeding" \
  "true"

# ==========================================================================
# v2.9.0-rc.7 — Resilience Layer + Documentation
# ==========================================================================
cat > "$_notes_file" <<'NOTES'
## Resilience Layer + Documentation

Circuit breakers, retries, and timeouts for all external services.

### Highlights

- **CircuitBreaker state machine** — CLOSED → OPEN → HALF_OPEN per service
- **withRetry(), withTimeout(), withResilience()** composed wrappers
- **Pre-configured breakers** — GitHub, Jira, Jenkins, Confluence
- **/health/full endpoint** with circuit breaker state reporting
- **30 unit tests** for resilience layer
- **Architecture docs** updated with resilience diagrams
- **All spec docs** verified at v3.0.0
NOTES
upsert_release "v2.9.0-rc.7" \
  "TestOps Copilot v2.9.0-rc.7 — Resilience Layer + Documentation" \
  "true"

# ==========================================================================
# v3.0.0-beta.1 — THE MAIN RELEASE (marketing copy)
# ==========================================================================
cat > "$_notes_file" <<'NOTES'
# TestOps Copilot v3.0.0-beta.1

### Your QA team just got an AI copilot that actually understands testing.

TestOps Copilot v3.0.0 is the culmination of 8 release candidates and thousands of engineering hours. It transforms your testing dashboard from a passive reporting tool into an **intelligent, agentic platform** that reasons about your test data, takes action on your behalf, and learns from every interaction.

---

## What Makes This Different

Most "AI-powered" dev tools bolt a chatbot onto a sidebar. **TestOps Copilot embeds AI directly into your testing workflow** — it reads your Jira tickets, analyzes your test failures, checks your GitHub PRs, and takes action with your permission.

### A Virtual Team of 9 Specialists
Every query is automatically routed to the right expert persona — Security Analyst, Performance Engineer, DevOps Specialist, Test Architect, and more. Ask about flaky tests and get advice from a testing expert. Ask about deployment risks and hear from DevOps.

### Graduated Autonomy — You Set the Boundaries
Not all actions are created equal. TestOps Copilot classifies every AI tool into three tiers:
| Tier | Behavior | Example |
|------|----------|---------|
| **Auto** | Executes instantly | Fetching test results, searching Jira |
| **AI Proposes** | AI suggests, you approve with one click | Merging a PR, linking issues |
| **You Decide** | Full manual control | Deployment triggers, config changes |

### Proactive Suggestions
The AI doesn't wait for you to ask. After every action, it anticipates your next step — offering to link related Jira issues, retry a failed build, or investigate a flaky test pattern.

### Page-Aware Context
The AI knows what you're looking at. On the Test Runs page, it prioritizes failure analysis. On the Dashboard, it highlights trends. On Settings, it helps with configuration. Zero prompt engineering required.

### Resilience Built In
Circuit breakers, automatic retries, and timeout management on every external service (GitHub, Jira, Jenkins, Confluence). Your copilot stays responsive even when third-party APIs don't.

---

## By the Numbers

| Metric | Value |
|--------|-------|
| AI Tools | **22** across Jira, GitHub, Jenkins, Confluence |
| Specialist Personas | **9** auto-routed domains |
| Test Coverage | **323/323 passing** (188 backend + 135 frontend) |
| E2E Smoke Tests | **10** Playwright scenarios |
| Lint Errors | **0** |
| TypeScript Errors | **0** |
| Security Vulnerabilities | **0 high/critical** |

---

## The Journey Here

| Release | Milestone |
|---------|-----------|
| v2.8.5 | Enterprise Readiness — SSO, RBAC, audit logging |
| v2.9.0-rc.1 | Agentic AI Copilot — ReAct loop, 13 tools, Mission Control |
| v2.9.0-rc.2 | Virtual Team — 9 specialist personas |
| v2.9.0-rc.3 | Stabilization — security audit, schema integrity |
| v2.9.0-rc.4 | Graduated Autonomy — 3-tier classification |
| v2.9.0-rc.5 | 95 new tests + 4 new tools (22 total) |
| v2.9.0-rc.6 | Page-aware context + production seed data |
| v2.9.0-rc.7 | Resilience layer — circuit breakers everywhere |
| **v3.0.0-beta.1** | **Everything above, unified and release-ready** |

---

## Get Started

```bash
git clone https://github.com/rayalon1984/testops-copilot.git
cd testops-copilot
git checkout v3.0.0-beta.1
npm run setup
```

---

> **This is a beta release.** We're actively collecting feedback before GA.
> Found an issue? [Open a bug report →](https://github.com/rayalon1984/testops-copilot/issues)
NOTES
upsert_release "v3.0.0-beta.1" \
  "TestOps Copilot v3.0.0-beta.1 — AI That Thinks, Acts, and Learns" \
  "true"

# ==========================================================================
# v3.0.1-beta.1 — End-to-End Test Coverage
# ==========================================================================
cat > "$_notes_file" <<'NOTES'
## End-to-End Test Coverage

The full agentic copilot flow is now covered by Playwright smoke tests.

### What's New

- **10 E2E smoke tests** covering login through multi-step AI chains
- **Mock API fixtures** with pre-built SSE streaming scenarios
- **CI-ready** with auto-start, retries, and trace capture on failure
- **Scenarios covered:** ReAct loop, confirmation flow, proactive suggestions, autonomous actions, persona routing, session persistence

> This is a pre-release build. [Report issues →](https://github.com/rayalon1984/testops-copilot/issues)
NOTES
upsert_release "v3.0.1-beta.1" \
  "TestOps Copilot v3.0.1-beta.1 — End-to-End Test Coverage" \
  "true"

# ==========================================================================
# v3.0.2-beta.1 — First-Run Experience & Error Recovery
# ==========================================================================
cat > "$_notes_file" <<'NOTES'
## First-Run Experience & Error Recovery

New users get a guided onboarding flow. Existing users get smarter error handling that recovers automatically.

### What's New

- **Onboarding Wizard** — 3-step guided setup for new users
- **Budget Indicator** — live spend badge with 80% warning threshold
- **Smart Error Recovery** — auto-retry for network errors, budget links for rate limits, visual error classification

> This is a pre-release build. [Report issues →](https://github.com/rayalon1984/testops-copilot/issues)
NOTES
upsert_release "v3.0.2-beta.1" \
  "TestOps Copilot v3.0.2-beta.1 — First-Run Experience & Error Recovery" \
  "true"

# ==========================================================================
# v3.0.3-beta.1 — Living Feature Specs
# ==========================================================================
cat > "$_notes_file" <<'NOTES'
## Living Feature Specs

Specs are no longer passive documentation. This release connects product specifications directly to test assertions with automated drift detection.

### What's New

- **Feature Manifest System** — versioned YAML specs with typed assertions (invariant / behavioral / contract)
- **3 Pilot Features** — Giphy (14), Smart Retry (14), Jira Housekeeping (15) — 43 total assertions mapped
- **Test Helpers** — `describeFeature()` + `itAssertion()` with version drift detection
- **CI Scanner** — `npm run validate:specs` for validation and coverage reports
- **Schema & Registry** — TypeScript types and manifest loader/indexer

### Quality

- 323 tests passing, build/typecheck/lint all clean
- Spec scanner: 3 features, 43 assertions valid

> This is a pre-release build. [Report issues →](https://github.com/rayalon1984/testops-copilot/issues)
NOTES
upsert_release "v3.0.3-beta.1" \
  "TestOps Copilot v3.0.3-beta.1 — Living Feature Specs" \
  "true"

# ==========================================================================
echo ""
echo "============================================"
echo "  ✓ All 12 releases created/updated!"
echo "============================================"
echo ""
echo "View them at: https://github.com/${REPO}/releases"
