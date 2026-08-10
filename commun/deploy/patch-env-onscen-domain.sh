#!/usr/bin/env bash
# patch-env-onscen-domain.sh — WEB_APP_URL + CORS multi-origines pour onscen.com
# Usage : bash patch-env-onscen-domain.sh prod|staging
set -euo pipefail

ROLE="${1:-}"
ENV_FILE="${ENV_FILE:-/opt/onscen/.env}"
[[ -f "$ENV_FILE" ]] || ENV_FILE="/opt/soundly/.env"

if [[ "$ROLE" != "prod" && "$ROLE" != "staging" ]]; then
  echo "Usage: $0 prod|staging" >&2
  exit 1
fi
[[ -f "$ENV_FILE" ]] || { echo ".env introuvable" >&2; exit 1; }

cp -a "$ENV_FILE" "${ENV_FILE}.bak.onscen-domain"

if [[ "$ROLE" == "prod" ]]; then
  WEB='https://onscen.com'
  CORS='https://onscen.com,https://www.onscen.com,https://getsoundy.com,https://www.getsoundy.com'
else
  WEB='https://staging.onscen.com'
  CORS='https://staging.onscen.com,https://staging.getsoundy.com'
fi

set_kv() {
  local key="$1" val="$2"
  if grep -q "^${key}=" "$ENV_FILE"; then
    sed -i "s|^${key}=.*|${key}=${val}|" "$ENV_FILE"
  else
    echo "${key}=${val}" >> "$ENV_FILE"
  fi
}

set_kv WEB_APP_URL "$WEB"
set_kv CORS_ORIGIN "$CORS"
set_kv WEBAUTHN_RP_ID "$(echo "$WEB" | sed -E 's|https?://||; s|/.*||')"
set_kv WEBAUTHN_ORIGIN "$WEB"

echo "PATCH_ENV_ONSCEN_DOMAIN_OK role=$ROLE WEB_APP_URL=$WEB"
