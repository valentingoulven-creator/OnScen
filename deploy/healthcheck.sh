#!/usr/bin/env bash
# healthcheck.sh — Redémarre PM2 si /health échoue (cron */2)
# Attend que le process soit up depuis 30s avant de redémarrer (évite boucles).
set -euo pipefail

LOG="/var/log/melosong-healthcheck.log"
APP="melosong-backend"
URL="http://127.0.0.1:3000/health"
MIN_UPTIME_SEC=30

log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S'): $*" >> "$LOG"
}

if curl -sf --max-time 5 "$URL" >/dev/null 2>&1; then
  exit 0
fi

# PM2 uptime en secondes (vide si process absent)
UPTIME="$(pm2 jlist 2>/dev/null | python3 -c "
import json,sys
try:
    procs=json.load(sys.stdin)
    for p in procs:
        if p.get('name')=='$APP':
            print(int((p.get('pm2_env') or {}).get('pm_uptime',0)/1000))
            break
except: pass
" 2>/dev/null || echo "0")"

if [ "${UPTIME:-0}" -lt "$MIN_UPTIME_SEC" ]; then
  log "SKIP — $APP démarré depuis ${UPTIME}s (< ${MIN_UPTIME_SEC}s), pas de restart"
  exit 0
fi

log "FAIL — /health KO, restart $APP (uptime ${UPTIME}s)"
# Résoudre /usr/bin/pm2 ou /usr/local/bin/pm2 selon la distribution
PM2_BIN="$(command -v pm2 2>/dev/null || echo /usr/bin/pm2)"
"$PM2_BIN" restart "$APP" --update-env >> "$LOG" 2>&1 || true
