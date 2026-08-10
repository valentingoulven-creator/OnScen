#!/usr/bin/env bash
# migrate-onscen-postgres.sh — Renomme bases PostgreSQL + rôle applicatif (Scaleway).
set -euo pipefail

ENV_FILE="${ENV_FILE:-/opt/soundly/.env}"
if [[ -f /opt/onscen/.env ]]; then ENV_FILE=/opt/onscen/.env; fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERREUR — .env introuvable" >&2
  exit 1
fi
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERREUR — DATABASE_URL absent" >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "ERREUR — psql absent" >&2
  exit 1
fi

ADMIN_URL="$(python3 - <<'PY'
import os
from urllib.parse import urlparse, urlunparse
raw = os.environ["DATABASE_URL"]
u = urlparse(raw)
u = u._replace(path="/postgres")
print(urlunparse(u))
PY
)"

log() { echo "[migrate-onscen-postgres] $*"; }

log "Terminaison connexions actives…"
psql "$ADMIN_URL" -v ON_ERROR_STOP=1 <<'SQL'
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname IN ('soundy', 'soundy_staging', 'onscen-prod', 'onscen_staging')
  AND pid <> pg_backend_pid();
SQL

log "Renommage bases (idempotent si déjà fait)…"
psql "$ADMIN_URL" -v ON_ERROR_STOP=0 <<'SQL'
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_database WHERE datname = 'soundy') THEN
    EXECUTE 'ALTER DATABASE soundy RENAME TO "onscen-prod"';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_database WHERE datname = 'soundy_staging') THEN
    EXECUTE 'ALTER DATABASE soundy_staging RENAME TO onscen_staging';
  END IF;
END $$;
SQL

log "Renommage rôle soundy → onscen (si présent)…"
psql "$ADMIN_URL" -v ON_ERROR_STOP=0 -c "ALTER ROLE soundy RENAME TO onscen;" || true

log "MIGRATE_ONSCEN_POSTGRES_OK"
