#!/usr/bin/env bash
# install-caddy-guard.sh — Installe watchdog, backup immuable, cron (à lancer sur le VPS)
# Usage : sudo bash /opt/soundly/deploy/install-caddy-guard.sh
set -euo pipefail

# Scripts copiés depuis Windows peuvent avoir des CRLF
sed -i 's/\r$//' /opt/soundly/deploy/*.sh 2>/dev/null || true

REPO_CADDY="/opt/soundly/deploy/Caddyfile"
BACKUP="/root/Caddyfile.production.backup"
WATCHDOG_DST="/root/caddy-watchdog.sh"
HEALTH_DST="/root/healthcheck.sh"
SYNC="/opt/soundly/deploy/sync-caddy.sh"

if [ "$(id -u)" -ne 0 ]; then
  echo "Exécuter en root (sudo)." >&2
  exit 1
fi

if [ ! -f "$REPO_CADDY" ]; then
  echo "ERREUR — $REPO_CADDY absent. Déployer deploy/ sur le VPS d'abord." >&2
  exit 1
fi

chmod +x /opt/soundly/deploy/sync-caddy.sh
chmod +x /opt/soundly/deploy/caddy-watchdog.sh
chmod +x /opt/soundly/deploy/healthcheck.sh 2>/dev/null || true

cp /opt/soundly/deploy/caddy-watchdog.sh "$WATCHDOG_DST"
chmod +x "$WATCHDOG_DST"

if [ -f /opt/soundly/deploy/healthcheck.sh ]; then
  cp /opt/soundly/deploy/healthcheck.sh "$HEALTH_DST"
  chmod +x "$HEALTH_DST"
fi

# Backup immuable (chattr +i empêche écrasement accidentel)
chattr -i "$BACKUP" 2>/dev/null || true
cp "$REPO_CADDY" "$BACKUP"
chmod 444 "$BACKUP"
chattr +i "$BACKUP" 2>/dev/null || echo "Note: chattr +i indisponible — backup copié sans immuabilité"

# Retirer l'ancien fichier piège (config :80 HTTP-only)
if [ -f /root/Caddyfile.production ]; then
  if ! grep -q 'getsoundy.com' /root/Caddyfile.production; then
    mv /root/Caddyfile.production /root/Caddyfile.production.OLD_HTTP_ONLY
    echo "→ /root/Caddyfile.production déplacé (était HTTP-only :80)"
  fi
fi

bash "$SYNC"

# Cron
TMP_CRON="$(mktemp)"
crontab -l 2>/dev/null | grep -v 'caddy-watchdog.sh' | grep -v 'healthcheck.sh' > "$TMP_CRON" || true
echo "*/5 * * * * $WATCHDOG_DST" >> "$TMP_CRON"
if [ -f "$HEALTH_DST" ]; then
  echo "*/2 * * * * $HEALTH_DST" >> "$TMP_CRON"
fi
crontab "$TMP_CRON"
rm -f "$TMP_CRON"

echo "=== Caddy guard installé ==="
echo "  Canonique : $REPO_CADDY"
echo "  Backup    : $BACKUP (immutable)"
echo "  Watchdog  : $WATCHDOG_DST (cron */5)"
crontab -l | grep -E 'caddy-watchdog|healthcheck' || true
