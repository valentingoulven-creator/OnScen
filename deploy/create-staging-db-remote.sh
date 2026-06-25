#!/usr/bin/env bash
set -euo pipefail
set -a
source /opt/soundly/.env
set +a
echo "DB_HOST_CHECK start"
timeout 20 psql "$DATABASE_URL" -Atc "SELECT current_database()" || echo "PSQL_FAIL"
ADMIN_URL="${DATABASE_URL//\/soundy-prod/\/postgres}"
ADMIN_URL="${ADMIN_URL//\/soundy\?/\/postgres?}"
EXISTS=$(timeout 20 psql "$ADMIN_URL" -Atc "SELECT 1 FROM pg_database WHERE datname='soundy_staging'" 2>/dev/null || echo "")
if [ "$EXISTS" = "1" ]; then
  echo "DB_EXISTS_OK"
else
  timeout 20 psql "$ADMIN_URL" -c "CREATE DATABASE soundy_staging;" && echo "DB_CREATED_OK"
fi
