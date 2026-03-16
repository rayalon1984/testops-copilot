#!/bin/bash
#
# TestOps Copilot — Production Pre-Flight Check
#
# Run this BEFORE deploying to catch configuration issues early.
# Usage: ./scripts/preflight-check.sh [--env-file .env.production]
#
set -euo pipefail

# ── Colors ─────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

PASS=0
WARN=0
FAIL=0

pass()  { PASS=$((PASS + 1)); echo -e "  ${GREEN}✓${NC} $1"; }
warn()  { WARN=$((WARN + 1)); echo -e "  ${YELLOW}⚠${NC} $1"; }
fail()  { FAIL=$((FAIL + 1)); echo -e "  ${RED}✗${NC} $1"; }
header(){ echo -e "\n${BOLD}${CYAN}[$1]${NC}"; }

# ── Parse args ─────────────────────────────────────────────────────
ENV_FILE="${1:-.env.production}"
if [[ "$ENV_FILE" == "--env-file" ]]; then
  ENV_FILE="${2:-.env.production}"
fi

echo -e "${BOLD}TestOps Copilot — Pre-Flight Check${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 1. Environment file ────────────────────────────────────────────
header "Environment File"

if [ ! -f "$ENV_FILE" ]; then
  fail "$ENV_FILE not found. Copy from .env.production.example:"
  echo -e "       ${CYAN}cp .env.production.example .env.production${NC}"
