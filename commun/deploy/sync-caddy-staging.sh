#!/usr/bin/env bash
# sync-caddy-staging.sh — Deploie Caddyfile.staging vers /etc/caddy/Caddyfile
set -euo pipefail

SOURCE="${1:-/opt/onscen/deploy/Caddyfile.staging}"
DEST="/etc/caddy/Caddyfile"
LOG="/var/log/caddy-sync-staging.log"

log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S'): $*" | tee -a "$LOG"
}

if [ ! -f "$SOURCE" ]; then
  log "ERREUR — Caddyfile staging introuvable : $SOURCE"
  exit 1
fi

if ! grep -q 'staging.onscen.com' "$SOURCE"; then
  log "ERREUR — source invalide (staging.onscen.com absent)"
  exit 1
fi

# staging.getsoundy.com décommissionné (2026-08-11) — refuser toute réintroduction accidentelle.
if grep -q 'getsoundy.com' "$SOURCE"; then
  log "ERREUR — getsoundy.com détecté dans le Caddyfile staging source, domaine décommissionné, refus d'installer"
  exit 1
fi

cp "$SOURCE" "$DEST"
caddy validate --config "$DEST" >/dev/null
systemctl reload caddy
log "OK — Caddyfile staging synchronise"
