#!/usr/bin/env bash
# setup-redis-vps.sh — Redis local (127.0.0.1:6379) + REDIS_URL dans .env
# Usage (root sur VPS) : bash /opt/soundly/deploy/setup-redis-vps.sh
set -euo pipefail

ENV_FILE="${ENV_FILE:-/opt/soundy/.env}"

log() { echo "[redis-setup] $*"; }

ensure_env_key() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    log "${key} déjà défini — ignoré"
  else
    echo "${key}=${value}" >> "$ENV_FILE"
    log "Ajouté ${key}=${value}"
  fi
}

install_redis() {
  if command -v redis-cli >/dev/null 2>&1 && redis-cli ping 2>/dev/null | grep -q PONG; then
    log "Redis déjà actif ($(redis-cli ping))"
    return 0
  fi
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq redis-server
  sed -i 's/^supervised no/supervised systemd/' /etc/redis/redis.conf 2>/dev/null || true
  systemctl enable redis-server
  systemctl restart redis-server
  redis-cli ping
  log "Redis installé — écoute 127.0.0.1:6379"
}

main() {
  if [[ ! -f "$ENV_FILE" ]]; then
    log "WARN: $ENV_FILE absent — Redis installé sans mise à jour .env"
    install_redis
    exit 0
  fi
  install_redis
  ensure_env_key "REDIS_URL" "redis://127.0.0.1:6379"
  log "Terminé. Recharger PM2 : pm2 reload <app> --update-env"
}

main "$@"
