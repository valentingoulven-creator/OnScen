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
gunzip -c "$FILE" | psql "$URL"
echo "OK — restore staging terminé"
