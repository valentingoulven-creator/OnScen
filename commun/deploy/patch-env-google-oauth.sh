#!/usr/bin/env bash
# Merge Google OAuth vars into /opt/onscen/.env without printing secrets.
# Expected env: GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET
# Optional: YOUTUBE_API_KEY
# Callbacks are forced to onscen.com (never copy localhost from msdev).
set -euo pipefail

ROOT="${ONSCEN_ROOT:-/opt/onscen}"
ENV_FILE="${ENV_FILE:-${ROOT}/.env}"
CLIENT_ID="${GOOGLE_CLIENT_ID:-}"
CLIENT_SECRET="${GOOGLE_CLIENT_SECRET:-}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERREUR — .env introuvable : $ENV_FILE" >&2
  exit 1
fi
if [[ -z "$CLIENT_ID" || -z "$CLIENT_SECRET" ]]; then
  echo "ERREUR — GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET requis" >&2
  exit 1
fi
if [[ "$CLIENT_ID" != *.apps.googleusercontent.com ]]; then
  echo "ERREUR — GOOGLE_CLIENT_ID ne ressemble pas à un client Web Google" >&2
  exit 1
fi
if [[ "$CLIENT_ID" == *localhost* || "$CLIENT_SECRET" == *localhost* ]]; then
  echo "ERREUR — valeurs localhost refusées" >&2
  exit 1
fi

cp -a "$ENV_FILE" "${ENV_FILE}.bak-google-$(date +%Y%m%d%H%M%S)"

python3 - "$ENV_FILE" "$CLIENT_ID" "$CLIENT_SECRET" <<'PY'
import re, sys
path, client_id, client_secret = sys.argv[1:4]
updates = {
    "GOOGLE_CLIENT_ID": client_id,
    "GOOGLE_CLIENT_SECRET": client_secret,
    "GOOGLE_CALLBACK_URL": "https://onscen.com/api/auth/google/callback",
    "YOUTUBE_CALLBACK_URL": "https://onscen.com/api/auth/youtube/callback",
    "GOOGLE_OAUTH_PROD_ENABLED": "1",
}
with open(path, "r", encoding="utf-8", errors="replace") as f:
    lines = f.read().splitlines()
out = []
seen = set()
for line in lines:
    m = re.match(r"^([A-Z_][A-Z0-9_]*)=", line)
    if m and m.group(1) in updates:
        key = m.group(1)
        out.append(f"{key}={updates[key]}")
        seen.add(key)
    else:
        out.append(line)
for key, val in updates.items():
    if key not in seen:
        out.append(f"{key}={val}")
text = "\n".join(out).rstrip() + "\n"
with open(path, "w", encoding="utf-8", newline="\n") as f:
    f.write(text)
print("OK — Google OAuth vars merged")
print("GOOGLE_CLIENT_ID_prefix=", client_id.split("-")[0])
print("GOOGLE_OAUTH_PROD_ENABLED=1")
print("GOOGLE_CALLBACK_URL=https://onscen.com/api/auth/google/callback")
print("YOUTUBE_CALLBACK_URL=https://onscen.com/api/auth/youtube/callback")
PY
