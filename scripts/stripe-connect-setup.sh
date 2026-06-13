#!/bin/bash
# Stripe Connect setup for a specific MeloSong host (production VPS).
# Usage: ./stripe-connect-setup.sh [user_id] [connect_account_id]
set -euo pipefail
set -a
source /opt/soundly/.env
set +a

TARGET_USER_ID="${1:-user_1781025111633_ipv5l}"
REQUESTED_ACCT="${2:-${STRIPE_CONNECT_ACCOUNT_ID:-}}"
DEFAULT_ACCT="acct_1ThwQ2FsKQ6HX3Pk"
APP_BASE="${WEB_APP_URL:-https://getsoundy.com}"
APP_BASE="${APP_BASE%/}"

if [ -z "${STRIPE_SECRET_KEY:-}" ]; then
  echo "ERROR: STRIPE_SECRET_KEY missing in /opt/soundly/.env"
  exit 1
fi

stripe_get() {
  curl -sS "https://api.stripe.com/v1/accounts/${1}" -u "${STRIPE_SECRET_KEY}:"
}

stripe_post() {
  curl -sS -X POST "$1" -u "${STRIPE_SECRET_KEY}:" "${@:2}"
}

echo "=== Target user ==="
psql "$DATABASE_URL" -t -A -F'|' -c "
SELECT id, username, email,
       payload->>'role' AS role,
       payload->>'age' AS age,
       payload->>'stripeConnectAccountId' AS connect
FROM users
WHERE id = '${TARGET_USER_ID}';
" || { echo "ERROR: user ${TARGET_USER_ID} not found"; exit 1; }

EXISTING_CONNECT=$(psql "$DATABASE_URL" -t -A -c "
SELECT COALESCE(payload->>'stripeConnectAccountId','')
FROM users WHERE id = '${TARGET_USER_ID}';
" | tr -d '[:space:]')

ACCT_ID=""
if [ -n "$REQUESTED_ACCT" ]; then
  ACCT_ID="$REQUESTED_ACCT"
  echo "Using requested Connect account: $ACCT_ID"
elif [ -n "$EXISTING_CONNECT" ]; then
  ACCT_ID="$EXISTING_CONNECT"
  echo "Using existing Connect account on user: $ACCT_ID"
else
  # Prefer known account before creating a new one
  CHECK=$(stripe_get "$DEFAULT_ACCT")
  DEFAULT_OK=$(echo "$CHECK" | python3 -c "import sys,json; d=json.load(sys.stdin); print('yes' if d.get('id') else 'no')")
  if [ "$DEFAULT_OK" = "yes" ]; then
    ACCT_ID="$DEFAULT_ACCT"
    echo "Using default Connect account: $ACCT_ID"
  else
    echo "=== Create Express Connect account ==="
    ACCT_JSON=$(stripe_post https://api.stripe.com/v1/accounts \
      -d type=express \
      -d country=FR \
      -d email=valentin.goulven@gmail.com \
      -d "capabilities[card_payments][requested]=true" \
      -d "capabilities[transfers][requested]=true" \
      -d "metadata[melosongUserId]=${TARGET_USER_ID}")
    ACCT_ID=$(echo "$ACCT_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))")
    ERR=$(echo "$ACCT_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('error',{}).get('message',''))")
    if [ -z "$ACCT_ID" ]; then
      echo "CREATE_FAILED: $ERR"
      echo "$ACCT_JSON"
      exit 1
    fi
    echo "CREATED: $ACCT_ID"
  fi
fi

echo "=== Stripe account status ==="
ACCT_JSON=$(stripe_get "$ACCT_ID")
python3 - <<'PY' "$ACCT_JSON"
import json, sys
d = json.loads(sys.argv[1])
if d.get("error"):
    print(f"STRIPE_ERROR: {d['error'].get('message')}")
    sys.exit(1)
print(f"id={d.get('id')} type={d.get('type')} charges_enabled={d.get('charges_enabled')} payouts_enabled={d.get('payouts_enabled')}")
req = d.get("requirements") or {}
print(f"currently_due={req.get('currently_due')}")
print(f"disabled_reason={req.get('disabled_reason')}")
PY

CHARGES=$(echo "$ACCT_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('charges_enabled', False))")

ONBOARDING_URL=""
if [ "$CHARGES" != "True" ]; then
  echo "=== Express onboarding required (charges_enabled=false) ==="
  LINK_JSON=$(stripe_post https://api.stripe.com/v1/account_links \
    -d "account=${ACCT_ID}" \
    -d "refresh_url=${APP_BASE}/profile?stripeConnect=refresh" \
    -d "return_url=${APP_BASE}/profile?stripeConnect=return" \
    -d type=account_onboarding)
  ONBOARDING_URL=$(echo "$LINK_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('url',''))")
  LINK_ERR=$(echo "$LINK_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('error',{}).get('message',''))")
  if [ -z "$ONBOARDING_URL" ]; then
    echo "ACCOUNT_LINK_FAILED: $LINK_ERR"
    echo "$LINK_JSON"
  else
    echo ""
    echo ">>> ONBOARDING URL (open in browser as Val) <<<"
    echo "$ONBOARDING_URL"
    echo ""
  fi
fi

echo "=== Stop backend before direct DB patch (avoid persist overwrite on reload) ==="
pm2 stop melosong-backend >/dev/null 2>&1 || true
sleep 2

echo "=== Persist stripeConnectAccountId on target user (full payload merge) ==="
psql "$DATABASE_URL" -c "
UPDATE users
SET payload = COALESCE(payload, '{}'::jsonb) || jsonb_build_object('stripeConnectAccountId', '${ACCT_ID}')
WHERE id = '${TARGET_USER_ID}';
"

echo "=== Verify DB payload ==="
psql "$DATABASE_URL" -t -A -F'|' -c "
SELECT id, username, payload->>'stripeConnectAccountId'
FROM users WHERE id = '${TARGET_USER_ID}';
"

echo "=== Start backend (fresh PostgreSQL load) ==="
pm2 start melosong-backend --update-env >/dev/null 2>&1 || pm2 restart melosong-backend --update-env >/dev/null 2>&1 || true
sleep 5

echo "=== Active lives for host (payload.title, not column) ==="
psql "$DATABASE_URL" -t -A -F'|' -c "
SELECT id, host_id, is_active, payload->>'title' AS title
FROM lives
WHERE host_id = '${TARGET_USER_ID}' AND is_active = true
LIMIT 5;
"

echo "=== Summary ==="
echo "user=${TARGET_USER_ID} acct=${ACCT_ID} charges_enabled=${CHARGES}"
if [ -n "$ONBOARDING_URL" ]; then
  echo "ACTION_REQUIRED: Complete Express onboarding at URL above, then re-run stripe-donation-verify.sh"
fi
echo "DONE"
