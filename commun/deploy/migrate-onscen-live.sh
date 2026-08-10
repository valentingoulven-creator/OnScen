#!/usr/bin/env bash
# migrate-onscen-live.sh — Renommage live /opt/soundly → /opt/onscen + PM2 onscen-backend*
# Exécuter sur CHAQUE VPS (staging puis prod) après migration PostgreSQL (migrate-onscen-postgres.sh).
#
# Usage :
#   bash /opt/soundly/deploy/migrate-onscen-live.sh staging
#   bash /opt/soundly/deploy/migrate-onscen-live.sh prod
set -euo pipefail

ROLE="${1:-}"
if [[ "$ROLE" != "staging" && "$ROLE" != "prod" ]]; then
  echo "Usage: $0 staging|prod" >&2
  exit 1
fi

OLD_ROOT=/opt/soundly
NEW_ROOT=/opt/onscen

if [[ "$ROLE" == "staging" ]]; then
  OLD_PM2=(melosong-backend-staging)
  ECOSYSTEM="deploy/ecosystem.staging.config.cjs"
  NEW_PM2=onscen-backend-staging
else
  OLD_PM2=(melosong-backend)
  ECOSYSTEM="deploy/ecosystem.config.cjs"
  NEW_PM2=onscen-backend
fi

log() { echo "[migrate-onscen-live] $*"; }

if [[ -d "$NEW_ROOT" && ! -d "$OLD_ROOT" ]]; then
  log "OK — $NEW_ROOT existe déjà, pas de mv."
  ROOT="$NEW_ROOT"
else
  if [[ ! -d "$OLD_ROOT" ]]; then
    echo "ERREUR — $OLD_ROOT absent" >&2
    exit 1
  fi
  log "Arrêt PM2 (anciens noms)…"
  for n in "${OLD_PM2[@]}"; do pm2 stop "$n" 2>/dev/null || true; done
  pm2 stop soundy-auth 2>/dev/null || true

  log "Déplacement $OLD_ROOT → $NEW_ROOT"
  mv "$OLD_ROOT" "$NEW_ROOT"
  ROOT="$NEW_ROOT"
fi

# Crons / scripts qui pointent encore vers soundly
if grep -rl '/opt/soundly' /etc/cron.d /var/spool/cron 2>/dev/null | head -1 | grep -q .; then
  log "AVERTISSEMENT — crons avec /opt/soundly : vérifier manuellement"
fi

cd "$ROOT"

log "PM2 — suppression anciens process…"
for n in "${OLD_PM2[@]}"; do pm2 delete "$n" 2>/dev/null || true; done

if [[ ! -f "$ECOSYSTEM" ]]; then
  echo "ERREUR — $ROOT/$ECOSYSTEM absent (déployer commun/deploy d'abord)" >&2
  exit 1
fi

export ONSCEN_ROOT="$ROOT"
log "PM2 — démarrage $NEW_PM2"
pm2 start "$ECOSYSTEM"
pm2 save

if pm2 describe soundy-auth >/dev/null 2>&1; then
  log "Redémarrage soundy-auth (legacy) avec nouveau cwd…"
  pm2 delete soundy-auth 2>/dev/null || true
  if [[ -f "$ROOT/deploy/auth-server/server.js" ]]; then
    pm2 start "$ROOT/deploy/auth-server/server.js" --name soundy-auth --cwd "$ROOT"
    pm2 save
  fi
fi

log "Health local…"
sleep 2
curl -sf "http://127.0.0.1:3000/health" >/dev/null && log "OK /health" || log "WARN — /health non OK (vérifier logs pm2)"

log "MIGRATE_ONSCEN_LIVE_OK role=$ROLE root=$ROOT pm2=$NEW_PM2"
