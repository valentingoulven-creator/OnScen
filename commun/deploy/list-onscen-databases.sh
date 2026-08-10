#!/usr/bin/env bash
set -a
source "${1:-/opt/soundly/.env}"
set +a
ADMIN_URL="$(python3 - <<'PY'
import os
from urllib.parse import urlparse, urlunparse
u = urlparse(os.environ["DATABASE_URL"])
print(urlunparse(u._replace(path="/postgres")))
PY
)"
psql "$ADMIN_URL" -Atc "SELECT datname FROM pg_database WHERE datname IN ('soundy','soundy_staging','onscen-prod','onscen_staging') ORDER BY 1"
