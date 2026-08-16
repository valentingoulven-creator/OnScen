#!/usr/bin/env bash
# Cloud Agent — installation idempotente (Ubuntu VM).
# Appelé à chaque démarrage d'agent via .cursor/environment.json → install
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "[cloud-install] OnScen — deps + env msdev"

# Fichiers env de base (sans secrets) si absents
if [[ ! -f commun/msdev/.env ]] && [[ -f commun/msdev/.env.example ]]; then
  cp commun/msdev/.env.example commun/msdev/.env
fi
if [[ ! -f web/app/.env.development ]] && [[ -f web/app/.env.development.example ]]; then
  cp web/app/.env.development.example web/app/.env.development
fi

# Secrets dashboard → fichiers .env locaux VM
if command -v node >/dev/null 2>&1; then
  node .cursor/cloud-materialize-env.mjs || true
fi

echo "[cloud-install] npm install web/app"
npm install --prefix web/app --no-audit --no-fund

echo "[cloud-install] npm install commun/backend"
npm install --prefix commun/backend --no-audit --no-fund

echo "[cloud-install] npm install ios/apptel (Capacitor / tel PWA)"
npm install --prefix ios/apptel --no-audit --no-fund

echo "[cloud-install] typecheck ios/apptel (sans Xcode)"
if [[ -f ios/apptel/tsconfig.app.json ]]; then
  (cd ios/apptel && npx tsc --noEmit -p tsconfig.app.json) || {
    echo "[cloud-install] WARN — typecheck apptel en échec (voir logs ci-dessus)"
  }
fi

echo "[cloud-install] OK — terminals soundy-api + soundy-web + onscen-tel (:4082/tel/)"
