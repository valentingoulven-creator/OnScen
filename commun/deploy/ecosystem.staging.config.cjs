/**
 * PM2 — Soundy preproduction (staging)
 * Usage (sur le VPS staging) :
 *   mkdir -p /opt/soundly/logs
 *   cd /opt/soundly && pm2 start deploy/ecosystem.staging.config.cjs
 *   pm2 save && pm2 startup
 */
const fs = require('fs');
const path = require('path');

function resolveSoundyRoot() {
  const fromEnv = process.env.SOUNDY_ROOT;
  if (fromEnv && fs.existsSync(path.join(fromEnv, '.env'))) return fromEnv;
  for (const root of ['/opt/soundly', '/opt/soundy']) {
    if (fs.existsSync(path.join(root, '.env'))) return root;
  }
  return '/opt/soundly';
}

const ROOT = resolveSoundyRoot();

module.exports = {
  apps: [
    {
      name: 'melosong-backend-staging',
      script: 'dist/index.js',
      cwd: ROOT,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_restarts: 20,
      min_uptime: '10s',
      max_memory_restart: '512M',
      env_file: path.join(ROOT, '.env'),
      env: {
        NODE_ENV: 'production',
        APP_ENV: 'preproduction',
      },
      error_file: path.join(ROOT, 'logs/pm2-staging-error.log'),
      out_file: path.join(ROOT, 'logs/pm2-staging-out.log'),
      merge_logs: true,
      time: true,
    },
  ],
};
