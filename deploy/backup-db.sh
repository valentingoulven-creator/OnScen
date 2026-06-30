#!/usr/bin/env bash
# backup-db.sh — Sauvegarde PostgreSQL (Scaleway Managed DB ou local)
# Usage (sur le VPS) :
#   set -a && source /opt/soundy/.env && set +a
#   bash /opt/soundy/deploy/backup-db.sh
# Usage (local, avec URL explicite) :
#   DATABASE_URL='postgresql://...' ./deploy/backup-db.sh
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/soundy/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP="$(date '+%Y%m%d-%H%M%S')"
LOG="${BACKUP_DIR}/backup.log"

log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S'): $*" | tee -a "$LOG"
}

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Erreur : DATABASE_URL non défini (source /opt/soundy/.env ou export DATABASE_URL=...)" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
OUT="${BACKUP_DIR}/soundy-${TIMESTAMP}.sql.gz"

log "Démarrage pg_dump → $OUT"

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "Erreur : pg_dump introuvable (apt install postgresql-client)" >&2
  exit 1
fi

pg_dump "$DATABASE_URL" --no-owner --no-acl | gzip -9 > "$OUT"

SIZE="$(du -h "$OUT" | cut -f1)"
log "OK — sauvegarde créée ($SIZE)"

# Rétention locale (fichiers plus anciens que RETENTION_DAYS)
DELETED="$(find "$BACKUP_DIR" -maxdepth 1 -name 'soundy-*.sql.gz' -mtime +"${RETENTION_DAYS}" -print -delete | wc -l | tr -d ' ')"
if [[ "${DELETED:-0}" -gt 0 ]]; then
  log "Rétention — ${DELETED} ancienne(s) sauvegarde(s) supprimée(s) (> ${RETENTION_DAYS} jours)"
fi

REMAINING="$(find "$BACKUP_DIR" -maxdepth 1 -name 'soundy-*.sql.gz' | wc -l | tr -d ' ')"
log "Inventaire — ${REMAINING} sauvegarde(s) dans ${BACKUP_DIR}"

echo ""
echo "Rappel : activer aussi les sauvegardes automatiques Scaleway (console → Managed Databases → Backups)."
echo "Voir deploy/RUNBOOK-PROD.md pour la fréquence recommandée et la procédure de restauration."
