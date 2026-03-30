#!/bin/bash
#
# TestOps Copilot — Health Check
#
# Quick verification that all services are running and healthy.
# Usage: ./scripts/health-check.sh [HOST]
#
set -euo pipefail

HOST="${1:-localhost}"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${BOLD}TestOps Copilot — Health Check${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

PASS=0
FAIL=0

check() {
  local name=$1
  local url=$2

  STATUS=$(curl -sf -o /dev/null -w "%{http_code}" --max-time 5 "$url" 2>/dev/null || echo "000")
  if [ "$STATUS" = "200" ]; then
    echo -e "  ${GREEN}✓${NC} $name ($url)"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} $name ($url) — HTTP $STATUS"
    FAIL=$((FAIL + 1))
  fi
}

check "Frontend"        "http://${HOST}:80/health"
check "Backend (basic)" "http://${HOST}:3000/health"
check "Backend (ready)" "http://${HOST}:3000/health/ready"
check "Backend (alive)" "http://${HOST}:3000/health/alive"

# Full health shows service details
echo ""
echo -e "${BOLD}Service Details:${NC}"
FULL=$(curl -sf --max-time 5 "http://${HOST}:3000/health/full" 2>/dev/null || echo '{"error":"unreachable"}')
echo "$FULL" | python3 -m json.tool 2>/dev/null || echo "$FULL" | node -e "
  let d='';process.stdin.on('data',c=>d+=c);
  process.stdin.on('end',()=>{try{console.log(JSON.stringify(JSON.parse(d),null,2))}catch(e){console.log(d)}})
" 2>/dev/null || echo "$FULL"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✓ $PASS passed${NC}  ${RED}✗ $FAIL failed${NC}"

if [ "$FAIL" -gt 0 ]; then
  echo -e "\n${RED}${BOLD}Some services are unhealthy.${NC} Check:"
  echo "  docker compose -f docker-compose.prod.yml logs --tail=50"
  exit 1
else
  echo -e "\n${GREEN}${BOLD}All services healthy!${NC}"
fi
