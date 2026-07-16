#!/usr/bin/env node
/** Audit .env keys for external services — prints OK/MISS (no values). */
const fs = require('fs');
const path = process.argv[2] || '/opt/soundly/.env';

const GROUPS = {
  infra: [
    'DATABASE_URL',
    'REDIS_URL',
    'SCW_BUCKET',
    'SCW_ACCESS_KEY',
    'SCW_SECRET_KEY',
    'S3_BUCKET',
    'S3_ACCESS_KEY_ID',
  ],
  streaming: [
    'CLOUDFLARE_ACCOUNT_ID',
    'CLOUDFLARE_STREAM_API_TOKEN',
    'CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN',
    'LIVEKIT_URL',
    'LIVEKIT_API_KEY',
    'LIVEKIT_API_SECRET',
    'TURN_URL',
    'TURN_USERNAME',
    'TURN_CREDENTIAL',
  ],
  moderation: ['SIGHTENGINE_API_USER', 'SIGHTENGINE_API_SECRET', 'ACRCLOUD_ACCESS_KEY', 'ACRCLOUD_ACCESS_SECRET'],
  payments: [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'STRIPE_PRICE_ID_TIER1',
    'STRIPE_PRICE_ID_TIER2',
    'STRIPE_PRICE_ID_SOUNDY_PLUS',
    'STRIPE_PRICE_ID_SOUNDY_ULTRA',
    'DONATIONS_ENABLED',
    'SUBSCRIPTIONS_ENABLED',
  ],
  comms: ['RESEND_API_KEY', 'RESEND_FROM', 'SMTP_ADMIN_EMAIL'],
  auth: [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_CALLBACK_URL',
    'YOUTUBE_CALLBACK_URL',
    'YOUTUBE_API_KEY',
    'FACEBOOK_APP_ID',
    'FACEBOOK_APP_SECRET',
    'INSTAGRAM_CALLBACK_URL',
  ],
  push_ai: ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'SENTRY_DSN'],
  legal: ['LEGAL_PUBLISHER_ADDRESS', 'ENCRYPTION_KEY', 'JWT_SECRET'],
};

function parseEnv(text) {
  const env = {};
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i <= 0) continue;
    const k = t.slice(0, i);
    const v = t.slice(i + 1).trim();
    env[k] = v;
  }
  return env;
}

if (!fs.existsSync(path)) {
  console.error('MISS env_file', path);
  process.exit(1);
}

const env = parseEnv(fs.readFileSync(path, 'utf8'));
console.log('===', path, 'APP_ENV=', env.APP_ENV || '?', '===');

for (const [group, keys] of Object.entries(GROUPS)) {
  console.log('\n[' + group + ']');
  for (const k of keys) {
    console.log(env[k] ? 'OK   ' + k : 'MISS ' + k);
  }
}
