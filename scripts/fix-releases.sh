#!/bin/bash
# Fix release tags and notes for TestOps Companion
# Run from the repo root on your Mac

set -e

echo "Step 1: Delete incorrect releases"
gh release delete v3.0.1-beta.1 --yes || echo "  v3.0.1-beta.1 already gone"
gh release delete v3.0.2-beta.1 --yes || echo "  v3.0.2-beta.1 already gone"
gh release delete v3.0.3-beta.1 --yes || echo "  v3.0.3-beta.1 already gone"
gh release delete v3.0.0-rc.2 --yes || echo "  v3.0.0-rc.2 already gone"

echo "Step 2: Delete incorrect tags"
git push origin :refs/tags/v3.0.1-beta.1 || echo "  tag v3.0.1-beta.1 already gone"
git push origin :refs/tags/v3.0.2-beta.1 || echo "  tag v3.0.2-beta.1 already gone"
git push origin :refs/tags/v3.0.3-beta.1 || echo "  tag v3.0.3-beta.1 already gone"
git push origin :refs/tags/v3.0.0-rc.2 || echo "  tag v3.0.0-rc.2 already gone"
git tag -d v3.0.1-beta.1 || true
git tag -d v3.0.2-beta.1 || true
git tag -d v3.0.3-beta.1 || true
git tag -d v3.0.0-rc.2 || true

echo "Step 3: Create correct tags"
git tag -a v3.0.0-beta.2 f01aaae -m "v3.0.0-beta.2: E2E test coverage"
git tag -a v3.0.0-beta.3 66f25ef -m "v3.0.0-beta.3: First-run experience"
git tag -a v3.0.0-beta.4 2b22b30 -m "v3.0.0-beta.4: Living feature specs"
git tag -a v3.0.0-rc.2 5a8e9ac -m "v3.0.0-rc.2: Full beta coverage 229 assertions"

echo "Step 4: Push tags"
git push origin v3.0.0-beta.2
git push origin v3.0.0-beta.3
git push origin v3.0.0-beta.4
git push origin v3.0.0-rc.2

echo "Step 5: Create beta.2 release"
gh release create v3.0.0-beta.2 \
  --title "TestOps Companion v3.0.0-beta.2 — E2E Test Coverage" \
  --notes "10 E2E smoke tests covering login, ReAct reasoning loop, confirmation approve/deny, proactive suggestions, autonomous actions, persona routing, session persistence. Mock API fixtures with pre-built SSE streaming scenarios." \
  --prerelease --verify-tag

echo "Step 6: Create beta.3 release"
gh release create v3.0.0-beta.3 \
  --title "TestOps Companion v3.0.0-beta.3 — First-Run Experience" \
  --notes "Onboarding Wizard (3-step guided setup), Budget Indicator (live badge with 80% warning), Smart Error Recovery (auto-retry with countdown, rate limit links to Cost Tracker)." \
  --prerelease --verify-tag

echo "Step 7: Create beta.4 release"
gh release create v3.0.0-beta.4 \
  --title "TestOps Companion v3.0.0-beta.4 — Living Feature Specs" \
  --notes "Feature Manifest System with versioned YAML and typed assertions. 3 pilot features instrumented (Giphy 14, Smart Retry 14, Jira Housekeeping 15 = 43 assertions). CI Scanner, test helpers with version drift detection." \
  --prerelease --verify-tag

echo "Step 8: Update rc.1 release"
gh release edit v3.0.0-rc.1 \
  --title "TestOps Companion v3.0.0-rc.1 — Specs Complete, Docs Polished" \
  --notes "Living Feature Specs Phase 1-3: 6 features, 103 assertions, 100% coverage. Coverage thresholds enforced. PR coverage reports auto-posted via GitHub Actions. Health scoring A+ through D. Documentation cleanup. CI release fix for macOS." \
  --prerelease

echo "Step 9: Create rc.2 release"
gh release create v3.0.0-rc.2 \
  --title "TestOps Companion v3.0.0-rc.2 — Full Beta Coverage" \
  --notes "Phase 4: 16 features, 229 assertions, 100% coverage. Authentication (21), Failure Analysis (17), MCP Server (15), Failure KB (13), Resilience (13), ReAct Loop (12), Context Enrichment (10), AI Cost (9), Pipeline (8), Notifications (8). Invariants 144/144, Behavioral 41/41, Contracts 44/44. 417 tests passing. PR #424." \
  --prerelease --verify-tag

echo ""
echo "DONE! Verify with: gh release list"
