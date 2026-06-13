#!/bin/bash
# Verify donation create-intent on production VPS (after Connect + host setup).
set -eu
set -a
source /opt/soundly/.env
set +a

HOST_USER_ID="${1:-user_1781025111633_ipv5l}"
API_BASE="${API_BASE:-http://127.0.0.1:3000/api}"
LIVE_ID="${2:-}"

echo "=== Donations config ==="
curl -sS "${API_BASE}/donations/config" | python3 -m json.tool | head -20

echo "=== Ensure test live for host ==="
if [ -z "$LIVE_ID" ]; then
  LIVE_ID="live_stripe_test_$(date +%s)"
  NOW=$(date +%s%3N)
  PAYLOAD=$(cat <<EOF
{"id":"${LIVE_ID}","hostId":"${HOST_USER_ID}","hostName":"Val","title":"Stripe Connect test live","platform":"spotify","playbackState":"playing","latitude":48.8566,"longitude":2.3522,"blurredLatitude":48.86,"blurredLongitude":2.35,"viewersCount":0,"isActive":true,"startedAt":${NOW}}
EOF
)
  psql "$DATABASE_URL" -c "
INSERT INTO lives (id, host_id, started_at, is_active, latitude, longitude, payload)
VALUES ('${LIVE_ID}', '${HOST_USER_ID}', ${NOW}, true, 48.8566, 2.3522, '${PAYLOAD}'::jsonb)
ON CONFLICT (id) DO UPDATE SET is_active = true, payload = EXCLUDED.payload;
"
  echo "Created/updated live: ${LIVE_ID}"
  pm2 reload melosong-backend --update-env >/dev/null 2>&1 || true
  sleep 4
fi

echo "=== Donor JWT (synthetic test user) ==="
DONOR_ID="user_stripe_donor_test"
DONOR_PAYLOAD='{"id":"user_stripe_donor_test","username":"DonorTest","email":"donor-test@getsoundy.com","age":25,"memberSince":1700000000000}'
psql "$DATABASE_URL" -c "
INSERT INTO users (id, email, username, payload)
VALUES ('${DONOR_ID}', 'donor-test@getsoundy.com', 'DonorTest', '${DONOR_PAYLOAD}'::jsonb)
ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload;
" >/dev/null
pm2 reload melosong-backend --update-env >/dev/null 2>&1 || true
sleep 4

TOKEN=$(cd /opt/soundly && node -e "
const jwt = require('jsonwebtoken');
const secret = process.env.JWT_SECRET;
if (!secret) { console.error('JWT_SECRET missing'); process.exit(1); }
console.log(jwt.sign({ id: '${DONOR_ID}', username: 'DonorTest' }, secret, { expiresIn: '1h' }));
")

echo "=== POST /donations/create-intent (5 EUR) ==="
RESP=$(curl -sS -w '\nHTTP:%{http_code}' -X POST "${API_BASE}/donations/create-intent" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{\"liveId\":\"${LIVE_ID}\",\"amount\":5,\"ageConfirmed\":true}")

HTTP=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
echo "$HTTP"

CODE=$(echo "$HTTP" | cut -d: -f2)
if [ "$CODE" = "201" ]; then
  echo "PASS: PaymentIntent created (no CREATOR_STRIPE_CONNECT_REQUIRED)"
elif echo "$BODY" | grep -q CREATOR_STRIPE_CONNECT_REQUIRED; then
  echo "BLOCKED: Host missing stripeConnectAccountId"
elif echo "$BODY" | grep -q 'signed up for Connect'; then
  echo "BLOCKED: Platform Connect not enabled on Stripe account"
else
  echo "RESULT: see response above"
fi
