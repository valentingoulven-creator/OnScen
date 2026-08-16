#!/usr/bin/env bash
# Restaure un dump pg_dump vers la base STAGING uniquement.
# Refuse prod. Usage :
#   CONFIRM=I_UNDERSTAND_STAGING \
#   DATABASE_URL_STAGING='postgres://…/onscen_staging' \
#   bash commun/deploy/restore-db-staging.sh /opt/onscen/backups/onscen-YYYYMMDD.sql.gz
set -euo pipefail

if [[ "${CONFIRM:-}" != "I_UNDERSTAND_STAGING" ]]; then
  echo "Refus — définir CONFIRM=I_UNDERSTAND_STAGING" >&2
  exit 1
fi

FILE="${1:-}"
if [[ -z "$FILE" || ! -f "$FILE" ]]; then
  echo "Usage: CONFIRM=I_UNDERSTAND_STAGING DATABASE_URL_STAGING=… $0 dump.sql.gz" >&2
  exit 1
fi

URL="${DATABASE_URL_STAGING:-}"
if [[ -z "$URL" ]]; then
  echo "Refus — DATABASE_URL_STAGING manquant" >&2
  exit 1
fi

if echo "$URL" | grep -qiE 'onscen-prod|onscen_prod|/onscen[^-_]'; then
  echo "Refus — l’URL ressemble à la prod" >&2
  exit 1
fi

if ! echo "$URL" | grep -qi 'staging'; then
  echo "Refus — DATABASE_URL_STAGING doit contenir « staging »" >&2
  exit 1
fi

if ! gzip -t "$FILE" 2>/dev/null; then
  echo "ERREUR — archive gzip corrompue" >&2
  exit 1
fi

echo "Restore staging depuis $FILE"
echo "Drop schema public (staging uniquement)…"
psql "$URL" -v ON_ERROR_STOP=1 -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO CURRENT_USER; GRANT ALL ON SCHEMA public TO public;"

# spatial_ref_sys (PostGIS) est souvent non insérable par le rôle applicatif —
# on n'arrête pas le restore pour cette table système.
set +e
gunzip -c "$FILE" | psql "$URL" -v ON_ERROR_STOP=0
psql_rc=${PIPESTATUS[1]}
set -e

users=$(psql "$URL" -tAc "SELECT COUNT(*) FROM users" | tr -d '[:space:]')
if ! [[ "$users" =~ ^[0-9]+$ ]] || [[ "$users" -lt 1 ]]; then
  echo "ERREUR — table users absente ou vide après restore (count=${users:-?})" >&2
  exit 1
fi

echo "OK — restore staging terminé (users=$users, psql_rc=${psql_rc:-0})"
