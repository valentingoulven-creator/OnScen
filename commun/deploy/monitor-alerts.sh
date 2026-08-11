#!/usr/bin/env bash
# monitor-alerts.sh — Alertes système VPS OnScen
# Vérifie disk / RAM / CPU et état PM2 (redémarrages).
# Appelé par cron toutes les 5 min (installé par install-monitor-cron.sh).
# Prérequis : python3 (pré-installé Ubuntu), pm2 dans PATH.
#
# Config :
#   RESEND_API_KEY (prioritaire, HTTP 443) ou credentials SMTP depuis /opt/onscen/.env.
#   Les seuils peuvent être surchargés via des variables d'environnement.
#
# Usage manuel :
#   sudo bash /opt/onscen/deploy/monitor-alerts.sh
#
# Redémarrages PM2 intentionnels (deploy Cursor, reload manuel) :
#   Le flag /tmp/onscen-pm2-reload-intentional supprime l'alerte pour CE redémarrage
#   (consommé à la prochaine détection d'incrément restart_time, pas de fenêtre 15 min).
#   Deploy : commun/deploy/deploy_zero_downtime.ps1 pose le flag automatiquement.
#   Manuel : bash /opt/onscen/deploy/pm2-reload-intentional.sh [reload|restart]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/onscen-root.sh
source "${SCRIPT_DIR}/lib/onscen-root.sh"
ENV_FILE="${ROOT}/.env"
LOG_FILE="${ROOT}/logs/monitor-alerts.log"
PREV_RESTART_FILE="/tmp/onscen_pm2_restarts"
INTENTIONAL_RELOAD_FLAG="/tmp/onscen-pm2-reload-intentional"
PM2_RELOAD_FLAG_STALE_SECS="${PM2_RELOAD_FLAG_STALE_SECS:-86400}"   # 24h — nettoyage flags orphelins
PM2_APP="${PM2_APP:-onscen-backend}"

DISK_THRESHOLD="${ALERT_DISK_PERCENT:-80}"
RAM_THRESHOLD="${ALERT_RAM_PERCENT:-80}"
CPU_THRESHOLD="${ALERT_CPU_PERCENT:-80}"
COOLDOWN_SECS="${ALERT_COOLDOWN_SECS:-1800}"   # 30 min

mkdir -p "${ROOT}/logs"

# ── Lecture .env ──────────────────────────────────────────────────────────────
get_env() {
  local key="$1"
  local default="${2:-}"
  if [[ -f "$ENV_FILE" ]]; then
    local val
    val=$(grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | sed "s/^['\"]//;s/['\"]$//" | tr -d '\r') || true
    echo "${val:-$default}"
  else
    echo "$default"
  fi
}

SMTP_HOST=$(get_env SMTP_HOST "")
SMTP_PORT=$(get_env SMTP_PORT "587")
SMTP_USER=$(get_env SMTP_USER "")
SMTP_PASS=$(get_env SMTP_PASS "")
SMTP_FROM_RAW=$(get_env SMTP_FROM "")
SMTP_FROM="${SMTP_FROM_RAW:-OnScen Monitoring <${SMTP_USER}>}"
SMTP_ADMIN_EMAIL=$(get_env SMTP_ADMIN_EMAIL "admin@onscen.com")
ALERT_EXTRA_EMAILS=$(get_env ALERT_EXTRA_EMAILS "")

RESEND_API_KEY=$(get_env RESEND_API_KEY "")
RESEND_FROM_RAW=$(get_env RESEND_FROM "")
RESEND_FROM="${RESEND_FROM_RAW:-${SMTP_FROM_RAW:-OnScen Monitoring <onboarding@resend.dev>}}"

RESEND_ENABLED="false"
[[ -n "$RESEND_API_KEY" ]] && RESEND_ENABLED="true"

APP_ENV=$(get_env APP_ENV "production")
SMTP_ENABLED_FLAG=$(get_env SMTP_ENABLED "")
SMTP_VARS_OK="false"
[[ -n "$SMTP_HOST" && -n "$SMTP_USER" && -n "$SMTP_PASS" ]] && SMTP_VARS_OK="true"

SMTP_ENABLED="false"
if [[ "$SMTP_VARS_OK" == "true" ]]; then
  case "${SMTP_ENABLED_FLAG,,}" in
    true|1|yes) SMTP_ENABLED="true" ;;
    false|0|no) SMTP_ENABLED="false" ;;
    *)
      if [[ "$APP_ENV" != "production" ]]; then SMTP_ENABLED="true"; fi
      ;;
  esac
