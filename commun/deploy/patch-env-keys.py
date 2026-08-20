#!/usr/bin/env python3
"""Merge KEY=val from src file into /opt/onscen/.env. Prints key names only."""
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from shutil import copy2

if len(sys.argv) < 3:
    raise SystemExit("usage: patch-env-keys.py SRC.env key1 [key2...]")

src_path = Path(sys.argv[1])
wanted = sys.argv[2:]
env_file = Path("/opt/onscen/.env")

src = {}
for raw in src_path.read_text(encoding="utf-8", errors="replace").splitlines():
    line = raw.strip().lstrip("\ufeff")
    if not line or line.startswith("#") or "=" not in line:
        continue
    k, _, v = line.partition("=")
    src[k.strip()] = v.strip().strip("'\"")

updates = {}
for key in wanted:
    if key not in src or not src[key]:
        raise SystemExit(f"missing {key} in src")
    updates[key] = src[key]

bak = env_file.with_name(
    f".env.bak-keys-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
)
copy2(env_file, bak)

lines = env_file.read_text(encoding="utf-8", errors="replace").splitlines()
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
env_file.write_text("\n".join(out).rstrip() + "\n", encoding="utf-8", newline="\n")
print("OK merged", ",".join(wanted), "backup", bak.name)
for key, val in updates.items():
    print(f"{key}_len={len(val)} prefix={val[:4]}")
