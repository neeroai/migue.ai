#!/bin/bash

# Comprehensive API testing script
# Usage: ./test-all-endpoints.sh

set -e

# Load environment variables from .env if it exists
if [ -f "../../.env" ]; then
  export $(grep -v '^#' ../../.env | xargs)
fi

BASE_URL="${BASE_URL:-http://localhost:3000}"
VERIFY_TOKEN="${WHATSAPP_VERIFY_TOKEN:-TEST_TOKEN}"

echo "🧪 migue.ai - API Testing Suite"
echo "================================="
echo "Base URL: $BASE_URL"
echo ""
echo "🧹 Cleaning up previous test data..."
# Close any active test conversations
curl -s -X POST "${BASE_URL}/api/test/cleanup" >/dev/null 2>&1 || echo "  (cleanup endpoint not available - skipping)"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

test_endpoint() {
  local name="$1"
  local method="$2"
  local url="$3"
  local data="$4"
  local expected_status="${5:-200}"

  echo -n "Testing: $name... "

  if [ "$method" = "GET" ]; then
    response=$(curl -s -w "\n%{http_code}" "$url")
  else
    response=$(curl -s -w "\n%{http_code}" -X "$method" "$url" -H "Content-Type: application/json" -d "$data")
  fi

  status=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')

  if [ "$status" = "$expected_status" ]; then
    echo -e "${GREEN}✓ PASS${NC} (Status: $status)"
    TESTS_PASSED=$((TESTS_PASSED + 1))
    return 0
  else
    echo -e "${RED}✗ FAIL${NC} (Expected: $expected_status, Got: $status)"
    echo "Response: $body"
    TESTS_FAILED=$((TESTS_FAILED + 1))
    return 1
  fi
}

echo "📋 Phase 1: Webhook Verification"
echo "---------------------------------"
test_endpoint \
  "GET /api/whatsapp/webhook (verify)" \
  "GET" \
  "${BASE_URL}/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=test123" \
  "" \
  "200"

test_endpoint \
  "GET /api/whatsapp/webhook (invalid token)" \
  "GET" \
  "${BASE_URL}/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=WRONG&hub.challenge=test123" \
  "" \
  "401"

echo ""
echo "📋 Phase 2: Webhook Messages"
echo "-----------------------------"

# Test text message
if [ -f "webhook-payload.json" ]; then
  test_endpoint \
    "POST /api/whatsapp/webhook (text message)" \
    "POST" \
    "${BASE_URL}/api/whatsapp/webhook" \
    "@webhook-payload.json" \
    "200"
else
  echo -e "${YELLOW}⊘ SKIP${NC} - webhook-payload.json not found"
fi

# Test audio message
if [ -f "webhook-audio.json" ]; then
  test_endpoint \
    "POST /api/whatsapp/webhook (audio message)" \
    "POST" \
    "${BASE_URL}/api/whatsapp/webhook" \
    "@webhook-audio.json" \
    "200"
else
  echo -e "${YELLOW}⊘ SKIP${NC} - webhook-audio.json not found"
fi

# Test interactive message
if [ -f "webhook-interactive.json" ]; then
  test_endpoint \
    "POST /api/whatsapp/webhook (interactive)" \
    "POST" \
    "${BASE_URL}/api/whatsapp/webhook" \
    "@webhook-interactive.json" \
    "200"
else
  echo -e "${YELLOW}⊘ SKIP${NC} - webhook-interactive.json not found"
fi

# Test invalid payload
test_endpoint \
  "POST /api/whatsapp/webhook (invalid payload)" \
  "POST" \
  "${BASE_URL}/api/whatsapp/webhook" \
  '{"invalid":"payload"}' \
  "400"

echo ""
echo "📋 Phase 3: Cron Endpoints"
echo "--------------------------"

test_endpoint \
  "GET /api/cron/check-reminders" \
  "GET" \
  "${BASE_URL}/api/cron/check-reminders" \
  "" \
  "200"

test_endpoint \
  "GET /api/cron/follow-ups" \
  "GET" \
  "${BASE_URL}/api/cron/follow-ups" \
  "" \
  "200"

echo ""
echo "================================="
echo "📊 Test Results"
echo "================================="
echo -e "${GREEN}✓ Passed: $TESTS_PASSED${NC}"
echo -e "${RED}✗ Failed: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}🎉 All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}❌ Some tests failed${NC}"
  exit 1
fi