fi

MAIL_ENABLED="false"
[[ "$RESEND_ENABLED" == "true" || "$SMTP_ENABLED" == "true" ]] && MAIL_ENABLED="true"

# ── Redémarrages PM2 intentionnels (deploy / manuel) ─────────────────────────
# Flag valide jusqu'à consommation (incrément restart_time détecté) ; pas d'expiration courte.
is_intentional_pm2_reload() {
  [[ -f "$INTENTIONAL_RELOAD_FLAG" ]] || return 1
  local file_ts now elapsed
  file_ts=$(head -1 "$INTENTIONAL_RELOAD_FLAG" 2>/dev/null || echo 0)
  [[ "$file_ts" =~ ^[0-9]+$ ]] || { rm -f "$INTENTIONAL_RELOAD_FLAG" 2>/dev/null || true; return 1; }
  now=$(date +%s)
  elapsed=$(( now - file_ts ))
  if [[ "$elapsed" -gt "$PM2_RELOAD_FLAG_STALE_SECS" ]]; then
    rm -f "$INTENTIONAL_RELOAD_FLAG" 2>/dev/null || true
    return 1
  fi
  return 0
}

intentional_pm2_reload_reason() {
  sed -n '2p' "$INTENTIONAL_RELOAD_FLAG" 2>/dev/null || echo "intentional"
}

# ── Cooldown (évite le spam d'alertes) ───────────────────────────────────────
is_coolingdown() {
  local name="$1"
  local lockfile="/tmp/onscen_alert_${name}"
  if [[ -f "$lockfile" ]]; then
    local last_ts now elapsed
    last_ts=$(stat -c %Y "$lockfile" 2>/dev/null || echo 0)
    now=$(date +%s)
    elapsed=$(( now - last_ts ))
    [[ "$elapsed" -lt "$COOLDOWN_SECS" ]] && return 0
  fi
  touch "$lockfile"
  return 1
}

# ── Envoi email (Resend HTTP API ou SMTP Python) ─────────────────────────────
send_alert_email() {
  local subject="$1"
  local body="$2"
  local ts
  ts=$(date '+%Y-%m-%d %H:%M:%S')

  echo "${ts}: ALERTE — ${subject}" >> "$LOG_FILE"

  if [[ "$MAIL_ENABLED" != "true" ]]; then
    echo "${ts}: Email non configuré — alerte non envoyée (RESEND_API_KEY ou SMTP_*)" >> "$LOG_FILE"
    return 0
  fi

  # Construire la liste des destinataires
  local recipients="$SMTP_ADMIN_EMAIL"
  if [[ -n "$ALERT_EXTRA_EMAILS" ]]; then
    recipients="${recipients},${ALERT_EXTRA_EMAILS}"
  fi
  # Toujours inclure admin@onscen.com
  if [[ "$recipients" != *"admin@onscen.com"* ]]; then
    recipients="${recipients},admin@onscen.com"
  fi

  if [[ "$RESEND_ENABLED" == "true" ]]; then
    local json_payload http_code response_file="/tmp/onscen_resend_response.json"
    json_payload=$(RESEND_FROM="$RESEND_FROM" MAIL_TO="$recipients" MAIL_SUBJECT="$subject" MAIL_BODY="$body" python3 - <<'PYEOF'
import json, os
print(json.dumps({
    "from": os.environ["RESEND_FROM"],
    "to": [a.strip() for a in os.environ["MAIL_TO"].split(",") if a.strip()],
    "subject": os.environ["MAIL_SUBJECT"],
    "text": os.environ["MAIL_BODY"],
}))
PYEOF
)
    http_code=$(curl -sS -o "$response_file" -w '%{http_code}' \
      -X POST 'https://api.resend.com/emails' \
      -H "Authorization: Bearer ${RESEND_API_KEY}" \
      -H 'Content-Type: application/json' \
      -d "$json_payload" 2>>"$LOG_FILE" || echo "000")

    if [[ "$http_code" -ge 200 && "$http_code" -lt 300 ]]; then
      echo "${ts}: Email envoyé via Resend : ${subject}" >> "$LOG_FILE"
      return 0
    fi

    echo "${ts}: Erreur Resend (HTTP ${http_code}) : $(cat "$response_file" 2>/dev/null || echo '(pas de réponse)')" >> "$LOG_FILE"
    return 1
  fi

  if [[ "$SMTP_ENABLED" != "true" ]]; then
    echo "${ts}: SMTP désactivé (production VPS : utiliser RESEND_API_KEY)" >> "$LOG_FILE"
    return 1
  fi

  # Fallback SMTP (local dev ou réseaux sans blocage ports 587/465)
  SMTP_HOST="$SMTP_HOST" \
  SMTP_PORT="$SMTP_PORT" \
  SMTP_USER="$SMTP_USER" \
  SMTP_PASS="$SMTP_PASS" \
  SMTP_FROM="$SMTP_FROM" \
  MAIL_TO="$recipients" \
  MAIL_SUBJECT="$subject" \
  MAIL_BODY="$body" \
  python3 - <<'PYEOF' 2>>"$LOG_FILE"
import os, smtplib, sys
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

host    = os.environ['SMTP_HOST']
port    = int(os.environ['SMTP_PORT'])
user    = os.environ['SMTP_USER']
passwd  = os.environ['SMTP_PASS']
from_   = os.environ['SMTP_FROM']
to_raw  = os.environ['MAIL_TO']
subject = os.environ['MAIL_SUBJECT']
body    = os.environ['MAIL_BODY']

to_list = [a.strip() for a in to_raw.split(',') if a.strip()]

msg = MIMEMultipart()
msg['From']    = from_
msg['To']      = ', '.join(to_list)
msg['Subject'] = subject
msg.attach(MIMEText(body, 'plain', 'utf-8'))

try:
    if port == 465:
        with smtplib.SMTP_SSL(host, port) as s:
            s.login(user, passwd)
            s.sendmail(from_, to_list, msg.as_string())
    else:
        with smtplib.SMTP(host, port, timeout=15) as s:
            s.ehlo()
            s.starttls()
            s.login(user, passwd)
            s.sendmail(from_, to_list, msg.as_string())
    print(f"Email envoyé : {subject}")
except Exception as e:
    print(f"Erreur SMTP : {e}", file=sys.stderr)
    sys.exit(1)
PYEOF
}

