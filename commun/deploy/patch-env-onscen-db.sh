#!/usr/bin/env bash
# patch-env-onscen-db.sh — Met à jour DATABASE_URL dans .env après rename PG.
# Usage : bash patch-env-onscen-db.sh /opt/soundly/.env staging|prod
set -euo pipefail

ENV_FILE="${1:-}"
ROLE="${2:-}"
[[ -f "$ENV_FILE" ]] || { echo "Fichier .env introuvable" >&2; exit 1; }

cp -a "$ENV_FILE" "${ENV_FILE}.bak.onscen-migrate"

python3 - <<PY
import re
from pathlib import Path
p = Path("$ENV_FILE")
role = "$ROLE"
text = p.read_text(encoding="utf-8")
lines = []
for line in text.splitlines():
    if line.startswith("DATABASE_URL="):
        v = line.split("=", 1)[1]
        if role == "staging":
            v = re.sub(r"/soundy_staging(\?|$)", r"/onscen_staging\1", v)
        else:
            v = re.sub(r"/soundy(\?|$)", r"/onscen-prod\1", v)
        line = "DATABASE_URL=" + v
    lines.append(line)
p.write_text("\n".join(lines) + ("\n" if text.endswith("\n") else ""), encoding="utf-8")
print("PATCH_ENV_ONSCEN_OK", p)
PY
