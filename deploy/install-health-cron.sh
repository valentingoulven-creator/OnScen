#!/usr/bin/env bash
# install-health-cron.sh — Cron hebdomadaire verify-prod.sh (dimanche 06:00)
# Usage : sudo bash /opt/soundy/deploy/install-health-cron.sh
set -euo pipefail

sed -i 's/\r$//' /opt/soundy/deploy/*.sh 2>/dev/null || true

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/soundy-root.sh
source "${SCRIPT_DIR}/lib/soundy-root.sh"
VERIFY_SCRIPT="${ROOT}/deploy/verify-prod.sh"
LOG_DIR="${ROOT}/logs"
LOG_FILE="${LOG_DIR}/verify-prod.log"
CRON_MARKER="verify-prod.sh"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Exécuter en root (sudo)." >&2
  exit 1
fi

if [[ ! -f "$VERIFY_SCRIPT" ]]; then
  echo "ERREUR — $VERIFY_SCRIPT absent. Déployer deploy/ sur le VPS d'abord." >&2
  exit 1
fi

chmod +x "$VERIFY_SCRIPT"
mkdir -p "$LOG_DIR"

CRON_LINE="0 6 * * 0 /bin/bash ${VERIFY_SCRIPT} >> ${LOG_FILE} 2>&1"

TMP_CRON="$(mktemp)"
crontab -l 2>/dev/null | grep -v "$CRON_MARKER" > "$TMP_CRON" || true
echo "$CRON_LINE" >> "$TMP_CRON"
crontab "$TMP_CRON"
rm -f "$TMP_CRON"

echo "=== Cron vérification prod installé ==="
echo "  Horaire  : dimanche 06:00"
echo "  Script   : $VERIFY_SCRIPT"
echo "  Log      : $LOG_FILE"
crontab -l | grep "$CRON_MARKER" || true