HOSTNAME_VAL=$(hostname 2>/dev/null || echo "vps")
SERVER_LINE="Serveur : onscen.com (51.159.164.100 — ${HOSTNAME_VAL})"
ADMIN_URL="https://onscen.com/admin?tab=monitoring"

# ── Vérification disque ───────────────────────────────────────────────────────
DISK_USED=$(df / | awk 'NR==2 {gsub(/%/,"",$5); print int($5)}' 2>/dev/null || echo "0")
if [[ "$DISK_USED" -ge "$DISK_THRESHOLD" ]]; then
  if ! is_coolingdown "disk"; then
    DF_OUTPUT=$(df -h / 2>/dev/null | tail -1)
    SEVERITY=$( [[ "$DISK_USED" -ge 95 ]] && echo "CRITIQUE" || echo "AVERTISSEMENT" )
    send_alert_email \
      "💾 [OnScen ${SEVERITY}] Disque ${DISK_USED}% — seuil ${DISK_THRESHOLD}%" \
      "Stockage disque élevé sur onscen.com

${SERVER_LINE}
Heure     : $(date '+%Y-%m-%d %H:%M:%S %Z')
Valeur    : ${DISK_USED}% (seuil : ${DISK_THRESHOLD}%)
Détail    : ${DF_OUTPUT}

Voir : ${ADMIN_URL}"
  fi
fi

# ── Vérification RAM ──────────────────────────────────────────────────────────
RAM_INFO=$(free 2>/dev/null | grep "^Mem:" || echo "")
if [[ -n "$RAM_INFO" ]]; then
  RAM_TOTAL=$(echo "$RAM_INFO" | awk '{print $2}')
  RAM_USED=$(echo "$RAM_INFO" | awk '{print $3}')
  RAM_PERCENT=$(( 100 * RAM_USED / (RAM_TOTAL > 0 ? RAM_TOTAL : 1) ))
  if [[ "$RAM_PERCENT" -ge "$RAM_THRESHOLD" ]]; then
    if ! is_coolingdown "ram"; then
      FREE_OUTPUT=$(free -h 2>/dev/null || echo "(unavailable)")
      SEVERITY=$( [[ "$RAM_PERCENT" -ge 95 ]] && echo "CRITIQUE" || echo "AVERTISSEMENT" )
      send_alert_email \
        "🧠 [OnScen ${SEVERITY}] RAM ${RAM_PERCENT}% — seuil ${RAM_THRESHOLD}%" \
        "RAM élevée sur onscen.com

${SERVER_LINE}
Heure  : $(date '+%Y-%m-%d %H:%M:%S %Z')
Valeur : ${RAM_PERCENT}% (seuil : ${RAM_THRESHOLD}%)
free -h :
${FREE_OUTPUT}

