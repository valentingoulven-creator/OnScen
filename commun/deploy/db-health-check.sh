#!/usr/bin/env bash
# db-health-check.sh — Vérifie PostgreSQL + contenu critique + sauvegardes récentes
# Usage (VPS) :
#   set -a && source /opt/onscen/.env && set +a
#   bash /opt/onscen/deploy/db-health-check.sh
# Usage (local via API prod) :
#   BASE_URL=https://onscen.com bash commun/deploy/db-health-check.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/onscen-root.sh
source "${SCRIPT_DIR}/lib/onscen-root.sh"
BACKUP_DIR="${BACKUP_DIR:-${ROOT}/backups}"
BASE_URL="${BASE_URL:-http://127.0.0.1:${PORT:-3000}}"
MAX_BACKUP_AGE_HOURS="${MAX_BACKUP_AGE_HOURS:-36}"

fail=0

echo "=== OnScen DB health check ==="
echo "Date : $(date -Iseconds)"
echo ""

# 1) API /health/db (comptes + drift)
echo "--- API /health/db ---"
if command -v curl >/dev/null 2>&1; then
  HTTP_CODE="$(curl -sS -o /tmp/onscen-health-db.json -w '%{http_code}' "${BASE_URL}/health/db" || echo 000)"
  echo "HTTP ${HTTP_CODE}"
  if [[ -f /tmp/onscen-health-db.json ]]; then
    cat /tmp/onscen-health-db.json
    echo ""
    if [[ "$HTTP_CODE" != "200" ]]; then
      echo "ERREUR — /health/db non OK" >&2
      fail=1
    fi
  fi
else
  echo "curl absent — skip API check"
fi
echo ""

# 2) Connexion PostgreSQL directe (si DATABASE_URL)
if [[ -n "${DATABASE_URL:-}" ]] && command -v psql >/dev/null 2>&1; then
  echo "--- PostgreSQL direct ---"
  psql "$DATABASE_URL" -Atc "
    SELECT 'users=' || COUNT(*) FROM users
    UNION ALL SELECT 'feed_posts=' || COUNT(*) FROM feed_posts
    UNION ALL SELECT 'user_reels=' || COUNT(*) FROM user_reels
    UNION ALL SELECT 'user_albums=' || COUNT(*) FROM user_albums
    UNION ALL SELECT 'user_compositions=' || COUNT(*) FROM user_compositions
    UNION ALL SELECT 'stories=' || COUNT(*) FROM stories;
  " || { echo "ERREUR psql" >&2; fail=1; }
  echo ""
fi

# 3) Sauvegardes pg_dump
echo "--- Backups (${BACKUP_DIR}) ---"
LATEST="$(find "$BACKUP_DIR" -maxdepth 1 \( -name 'onscen-*.sql.gz' -o -name 'soundy-*.sql.gz' \) -type f 2>/dev/null | sort -r | head -1 || true)"
if [[ -z "$LATEST" ]]; then
  echo "AVERTISSEMENT — aucune sauvegarde onscen-*.sql.gz (ou legacy soundy-*) trouvée" >&2
  fail=1
else
  AGE_SEC=$(( $(date +%s) - $(stat -c %Y "$LATEST" 2>/dev/null || stat -f %m "$LATEST") ))
  AGE_H=$(( AGE_SEC / 3600 ))
  echo "Dernière : $LATEST (${AGE_H}h)"
  if [[ "$AGE_H" -gt "$MAX_BACKUP_AGE_HOURS" ]]; then
    echo "AVERTISSEMENT — sauvegarde > ${MAX_BACKUP_AGE_HOURS}h" >&2
    fail=1
  fi
  if [[ -x "$DEPLOY_DIR/verify-backup.sh" ]]; then
    bash "$DEPLOY_DIR/verify-backup.sh" "$LATEST" || fail=1
  elif [[ -f "$DEPLOY_DIR/verify-backup.sh" ]]; then
    bash "$DEPLOY_DIR/verify-backup.sh" "$LATEST" || fail=1
  fi
fi

echo ""
if [[ "$fail" -eq 0 ]]; then
  echo "=== Résultat : OK ==="
  exit 0
fi
echo "=== Résultat : PROBLÈMES DÉTECTÉS ==="
exit 1
