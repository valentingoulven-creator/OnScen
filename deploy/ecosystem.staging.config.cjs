/**
 * PM2 — Soundy preproduction (staging)
 * Usage (sur le VPS staging) :
 *   mkdir -p /opt/soundy/logs
 *   cd /opt/soundy && pm2 start deploy/ecosystem.staging.config.cjs
 *   pm2 save && pm2 startup
 */
module.exports = {
  apps: [
    {
      name: 'melosong-backend-staging',
      script: 'dist/index.js',
      cwd: '/opt/soundy',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_restarts: 20,
      min_uptime: '10s',
      max_memory_restart: '512M',
      env_file: '/opt/soundy/.env',
      env: {
        NODE_ENV: 'production',
        APP_ENV: 'preproduction',
      },
      error_file: '/opt/soundy/logs/pm2-staging-error.log',
      out_file: '/opt/soundy/logs/pm2-staging-out.log',
      merge_logs: true,
      time: true,
    },
  ],
};
