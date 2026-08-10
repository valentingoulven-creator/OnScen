#!/usr/bin/env bash
# patch-env-turnstile.sh — Ajoute ou met à jour Turnstile dans /opt/onscen/.env (sans afficher les secrets).
# Usage (sur VPS) :
#   TURNSTILE_SITE_KEY=... TURNSTILE_SECRET_KEY=... TURNSTILE_REQUIRED=1 bash patch-env-turnstile.sh
# Ou depuis le repo :
#   ssh onscen-staging 'bash -s' < commun/deploy/patch-env-turnstile.sh  (avec exports avant)

set -euo pipefail

ROOT="${ONSCEN_ROOT:-/opt/onscen}"
ENV_FILE="${ENV_FILE:-${ROOT}/.env}"

SITE_KEY="${TURNSTILE_SITE_KEY:-}"
SECRET_KEY="${TURNSTILE_SECRET_KEY:-}"
REQUIRED="${TURNSTILE_REQUIRED:-1}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERREUR — .env introuvable : $ENV_FILE" >&2
  exit 1
fi
if [[ -z "$SITE_KEY" || -z "$SECRET_KEY" ]]; then
  echo "ERREUR — TURNSTILE_SITE_KEY et TURNSTILE_SECRET_KEY requis" >&2
  exit 1
fi

python3 - "$ENV_FILE" "$SITE_KEY" "$SECRET_KEY" "$REQUIRED" <<'PY'
import re, sys
path, site, secret, req = sys.argv[1:5]
updates = {
    "TURNSTILE_SITE_KEY": site,
    "TURNSTILE_SECRET_KEY": secret,
    "TURNSTILE_REQUIRED": req,
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
print("OK — Turnstile vars mises à jour dans", path)
PY
