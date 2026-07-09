#!/usr/bin/env bash
# install-uploads-backup-cron.sh — Cron quotidien backup-uploads.sh (04:30, après pg_dump 03:15)
# Usage : sudo bash /opt/soundly/deploy/install-uploads-backup-cron.sh
set -euo pipefail

sed -i 's/\r$//' /opt/soundly/deploy/*.sh 2>/dev/null || true

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/soundy-root.sh
source "${SCRIPT_DIR}/lib/soundy-root.sh"
SCRIPT="$DEPLOY_DIR/backup-uploads.sh"
CRON_LOG="${ROOT}/backups/uploads/cron.log"
CRON_MARKER="backup-uploads.sh"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Exécuter en root (sudo)." >&2
  exit 1
fi

if [[ ! -f "$SCRIPT" ]]; then
  echo "ERREUR — $SCRIPT absent. Déployer commun/deploy/ sur le VPS d'abord." >&2
  exit 1
fi

chmod +x "$SCRIPT"
mkdir -p "${ROOT}/backups/uploads"

CRON_LINE="30 4 * * * /bin/bash ${SCRIPT} >> ${CRON_LOG} 2>&1"

TMP_CRON="$(mktemp)"
crontab -l 2>/dev/null | grep -v "$CRON_MARKER" > "$TMP_CRON" || true
echo "$CRON_LINE" >> "$TMP_CRON"
crontab "$TMP_CRON"
rm -f "$TMP_CRON"

echo "=== Cron backup uploads installé ==="
echo "  Horaire  : quotidien 04:30"
echo "  Script   : $SCRIPT"
echo "  Log      : $CRON_LOG"
crontab -l | grep "$CRON_MARKER" || true
