#!/usr/bin/env bash
# Audit presence of external service env vars (no secret values printed).
set -euo pipefail
ENV_FILE="${1:-/opt/soundy/.env}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "MISS env_file $ENV_FILE"
  exit 1
fi
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

check() {
  local name="$1"
  local val="${!name-}"
  if [[ -n "${val// /}" ]]; then
    echo "OK $name"
  else
    echo "MISS $name"
  fi
}

echo "=== ENV $(grep -E '^APP_ENV=' "$ENV_FILE" | cut -d= -f2- || echo unknown) ==="

# Infra
check DATABASE_URL
check REDIS_URL
check SCW_BUCKET
check SCW_ACCESS_KEY
check S3_BUCKET

# Streaming
check CLOUDFLARE_ACCOUNT_ID
check CLOUDFLARE_STREAM_API_TOKEN
check CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN
check LIVEKIT_URL
check LIVEKIT_API_KEY
check LIVEKIT_API_SECRET

# Moderation
check SIGHTENGINE_API_USER
check SIGHTENGINE_API_SECRET
check ACRCLOUD_ACCESS_KEY
check ACRCLOUD_ACCESS_SECRET

# Payments
check STRIPE_SECRET_KEY
check STRIPE_WEBHOOK_SECRET
check DONATIONS_ENABLED
check SUBSCRIPTIONS_ENABLED
check STRIPE_PRICE_ID_TIER1
check STRIPE_PRICE_ID_SOUNDY_PLUS

# Comms
check RESEND_API_KEY
check RESEND_FROM

# Auth / APIs
check GOOGLE_CLIENT_ID
check GOOGLE_CLIENT_SECRET
check GOOGLE_CALLBACK_URL
check YOUTUBE_CALLBACK_URL
check YOUTUBE_API_KEY
check FACEBOOK_APP_ID
check FACEBOOK_APP_SECRET
check INSTAGRAM_CALLBACK_URL

# Push / TURN / AI
check VAPID_PUBLIC_KEY
check VAPID_PRIVATE_KEY
check TURN_URL
check ANTHROPIC_API_KEY
check OPENAI_API_KEY

# Security / legal
check ENCRYPTION_KEY
check JWT_SECRET
check LEGAL_PUBLISHER_ADDRESS
