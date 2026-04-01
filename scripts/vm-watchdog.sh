#!/bin/bash
#
# TestOps Copilot — VM Watchdog
#
# Runs via cron every 5 minutes. Handles:
#   1. Health checking — restarts containers if backend is down
#   2. Auto-deploy — pulls and rebuilds when new commits land on main
#   3. Alerting — creates GitHub issue after repeated failures
#
# Usage:
#   ./scripts/vm-watchdog.sh           # Normal run (cron mode)
#   ./scripts/vm-watchdog.sh --dry-run # Show what would happen, don't act
#
# Logs: /var/log/testops-watchdog.log (or $LOG_FILE)
#
set -uo pipefail

# ── Config ────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

COMPOSE_FILE="docker-compose.prod.yml"
COMPOSE_CMD="docker compose"
HEALTH_URL="http://localhost:3000/health"
HEALTH_TIMEOUT=10
MAX_RESTART_ATTEMPTS=2
ALERT_AFTER_FAILURES=3

# State files
STATE_DIR="${PROJECT_DIR}/.watchdog"
FAILURE_COUNT_FILE="${STATE_DIR}/failure_count"
LAST_DEPLOY_FILE="${STATE_DIR}/last_deploy_sha"
ALERT_SENT_FILE="${STATE_DIR}/alert_sent"
LOCK_FILE="${STATE_DIR}/watchdog.lock"

# Logging
LOG_FILE="${LOG_FILE:-/var/log/testops-watchdog.log}"
DRY_RUN=false

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
  esac
done

# ── Helpers ───────────────────────────────────────────────────────
timestamp() { date '+%Y-%m-%d %H:%M:%S'; }

log() {
  local msg="[$(timestamp)] $1"
  echo "$msg"
  # Append to log file if writable
  echo "$msg" >> "$LOG_FILE" 2>/dev/null || true
}

log_error() { log "ERROR: $1"; }
log_warn()  { log "WARN:  $1"; }
log_ok()    { log "OK:    $1"; }

# Prevent overlapping runs
acquire_lock() {
  mkdir -p "$STATE_DIR"
  if [ -f "$LOCK_FILE" ]; then
    local lock_pid
    lock_pid=$(cat "$LOCK_FILE" 2>/dev/null || echo "")
    if [ -n "$lock_pid" ] && kill -0 "$lock_pid" 2>/dev/null; then
      log_warn "Another watchdog is running (PID $lock_pid). Exiting."
      exit 0
    else
      log_warn "Stale lock file found. Removing."
      rm -f "$LOCK_FILE"
    fi
  fi
  echo $$ > "$LOCK_FILE"
}

release_lock() {
  rm -f "$LOCK_FILE"
}
trap release_lock EXIT

# ── State helpers ─────────────────────────────────────────────────
get_failure_count() {
  if [ -f "$FAILURE_COUNT_FILE" ]; then
    cat "$FAILURE_COUNT_FILE"
  else
    echo "0"
  fi
}

set_failure_count() {
  echo "$1" > "$FAILURE_COUNT_FILE"
}

get_last_deploy_sha() {
  if [ -f "$LAST_DEPLOY_FILE" ]; then
    cat "$LAST_DEPLOY_FILE"
  else
    git rev-parse HEAD 2>/dev/null || echo ""
  fi
}

set_last_deploy_sha() {
  echo "$1" > "$LAST_DEPLOY_FILE"
}

# ── Health Check ──────────────────────────────────────────────────
check_health() {
  local status
  status=$(curl -sf -o /dev/null -w "%{http_code}" --max-time "$HEALTH_TIMEOUT" "$HEALTH_URL" 2>/dev/null || echo "000")
  [ "$status" = "200" ]
}

# ── Container Restart ─────────────────────────────────────────────
restart_backend() {
  log "Restarting backend container..."
  if [ "$DRY_RUN" = true ]; then
    log "[DRY RUN] Would run: $COMPOSE_CMD -f $COMPOSE_FILE restart backend"
    return 0
  fi
  $COMPOSE_CMD -f "$COMPOSE_FILE" restart backend 2>&1 | while read -r line; do log "  $line"; done
  # Wait for it to come up
  local waited=0
  while [ $waited -lt 60 ]; do
    sleep 5
    waited=$((waited + 5))
    if check_health; then
      return 0
    fi
  done
  return 1
}

# ── Full Rebuild ──────────────────────────────────────────────────
full_rebuild() {
  log "Starting full rebuild (--rebuild)..."
  if [ "$DRY_RUN" = true ]; then
    log "[DRY RUN] Would run: ./scripts/deploy-prod.sh --rebuild"
    return 0
  fi
  bash "$SCRIPT_DIR/deploy-prod.sh" --rebuild 2>&1 | while read -r line; do log "  $line"; done
  return ${PIPESTATUS[0]}
}

