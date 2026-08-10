#!/usr/bin/env bash
# install-offsite-backup-cron.sh — Cron quotidien backup-offsite.sh (04:00, après pg_dump 03:15)
# Usage : sudo bash /opt/onscen/deploy/install-offsite-backup-cron.sh
set -euo pipefail

sed -i 's/\r$//' /opt/onscen/deploy/*.sh 2>/dev/null || true

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/onscen-root.sh
source "${SCRIPT_DIR}/lib/onscen-root.sh"
SCRIPT="$DEPLOY_DIR/backup-offsite.sh"
CRON_LOG="${ROOT}/backups-offsite/offsite-cron.log"
CRON_MARKER="backup-offsite.sh"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Exécuter en root (sudo)." >&2
  exit 1
fi

if [[ ! -f "$SCRIPT" ]]; then
  echo "ERREUR — $SCRIPT absent. Déployer commun/deploy/ sur le VPS d'abord." >&2
  exit 1
fi

chmod +x "$SCRIPT"
mkdir -p "${ROOT}/backups-offsite"

CRON_LINE="0 4 * * * set -a && . ${ROOT}/.env && set +a && /bin/bash ${SCRIPT} >> ${CRON_LOG} 2>&1"

TMP_CRON="$(mktemp)"
crontab -l 2>/dev/null | grep -v "$CRON_MARKER" > "$TMP_CRON" || true
echo "$CRON_LINE" >> "$TMP_CRON"
crontab "$TMP_CRON"
rm -f "$TMP_CRON"

echo "=== Cron backup off-site installé ==="
echo "  Horaire  : 04:00 quotidien (après backup-db 03:15)"
echo "  Script   : $SCRIPT"
echo "  Log      : $CRON_LOG"
crontab -l | grep "$CRON_MARKER" || true
