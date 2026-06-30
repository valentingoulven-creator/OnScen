#!/usr/bin/env bash
# caddy-watchdog.sh — Vérifie HTTPS + Caddyfile, restaure si cassé (cron */5)
set -euo pipefail

LOG="/var/log/caddy-watchdog.log"
CURRENT="/etc/caddy/Caddyfile"
SOURCES=(
  "/opt/soundy/deploy/Caddyfile"
  "/root/Caddyfile.production.backup"
)

log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S'): $*" >> "$LOG"
}

port_443_up() {
  ss -tlnp 2>/dev/null | grep -q ':443'
}

caddyfile_ok() {
  [ -f "$CURRENT" ] && grep -q 'getsoundy.com' "$CURRENT"
}

pick_source() {
  for src in "${SOURCES[@]}"; do
    if [ -f "$src" ] && grep -q 'getsoundy.com' "$src"; then
      echo "$src"
      return 0
    fi
  done
  return 1
}

restore() {
  local src reason="$1"
  if ! src="$(pick_source)"; then
    log "CRITIQUE — aucune source valide (getsoundy.com) : ${SOURCES[*]}"
    return 1
  fi
  log "RESTAURATION ($reason) depuis $src"
  cp "$src" "$CURRENT"
  if ! caddy validate --config "$CURRENT" >/dev/null 2>&1; then
    log "ERREUR — Caddyfile restauré invalide"
    return 1
  fi
  systemctl reload caddy >> "$LOG" 2>&1 || systemctl restart caddy >> "$LOG" 2>&1
  log "OK — Caddy rechargé"
}

broken=false
reasons=()

if ! port_443_up; then
  broken=true
  reasons+=("port 443 down")
fi

if ! caddyfile_ok; then
  broken=true
  reasons+=("Caddyfile sans getsoundy.com")
fi

if [ "$broken" = true ]; then
  restore "${reasons[*]}"
else
  : # healthy — silent
fi
