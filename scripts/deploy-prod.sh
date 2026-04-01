#!/bin/bash
#
# TestOps Copilot — Production Deployment
#
# One command to go from fresh clone to running system.
#
# Usage:
#   ./scripts/deploy-prod.sh              # Full deploy (build + start)
#   ./scripts/deploy-prod.sh --rebuild    # Force rebuild all images
#   ./scripts/deploy-prod.sh --skip-build # Start without rebuilding
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

# ── Flags ──────────────────────────────────────────────────────────
REBUILD=false
SKIP_BUILD=false
for arg in "$@"; do
  case "$arg" in
    --rebuild)    REBUILD=true ;;
    --skip-build) SKIP_BUILD=true ;;
  esac
done

# ── Colors ─────────────────────────────────────────────────────────
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

step()    { echo -e "\n${BOLD}${BLUE}[$1]${NC} $2"; }
ok()      { echo -e "  ${GREEN}✓${NC} $1"; }
warn()    { echo -e "  ${YELLOW}⚠${NC} $1"; }
fail()    { echo -e "  ${RED}✗${NC} $1"; }
die()     { echo -e "\n${RED}${BOLD}FATAL:${NC} $1"; exit 1; }

COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.production"
ENV_EXAMPLE=".env.production.example"

echo ""
echo -e "${BOLD}${BLUE}══════════════════════════════════════${NC}"
echo -e "${BOLD}${BLUE}  TestOps Copilot — Production Deploy ${NC}"
echo -e "${BOLD}${BLUE}══════════════════════════════════════${NC}"
echo ""

# ── Step 1: Requirements ───────────────────────────────────────────
step "1/7" "Checking requirements"

command -v docker &>/dev/null || die "Docker not installed. Install Docker first."

if docker compose version &>/dev/null; then
  COMPOSE_CMD="docker compose"
  ok "Docker Compose v2 ($(docker compose version --short))"
elif command -v docker-compose &>/dev/null; then
  COMPOSE_CMD="docker-compose"
  ok "Docker Compose v1"
else
  die "Docker Compose not found."
fi

docker info &>/dev/null || die "Docker daemon not running."
ok "Docker daemon running"

# ── Step 2: Environment ────────────────────────────────────────────
step "2/7" "Setting up environment"

