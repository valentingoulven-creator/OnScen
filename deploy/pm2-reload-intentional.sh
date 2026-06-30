#!/usr/bin/env bash
# pm2-reload-intentional.sh — Reload/restart PM2 sans alerte email monitor
# Usage :
#   bash /opt/soundy/deploy/pm2-reload-intentional.sh          # reload (zero-downtime)
#   bash /opt/soundy/deploy/pm2-reload-intentional.sh restart
#
# Crée /tmp/soundy-pm2-reload-intentional lu par monitor-alerts.sh (consommé au prochain restart détecté).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/soundy-root.sh
source "${SCRIPT_DIR}/lib/soundy-root.sh"
PM2_APP="${PM2_APP:-melosong-backend}"
INTENTIONAL_RELOAD_FLAG="/tmp/soundy-pm2-reload-intentional"
ACTION="${1:-reload}"

mark_intentional_pm2_reload() {
  local reason="${1:-manual}"
  printf '%s\n%s\n' "$(date +%s)" "$reason" > "$INTENTIONAL_RELOAD_FLAG"
}

case "$ACTION" in
  reload|restart) ;;
  *)
    echo "Usage: $0 [reload|restart]" >&2
    exit 1
    ;;
esac

mark_intentional_pm2_reload "manual"
cd "$ROOT"

if [[ "$ACTION" == "reload" ]]; then
  pm2 reload "$PM2_APP" --update-env
else
  pm2 restart "$PM2_APP" --update-env
fi

echo "PM2 ${ACTION} intentionnel — alerte monitor suppressée (flag ${INTENTIONAL_RELOAD_FLAG})"
