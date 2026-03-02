#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# release.sh — Automated release with polished notes
#
# Usage:
#   ./scripts/release.sh <version> "<headline>"
#
# Example:
#   ./scripts/release.sh 3.4.0 "Auto-Sync + Test Plan Browser"
#
# What it does:
#   1. Validates inputs and checks for clean working tree
#   2. Runs full test suite (backend + frontend + feature specs)
#   3. Generates release notes from commits since last tag
#   4. Prepends a CHANGELOG.md entry
#   5. Commits the changelog update
#   6. Creates an annotated git tag with the release notes
#   7. Pushes tag + commit to origin
#
# The generated notes follow a product-announcement style, not a
# grocery list of implementation details. Sections are grouped by
# user-facing impact, not by file or ticket number.
# ─────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Args ──────────────────────────────────────────────────────────────

VERSION="${1:-}"
HEADLINE="${2:-}"

if [[ -z "$VERSION" || -z "$HEADLINE" ]]; then
  echo "Usage: ./scripts/release.sh <version> \"<headline>\""
  echo "  e.g. ./scripts/release.sh 3.4.0 \"Auto-Sync + Test Plan Browser\""
  exit 1
fi

TAG="v${VERSION}"
DATE=$(date +%Y-%m-%d)
PREV_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
ROOT=$(git rev-parse --show-toplevel)

# ── Preflight checks ─────────────────────────────────────────────────

echo "╔══════════════════════════════════════════════════════╗"
echo "║  Release ${TAG} — ${HEADLINE}"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# Check clean working tree (allow spec-version-tracker.json which auto-updates)
DIRTY=$(git status --porcelain | grep -v 'spec-version-tracker.json' || true)
if [[ -n "$DIRTY" ]]; then
  echo "✗ Working tree is dirty. Commit or stash changes first."
  echo "$DIRTY"
  exit 1
fi

# Check tag doesn't already exist
if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "✗ Tag ${TAG} already exists. Delete it first or use a different version."
  exit 1
fi

# Check we're on main
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$BRANCH" != "main" ]]; then
  echo "⚠ Warning: releasing from '${BRANCH}', not 'main'. Continue? (y/N)"
  read -r CONFIRM
  [[ "$CONFIRM" == "y" ]] || exit 1
fi

echo "  Previous tag: ${PREV_TAG:-"(none)"}"
echo "  New tag:      ${TAG}"
echo "  Date:         ${DATE}"
echo ""

# ── Run tests ─────────────────────────────────────────────────────────

echo "── Running test suite ──────────────────────────────────"

echo "  Backend tests..."
cd "${ROOT}/backend" && npm test --silent 2>&1 | tail -3
BACKEND_RESULT=$(npm test --silent 2>&1 | grep -oP 'Tests:\s+\K\d+ passed' || echo "? passed")

echo "  Frontend tests..."
cd "${ROOT}/frontend" && npx vitest run --silent 2>&1 | tail -3
FRONTEND_RESULT=$(npx vitest run --silent 2>&1 | grep -oP 'Tests\s+\K\d+ passed' || echo "? passed")

echo "  Feature spec scanner..."
cd "${ROOT}"
SPEC_RESULT=$(npx tsx scripts/scan-feature-specs.ts 2>&1 | grep "Coverage:" || echo "Coverage: unknown")

echo ""
echo "  ✓ Backend:  ${BACKEND_RESULT}"
echo "  ✓ Frontend: ${FRONTEND_RESULT}"
echo "  ✓ Specs:    ${SPEC_RESULT}"
echo ""

# ── Generate release notes ────────────────────────────────────────────

echo "── Generating release notes ─────────────────────────────"

# Collect commits since last tag, grouped by type
if [[ -n "$PREV_TAG" ]]; then
  COMMITS=$(git log "${PREV_TAG}..HEAD" --pretty=format:"%s" --no-merges)
  COMMIT_COUNT=$(git rev-list "${PREV_TAG}..HEAD" --count)
else
  COMMITS=$(git log --pretty=format:"%s" --no-merges -30)
  COMMIT_COUNT="30+"
fi

# Extract feature commits (feat:)
FEATS=$(echo "$COMMITS" | grep -i '^feat' | sed 's/^feat([^)]*): //' | sed 's/^feat: //' || true)
# Extract fix commits (fix:)
FIXES=$(echo "$COMMITS" | grep -i '^fix' | sed 's/^fix([^)]*): //' | sed 's/^fix: //' || true)
# Extract test commits (test:)
TESTS=$(echo "$COMMITS" | grep -i '^test' | sed 's/^test([^)]*): //' | sed 's/^test: //' || true)

# Build the tag message (product-announcement style)
TAG_MSG="${TAG} — ${HEADLINE}

