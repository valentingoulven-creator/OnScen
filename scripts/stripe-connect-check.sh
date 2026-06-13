#!/bin/bash
set -eu
set -a
source /opt/soundly/.env
set +a

USER_ID="${1:-user_1781025111633_ipv5l}"

echo "=== User ==="
psql "$DATABASE_URL" -t -A -F'|' -c "
SELECT id, username, email, payload->>'age', payload->>'stripeConnectAccountId'
FROM users WHERE id = '${USER_ID}';
"

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