gen_secret() { openssl rand -hex 32 2>/dev/null || node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"; }

if [ ! -f "$ENV_FILE" ]; then
  if [ ! -f "$ENV_EXAMPLE" ]; then
    die "$ENV_EXAMPLE not found. Are you in the project root?"
  fi

  echo "  Creating $ENV_FILE from template..."
  cp "$ENV_EXAMPLE" "$ENV_FILE"

  # Auto-generate all secrets
  JWT=$(gen_secret)
  JWT_REFRESH=$(gen_secret)
  SESSION=$(gen_secret)
  CSRF=$(gen_secret)
  PG_PASS=$(gen_secret | head -c 24)

  sed -i.bak "s|POSTGRES_PASSWORD=CHANGE_ME|POSTGRES_PASSWORD=${PG_PASS}|" "$ENV_FILE"
  sed -i.bak "s|JWT_SECRET=CHANGE_ME_run_openssl_rand_hex_32|JWT_SECRET=${JWT}|" "$ENV_FILE"
  sed -i.bak "s|JWT_REFRESH_SECRET=CHANGE_ME_run_openssl_rand_hex_32|JWT_REFRESH_SECRET=${JWT_REFRESH}|" "$ENV_FILE"
  sed -i.bak "s|SESSION_SECRET=CHANGE_ME_run_openssl_rand_hex_32|SESSION_SECRET=${SESSION}|" "$ENV_FILE"
  sed -i.bak "s|CSRF_SECRET=CHANGE_ME_run_openssl_rand_hex_32|CSRF_SECRET=${CSRF}|" "$ENV_FILE"
  sed -i.bak "s|ADMIN_PASSWORD=CHANGE_ME_min_8_chars|ADMIN_PASSWORD=admin123|" "$ENV_FILE"
  rm -f "${ENV_FILE}.bak"

  ok "Generated $ENV_FILE with random secrets"
  warn "Review $ENV_FILE and set CORS_ORIGIN to your server's IP/hostname"
  warn "Default admin: admin@testops.local / admin123 — change after first login!"
else
  ok "$ENV_FILE already exists"
fi

# Source env file for validation
set -a
while IFS= read -r line; do
  [[ "$line" =~ ^[[:space:]]*# ]] && continue
  [[ -z "$line" ]] && continue
  [[ "$line" =~ \$\{ ]] && continue
  eval "$line" 2>/dev/null || true
done < "$ENV_FILE"
set +a

# Validate critical vars
ERRORS=0
for var in POSTGRES_PASSWORD JWT_SECRET JWT_REFRESH_SECRET; do
  val="${!var:-}"
  if [ -z "$val" ] || [[ "$val" == *"CHANGE_ME"* ]]; then
    fail "$var is not set or still has placeholder"
    ERRORS=$((ERRORS + 1))
  fi
done

if [ "$ERRORS" -gt 0 ]; then
  die "Fix the $ERRORS error(s) above in $ENV_FILE, then re-run."
fi
ok "Environment validated"

# ── Step 3: Build ──────────────────────────────────────────────────
step "3/7" "Building Docker images"

if [ "$SKIP_BUILD" = true ]; then
  ok "Skipping build (--skip-build)"
elif [ "$REBUILD" = true ]; then
  echo "  Force rebuilding all images..."
  $COMPOSE_CMD -f "$COMPOSE_FILE" build --no-cache 2>&1 | tail -5
  ok "Images rebuilt from scratch"
else
  echo "  Building images (using cache)..."
  $COMPOSE_CMD -f "$COMPOSE_FILE" build 2>&1 | tail -5
  ok "Images built"
fi

# ── Step 4: Start containers ───────────────────────────────────────
step "4/7" "Starting containers"

$COMPOSE_CMD -f "$COMPOSE_FILE" up -d 2>&1
ok "Containers started"

# ── Step 5: Wait for health ────────────────────────────────────────
step "5/7" "Waiting for services to become healthy"

wait_for_health() {
  local service=$1
  local url=$2
  local max_wait=${3:-90}
  local elapsed=0

  while [ $elapsed -lt $max_wait ]; do
    if curl -sf "$url" > /dev/null 2>&1; then
      ok "$service is healthy (${elapsed}s)"
      return 0
    fi
    sleep 3
    elapsed=$((elapsed + 3))
    printf "  Waiting for %s... (%ds/%ds)\r" "$service" "$elapsed" "$max_wait"
  done

  fail "$service did not become healthy within ${max_wait}s"
  return 1
}

HEALTH_ERRORS=0
wait_for_health "Backend"  "http://localhost:3000/health" 120 || HEALTH_ERRORS=$((HEALTH_ERRORS + 1))
wait_for_health "Frontend" "http://localhost:80/health" 60           || HEALTH_ERRORS=$((HEALTH_ERRORS + 1))

if [ "$HEALTH_ERRORS" -gt 0 ]; then
  echo ""
  fail "Some services failed to start. Check logs:"
  echo "  $COMPOSE_CMD -f $COMPOSE_FILE logs --tail=50 backend"
  echo "  $COMPOSE_CMD -f $COMPOSE_FILE logs --tail=50 frontend"
  exit 1
fi

# ── Step 6: Seed admin account ─────────────────────────────────────
step "6/7" "Checking admin account"

ADMIN_EMAIL="${ADMIN_EMAIL:-admin@testops.local}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin123}"

# Try to register — if user already exists, the API returns 409 and we move on
REGISTER_RESULT=$(curl -sf -o /dev/null -w "%{http_code}" \
  -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\",\"name\":\"Admin\"}" \
  2>/dev/null || echo "000")

case "$REGISTER_RESULT" in
  200|201) ok "Admin account created: $ADMIN_EMAIL" ;;
  409)     ok "Admin account already exists" ;;
  *)       warn "Could not create admin account (HTTP $REGISTER_RESULT) — register manually" ;;
esac

# ── Step 7: Summary ────────────────────────────────────────────────
step "7/7" "Deployment complete"

# Get container statuses
echo ""
$COMPOSE_CMD -f "$COMPOSE_FILE" ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null \
  || $COMPOSE_CMD -f "$COMPOSE_FILE" ps

echo ""
echo -e "${GREEN}${BOLD}══════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  TestOps Copilot is running!         ${NC}"
echo -e "${GREEN}${BOLD}══════════════════════════════════════${NC}"
echo ""
echo -e "  ${BOLD}Frontend:${NC}  http://localhost"
echo -e "  ${BOLD}Backend:${NC}   http://localhost:3000"
echo -e "  ${BOLD}API Docs:${NC}  http://localhost:3000/api/docs"
echo -e "  ${BOLD}Health:${NC}    http://localhost:3000/health/full"
echo ""
echo -e "  ${BOLD}Login:${NC}     $ADMIN_EMAIL / $ADMIN_PASSWORD"
echo ""
echo -e "  ${YELLOW}Next steps:${NC}"
echo -e "    1. Open the frontend URL in your browser"
echo -e "    2. Log in with the credentials above"
echo -e "    3. Change the default password in Settings"
echo -e "    4. Configure integrations (GitHub, Jira, AI) in Settings"
echo ""
echo -e "  ${BOLD}Useful commands:${NC}"
echo -e "    Logs:      $COMPOSE_CMD -f $COMPOSE_FILE logs -f"
echo -e "    Stop:      $COMPOSE_CMD -f $COMPOSE_FILE down"
echo -e "    Restart:   $COMPOSE_CMD -f $COMPOSE_FILE restart"
echo -e "    Update:    git pull && ./scripts/deploy-prod.sh --rebuild"
echo -e "    Health:    ./scripts/health-check.sh"
echo ""
