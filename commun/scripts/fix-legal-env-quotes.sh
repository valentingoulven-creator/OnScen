#!/usr/bin/env bash
set -euo pipefail
ENV_FILE="/opt/onscen/.env"
JSON_FILE="/opt/onscen/legal-publisher.json"
python3 <<'PY'
import json
from pathlib import Path

env_path = Path("/opt/onscen/.env")
json_path = Path("/opt/onscen/legal-publisher.json")
addr = json.loads(json_path.read_text(encoding="utf-8")).get("address", "")
if not addr:
    raise SystemExit("No address in legal-publisher.json")
escaped = addr.replace("\\", "\\\\").replace('"', '\\"')
lines = env_path.read_text(encoding="utf-8").splitlines(keepends=True)
out = []
found = False
for line in lines:
    if line.startswith("LEGAL_PUBLISHER_ADDRESS="):
        out.append(f'LEGAL_PUBLISHER_ADDRESS="{escaped}"\n')
        found = True
    else:
        out.append(line)
if not found:
    out.append(f'LEGAL_PUBLISHER_ADDRESS="{escaped}"\n')
env_path.write_text("".join(out), encoding="utf-8")
print("OK")
PY
bash -lc 'set -a; . /opt/onscen/.env; set +a; echo LEGAL_OK'
