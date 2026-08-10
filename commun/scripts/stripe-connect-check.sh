#!/bin/bash
# Check Stripe Connect state for a host on production VPS.
set -eu
set -a
source /opt/onscen/.env
set +a

USER_ID="${1:-user_1781025111633_ipv5l}"

echo "=== Env (donations) ==="
echo "DONATIONS_ENABLED=${DONATIONS_ENABLED:-unset}"
echo "STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY:+set}"
echo "STRIPE_PUBLISHABLE_KEY=${STRIPE_PUBLISHABLE_KEY:+set}"

echo "=== User ==="
psql "$DATABASE_URL" -t -A -F'|' -c "
SELECT id, username, email, payload->>'age', payload->>'stripeConnectAccountId'
FROM users WHERE id = '${USER_ID}';
"

CONNECT_ID=$(psql "$DATABASE_URL" -t -A -c "
SELECT COALESCE(payload->>'stripeConnectAccountId','')
FROM users WHERE id = '${USER_ID}';
" | tr -d '[:space:]')

if [ -n "$CONNECT_ID" ] && [ -n "${STRIPE_SECRET_KEY:-}" ]; then
  echo "=== Stripe account ==="
  curl -sS "https://api.stripe.com/v1/accounts/${CONNECT_ID}" -u "${STRIPE_SECRET_KEY}:" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(f\"id={d.get('id')} charges_enabled={d.get('charges_enabled')} payouts_enabled={d.get('payouts_enabled')} details_submitted={d.get('details_submitted')}\")"
fi

echo "=== Active lives for user ==="
psql "$DATABASE_URL" -t -A -F'|' -c "
SELECT id, host_id, is_active, payload->>'title' AS title
FROM lives
WHERE host_id = '${USER_ID}' AND is_active = true LIMIT 5;
"

echo "=== Any active live (fallback) ==="
psql "$DATABASE_URL" -t -A -F'|' -c "
SELECT l.id, l.host_id, u.username, u.payload->>'stripeConnectAccountId', l.payload->>'title'
FROM lives l JOIN users u ON u.id = l.host_id
WHERE l.is_active = true LIMIT 5;
"
