#!/usr/bin/env bash
# sync-caddy-staging.sh — Deploie Caddyfile.staging vers /etc/caddy/Caddyfile
set -euo pipefail

SOURCE="${1:-/opt/soundly/deploy/Caddyfile.staging}"
DEST="/etc/caddy/Caddyfile"
LOG="/var/log/caddy-sync-staging.log"

log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S'): $*" | tee -a "$LOG"
}

if [ ! -f "$SOURCE" ]; then
  log "ERREUR — Caddyfile staging introuvable : $SOURCE"
  exit 1
fi

if ! grep -q 'staging.getsoundy.com' "$SOURCE"; then
  log "ERREUR — source invalide (staging.getsoundy.com absent)"
  exit 1
fi

cp "$SOURCE" "$DEST"
caddy validate --config "$DEST" >/dev/null
systemctl reload caddy
log "OK — Caddyfile staging synchronise"
