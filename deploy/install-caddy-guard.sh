#!/usr/bin/env bash
# install-caddy-guard.sh — Installe watchdog, backup immuable, cron (à lancer sur le VPS)
# Usage : sudo bash /opt/soundy/deploy/install-caddy-guard.sh
set -euo pipefail

# Scripts copiés depuis Windows peuvent avoir des CRLF
sed -i 's/\r$//' /opt/soundy/deploy/*.sh 2>/dev/null || true

REPO_CADDY="/opt/soundy/deploy/Caddyfile"
BACKUP="/root/Caddyfile.production.backup"
WATCHDOG_DST="/root/caddy-watchdog.sh"
HEALTH_DST="/root/healthcheck.sh"
SYNC="/opt/soundy/deploy/sync-caddy.sh"

if [ "$(id -u)" -ne 0 ]; then
  echo "Exécuter en root (sudo)." >&2
  exit 1
fi

if [ ! -f "$REPO_CADDY" ]; then
  echo "ERREUR — $REPO_CADDY absent. Déployer deploy/ sur le VPS d'abord." >&2
  exit 1
fi

chmod +x /opt/soundy/deploy/sync-caddy.sh
chmod +x /opt/soundy/deploy/caddy-watchdog.sh
chmod +x /opt/soundy/deploy/healthcheck.sh 2>/dev/null || true
chmod +x /opt/soundy/deploy/backup-db.sh 2>/dev/null || true
chmod +x /opt/soundy/deploy/verify-backup.sh 2>/dev/null || true
chmod +x /opt/soundy/deploy/verify-prod.sh 2>/dev/null || true
chmod +x /opt/soundy/deploy/install-backup-cron.sh 2>/dev/null || true
chmod +x /opt/soundy/deploy/install-health-cron.sh 2>/dev/null || true
chmod +x /opt/soundy/deploy/setup-legal-publisher.sh 2>/dev/null || true
mkdir -p /opt/soundy/backups /opt/soundy/logs

cp /opt/soundy/deploy/caddy-watchdog.sh "$WATCHDOG_DST"
chmod +x "$WATCHDOG_DST"

if [ -f /opt/soundy/deploy/healthcheck.sh ]; then
  cp /opt/soundy/deploy/healthcheck.sh "$HEALTH_DST"
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
