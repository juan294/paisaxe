#!/bin/bash
set -a
[ -f .env.local ] && source .env.local
set +a

echo "=== ELEVENLABS SUBSCRIPTION ==="
curl -sS -H "xi-api-key: $ELEVENLABS_API_KEY" "https://api.elevenlabs.io/v1/user/subscription"
echo ""
echo "=== ELEVENLABS CONVERSATIONS (last 20) ==="
curl -sS -H "xi-api-key: $ELEVENLABS_API_KEY" "https://api.elevenlabs.io/v1/convai/conversations?page_size=20"
echo ""
echo "=== TWILIO BALANCE ==="
curl -sS -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/Balance.json"
echo ""
