/**
 * PM2 — Soundy production
 * Usage (sur le VPS, une fois) :
 *   mkdir -p /opt/soundly/logs
 *   cd /opt/soundly && pm2 start deploy/ecosystem.config.cjs
 *   pm2 save && pm2 startup
 *
 * Mise à jour sans recréer le process :
 *   pm2 reload melosong-backend --update-env
 */
module.exports = {
  apps: [
    {
      name: 'melosong-backend',
      script: 'dist/index.js',
      cwd: '/opt/soundly',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_restarts: 20,
      min_uptime: '10s',
      max_memory_restart: '768M',
      env_file: '/opt/soundly/.env',
      env: {
        NODE_ENV: 'production',
      },
      error_file: '/opt/soundly/logs/pm2-error.log',
      out_file: '/opt/soundly/logs/pm2-out.log',
      merge_logs: true,
      time: true,
    },
  ],
};
