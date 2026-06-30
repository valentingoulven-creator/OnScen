#!/usr/bin/env bash
# verify-prod.sh — Contrôles ops production (sans SSH, à lancer sur le VPS)
# Usage :
#   bash /opt/soundy/deploy/verify-prod.sh
# Variables optionnelles :
#   SOUNDY_ROOT=/opt/soundy  HEALTH_URL=http://127.0.0.1:3000/health  PM2_APP=melosong-backend
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/soundy-root.sh
source "${SCRIPT_DIR}/lib/soundy-root.sh"
ENV_FILE="${ROOT}/.env"
LEGAL_FILE="${ROOT}/legal-publisher.json"
BACKUP_DIR="${BACKUP_DIR:-${ROOT}/backups}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/health}"
PM2_APP="${PM2_APP:-melosong-backend}"

FAIL=0
warn() { echo "⚠ $*"; }
ok() { echo "✓ $*"; }
fail() { echo "✗ $*"; FAIL=1; }

echo "=== Soundy — vérification production ==="
echo "Racine : $ROOT"
echo ""

# Health HTTP
if curl -sf --max-time 5 "$HEALTH_URL" >/dev/null 2>&1; then
  ok "Health OK ($HEALTH_URL)"
else
  fail "Health KO ($HEALTH_URL)"
fi

# .env et DATABASE_URL (sans afficher de secret)
if [[ ! -f "$ENV_FILE" ]]; then
  fail ".env absent : $ENV_FILE"
else
  ok ".env présent"
  if grep -qE '^[[:space:]]*DATABASE_URL=.+[^[:space:]]' "$ENV_FILE" 2>/dev/null; then
    HOST_HINT="$(grep -E '^[[:space:]]*DATABASE_URL=' "$ENV_FILE" | sed -E 's/.*@([^/:]+).*/\1/' | head -1)"
    ok "DATABASE_URL défini (hôte : ${HOST_HINT:-?})"
  else
    warn "DATABASE_URL absent — repli store.json local (voir deploy/RUNBOOK-PROD.md)"
  fi
  if grep -qE '^[[:space:]]*JWT_SECRET=changez_moi' "$ENV_FILE" 2>/dev/null; then
    warn "JWT_SECRET semble être la valeur d'exemple — à changer"
  fi
fi

# legal-publisher.json
if [[ ! -f "$LEGAL_FILE" ]]; then
  fail "legal-publisher.json absent : $LEGAL_FILE (copier depuis msdev/legal-publisher.example.json)"
elif grep -q '\[À compléter' "$LEGAL_FILE" 2>/dev/null; then
  fail "legal-publisher.json contient des placeholders [À compléter]"
else
  ok "legal-publisher.json présent et rempli"
fi

# PM2
if command -v pm2 >/dev/null 2>&1; then
  if pm2 describe "$PM2_APP" >/dev/null 2>&1; then
    STATUS="$(pm2 jlist 2>/dev/null | python3 -c "
import json,sys
try:
    for p in json.load(sys.stdin):
        if p.get('name')=='$PM2_APP':
            print((p.get('pm2_env') or {}).get('status','?'))
            break
except: pass
" 2>/dev/null || echo "?")"
    if [[ "$STATUS" == "online" ]]; then
      ok "PM2 $PM2_APP : online"
    else
      fail "PM2 $PM2_APP : ${STATUS:-inconnu}"
    fi
  else
    fail "Process PM2 '$PM2_APP' introuvable"
  fi
else
  warn "pm2 non installé — skip statut process"
fi

# Espace disque backups
if [[ -d "$BACKUP_DIR" ]]; then
  COUNT="$(find "$BACKUP_DIR" -maxdepth 1 -name 'soundy-*.sql.gz' 2>/dev/null | wc -l | tr -d ' ')"
  AVAIL="$(df -h "$BACKUP_DIR" 2>/dev/null | awk 'NR==2 {print $4}' || echo "?")"
  ok "Backups DB : ${COUNT} fichier(s) dans $BACKUP_DIR (disponible : ${AVAIL})"
  if [[ "${COUNT:-0}" -eq 0 ]]; then
    warn "Aucune sauvegarde pg_dump locale — lancer deploy/backup-db.sh ou vérifier cron"
  else
    LATEST_DB="$(find "$BACKUP_DIR" -maxdepth 1 -name 'soundy-*.sql.gz' -type f -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1 | cut -d' ' -f2- || true)"
    if [[ -n "$LATEST_DB" ]]; then
      DB_AGE_H=$(( ($(date +%s) - $(stat -c %Y "$LATEST_DB" 2>/dev/null || echo 0)) / 3600 ))
      if [[ "${DB_AGE_H:-999}" -gt 26 ]]; then
        warn "Dernier dump DB vieux de ${DB_AGE_H}h (> 26h) — vérifier cron backup-db (03:15)"
      else
        ok "Dernier dump DB : il y a ${DB_AGE_H}h"
      fi
    fi
  fi
