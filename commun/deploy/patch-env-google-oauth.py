#!/usr/bin/env python3
"""Merge Google OAuth into /opt/onscen/.env. Reads KEY=val from argv file. No secret prints."""
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from shutil import copy2

SRC = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/onscen-google-oauth.src.env")
ENV_FILE = Path("/opt/onscen/.env")

src = {}
for raw in SRC.read_text(encoding="utf-8", errors="replace").splitlines():
    line = raw.strip().lstrip("\ufeff")
    if not line or line.startswith("#") or "=" not in line:
        continue
    k, _, v = line.partition("=")
    src[k.strip()] = v.strip().strip("'\"")

client_id = src.get("GOOGLE_CLIENT_ID", "")
client_secret = src.get("GOOGLE_CLIENT_SECRET", "")
if not client_id.endswith(".apps.googleusercontent.com"):
    raise SystemExit("invalid client id")
if client_id.startswith("522947046161"):
    raise SystemExit("refusing deleted_client id")
if not client_secret:
    raise SystemExit("missing secret")

updates = {
    "GOOGLE_CLIENT_ID": client_id,
    "GOOGLE_CLIENT_SECRET": client_secret,
    "GOOGLE_CALLBACK_URL": "https://onscen.com/api/auth/google/callback",
    "YOUTUBE_CALLBACK_URL": "https://onscen.com/api/auth/youtube/callback",
    "GOOGLE_OAUTH_PROD_ENABLED": "1",
}

bak = ENV_FILE.with_name(f".env.bak-google-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}")
copy2(ENV_FILE, bak)

lines = ENV_FILE.read_text(encoding="utf-8", errors="replace").splitlines()
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
ENV_FILE.write_text("\n".join(out).rstrip() + "\n", encoding="utf-8", newline="\n")

print("OK merged")
print("BACKUP", bak.name)
print("PROD_CLIENT_PREFIX", client_id.split("-")[0])
print("GOOGLE_OAUTH_PROD_ENABLED=1")
print("GOOGLE_CALLBACK_URL=https://onscen.com/api/auth/google/callback")
print("YOUTUBE_CALLBACK_URL=https://onscen.com/api/auth/youtube/callback")
print("STILL_OLD_DELETED", client_id.startswith("522947046161"))
