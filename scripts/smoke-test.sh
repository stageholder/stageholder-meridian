#!/bin/bash
set -e

API_URL="${API_URL:-http://localhost:4000}"
PWA_URL="${PWA_URL:-http://localhost:3000}"
PASS=0
FAIL=0

check() {
  local name="$1"
  if eval "$2" > /dev/null 2>&1; then
    echo "  PASS: $name"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $name"
    FAIL=$((FAIL + 1))
  fi
}

echo "Meridian Smoke Test"
echo "==================="
echo ""

echo "1. Health checks"
check "API health" "curl -sf $API_URL/health | grep -q ok"
check "PWA loads" "curl -sf $PWA_URL | grep -q Meridian"

echo ""
echo "2. Auth flow"
EMAIL="smoke-$(date +%s)@test.com"
REGISTER_RES=$(curl -sf -X POST "$API_URL/api/v1/auth/register" \
  -H 'Content-Type: application/json' \
  -H 'X-Auth-Strategy: bearer' \
  -d "{\"name\":\"Smoke Test\",\"email\":\"$EMAIL\",\"password\":\"smoketest123\"}" 2>/dev/null || echo '{}')
TOKEN=$(echo "$REGISTER_RES" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
check "Register user" "[ -n '$TOKEN' ]"

LOGIN_RES=$(curl -sf -X POST "$API_URL/api/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -H 'X-Auth-Strategy: bearer' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"smoketest123\"}" 2>/dev/null || echo '{}')
LOGIN_TOKEN=$(echo "$LOGIN_RES" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
check "Login user" "[ -n '$LOGIN_TOKEN' ]"

if [ -n "$TOKEN" ]; then
  echo ""
  echo "3. Workspace operations"
  WS_RES=$(curl -sf -X POST "$API_URL/api/v1/workspaces" \
    -H 'Content-Type: application/json' \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"name":"Smoke Workspace"}' 2>/dev/null || echo '{}')
  WS_ID=$(echo "$WS_RES" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  check "Create workspace" "[ -n '$WS_ID' ]"

  if [ -n "$WS_ID" ]; then
    check "Get workspace" "curl -sf -H 'Authorization: Bearer $TOKEN' $API_URL/api/v1/workspaces/$WS_ID | grep -q '$WS_ID'"
  fi
fi

echo ""
echo "4. Auth edge cases"
check "Refresh without token returns 401" "curl -sf -o /dev/null -w '%{http_code}' -X POST $API_URL/api/v1/auth/refresh | grep -q 401"

echo ""
echo "==================="
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] && echo "All checks passed!" || exit 1