else
  pass "$ENV_FILE exists"

  # Source env file for validation (skip comments and empty lines)
  set -a
  while IFS= read -r line; do
    # Skip comments and empty lines
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ -z "$line" ]] && continue
    # Skip lines with ${} interpolation (docker-compose resolves these)
    [[ "$line" =~ \$\{ ]] && continue
    eval "$line" 2>/dev/null || true
  done < "$ENV_FILE"
  set +a

  # Required vars
  for var in POSTGRES_PASSWORD JWT_SECRET JWT_REFRESH_SECRET; do
    val="${!var:-}"
    if [ -z "$val" ]; then
      fail "$var is not set"
    elif [[ "$val" == *"GENERATE"* ]] || [[ "$val" == *"CHANGE_ME"* ]] || [[ "$val" == *"your-"* ]]; then
      fail "$var still has placeholder value"
    elif [ "$var" != "POSTGRES_PASSWORD" ] && [ ${#val} -lt 32 ]; then
      fail "$var is too short (${#val} chars, need ≥32)"
    else
      pass "$var is set (${#val} chars)"
    fi
  done

  # CORS_ORIGIN should not be localhost in production
  cors="${CORS_ORIGIN:-}"
  if [[ "$cors" == *"localhost"* ]]; then
    warn "CORS_ORIGIN contains 'localhost' — update for production"
  elif [ -n "$cors" ]; then
    pass "CORS_ORIGIN=$cors"
  fi

  # Session secret
  session="${SESSION_SECRET:-}"
  if [ -z "$session" ]; then
    warn "SESSION_SECRET not set — will use a random value (sessions won't persist across restarts)"
  elif [[ "$session" == *"CHANGE_ME"* ]]; then
    fail "SESSION_SECRET still has placeholder value"
  elif [ ${#session} -lt 32 ]; then
    warn "SESSION_SECRET is short (${#session} chars) — recommend ≥32"
  else
    pass "SESSION_SECRET is set (${#session} chars)"
  fi

  # CSRF secret
  csrf="${CSRF_SECRET:-}"
  if [ -z "$csrf" ]; then
    warn "CSRF_SECRET not set — will use default (change for production)"
  elif [[ "$csrf" == *"CHANGE_ME"* ]]; then
    fail "CSRF_SECRET still has placeholder value"
  else
    pass "CSRF_SECRET is set (${#csrf} chars)"
  fi

  # Check for leading/trailing spaces in values (common copy-paste issue)
  while IFS= read -r line; do
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ -z "$line" ]] && continue
    key="${line%%=*}"
    val="${line#*=}"
    if [[ "$val" =~ ^[[:space:]] ]] || [[ "$val" =~ [[:space:]]$ ]]; then
      fail "$key has leading/trailing whitespace — this will break auth tokens"
    fi
  done < "$ENV_FILE"
fi

# ── 2. Docker ──────────────────────────────────────────────────────
header "Docker"

if ! command -v docker &>/dev/null; then
  fail "docker not found"
else
  pass "docker installed ($(docker --version | grep -oP '\d+\.\d+\.\d+'))"
  if ! docker info &>/dev/null; then
    fail "Docker daemon not running (or needs sudo)"
  else
    pass "Docker daemon is running"
  fi
fi

if ! docker compose version &>/dev/null; then
  warn "docker compose (v2) not found — trying docker-compose (v1)"
  if ! command -v docker-compose &>/dev/null; then
    fail "Neither 'docker compose' nor 'docker-compose' found"
  fi
else
  pass "docker compose v2 available"
fi

# ── 3. Docker Compose files ───────────────────────────────────────
header "Compose Configuration"

for f in docker-compose.prod.yml docker-compose.ghcr.yml; do
  if [ ! -f "$f" ]; then
    warn "$f not found"
  else
    # Check for unresolved variables
    unresolved=$(docker compose -f "$f" config 2>&1 | grep -c 'variable is not set' || true)
    if [ "$unresolved" -gt 0 ]; then
      fail "$f has $unresolved unresolved variables"
    else
      pass "$f validates OK"
    fi
  fi
done

# ── 4. Prisma schema sync ─────────────────────────────────────────
header "Database Schema"

DEV_SCHEMA="backend/prisma/schema.dev.prisma"
PROD_SCHEMA="backend/prisma/schema.production.prisma"

if [ ! -f "$DEV_SCHEMA" ] || [ ! -f "$PROD_SCHEMA" ]; then
  warn "Dual Prisma schemas not found — skipping sync check"
else
  # Extract model names from both schemas
  dev_models=$(grep -c "^model " "$DEV_SCHEMA" || true)
  prod_models=$(grep -c "^model " "$PROD_SCHEMA" || true)

  if [ "$dev_models" -ne "$prod_models" ]; then
    fail "Schema model count mismatch: dev=$dev_models, prod=$prod_models"
  else
    pass "Both schemas have $dev_models models"
  fi

  # Check that field names match (ignoring type differences like String vs Json)
  dev_fields=$(grep -oE '^\s+[a-zA-Z]+\s' "$DEV_SCHEMA" 2>/dev/null | sort -u | wc -l | tr -d ' ')
  prod_fields=$(grep -oE '^\s+[a-zA-Z]+\s' "$PROD_SCHEMA" 2>/dev/null | sort -u | wc -l | tr -d ' ')

  if [ "$dev_fields" -ne "$prod_fields" ]; then
    warn "Field count differs: dev=$dev_fields, prod=$prod_fields — verify manually"
  else
    pass "Field counts match ($dev_fields fields)"
  fi
fi

# Check migrations exist
MIGRATION_DIR="backend/prisma/migrations"
if [ -d "$MIGRATION_DIR" ]; then
  migration_count=$(find "$MIGRATION_DIR" -name "migration.sql" | wc -l)
  pass "$migration_count migrations found"
else
  warn "No migrations directory — first deploy will create tables"
fi

# ── 5. Dockerfile checks ──────────────────────────────────────────
header "Dockerfile"

DOCKERFILE="backend/Dockerfile"
if [ -f "$DOCKERFILE" ]; then
  # Check healthcheck uses 127.0.0.1 (not localhost — Alpine IPv6 issue)
  if grep -q "localhost" "$DOCKERFILE" && grep -q "HEALTHCHECK" "$DOCKERFILE"; then
    fail "Dockerfile HEALTHCHECK uses 'localhost' — Alpine resolves to IPv6. Use 127.0.0.1"
  else
    pass "Healthcheck uses 127.0.0.1 (Alpine-safe)"
  fi

  # Check openapi.yaml is copied
  if grep -q "openapi.yaml" "$DOCKERFILE"; then
    pass "openapi.yaml copied in Dockerfile"
  else
    warn "openapi.yaml not in Dockerfile — /api/docs will serve blank spec"
  fi
else
  warn "backend/Dockerfile not found"
fi

# ── 6. Integration configs ────────────────────────────────────────
header "Integrations (Optional)"

# Jira
jira_url="${JIRA_BASE_URL:-}"
jira_token="${JIRA_API_TOKEN:-}"
jira_email="${JIRA_EMAIL:-}"
jira_key="${JIRA_PROJECT_KEY:-}"

if [ -n "$jira_url" ]; then
  if [ -z "$jira_email" ]; then
    fail "JIRA_BASE_URL is set but JIRA_EMAIL is missing — Atlassian Cloud requires email+token for Basic auth"
  elif [ -z "$jira_token" ]; then
    fail "JIRA_BASE_URL is set but JIRA_API_TOKEN is missing"
  elif [ -z "$jira_key" ]; then
    fail "JIRA_BASE_URL is set but JIRA_PROJECT_KEY is missing"
  else
    pass "Jira configured: $jira_url (project: $jira_key)"
  fi
else
  warn "Jira not configured (JIRA_BASE_URL not set)"
fi

# GitHub
github_token="${GITHUB_TOKEN:-}"
if [ -n "$github_token" ]; then
  pass "GitHub token configured"
else
  warn "GitHub not configured (GITHUB_TOKEN not set)"
fi

# AI
ai_enabled="${AI_ENABLED:-false}"
ai_provider="${AI_PROVIDER:-}"
if [ "$ai_enabled" = "true" ]; then
  if [ -z "$ai_provider" ]; then
    warn "AI_ENABLED=true but AI_PROVIDER not set"
  else
    pass "AI enabled: provider=$ai_provider"
    # Check the provider's API key exists
    case "$ai_provider" in
      anthropic) [ -n "${ANTHROPIC_API_KEY:-}" ] && pass "Anthropic API key set" || fail "ANTHROPIC_API_KEY missing" ;;
      openai)    [ -n "${OPENAI_API_KEY:-}" ]    && pass "OpenAI API key set"    || fail "OPENAI_API_KEY missing" ;;
      google)    [ -n "${GOOGLE_AI_API_KEY:-}" ]  && pass "Google API key set"    || fail "GOOGLE_AI_API_KEY missing" ;;
    esac
  fi
