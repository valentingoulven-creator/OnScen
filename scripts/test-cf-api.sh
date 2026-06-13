#!/bin/bash
set -euo pipefail
ENV_FILE="${1:-/opt/soundly/.env}"
ACCOUNT=$(grep '^CLOUDFLARE_ACCOUNT_ID=' "$ENV_FILE" | cut -d= -f2-)
TOKEN=$(grep '^CLOUDFLARE_STREAM_API_TOKEN=' "$ENV_FILE" | cut -d= -f2-)
SUBDOMAIN=$(grep '^CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN=' "$ENV_FILE" | cut -d= -f2-)

echo "account_id_set: $([ -n "$ACCOUNT" ] && echo yes || echo no)"
echo "token_set: $([ -n "$TOKEN" ] && echo yes || echo no)"
echo "subdomain_set: $([ -n "$SUBDOMAIN" ] && echo yes || echo no)"

RESP=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  -H "Authorization: Bearer $TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/stream/live_inputs?per_page=3")

HTTP_CODE=$(echo "$RESP" | tail -1 | cut -d: -f2)
BODY=$(echo "$RESP" | sed '$d')

echo "list_http: $HTTP_CODE"
echo "$BODY" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print('success:', d.get('success'))
errs = d.get('errors') or []
if errs:
    print('errors:', [e.get('message') for e in errs[:3]])
items = d.get('result') or []
print('count:', len(items))
for i in items[:2]:
    print('  uid:', i.get('uid'), 'name:', (i.get('meta') or {}).get('name'))
"

# Test create (then delete)
CREATE_RESP=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"meta":{"name":"Soundy API test"},"recording":{"mode":"automatic"},"preferLowLatency":true}' \
  "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/stream/live_inputs")

CREATE_HTTP=$(echo "$CREATE_RESP" | tail -1 | cut -d: -f2)
CREATE_BODY=$(echo "$CREATE_RESP" | sed '$d')
echo "create_http: $CREATE_HTTP"
UID=$(echo "$CREATE_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('result',{}).get('uid','') if d.get('success') else 'FAIL:'+str(d.get('errors')))")
echo "create_uid: $UID"

if [ -n "$UID" ] && [ "${UID#FAIL:}" = "$UID" ]; then
  DEL_HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE \
    -H "Authorization: Bearer $TOKEN" \
    "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/stream/live_inputs/${UID}")
  echo "delete_http: $DEL_HTTP"
fi
