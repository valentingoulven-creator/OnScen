/**
 * PM2 — Soundy preproduction (staging)
 * Usage (sur le VPS staging) :
 *   mkdir -p /opt/soundly/logs
 *   cd /opt/soundly && pm2 start deploy/ecosystem.staging.config.cjs
 *   pm2 save && pm2 startup
 */
module.exports = {
  apps: [
    {
      name: 'melosong-backend-staging',
      script: 'dist/index.js',
      cwd: '/opt/soundly',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_restarts: 20,
      min_uptime: '10s',
      max_memory_restart: '512M',
      env_file: '/opt/soundly/.env',
      env: {
        NODE_ENV: 'production',
        APP_ENV: 'preproduction',
      },
      error_file: '/opt/soundly/logs/pm2-staging-error.log',
      out_file: '/opt/soundly/logs/pm2-staging-out.log',
      merge_logs: true,
      time: true,
    },
  ],
};
