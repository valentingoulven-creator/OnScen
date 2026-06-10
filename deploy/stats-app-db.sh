#!/usr/bin/env bash
# stats-app-db.sh — Exécute les requêtes statistiques sur PostgreSQL production
# Usage (sur le VPS) :
#   bash /opt/soundly/deploy/stats-app-db.sh
# Usage (local, URL explicite) :
#   DATABASE_URL='postgresql://...' ./deploy/stats-app-db.sh
# Options :
#   OUT=/chemin/rapport.txt  — redirige la sortie vers un fichier horodaté
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_FILE="${SCRIPT_DIR}/stats-app-db.sql"
ENV_FILE="${ENV_FILE:-/opt/soundly/.env}"

if [[ -z "${DATABASE_URL:-}" ]] && [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Erreur : DATABASE_URL non défini (source $ENV_FILE ou export DATABASE_URL=...)" >&2
  exit 1
fi

if [[ ! -f "$SQL_FILE" ]]; then
  echo "Erreur : fichier SQL introuvable — $SQL_FILE" >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "Erreur : psql introuvable (apt install postgresql-client)" >&2
  exit 1
fi

TIMESTAMP="$(date '+%Y%m%d-%H%M%S')"
OUT="${OUT:-}"

echo "Soundy — statistiques base de données"
echo "Fichier : $SQL_FILE"
echo "Horodatage : $TIMESTAMP"
echo ""

run_stats() {
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$SQL_FILE"
}

if [[ -n "$OUT" ]]; then
  mkdir -p "$(dirname "$OUT")"
  {
    echo "# Soundy stats — $TIMESTAMP"
    echo "# DATABASE_URL host : $(echo "$DATABASE_URL" | sed -E 's#.*@([^/:]+).*#\1#')"
    echo ""
    run_stats
  } 2>&1 | tee "$OUT"
  echo ""
  echo "Rapport enregistré : $OUT"
else
  run_stats
fi
