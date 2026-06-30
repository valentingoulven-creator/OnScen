#!/usr/bin/env bash
# migrate-remote.sh — Applique les migrations PostgreSQL sur le VPS
# Usage (sur le VPS) : bash /opt/soundly/deploy/migrate-remote.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/soundy-root.sh
source "$SCRIPT_DIR/lib/soundy-root.sh"
cd "$ROOT"

if [ ! -f dist/db/migrate.js ]; then
  echo "MIGRATE_SKIP=1"
  exit 0
fi

if [ ! -f .env ]; then
  echo "ERREUR — .env absent dans $ROOT" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
. ./.env
set +a

node -r dotenv/config -e "
const { runMigrations } = require('./dist/db/migrate');
runMigrations()
  .then(() => { console.log('MIGRATE_OK'); process.exit(0); })
  .catch((e) => { console.error(e); process.exit(1); });
"
