#!/usr/bin/env bash
# backup-uploads.sh — Archive tar.gz des fichiers utilisateur (avatars, pièces jointes…)
# Usage (sur le VPS) :
#   bash /opt/soundly/deploy/backup-uploads.sh
# Variables optionnelles :
#   UPLOADS_SRC=/opt/soundly/public/uploads
#   UPLOADS_BACKUP_DIR=/opt/soundly/backups/uploads
#   UPLOADS_RETENTION_DAYS=28
set -euo pipefail

UPLOADS_SRC="${UPLOADS_SRC:-/opt/soundly/public/uploads}"
UPLOADS_BACKUP_DIR="${UPLOADS_BACKUP_DIR:-/opt/soundly/backups/uploads}"
RETENTION_DAYS="${UPLOADS_RETENTION_DAYS:-28}"
TIMESTAMP="$(date '+%Y%m%d-%H%M%S')"
LOG="${UPLOADS_BACKUP_DIR}/backup-uploads.log"

log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S'): $*" | tee -a "$LOG"
}

mkdir -p "$UPLOADS_BACKUP_DIR"

if [[ ! -d "$UPLOADS_SRC" ]]; then
  log "SKIP — dossier uploads absent : $UPLOADS_SRC"
  exit 0
fi

FILE_COUNT="$(find "$UPLOADS_SRC" -type f 2>/dev/null | wc -l | tr -d ' ')"
if [[ "${FILE_COUNT:-0}" -eq 0 ]]; then
  log "SKIP — aucun fichier dans $UPLOADS_SRC"
  exit 0
fi

OUT="${UPLOADS_BACKUP_DIR}/uploads-${TIMESTAMP}.tar.gz"
log "Démarrage tar → $OUT (${FILE_COUNT} fichier(s))"

tar -czf "$OUT" -C "$(dirname "$UPLOADS_SRC")" "$(basename "$UPLOADS_SRC")"

SIZE="$(du -h "$OUT" | cut -f1)"
log "OK — archive créée ($SIZE)"

DELETED="$(find "$UPLOADS_BACKUP_DIR" -maxdepth 1 -name 'uploads-*.tar.gz' -mtime +"${RETENTION_DAYS}" -print -delete | wc -l | tr -d ' ')"
if [[ "${DELETED:-0}" -gt 0 ]]; then
  log "Rétention — ${DELETED} ancienne(s) archive(s) supprimée(s) (> ${RETENTION_DAYS} jours)"
fi

REMAINING="$(find "$UPLOADS_BACKUP_DIR" -maxdepth 1 -name 'uploads-*.tar.gz' | wc -l | tr -d ' ')"
log "Inventaire — ${REMAINING} archive(s) dans ${UPLOADS_BACKUP_DIR}"