else
  warn "Dossier backups absent : $BACKUP_DIR (mkdir -p && cron backup-db.sh)"
fi

# Backups uploads
UPLOADS_BACKUP_DIR="${UPLOADS_BACKUP_DIR:-${ROOT}/backups/uploads}"
if [[ -d "$UPLOADS_BACKUP_DIR" ]]; then
  UP_COUNT="$(find "$UPLOADS_BACKUP_DIR" -maxdepth 1 -name 'uploads-*.tar.gz' 2>/dev/null | wc -l | tr -d ' ')"
  ok "Backups uploads : ${UP_COUNT} archive(s) dans $UPLOADS_BACKUP_DIR"
  if [[ "${UP_COUNT:-0}" -eq 0 ]]; then
    warn "Aucune archive uploads — lancer deploy/backup-uploads.sh ou install-uploads-backup-cron.sh"
  else
    LATEST_UP="$(find "$UPLOADS_BACKUP_DIR" -maxdepth 1 -name 'uploads-*.tar.gz' -type f -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1 | cut -d' ' -f2- || true)"
    if [[ -n "$LATEST_UP" ]]; then
      UP_AGE_D=$(( ($(date +%s) - $(stat -c %Y "$LATEST_UP" 2>/dev/null || echo 0)) / 86400 ))
      if [[ "${UP_AGE_D:-999}" -gt 8 ]]; then
        warn "Dernière archive uploads vieille de ${UP_AGE_D}j (> 8j) — cron hebdo attendu (dim. 04:30)"
      else
        ok "Dernière archive uploads : il y a ${UP_AGE_D}j"
      fi
    fi
  fi
else
  warn "Dossier backups uploads absent : $UPLOADS_BACKUP_DIR"
fi

# Backup off-site secondaire
OFFSITE_DIR="${BACKUP_OFFSITE_DIR:-${ROOT}/backups-offsite}"
if [[ -d "$OFFSITE_DIR/db" ]]; then
  OFF_COUNT="$(find "$OFFSITE_DIR/db" -maxdepth 1 -type f 2>/dev/null | wc -l | tr -d ' ')"
  ok "Backup off-site : ${OFF_COUNT} dump(s) dans $OFFSITE_DIR/db"
  if [[ "${OFF_COUNT:-0}" -eq 0 ]]; then
    warn "Copie off-site vide — lancer deploy/backup-offsite.sh ou install-offsite-backup-cron.sh"
  fi
else
  warn "Backup off-site absent : $OFFSITE_DIR (optionnel mais recommandé)"
fi

# Crons backup
if command -v crontab >/dev/null 2>&1; then
  CRON="$(crontab -l 2>/dev/null || true)"
  if echo "$CRON" | grep -q 'backup-db.sh'; then
    ok "Cron backup-db installé"
  else
    warn "Cron backup-db absent — sudo bash deploy/install-backup-cron.sh"
  fi
  if echo "$CRON" | grep -q 'backup-uploads.sh'; then
    ok "Cron backup-uploads installé"
  else
    warn "Cron backup-uploads absent — sudo bash deploy/install-uploads-backup-cron.sh"
  fi
  if echo "$CRON" | grep -q 'backup-offsite.sh'; then
    ok "Cron backup-offsite installé"
  else
    warn "Cron backup-offsite absent — sudo bash deploy/install-offsite-backup-cron.sh"
  fi
fi

# Espace disque racine app
ROOT_AVAIL="$(df -h "$ROOT" 2>/dev/null | awk 'NR==2 {print $4 " (" $5 " utilisé)"}' || echo "?")"
echo ""
echo "Espace disque $ROOT : ${ROOT_AVAIL}"

echo ""
if [[ "$FAIL" -eq 0 ]]; then
  echo "Résultat : OK"
  exit 0
else
  echo "Résultat : ÉCHEC — corriger les points ✗ ci-dessus (deploy/RUNBOOK-PROD.md)"
  exit 1
fi
