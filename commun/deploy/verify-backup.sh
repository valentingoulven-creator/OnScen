#!/usr/bin/env bash
# verify-backup.sh — Vérifie qu'un dump pg_dump est lisible (sans restauration complète)
# Usage :
#   bash /opt/soundly/deploy/verify-backup.sh /opt/soundy/backups/soundy-YYYYMMDD-HHMMSS.sql.gz
#   bash /opt/soundly/deploy/verify-backup.sh   # prend la sauvegarde la plus récente
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/soundy/backups}"
FILE="${1:-}"

if [[ -z "$FILE" ]]; then
  FILE="$(find "$BACKUP_DIR" -maxdepth 1 -name 'soundy-*.sql.gz' -type f 2>/dev/null | sort -r | head -1 || true)"
fi

if [[ -z "$FILE" || ! -f "$FILE" ]]; then
  echo "ERREUR — aucun fichier de sauvegarde trouvé (argument ou ${BACKUP_DIR}/soundy-*.sql.gz)" >&2
  exit 1
fi

echo "Vérification : $FILE"

# Intégrité gzip
if ! gzip -t "$FILE" 2>/dev/null; then
  echo "ERREUR — archive gzip corrompue" >&2
  exit 1
fi
echo "  ✓ gzip OK"

# Contenu SQL minimal attendu (process substitution évite SIGPIPE avec set -o pipefail)
HEAD="$(head -50 < <(gunzip -c "$FILE" 2>/dev/null) || true)"
if [[ -z "$HEAD" ]] || ! echo "$HEAD" | grep -qE 'PostgreSQL|CREATE TABLE|SET '; then
  echo "ERREUR — contenu SQL suspect (pas de signature PostgreSQL / CREATE TABLE)" >&2
  exit 1
fi
echo "  ✓ en-tête SQL PostgreSQL détecté"

LINES="$(gunzip -c "$FILE" | wc -l | tr -d ' ')"
SIZE="$(du -h "$FILE" | cut -f1)"
echo "  ✓ ${LINES} lignes, ${SIZE}"

# Tables contenu utilisateur attendues dans le dump
TABLES=(feed_posts user_reels user_albums user_compositions stories users)
MISSING=()
for t in "${TABLES[@]}"; do
  if ! gunzip -c "$FILE" | grep -q "CREATE TABLE.*${t}\|COPY public\.${t} "; then
    MISSING+=("$t")
  fi
done
if ((${#MISSING[@]} > 0)); then
  echo "AVERTISSEMENT — tables absentes ou non détectées dans le dump : ${MISSING[*]}" >&2
else
  echo "  ✓ tables contenu détectées (${TABLES[*]})"
fi

echo ""
echo "Test de restauration complet (optionnel, base de test) :"
echo "  createdb soundy_restore_test"
echo "  gunzip -c \"$FILE\" | psql \"\$DATABASE_URL_RESTORE_TEST\""
echo "  dropdb soundy_restore_test"
echo ""
echo "Voir commun/deploy/RUNBOOK-PROD.md § Restauration PostgreSQL."
