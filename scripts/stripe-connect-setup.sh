#!/bin/bash
set -euo pipefail
set -a
source /opt/soundly/.env
set +a

echo "=== Users (Val / admin) ==="
psql "$DATABASE_URL" -t -A -F'|' -c "
SELECT id, username, email,
       payload->>'role' AS role,
       payload->>'stripeConnectAccountId' AS connect
FROM users
WHERE username ILIKE '%val%'
   OR payload->>'role' = 'admin'
ORDER BY username
LIMIT 10;
"

echo "=== Create Express Connect account ==="
ACCT_JSON=$(curl -sS -X POST https://api.stripe.com/v1/accounts \
  -u "${STRIPE_SECRET_KEY}:" \
  -d type=express \
  -d country=FR \
  -d email=val-test-host@getsoundy.com \
  -d "capabilities[card_payments][requested]=true" \
  -d "capabilities[transfers][requested]=true" \
  -d "metadata[melosongUser]=test-host-val")

ACCT_ID=$(echo "$ACCT_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))")
ERR=$(echo "$ACCT_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('error',{}).get('message',''))")

if [ -z "$ACCT_ID" ]; then
  echo "CREATE_FAILED: $ERR"
  echo "$ACCT_JSON"
  exit 1
fi
echo "CREATED: $ACCT_ID"

echo "=== Complete test onboarding (Stripe test helpers) ==="
UPD=$(curl -sS -X POST "https://api.stripe.com/v1/accounts/${ACCT_ID}" \
  -u "${STRIPE_SECRET_KEY}:" \
  -d business_type=individual \
  -d "individual[first_name]=Val" \
  -d "individual[last_name]=TestHost" \
  -d "individual[email]=val-test-host@getsoundy.com" \
  -d "individual[dob][day]=1" \
  -d "individual[dob][month]=1" \
  -d "individual[dob][year]=1990" \
  -d "individual[address][line1]=1 rue Test" \
  -d "individual[address][city]=Paris" \
  -d "individual[address][postal_code]=75001" \
  -d "individual[address][country]=FR" \
  -d "tos_acceptance[date]=$(date +%s)" \
  -d "tos_acceptance[ip]=127.0.0.1" \
  -d "external_account[object]=bank_account" \
  -d "external_account[country]=FR" \
  -d "external_account[currency]=eur" \
  -d "external_account[account_number]=FR1420041010050500013M02606")

CHARGES=$(echo "$UPD" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('charges_enabled', d.get('error',{}).get('message','?')))")
PAYOUTS=$(echo "$UPD" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('payouts_enabled','?'))")
echo "charges_enabled=$CHARGES payouts_enabled=$PAYOUTS"

echo "=== Set stripeConnectAccountId on first Val/admin without connect ==="
TARGET=$(psql "$DATABASE_URL" -t -A -c "
SELECT id FROM users
WHERE (username ILIKE '%val%' OR payload->>'role' = 'admin')
  AND COALESCE(payload->>'stripeConnectAccountId','') = ''
ORDER BY CASE WHEN username ILIKE '%val%' THEN 0 ELSE 1 END, username
LIMIT 1;
" | tr -d '[:space:]')

if [ -z "$TARGET" ]; then
  TARGET=$(psql "$DATABASE_URL" -t -A -c "
SELECT id FROM users
WHERE username ILIKE '%val%' OR payload->>'role' = 'admin'
ORDER BY CASE WHEN username ILIKE '%val%' THEN 0 ELSE 1 END, username
LIMIT 1;
" | tr -d '[:space:]')
fi

if [ -z "$TARGET" ]; then
  echo "NO_TARGET_USER"
  exit 1
fi

echo "TARGET_USER: $TARGET"
psql "$DATABASE_URL" -c "
UPDATE users
SET payload = jsonb_set(payload, '{stripeConnectAccountId}', to_jsonb('${ACCT_ID}'::text), true)
WHERE id = '${TARGET}';
"

echo "=== Verify user connect id ==="
psql "$DATABASE_URL" -t -A -F'|' -c "
SELECT id, username, payload->>'stripeConnectAccountId'
FROM users WHERE id = '${TARGET}';
"

echo "=== Reload backend to pick up DB changes ==="
pm2 reload melosong-backend --update-env >/dev/null 2>&1 || true
sleep 4

echo "=== Active live for host (if any) ==="
psql "$DATABASE_URL" -t -A -F'|' -c "
SELECT id, title, host_id FROM lives
WHERE is_active = true AND host_id = '${TARGET}'
LIMIT 3;
"

echo "DONE acct=$ACCT_ID user=$TARGET"
