#!/usr/bin/env bash
# setup-staging-db.sh — Cree la base soundy_staging sur PostgreSQL Scaleway (depuis VPS prod)
# Usage (sur VPS prod avec acces DATABASE_URL) :
#   bash /opt/soundly/deploy/setup-staging-db.sh
#   STAGING_VPS_IP=51.159.170.181 bash setup-staging-db.sh
set -euo pipefail

ENV_FILE="${ENV_FILE:-/opt/soundy/.env}"
STAGING_DB="${STAGING_DB:-soundy_staging}"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERREUR : DATABASE_URL absent" >&2
  exit 1
fi

# Connexion admin via base postgres ou soundy existante
ADMIN_URL="${DATABASE_URL}"
ADMIN_URL="${ADMIN_URL//\/soundy?/\/postgres?}"
ADMIN_URL="${ADMIN_URL//\/soundy-prod?/\/postgres?}"
ADMIN_URL="${ADMIN_URL//\/soundy\?/\/postgres?}"

echo ">> Verification base $STAGING_DB..."
EXISTS=$(psql "$ADMIN_URL" -Atc "SELECT 1 FROM pg_database WHERE datname='${STAGING_DB}'" 2>/dev/null || echo "")

if [[ "$EXISTS" == "1" ]]; then
  echo "OK base $STAGING_DB deja presente"
else
  echo ">> Creation base $STAGING_DB..."
  psql "$ADMIN_URL" -c "CREATE DATABASE ${STAGING_DB} OWNER soundy;" 2>/dev/null \
    || psql "$ADMIN_URL" -c "CREATE DATABASE ${STAGING_DB};"
  echo "OK base $STAGING_DB creee"
fi

echo ""
echo "IMPORTANT : ajouter l IP du VPS staging dans Scaleway Allowed IPs (51.159.170.181/32)"
echo "Puis sur le VPS staging, DATABASE_URL doit pointer vers .../${STAGING_DB}?sslmode=require"
echo "SETUP_STAGING_DB_OK"