# ── GitHub Issue Alert ────────────────────────────────────────────
send_alert() {
  local failure_count=$1

  # Don't alert more than once per incident
  if [ -f "$ALERT_SENT_FILE" ]; then
    log_warn "Alert already sent for this incident. Skipping."
    return 0
  fi

  local container_status
  container_status=$($COMPOSE_CMD -f "$COMPOSE_FILE" ps --format "table {{.Name}}\t{{.Status}}" 2>/dev/null || $COMPOSE_CMD -f "$COMPOSE_FILE" ps 2>/dev/null || echo "unable to get container status")

  local backend_logs
  backend_logs=$($COMPOSE_CMD -f "$COMPOSE_FILE" logs --tail=30 backend 2>/dev/null || echo "unable to get logs")

  if [ "$DRY_RUN" = true ]; then
    log "[DRY RUN] Would create GitHub issue: Backend down after $failure_count consecutive checks"
    return 0
  fi

  # Try gh CLI first
  if command -v gh &>/dev/null; then
    gh issue create \
      --title "[Watchdog] Backend unhealthy - $failure_count consecutive failures ($(date '+%Y-%m-%d %H:%M'))" \
      --body "$(cat <<EOF
## Watchdog Alert

The backend health check has failed **$failure_count consecutive times** on \`vm-testops\`.

Auto-restart and full rebuild were attempted but the service did not recover.

### Container Status
\`\`\`
$container_status
\`\`\`

### Backend Logs (last 30 lines)
\`\`\`
$backend_logs
\`\`\`

### Actions Taken
1. Attempted container restart ($MAX_RESTART_ATTEMPTS times)
2. Attempted full rebuild via \`deploy-prod.sh --rebuild\`
3. Service still not responding

### Manual Recovery
\`\`\`powershell
wsl -d Ubuntu-22.04 bash -c 'cd /home/rotem/testops-copilot && docker compose -f docker-compose.prod.yml logs --tail=100 backend'
\`\`\`

---
*Auto-generated by vm-watchdog.sh*
EOF
)" \
      --label "bug,ops" 2>&1 | while read -r line; do log "  GitHub: $line"; done

    if [ ${PIPESTATUS[0]} -eq 0 ]; then
      touch "$ALERT_SENT_FILE"
      log_ok "GitHub issue created."
    else
      log_error "Failed to create GitHub issue."
    fi
  else
    log_warn "gh CLI not available. Cannot create GitHub issue."
    log_warn "Install: https://cli.github.com/ then run: gh auth login"
  fi
}

clear_alert() {
  rm -f "$ALERT_SENT_FILE"
}

# ── Auto-Deploy (git poll) ────────────────────────────────────────
check_and_deploy() {
  # Fetch latest from origin
  log "Checking for new commits on origin/main..."
  git fetch origin main --quiet 2>/dev/null || {
    log_warn "git fetch failed. Skipping deploy check."
    return 0
  }

  local current_sha
  current_sha=$(get_last_deploy_sha)
  local remote_sha
  remote_sha=$(git rev-parse origin/main 2>/dev/null || echo "")

  if [ -z "$remote_sha" ]; then
    log_warn "Could not determine origin/main SHA."
    return 0
  fi

  if [ "$current_sha" = "$remote_sha" ]; then
    log_ok "No new commits. Current: ${current_sha:0:8}"
    return 0
  fi

  # Show what's new
  local new_commits
  new_commits=$(git log --oneline "$current_sha".."$remote_sha" 2>/dev/null || echo "unknown")
  log "New commits detected:"
  echo "$new_commits" | while read -r line; do log "  $line"; done

  if [ "$DRY_RUN" = true ]; then
    log "[DRY RUN] Would pull and rebuild."
    return 0
  fi

  # Pull and deploy
  log "Pulling changes..."
  git pull origin main 2>&1 | while read -r line; do log "  $line"; done

  log "Deploying with --rebuild..."
  bash "$SCRIPT_DIR/deploy-prod.sh" --rebuild 2>&1 | while read -r line; do log "  $line"; done

  if [ ${PIPESTATUS[0]} -eq 0 ]; then
    set_last_deploy_sha "$remote_sha"
    log_ok "Auto-deploy complete. Now at ${remote_sha:0:8}"
  else
    log_error "Auto-deploy failed!"
    return 1
  fi
}

# ── Main ──────────────────────────────────────────────────────────
main() {
  acquire_lock
  mkdir -p "$STATE_DIR"

  log "========== Watchdog run starting =========="

  # ── Phase 1: Health Check ──
  if check_health; then
    log_ok "Backend is healthy."
    set_failure_count 0
    clear_alert

    # ── Phase 2: Auto-deploy (only when healthy) ──
    check_and_deploy
    return 0
  fi

  # Backend is down
  local failures
  failures=$(get_failure_count)
  failures=$((failures + 1))
  set_failure_count "$failures"
  log_error "Backend health check FAILED. Consecutive failures: $failures"

  # ── Phase 2: Try restart ──
  local attempt=0
  while [ $attempt -lt $MAX_RESTART_ATTEMPTS ]; do
    attempt=$((attempt + 1))
    log "Restart attempt $attempt/$MAX_RESTART_ATTEMPTS..."

    if restart_backend; then
      log_ok "Backend recovered after restart (attempt $attempt)."
      set_failure_count 0
      clear_alert
      return 0
    fi
  done

  # ── Phase 3: Full rebuild ──
  log_warn "Restart failed. Attempting full rebuild..."
  if full_rebuild && check_health; then
    log_ok "Backend recovered after full rebuild."
    set_failure_count 0
    clear_alert
    set_last_deploy_sha "$(git rev-parse HEAD 2>/dev/null || echo "")"
    return 0
  fi

  # ── Phase 4: Alert ──
  log_error "All recovery attempts failed. Failures: $failures"
  if [ "$failures" -ge "$ALERT_AFTER_FAILURES" ]; then
    send_alert "$failures"
  fi

  return 1
}

main "$@"
