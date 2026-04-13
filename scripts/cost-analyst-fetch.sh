#!/bin/bash
set -a
source "$(dirname "$0")/../.env.local"
set +a

echo "=== ELEVENLABS SUBSCRIPTION ==="
curl -s -H "xi-api-key: $ELEVENLABS_API_KEY" "https://api.elevenlabs.io/v1/user/subscription" | python3 -m json.tool 2>/dev/null || echo "FAILED"

echo ""
echo "=== ELEVENLABS CONVERSATIONS ==="
curl -s -H "xi-api-key: $ELEVENLABS_API_KEY" "https://api.elevenlabs.io/v1/convai/conversations?page_size=20" | python3 -m json.tool 2>/dev/null || echo "FAILED"

echo ""
echo "=== TWILIO BALANCE ==="
curl -s -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/Balance.json" | python3 -m json.tool 2>/dev/null || echo "FAILED"

echo ""
echo "=== TWILIO USAGE ==="
curl -s -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/Usage/Records/ThisMonth.json" | python3 -c "
import sys,json
data=json.load(sys.stdin)
records=data.get('usage_records',[])
nonzero=[r for r in records if float(r.get('price','0'))>0 or float(r.get('usage','0'))>0]
for r in nonzero:
    print(f\"{r['category']}: usage={r['usage']} {r.get('usage_unit','')}, price={r['price']}\")
print(f'Total records: {len(records)}, non-zero: {len(nonzero)}')
" 2>/dev/null || echo "FAILED"
