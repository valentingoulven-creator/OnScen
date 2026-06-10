#!/usr/bin/env bash
# Soundy — PostgreSQL production (VPS ou Managed DB Scaleway)
# Usage :
#   Option A (recommandé prod) : créer une Managed DB PostgreSQL Paris, puis :
#     export DATABASE_URL='postgresql://soundy:SECRET@xxx.pg.sdb.scaleway.com:5432/soundy?sslmode=require'
#     ./deploy/postgres-setup.sh --migrate-only
#   Option B (MVP / petit trafic, VPS DEV1-S 1.9 Go RAM — serré) :
#     sudo ./deploy/postgres-setup.sh --local-docker
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$REPO_ROOT/backend"

MODE="${1:-}"

usage() {
  cat <<'EOF'
Soundy — postgres-setup.sh

  --migrate-only     Applique les migrations (DATABASE_URL requis dans l'environnement)
  --local-docker     Lance PostgreSQL 16 via Docker sur le VPS (port 5432 local)
  --local-apt        Installe PostgreSQL via apt (Ubuntu/Debian)
  --env-snippet      Affiche les variables à ajouter dans /opt/soundly/.env

Variables utiles :
  DATABASE_URL       postgresql://user:pass@host:5432/dbname
  PG_SSL=1           SSL pour Scaleway Managed DB (recommandé)
  PG_POOL_MAX=10     Taille du pool de connexions

⚠ VPS DEV1-S (1.9 Go RAM) : Postgres + Node + Caddy sur la même machine est limite.
  Préférez Scaleway Managed Database (~15 €/mo, Paris) pour la production.
EOF
}

migrate_only() {
  if [[ -z "${DATABASE_URL:-}" ]]; then
    echo "Erreur : DATABASE_URL non défini" >&2
    exit 1
  fi
  cd "$BACKEND_DIR"
  npm install --omit=dev
  npm run build
  node -e "
    require('dotenv').config();
    const { runMigrations } = require('./dist/db/migrate');
    runMigrations().then(() => console.log('Migrations OK')).catch((e) => { console.error(e); process.exit(1); });
  "
}

local_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    echo "Docker requis. Installez : curl -fsSL https://get.docker.com | sh" >&2
    exit 1
  fi
  DB_NAME="${SOUNDY_DB_NAME:-soundy}"
  DB_USER="${SOUNDY_DB_USER:-soundy}"
  DB_PASS="${SOUNDY_DB_PASS:-$(openssl rand -hex 16)}"
  docker run -d \
    --name soundy-postgres \
    --restart unless-stopped \
    -e POSTGRES_DB="$DB_NAME" \
    -e POSTGRES_USER="$DB_USER" \
    -e POSTGRES_PASSWORD="$DB_PASS" \
    -v soundy_pgdata:/var/lib/postgresql/data \
    -p 127.0.0.1:5432:5432 \
    postgres:16-alpine
  echo ""
  echo "PostgreSQL local démarré (container soundy-postgres)"
  echo "DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}"
  echo "Ajoutez cette ligne dans /opt/soundly/.env puis : ./deploy/postgres-setup.sh --migrate-only"
}

local_apt() {
  sudo apt-get update
  sudo apt-get install -y postgresql postgresql-contrib
  DB_NAME="${SOUNDY_DB_NAME:-soundy}"
  DB_USER="${SOUNDY_DB_USER:-soundy}"
  DB_PASS="${SOUNDY_DB_PASS:-$(openssl rand -hex 16)}"
  sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';
CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
SQL
  echo "DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}"
}

env_snippet() {
  cat <<'EOF'
# --- PostgreSQL production (Soundy) ---
APP_ENV=production
DATABASE_URL=postgresql://soundy:MOT_DE_PASSE@HOST:5432/soundy
# Scaleway Managed DB (Paris) :
# PG_SSL=1
# PG_POOL_MAX=10

# Admin initial (premier démarrage si base vide)
# PROD_ADMIN_EMAIL=admin@votredomaine.fr
# PROD_ADMIN_PASSWORD=changez-moi
# PROD_ADMIN_USERNAME=admin

# JWT obligatoire en production
# JWT_SECRET=...
EOF
}

case "$MODE" in
  --migrate-only) migrate_only ;;
  --local-docker) local_docker ;;
  --local-apt) local_apt ;;
  --env-snippet) env_snippet ;;
  -h|--help|"") usage ;;
  *) echo "Option inconnue : $MODE" >&2; usage; exit 1 ;;
esac
