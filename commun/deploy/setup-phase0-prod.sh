#!/usr/bin/env bash
# setup-phase0-prod.sh — Phase 0 stack scale (Redis + env S3) sur VPS prod
# Usage (root sur VPS) : bash /opt/onscen/deploy/setup-phase0-prod.sh
set -euo pipefail

ENV_FILE="${ENV_FILE:-/opt/onscen/.env}"
UPLOADS_BUCKET="${S3_BUCKET:-onscen-prod-uploads}"
REGION="${S3_REGION:-fr-par}"
S3_ENDPOINT="${S3_ENDPOINT:-https://s3.fr-par.scw.cloud}"

log() { echo "[phase0] $*"; }

ensure_env_key() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    log "${key} déjà défini — ignoré"
  else
    echo "${key}=${value}" >> "$ENV_FILE"
    log "Ajouté ${key}"
  fi
}

configure_s3_env() {
  if [[ ! -f "$ENV_FILE" ]]; then
    log "WARN: $ENV_FILE absent"
    return 0
  fi
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a

  ensure_env_key "PG_POOL_MAX" "15"

  if grep -q '^S3_BUCKET=' "$ENV_FILE"; then
    log "S3_BUCKET déjà configuré"
    return 0
  fi

  if [[ -z "${SCW_ACCESS_KEY:-}" || -z "${SCW_SECRET_KEY:-}" ]]; then
    log "SCW keys absentes — S3 uploads non configuré (local disk)"
    return 0
  fi

  ensure_env_key "S3_BUCKET" "$UPLOADS_BUCKET"
  ensure_env_key "S3_REGION" "$REGION"
  ensure_env_key "S3_ENDPOINT" "$S3_ENDPOINT"
  ensure_env_key "S3_ACCESS_KEY_ID" "$SCW_ACCESS_KEY"
  ensure_env_key "S3_SECRET_ACCESS_KEY" "$SCW_SECRET_KEY"
  ensure_env_key "S3_PUBLIC_BASE_URL" "https://${UPLOADS_BUCKET}.s3.${REGION}.scw.cloud"
  ensure_env_key "S3_PUBLIC_READ" "1"
  ensure_env_key "S3_FORCE_PATH_STYLE" "0"

  if command -v aws >/dev/null 2>&1; then
    export AWS_ACCESS_KEY_ID="$SCW_ACCESS_KEY"
    export AWS_SECRET_ACCESS_KEY="$SCW_SECRET_KEY"
    export AWS_DEFAULT_REGION="$REGION"
    if aws s3 ls "s3://${UPLOADS_BUCKET}" --endpoint-url "$S3_ENDPOINT" 2>/dev/null; then
      log "Bucket S3 existant: $UPLOADS_BUCKET"
    else
      aws s3 mb "s3://${UPLOADS_BUCKET}" --endpoint-url "$S3_ENDPOINT" && log "Bucket créé: $UPLOADS_BUCKET"
    fi
  else
    log "aws CLI absent — créer le bucket ${UPLOADS_BUCKET} dans la console Scaleway si besoin"
  fi
}

main() {
  log "Phase 0 prod — Redis + env S3"
  bash "$(dirname "$0")/setup-redis-vps.sh"
  configure_s3_env
  log "Terminé. Relancer PM2 : pm2 startOrReload /opt/onscen/deploy/ecosystem.config.cjs --update-env"
}

main "$@"