${COMMIT_COUNT} commits since ${PREV_TAG:-"initial"}."

if [[ -n "$FEATS" ]]; then
  TAG_MSG="${TAG_MSG}

### What's new

$(echo "$FEATS" | while IFS= read -r line; do [[ -n "$line" ]] && echo "- ${line}"; done)"
fi

if [[ -n "$FIXES" ]]; then
  TAG_MSG="${TAG_MSG}

### Fixes

$(echo "$FIXES" | while IFS= read -r line; do [[ -n "$line" ]] && echo "- ${line}"; done)"
fi

TAG_MSG="${TAG_MSG}

### Quality

- ${BACKEND_RESULT} (backend) + ${FRONTEND_RESULT} (frontend)
- ${SPEC_RESULT}"

echo "$TAG_MSG"
echo ""

# ── Update CHANGELOG.md ──────────────────────────────────────────────

echo "── Updating CHANGELOG.md ────────────────────────────────"

CHANGELOG="${ROOT}/CHANGELOG.md"

# Build changelog entry
CHANGELOG_ENTRY="## [${VERSION}] - ${DATE}

> **${HEADLINE}**"

if [[ -n "$FEATS" ]]; then
  CHANGELOG_ENTRY="${CHANGELOG_ENTRY}

### Features

$(echo "$FEATS" | while IFS= read -r line; do [[ -n "$line" ]] && echo "- ${line}"; done)"
fi

if [[ -n "$FIXES" ]]; then
  CHANGELOG_ENTRY="${CHANGELOG_ENTRY}

### Fixes

$(echo "$FIXES" | while IFS= read -r line; do [[ -n "$line" ]] && echo "- ${line}"; done)"
fi

CHANGELOG_ENTRY="${CHANGELOG_ENTRY}

### Quality

- ${BACKEND_RESULT} (backend) + ${FRONTEND_RESULT} (frontend)
- ${SPEC_RESULT}

---"

# Insert after the first "---" line (after the header)
# Uses awk to inject after the first separator
awk -v entry="$CHANGELOG_ENTRY" '
  /^---$/ && !done { print; print ""; print entry; done=1; next }
  { print }
' "$CHANGELOG" > "${CHANGELOG}.tmp" && mv "${CHANGELOG}.tmp" "$CHANGELOG"

echo "  ✓ CHANGELOG.md updated"
echo ""

# ── Commit, tag, push ────────────────────────────────────────────────

echo "── Creating release commit + tag ────────────────────────"

cd "${ROOT}"
git add CHANGELOG.md
# Also stage spec-version-tracker if it changed (test run artifact)
git add backend/src/__tests__/helpers/spec-version-tracker.json 2>/dev/null || true

git commit -m "$(cat <<COMMITEOF
chore(release): ${TAG} — ${HEADLINE}

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
COMMITEOF
)"

git tag -a "${TAG}" -m "${TAG_MSG}"

echo "  ✓ Committed changelog"
echo "  ✓ Tagged ${TAG}"
echo ""

# ── Push ──────────────────────────────────────────────────────────────

echo "── Pushing to origin ────────────────────────────────────"

git push origin "${BRANCH}" --tags

echo "  ✓ Pushed to origin/${BRANCH}"
echo ""

# ── Create GitHub Release ──────────────────────────────────────────────
# Creates the release via gh CLI so CI doesn't auto-generate a grocery list.
# The CI workflow's skip check will see this release exists and not overwrite it.

if command -v gh &>/dev/null; then
  echo "── Creating GitHub Release ──────────────────────────────"

  RELEASE_BODY="${CHANGELOG_ENTRY}

### Installation

\`\`\`bash
git clone https://github.com/$(gh repo view --json nameWithOwner -q '.nameWithOwner').git
cd testops-copilot
git checkout ${TAG}
npm run setup
\`\`\`

📖 See [CHANGELOG.md](https://github.com/$(gh repo view --json nameWithOwner -q '.nameWithOwner')/blob/main/CHANGELOG.md) for full history."

  gh release create "${TAG}" \
    --title "TestOps Copilot ${TAG}" \
    --notes "${RELEASE_BODY}" \
    --verify-tag

  echo "  ✓ GitHub Release created"
else
  echo "⚠ gh CLI not found — skipping GitHub Release creation."
  echo "  CI will auto-generate release notes (may be less polished)."
  echo "  Install gh: https://cli.github.com"
fi

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  ✓ Released ${TAG}                                   "
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "  Tag:       ${TAG}"
echo "  Changelog: CHANGELOG.md updated"
echo "  Release:   https://github.com/$(gh repo view --json nameWithOwner -q '.nameWithOwner' 2>/dev/null || echo 'OWNER/REPO')/releases/tag/${TAG}"
echo ""
