#!/bin/bash
set -eu
set -a
source /opt/onscen/.env
set +a
API_BASE="http://127.0.0.1:3000/api"
DONOR_ID="user_1781027715573_dtyhk"
LIVE_ID="live_stripe_test_1781371257"

TOKEN=$(cd /opt/onscen && node -e "
const jwt = require('jsonwebtoken');
console.log(jwt.sign({ id: '${DONOR_ID}', username: 'keval' }, process.env.JWT_SECRET, { expiresIn: '1h' }));
")

echo "Token for keval OK"
curl -sS -X POST "${API_BASE}/donations/create-intent" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{\"liveId\":\"${LIVE_ID}\",\"amount\":5,\"ageConfirmed\":true}" | python3 -m json.tool
