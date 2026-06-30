#!/usr/bin/env bash
# install-backup-cron.sh — Installe le cron quotidien backup-db.sh (03:15)
# Usage : sudo bash /opt/soundy/deploy/install-backup-cron.sh
set -euo pipefail

sed -i 's/\r$//' /opt/soundy/deploy/*.sh 2>/dev/null || true

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/soundy-root.sh
source "${SCRIPT_DIR}/lib/soundy-root.sh"
BACKUP_SCRIPT="${ROOT}/deploy/backup-db.sh"
CRON_LOG="${ROOT}/backups/cron.log"
CRON_MARKER="backup-db.sh"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Exécuter en root (sudo)." >&2
  exit 1
fi

if [[ ! -f "$BACKUP_SCRIPT" ]]; then
  echo "ERREUR — $BACKUP_SCRIPT absent. Déployer deploy/ sur le VPS d'abord." >&2
  exit 1
fi

chmod +x "$BACKUP_SCRIPT"
mkdir -p "${ROOT}/backups"

CRON_LINE="15 3 * * * set -a && . ${ROOT}/.env && set +a && /bin/bash ${BACKUP_SCRIPT} >> ${CRON_LOG} 2>&1"

TMP_CRON="$(mktemp)"
crontab -l 2>/dev/null | grep -v "$CRON_MARKER" > "$TMP_CRON" || true
echo "$CRON_LINE" >> "$TMP_CRON"
crontab "$TMP_CRON"
rm -f "$TMP_CRON"

echo "=== Cron backup PostgreSQL installé ==="
echo "  Horaire  : 03:15 quotidien"
echo "  Script   : $BACKUP_SCRIPT"
echo "  Log      : $CRON_LOG"
crontab -l | grep "$CRON_MARKER" || true
