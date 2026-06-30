#!/usr/bin/env bash
# sync-caddy.sh — Déploie le Caddyfile canonique vers /etc/caddy/Caddyfile
# Usage (sur le VPS) :
#   sudo ./deploy/sync-caddy.sh
#   sudo ./deploy/sync-caddy.sh /chemin/vers/Caddyfile
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/soundy-root.sh
source "$SCRIPT_DIR/lib/soundy-root.sh"

SOURCE="${1:-$ROOT/deploy/Caddyfile}"
DEST="/etc/caddy/Caddyfile"
LOG="/var/log/caddy-sync.log"

log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S'): $*" | tee -a "$LOG"
}

if [ ! -f "$SOURCE" ]; then
  log "ERREUR — Caddyfile source introuvable : $SOURCE"
  exit 1
fi

if ! grep -q 'getsoundy.com' "$SOURCE"; then
  log "ERREUR — source invalide (getsoundy.com absent) : $SOURCE"
  exit 1
fi

if grep -qE '^:80[[:space:]]*\{' "$SOURCE" && ! grep -q 'getsoundy.com' "$SOURCE"; then
  log "ERREUR — refus d'installer un Caddyfile HTTP-only :80"
  exit 1
fi

cp "$SOURCE" "$DEST"
caddy validate --config "$DEST" >/dev/null
systemctl reload caddy
log "OK — Caddyfile synchronisé depuis $SOURCE"
