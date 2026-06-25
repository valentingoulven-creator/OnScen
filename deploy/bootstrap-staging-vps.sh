#!/usr/bin/env bash
# bootstrap-staging-vps.sh — Premiere installation VPS staging (Ubuntu 22.04)
# Usage (sur le VPS staging, en root) :
#   curl -fsSL ... | bash
#   ou : bash deploy/bootstrap-staging-vps.sh
set -euo pipefail

echo ">> Soundy staging — bootstrap VPS"

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl git ca-certificates gnupg lsb-release ufw

# Node.js 20 LTS
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs
fi

# PM2
if ! command -v pm2 >/dev/null 2>&1; then
  npm install -g pm2
fi

# Caddy
if ! command -v caddy >/dev/null 2>&1; then
  apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq
  apt-get install -y -qq caddy
fi

# Coturn (WebRTC fallback — optionnel, meme config que prod)
if ! command -v turnserver >/dev/null 2>&1; then
  apt-get install -y -qq coturn || true
fi

# Firewall minimal
ufw allow OpenSSH || true
ufw allow 80/tcp || true
ufw allow 443/tcp || true
ufw allow 3478/tcp || true
ufw allow 3478/udp || true
ufw --force enable || true

mkdir -p /opt/soundly/{dist,deploy,public,logs,backups,data,public/uploads}
mkdir -p /etc/caddy/certs

echo "BOOTSTRAP_OK node=$(node -v) pm2=$(pm2 -v 2>/dev/null || echo n/a) caddy=$(caddy version 2>/dev/null | head -1)"
