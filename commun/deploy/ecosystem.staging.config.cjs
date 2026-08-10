/**
 * PM2 — OnScen preproduction (staging)
 * Usage (sur le VPS staging) :
 *   mkdir -p /opt/onscen/logs
 *   cd /opt/onscen && pm2 start deploy/ecosystem.staging.config.cjs
 *   pm2 save && pm2 startup
 */
const fs = require('fs');
const path = require('path');

function resolveOnScenRoot() {
  const fromEnv = process.env.ONSCEN_ROOT;
  if (fromEnv && fs.existsSync(path.join(fromEnv, '.env'))) return fromEnv;
  for (const root of ['/opt/onscen', '/opt/soundly']) {
    if (fs.existsSync(path.join(root, '.env'))) return root;
  }
  return '/opt/onscen';
}

const ROOT = resolveOnScenRoot();

module.exports = {
  apps: [
    {
      name: 'onscen-backend-staging',
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
