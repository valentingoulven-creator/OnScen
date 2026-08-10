#!/usr/bin/env bash
set -euo pipefail
# setup-scaleway-object-storage.sh - Object Storage for backup-offsite.sh
BUCKET="${SCW_BUCKET:-onscen-backups}"
REGION="${SCW_REGION:-fr-par}"
VPS_ONLY=0
for arg in "$@"; do case "$arg" in --vps-only) VPS_ONLY=1 ;; esac; done
log() { echo "$(date '+%Y-%m-%d %H:%M:%S'): $*"; }
install_awscli_vps() {
  if command -v aws >/dev/null 2>&1; then
    log "aws CLI present"
    return 0
  fi
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq awscli
  log "awscli installed"
}
create_bucket_with_scw() {
  if ! command -v scw >/dev/null 2>&1; then
    log "scw CLI missing - create bucket in Scaleway console"
    return 1
  fi
  if scw object bucket list region=${REGION} 2>/dev/null | grep -q ${BUCKET}; then
    log "bucket already exists: ${BUCKET}"
  else
    scw object bucket create name=${BUCKET} region=${REGION} acl=private
    log "bucket created: ${BUCKET}"
  fi
}
print_env_template() {
  echo
  echo "# Add to /opt/onscen/.env (never commit):"
  echo "SCW_BUCKET=${BUCKET}"
  echo "SCW_REGION=${REGION}"
  echo "SCW_ACCESS_KEY=<iam-access-key>"
  echo "SCW_SECRET_KEY=<iam-secret-key>"
  echo
}
main() {
  log "Scaleway Object Storage setup (bucket=${BUCKET}, region=${REGION})"
  if [[ "$VPS_ONLY" -eq 1 ]]; then
    install_awscli_vps
    if [[ -f /opt/onscen/.env ]] && grep -q '^SCW_BUCKET=' /opt/onscen/.env; then
      set -a; source /opt/onscen/.env; set +a
      if [[ -n "${SCW_ACCESS_KEY:-}" && -n "${SCW_SECRET_KEY:-}" ]]; then
        bash /opt/onscen/deploy/backup-offsite.sh
      else
        log "WARN: SCW_BUCKET set but keys missing"
      fi
    else
      log "SCW_BUCKET not in /opt/onscen/.env"
      print_env_template
    fi
    return 0
  fi
  create_bucket_with_scw || true
  print_env_template
  log "Console: https://console.scaleway.com/object-storage"
}
main "$@"
