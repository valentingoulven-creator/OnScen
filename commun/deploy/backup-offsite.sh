#!/usr/bin/env bash
# backup-offsite.sh — Copie secondaire des dumps DB + archives uploads (hors disque principal)
#
# Couche minimale : copie locale vers BACKUP_OFFSITE_DIR (second chemin sur le VPS).
# Couche optionnelle : sync S3-compatible Scaleway Object Storage si SCW_BUCKET est défini.
#
# Usage (sur le VPS, après backup-db.sh) :
#   set -a && source /opt/onscen/.env && set +a
#   bash /opt/onscen/deploy/backup-offsite.sh
#
# Variables (.env ou export) :
#   BACKUP_DIR=/opt/onscen/backups
#   UPLOADS_BACKUP_DIR=/opt/onscen/backups/uploads
#   BACKUP_OFFSITE_DIR=/opt/onscen/backups-offsite
#   OFFSITE_RETENTION_DAYS=14
#   SCW_BUCKET=onscen-backups          # optionnel — bucket Object Storage
#   SCW_REGION=fr-par                  # optionnel — défaut fr-par
#   SCW_ACCESS_KEY / SCW_SECRET_KEY    # optionnel — ou AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/onscen-root.sh
source "${SCRIPT_DIR}/lib/onscen-root.sh"

BACKUP_DIR="${BACKUP_DIR:-${ROOT}/backups}"
UPLOADS_BACKUP_DIR="${UPLOADS_BACKUP_DIR:-${ROOT}/backups/uploads}"
OFFSITE_DIR="${BACKUP_OFFSITE_DIR:-${ROOT}/backups-offsite}"
RETENTION_DAYS="${OFFSITE_RETENTION_DAYS:-14}"
TIMESTAMP="$(date '+%Y%m%d-%H%M%S')"
LOG="${OFFSITE_DIR}/offsite.log"

log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S'): $*" | tee -a "$LOG"
}

mkdir -p "$OFFSITE_DIR/db" "$OFFSITE_DIR/uploads"

COPIED=0

copy_latest() {
  local pattern="$1"
  local src_dir="$2"
  local dest_sub="$3"
  local latest
  latest="$(find "$src_dir" -maxdepth 1 -name "$pattern" -type f 2>/dev/null | sort | tail -1 || true)"
  if [[ -z "$latest" ]]; then
    log "SKIP — aucun fichier $pattern dans $src_dir"
    return 0
  fi
  local base dest
  base="$(basename "$latest")"
  dest="${OFFSITE_DIR}/${dest_sub}/${base}"
  if [[ -f "$dest" ]] && cmp -s "$latest" "$dest" 2>/dev/null; then
    log "Déjà à jour — $dest_sub/$base"
    return 0
  fi
  cp -a "$latest" "$dest"
  log "Copié — $base → $dest_sub/"
  COPIED=$((COPIED + 1))
}

log "=== Début copie off-site → $OFFSITE_DIR ==="
LATEST_DB="$(find "$BACKUP_DIR" -maxdepth 1 \( -name 'onscen-*.sql.gz' -o -name 'soundy-*.sql.gz' \) -type f 2>/dev/null | sort | tail -1 || true)"
if [[ -n "$LATEST_DB" ]]; then
  base="$(basename "$LATEST_DB")"
  dest="${OFFSITE_DIR}/db/${base}"
  if [[ ! -f "$dest" ]] || ! cmp -s "$LATEST_DB" "$dest" 2>/dev/null; then
    cp -a "$LATEST_DB" "$dest"
    log "Copié — $base → db/"
    COPIED=$((COPIED + 1))
  else
    log "Déjà à jour — db/$base"
  fi
else
  log "SKIP — aucun dump onscen-*.sql.gz / soundy-*.sql.gz dans $BACKUP_DIR"
fi
copy_latest 'uploads-*.tar.gz' "$UPLOADS_BACKUP_DIR" 'uploads'

# Rétention off-site
for sub in db uploads; do
  DELETED="$(find "${OFFSITE_DIR}/${sub}" -maxdepth 1 -type f -mtime +"${RETENTION_DAYS}" -print -delete | wc -l | tr -d ' ')"
  if [[ "${DELETED:-0}" -gt 0 ]]; then
    log "Rétention $sub — ${DELETED} fichier(s) supprimé(s) (> ${RETENTION_DAYS} j)"
  fi
done

# Sync Scaleway Object Storage (S3-compatible) — optionnel
if [[ -n "${SCW_BUCKET:-}" ]]; then
  SCW_REGION="${SCW_REGION:-fr-par}"
  S3_ENDPOINT="https://s3.${SCW_REGION}.scw.cloud"
  export AWS_ACCESS_KEY_ID="${SCW_ACCESS_KEY:-${AWS_ACCESS_KEY_ID:-}}"
  export AWS_SECRET_ACCESS_KEY="${SCW_SECRET_KEY:-${AWS_SECRET_ACCESS_KEY:-}}"

  if [[ -z "${AWS_ACCESS_KEY_ID:-}" || -z "${AWS_SECRET_ACCESS_KEY:-}" ]]; then
    log "WARN — SCW_BUCKET défini mais clés S3 absentes (SCW_ACCESS_KEY / SCW_SECRET_KEY)"
  elif command -v aws >/dev/null 2>&1; then
    log "Sync S3 → s3://${SCW_BUCKET}/onscen/${TIMESTAMP}/"
    aws s3 sync "$OFFSITE_DIR/db" "s3://${SCW_BUCKET}/onscen/${TIMESTAMP}/db/" \
      --endpoint-url "$S3_ENDPOINT" --only-show-errors
    aws s3 sync "$OFFSITE_DIR/uploads" "s3://${SCW_BUCKET}/onscen/${TIMESTAMP}/uploads/" \
      --endpoint-url "$S3_ENDPOINT" --only-show-errors
    log "OK — sync Object Storage terminée"
  else
    log "WARN — aws CLI absent (apt install awscli) — copie locale uniquement"
  fi
else
  log "Info — SCW_BUCKET non défini ; copie locale secondaire uniquement"
fi

log "Terminé — ${COPIED} nouveau(x) fichier(s) copié(s)"
