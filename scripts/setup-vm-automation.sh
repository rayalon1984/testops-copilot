#!/bin/bash
#
# TestOps Copilot — VM Automation Setup
#
# One-time setup script. Run this INSIDE WSL on the VM to install:
#   - Cron job for vm-watchdog.sh (every 5 minutes)
#   - Log rotation for watchdog logs
#   - gh CLI authentication check
#
# Usage:
#   ./scripts/setup-vm-automation.sh          # Install everything
#   ./scripts/setup-vm-automation.sh --remove # Remove cron jobs
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

ok()   { echo -e "  ${GREEN}✓${NC} $1"; }
warn() { echo -e "  ${YELLOW}⚠${NC} $1"; }
fail() { echo -e "  ${RED}✗${NC} $1"; }

WATCHDOG_SCRIPT="${SCRIPT_DIR}/vm-watchdog.sh"
LOG_FILE="/var/log/testops-watchdog.log"
CRON_MARKER="# testops-watchdog"

echo ""
echo -e "${BOLD}TestOps Copilot — VM Automation Setup${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── Remove mode ───────────────────────────────────────────────────
if [ "${1:-}" = "--remove" ]; then
  echo "Removing automation..."
  crontab -l 2>/dev/null | grep -v "$CRON_MARKER" | crontab - 2>/dev/null || true
  ok "Cron jobs removed"
  echo ""
  echo "Note: Log file at $LOG_FILE was preserved."
  exit 0
fi

# ── Step 1: Verify prerequisites ──────────────────────────────────
echo -e "${BOLD}[1/4] Checking prerequisites${NC}"

if [ ! -f "$WATCHDOG_SCRIPT" ]; then
  fail "vm-watchdog.sh not found at $WATCHDOG_SCRIPT"
  exit 1
fi
ok "vm-watchdog.sh found"

if command -v docker &>/dev/null && docker info &>/dev/null 2>&1; then
  ok "Docker is available"
else
  fail "Docker not available. Is this running inside WSL with Docker?"
  exit 1
fi

if command -v git &>/dev/null; then
  ok "git is available"
else
  warn "git not found — auto-deploy won't work"
fi

if command -v gh &>/dev/null; then
  if gh auth status &>/dev/null 2>&1; then
    ok "gh CLI authenticated — alerts will create GitHub issues"
  else
    warn "gh CLI installed but not authenticated"
    warn "Run: gh auth login"
    warn "Without this, alerts will only go to the log file"
  fi
else
  warn "gh CLI not installed — alerts will only go to the log file"
  warn "Install: https://cli.github.com/"
fi

if command -v curl &>/dev/null; then
  ok "curl is available"
else
  fail "curl not found. Install: sudo apt install curl"
  exit 1
fi

# ── Step 2: Create log file ───────────────────────────────────────
echo ""
echo -e "${BOLD}[2/4] Setting up logging${NC}"

sudo touch "$LOG_FILE" 2>/dev/null || touch "$LOG_FILE" 2>/dev/null || {
  LOG_FILE="${PROJECT_DIR}/.watchdog/watchdog.log"
  mkdir -p "$(dirname "$LOG_FILE")"
  touch "$LOG_FILE"
  warn "Cannot write to /var/log. Using $LOG_FILE instead."
}
sudo chmod 666 "$LOG_FILE" 2>/dev/null || chmod 666 "$LOG_FILE" 2>/dev/null || true
ok "Log file: $LOG_FILE"

# Set up logrotate if available
if command -v logrotate &>/dev/null && [ -d /etc/logrotate.d ]; then
  sudo tee /etc/logrotate.d/testops-watchdog > /dev/null 2>&1 <<EOF
$LOG_FILE {
    weekly
    rotate 4
    compress
    missingok
    notifempty
    size 10M
}
EOF
  ok "Log rotation configured (weekly, 4 rotations, max 10MB)"
else
  warn "logrotate not available. Logs will grow unbounded."
  warn "Consider: sudo apt install logrotate"
fi

# ── Step 3: Install cron job ──────────────────────────────────────
echo ""
echo -e "${BOLD}[3/4] Installing cron job${NC}"

# Build the cron line
CRON_LINE="*/5 * * * * cd ${PROJECT_DIR} && LOG_FILE=${LOG_FILE} ${WATCHDOG_SCRIPT} >> ${LOG_FILE} 2>&1 ${CRON_MARKER}"

# Remove any existing watchdog cron entry, then add the new one
EXISTING_CRONTAB=$(crontab -l 2>/dev/null || echo "")
NEW_CRONTAB=$(echo "$EXISTING_CRONTAB" | grep -v "$CRON_MARKER" || true)

if [ -n "$NEW_CRONTAB" ]; then
  echo "${NEW_CRONTAB}
${CRON_LINE}" | crontab -
else
  echo "$CRON_LINE" | crontab -
fi

ok "Cron installed: every 5 minutes"
echo "  Entry: $CRON_LINE"

# Verify cron service is running
if pgrep -x cron > /dev/null 2>&1; then
  ok "cron service is running"
else
  warn "cron service not running. Starting it..."
  sudo service cron start 2>/dev/null || {
    fail "Could not start cron. Run manually: sudo service cron start"
  }
  if pgrep -x cron > /dev/null 2>&1; then
    ok "cron service started"
  fi
fi

# ── Step 4: Create state directory ────────────────────────────────
echo ""
echo -e "${BOLD}[4/4] Initializing state${NC}"

STATE_DIR="${PROJECT_DIR}/.watchdog"
mkdir -p "$STATE_DIR"

# Record current SHA so auto-deploy doesn't redeploy on first run
CURRENT_SHA=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
echo "$CURRENT_SHA" > "${STATE_DIR}/last_deploy_sha"
ok "State directory: $STATE_DIR"
ok "Current deploy SHA: ${CURRENT_SHA:0:8}"

# ── Done ──────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}${BOLD}  Automation installed!${NC}"
echo -e "${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "  What happens now:"
echo "    - Every 5 min: health check → auto-restart → full rebuild → alert"
echo "    - On new commits to main: auto-pull and rebuild"
echo "    - After 3 consecutive failures: GitHub issue created"
echo ""
echo "  Useful commands:"
echo "    View logs:    tail -f $LOG_FILE"
echo "    Test run:     ${WATCHDOG_SCRIPT} --dry-run"
echo "    Remove:       ${SCRIPT_DIR}/setup-vm-automation.sh --remove"
echo "    Check cron:   crontab -l"
echo ""