else
  warn "AI features disabled (AI_ENABLED != true)"
fi

# Redis
redis_enabled="${REDIS_ENABLED:-}"
if [ "$redis_enabled" = "true" ] || [ -n "${REDIS_URL:-}" ]; then
  pass "Redis configured"
else
  warn "Redis not explicitly enabled — backend will use in-memory sessions (not recommended for production)"
fi

# ── 7. Disk space ─────────────────────────────────────────────────
header "System Resources"

if df --version &>/dev/null 2>&1; then
  # GNU df (Linux)
  available_gb=$(df -BG . | tail -1 | awk '{print $4}' | tr -d 'G')
else
  # BSD df (macOS)
  available_gb=$(df -g . | tail -1 | awk '{print $4}')
fi
if [ "$available_gb" -lt 5 ]; then
  warn "Low disk space: ${available_gb}GB available (recommend ≥10GB)"
else
  pass "Disk space: ${available_gb}GB available"
fi

# Docker disk usage
if docker system df &>/dev/null; then
  reclaimable=$(docker system df 2>/dev/null | grep "Build Cache" | awk '{print $4}' || echo "unknown")
  if [ "$reclaimable" != "unknown" ] && [ "$reclaimable" != "0B" ]; then
    warn "Docker build cache reclaimable: $reclaimable — run 'docker system prune' to free space"
  fi
fi

# ── Summary ────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✓ $PASS passed${NC}  ${YELLOW}⚠ $WARN warnings${NC}  ${RED}✗ $FAIL failed${NC}"

if [ "$FAIL" -gt 0 ]; then
  echo -e "\n${RED}${BOLD}Pre-flight check FAILED.${NC} Fix the issues above before deploying."
  exit 1
elif [ "$WARN" -gt 0 ]; then
  echo -e "\n${YELLOW}${BOLD}Pre-flight check passed with warnings.${NC} Review before deploying."
  exit 0
else
  echo -e "\n${GREEN}${BOLD}All checks passed. Ready to deploy!${NC}"
  exit 0
fi
