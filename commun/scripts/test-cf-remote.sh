#!/bin/bash
ACCOUNT=$(grep '^CLOUDFLARE_ACCOUNT_ID=' /opt/onscen/.env | cut -d= -f2-)
TOKEN=$(grep '^CLOUDFLARE_STREAM_API_TOKEN=' /opt/onscen/.env | cut -d= -f2-)
curl -s -H "Authorization: Bearer $TOKEN" "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT/stream/live_inputs?per_page=1" | python3 -c "import sys,json; d=json.load(sys.stdin); print('success:', d.get('success')); print('errors:', d.get('errors')); print('count:', len(d.get('result',[])))"
CREATE=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"meta":{"name":"OnScen test"},"recording":{"mode":"automatic"}}' "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT/stream/live_inputs")
echo "$CREATE" | python3 -c "import sys,json; d=json.load(sys.stdin); print('create_success:', d.get('success')); uid=d.get('result',{}).get('uid'); print('uid:', uid); print('create_errors:', d.get('errors')); import os; open('/tmp/cf_uid','w').write(uid or '')"
UID=$(cat /tmp/cf_uid 2>/dev/null)
if [ -n "$UID" ]; then
  DEL=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE -H "Authorization: Bearer $TOKEN" "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT/stream/live_inputs/$UID")
  echo "delete_http: $DEL"
fi