Voir : ${ADMIN_URL}"
    fi
  fi
fi

# ── Vérification CPU ──────────────────────────────────────────────────────────
CPU_CORES=$(nproc 2>/dev/null || echo "1")
LOAD_AVG=$(awk '{print $1}' /proc/loadavg 2>/dev/null || echo "0")
CPU_PERCENT=$(python3 -c "
import sys
try:
    pct = int(float('${LOAD_AVG}') / max(int('${CPU_CORES}'), 1) * 100)
    print(min(pct, 999))
except:
    print(0)
" 2>/dev/null || echo "0")
if [[ "$CPU_PERCENT" -ge "$CPU_THRESHOLD" ]]; then
  if ! is_coolingdown "cpu"; then
    SEVERITY=$( [[ "$CPU_PERCENT" -ge 95 ]] && echo "CRITIQUE" || echo "AVERTISSEMENT" )
    TOP_OUTPUT=$(top -bn1 2>/dev/null | head -15 || echo "(unavailable)")
    send_alert_email \
      "⚙️ [OnScen ${SEVERITY}] CPU ${CPU_PERCENT}% — seuil ${CPU_THRESHOLD}%" \
      "CPU élevé sur onscen.com

${SERVER_LINE}
Heure     : $(date '+%Y-%m-%d %H:%M:%S %Z')
Valeur    : ${CPU_PERCENT}% (load avg 1m : ${LOAD_AVG}, ${CPU_CORES} cœur(s), seuil : ${CPU_THRESHOLD}%)
top -bn1 :
${TOP_OUTPUT}

Voir : ${ADMIN_URL}"
  fi
fi

# ── Vérification redémarrages PM2 ────────────────────────────────────────────
if command -v pm2 &>/dev/null; then
  PM2_RESTARTS=$(pm2 jlist 2>/dev/null | python3 -c "
import json, sys
try:
    apps = json.load(sys.stdin)
    for app in apps:
        if app.get('name') == '${PM2_APP}':
            print(app.get('pm2_env', {}).get('restart_time', 0))
            sys.exit(0)
    print(0)
except Exception as e:
    print(-1)
" 2>/dev/null || echo "-1")

  if [[ "$PM2_RESTARTS" =~ ^[0-9]+$ ]]; then
    PREV="0"
    [[ -f "$PREV_RESTART_FILE" ]] && PREV=$(cat "$PREV_RESTART_FILE" 2>/dev/null || echo "0")
    echo "$PM2_RESTARTS" > "$PREV_RESTART_FILE"

    # Alerte seulement si le compteur a augmenté (et n'est pas la première lecture)
    if [[ "$PM2_RESTARTS" -gt "$PREV" && "$PREV" != "0" ]]; then
      DIFF=$(( PM2_RESTARTS - PREV ))
      if is_intentional_pm2_reload; then
        RELOAD_REASON=$(intentional_pm2_reload_reason)
        rm -f "$INTENTIONAL_RELOAD_FLAG" 2>/dev/null || true
        echo "$(date '+%Y-%m-%d %H:%M:%S'): PM2 restart +${DIFF} intentionnel (${RELOAD_REASON}) — alerte ignorée" >> "$LOG_FILE"
      else
        PM2_LOGS=$(pm2 logs "${PM2_APP}" --lines 30 --nostream 2>/dev/null || echo "(logs indisponibles)")
        # PM2 crash = forcer l'envoi (bypass cooldown)
        rm -f "/tmp/onscen_alert_pm2_crash" 2>/dev/null || true
        send_alert_email \
          "💥 [OnScen CRITIQUE] Redémarrage PM2 détecté (+${DIFF})" \
          "Crash PM2 détecté sur onscen.com

${SERVER_LINE}
Heure          : $(date '+%Y-%m-%d %H:%M:%S %Z')
App PM2        : ${PM2_APP}
Redémarrages   : ${PM2_RESTARTS} total (+${DIFF} depuis la dernière vérification)

Derniers logs PM2 :
${PM2_LOGS}

Voir : ${ADMIN_URL}"
      fi
    fi
  fi
fi

# ── Log fin de vérification ───────────────────────────────────────────────────
echo "$(date '+%Y-%m-%d %H:%M:%S'): OK — disk=${DISK_USED}%, ram=${RAM_PERCENT:-?}%, cpu=${CPU_PERCENT}%, pm2_restarts=${PM2_RESTARTS:--}" >> "$LOG_FILE"
