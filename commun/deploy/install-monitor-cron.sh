#!/usr/bin/env bash
# install-monitor-cron.sh — Installe le cron de monitoring système OnScen (toutes les 5 min)
# Usage : sudo bash /opt/onscen/deploy/install-monitor-cron.sh
#
# Ce script installe :
#   - monitor-alerts.sh en cron toutes les 5 min (disk/RAM/CPU/PM2)
#
# Les alertes email utilisent RESEND_API_KEY (prioritaire) ou SMTP depuis /opt/onscen/.env.
# Le monitoring Node.js (API latency, uncaughtException, DB errors) est géré
# côté backend via lib/serverMonitor.ts et lib/alertNotifier.ts.
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Exécuter en root (sudo)." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/onscen-root.sh
source "${SCRIPT_DIR}/lib/onscen-root.sh"
MONITOR_SCRIPT="$DEPLOY_DIR/monitor-alerts.sh"
LOG_DIR="${ROOT}/logs"
LOG_FILE="${LOG_DIR}/monitor-alerts.log"
CRON_MARKER="monitor-alerts.sh"

if [[ ! -f "$MONITOR_SCRIPT" ]]; then
  echo "ERREUR — ${MONITOR_SCRIPT} absent." >&2
  echo "Déployez commun/deploy/ sur le VPS d'abord (commun/deploy/deploy_zero_downtime.ps1)." >&2
  exit 1
fi

sed -i 's/\r$//' "$MONITOR_SCRIPT" 2>/dev/null || true
chmod +x "$MONITOR_SCRIPT"
mkdir -p "$LOG_DIR"

CRON_LINE="*/5 * * * * /bin/bash ${MONITOR_SCRIPT} >> ${LOG_FILE} 2>&1"

TMP_CRON="$(mktemp)"
crontab -l 2>/dev/null | grep -v "$CRON_MARKER" > "$TMP_CRON" || true
echo "$CRON_LINE" >> "$TMP_CRON"
crontab "$TMP_CRON"
rm -f "$TMP_CRON"

echo ""
echo "=== Cron monitoring OnScen installé ==="
echo "  Horaire  : toutes les 5 minutes"
echo "  Script   : ${MONITOR_SCRIPT}"
echo "  Log      : ${LOG_FILE}"
echo "  Seuils   : disk ${ALERT_DISK_PERCENT:-80}%, RAM ${ALERT_RAM_PERCENT:-80}%, CPU ${ALERT_CPU_PERCENT:-80}%"
echo "  Email    : RESEND_API_KEY ou SMTP dans ${ROOT}/.env"
echo ""
crontab -l | grep "$CRON_MARKER" || true
echo ""
echo "Test immédiat (non bloquant) :"
bash "$MONITOR_SCRIPT" && echo "  -> OK (voir ${LOG_FILE})" || echo "  -> Erreur (voir ${LOG_FILE})"
