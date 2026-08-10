#!/usr/bin/env bash
# Resolve OnScen app root on VPS — canonical /opt/onscen (legacy /opt/soundly|soundy still detected).
# Usage: source "$(dirname "${BASH_SOURCE[0]}")/onscen-root.sh"
if [ -z "${ONSCEN_ROOT:-}" ]; then
  if [ -f /opt/onscen/.env ]; then
    ONSCEN_ROOT=/opt/onscen
  elif [ -f /opt/onscen/.env ]; then
    ONSCEN_ROOT=/opt/onscen
  elif [ -d /opt/onscen ]; then
    ONSCEN_ROOT=/opt/onscen
  elif [ -d /opt/onscen ]; then
    ONSCEN_ROOT=/opt/onscen
  else
    ONSCEN_ROOT=/opt/onscen
  fi
fi
export ONSCEN_ROOT
ROOT="${ONSCEN_ROOT}"

# Deploy scripts: VPS uses $ROOT/deploy; local repo checkout uses $ROOT/commun/deploy
if [ -z "${DEPLOY_DIR:-}" ]; then
  _deploy_lib_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  if [ -f "$_deploy_lib_dir/../Caddyfile" ]; then
    DEPLOY_DIR="$(cd "$_deploy_lib_dir/.." && pwd)"
  elif [ -f "$ROOT/deploy/Caddyfile" ]; then
    DEPLOY_DIR="$ROOT/deploy"
  elif [ -f "$ROOT/commun/deploy/Caddyfile" ]; then
    DEPLOY_DIR="$ROOT/commun/deploy"
  else
    DEPLOY_DIR="$ROOT/deploy"
  fi
fi
export DEPLOY_DIR
