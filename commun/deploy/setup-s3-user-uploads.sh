#!/usr/bin/env bash
# setup-s3-user-uploads.sh — Bucket Object Storage pour uploads runtime (S3_BUCKET)
#
# Distinct de SCW_BUCKET (backup-offsite.sh). Active objectStorage.ts côté backend.
#
# Usage local (CLI scw) :
#   bash commun/deploy/setup-s3-user-uploads.sh
# Usage VPS (test connexion après .env rempli) :
#   bash /opt/soundily/deploy/setup-s3-user-uploads.sh --vps-only
#
set -euo pipefail

BUCKET="${S3_BUCKET:-soundy-uploads}"
REGION="${S3_REGION:-fr-par}"
ENDPOINT="${S3_ENDPOINT:-https://s3.${REGION}.scw.cloud}"
VPS_ONLY=0

for arg in "$@"; do
  case "$arg" in
    --vps-only) VPS_ONLY=1 ;;
  esac
done

log() { echo "$(date '+%Y-%m-%d %H:%M:%S'): $*"; }

print_env_template() {
  cat <<EOF

# Ajouter à /opt/soundily/.env (jamais committer) :
S3_BUCKET=${BUCKET}
S3_REGION=${REGION}
S3_ENDPOINT=${ENDPOINT}
S3_ACCESS_KEY_ID=<iam-access-key>
S3_SECRET_ACCESS_KEY=<iam-secret-key>
S3_PUBLIC_BASE_URL=https://${BUCKET}.s3.${REGION}.scw.cloud
# ou CDN custom une fois Cloudflare P1 actif :
# S3_PUBLIC_BASE_URL=https://cdn.getsoundy.com
S3_FORCE_PATH_STYLE=0
S3_PUBLIC_READ=1

# Puis :
# pm2 reload onscen-backend --update-env
# Log attendu : [startup] S3 uploads actifs — bucket ${BUCKET}

EOF
}

create_bucket_with_scw() {
  if ! command -v scw >/dev/null 2>&1; then
    log "scw CLI absent — créer le bucket dans la console Scaleway Object Storage"
    return 1
  fi
  if scw object bucket list "region=${REGION}" 2>/dev/null | grep -q "${BUCKET}"; then
    log "bucket déjà existant : ${BUCKET}"
  else
    scw object bucket create "name=${BUCKET}" "region=${REGION}" acl=private
    log "bucket créé : ${BUCKET}"
  fi
}

test_vps_upload_env() {
  local root="${ONSCEN_ROOT:-/opt/soundily}"
  if [[ -f "${root}/.env" ]]; then
    set -a
    # shellcheck source=/dev/null
    source "${root}/.env"
    set +a
  fi
  if [[ -z "${S3_BUCKET:-}" || -z "${S3_ACCESS_KEY_ID:-}" || -z "${S3_SECRET_ACCESS_KEY:-}" ]]; then
    log "WARN: S3_BUCKET ou clés manquantes dans ${root}/.env"
    print_env_template
    return 1
  fi
  log "S3_BUCKET=${S3_BUCKET} — tester un upload via l'app (avatar / sponsor)"
  log "Scripts utiles : commun/backend/src/scripts/find-orphaned-s3-uploads.ts"
}

main() {
  log "Setup uploads utilisateur (bucket=${BUCKET}, region=${REGION})"
  if [[ "$VPS_ONLY" -eq 1 ]]; then
    test_vps_upload_env
    return $?
  fi
  create_bucket_with_scw || true
  print_env_template
  log "Console : https://console.scaleway.com/object-storage"
  log "Doc : commun/deploy/OPS-PRIORITIES.md § P3c"
}

main "$@"
