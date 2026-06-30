/**
 * PM2 — Soundy production
 * Usage (sur le VPS, une fois) :
 *   mkdir -p /opt/soundy/logs
 *   cd /opt/soundy && pm2 start deploy/ecosystem.config.cjs
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
      cwd: '/opt/soundy',
      // Phase 0 scale : 2 workers (DEV1-S 2 vCPU / ~2 Go RAM) + Redis adapter Socket.io
      instances: 2,
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_restarts: 20,
      min_uptime: '10s',
      max_memory_restart: '512M',
      env_file: '/opt/soundy/.env',
      env: {
        NODE_ENV: 'production',
      },
      error_file: '/opt/soundy/logs/pm2-error.log',
      out_file: '/opt/soundy/logs/pm2-out.log',
      merge_logs: true,
      time: true,
    },
  ],
};
