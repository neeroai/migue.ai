#!/bin/bash

# Test WhatsApp webhook with HMAC signature validation
# Usage: ./test-webhook-signature.sh [payload-file]

PAYLOAD_FILE="${1:-webhook-payload.json}"
SECRET="${WHATSAPP_APP_SECRET:-your_whatsapp_app_secret}"
URL="http://localhost:3000/api/whatsapp/webhook"

if [ ! -f "$PAYLOAD_FILE" ]; then
  echo "❌ Payload file not found: $PAYLOAD_FILE"
  exit 1
fi

# Read payload
PAYLOAD=$(cat "$PAYLOAD_FILE")

# Generate HMAC-SHA256 signature
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | sed 's/^.* //')

echo "🔐 Testing webhook with HMAC signature validation"
echo "📄 Payload file: $PAYLOAD_FILE"
echo "🔑 Signature: sha256=$SIGNATURE"
echo ""

# Send request with signature
curl -X POST "$URL" \
  -H "Content-Type: application/json" \
  -H "x-hub-signature-256: sha256=$SIGNATURE" \
  -d "$PAYLOAD" \
  -w "\n\n📊 HTTP Status: %{http_code}\n" \
  -s

echo ""
echo "✅ Test completed"
