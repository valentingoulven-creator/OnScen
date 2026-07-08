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
      name: 'melosong-backend',
      script: 'dist/index.js',
      cwd: ROOT,
      // MITIGATION TEMPORAIRE (MODIF 961) : repassé à 1 worker tant que le store
      // applicatif reste en RAM (models/schema.ts, Map par-processus) sans source
      // de vérité partagée. Avec 2 workers en cluster, chaque process a sa propre
      // copie du store (users, sessions, ...) : risque d'incohérence de lecture
      // (ex. 401 « Token invalide » aléatoire) entre workers. Ne pas remonter à
      // instances > 1 avant la refonte vers une source de vérité partagée
      // (Postgres/Redis) — voir commun/docs/audit/AUDIT-architecture-code.md §6 (#1).
      instances: 1,
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_restarts: 20,
      min_uptime: '10s',
      max_memory_restart: '512M',
      env_file: path.join(ROOT, '.env'),
      env: {
        NODE_ENV: 'production',
      },
      error_file: path.join(ROOT, 'logs/pm2-error.log'),
      out_file: path.join(ROOT, 'logs/pm2-out.log'),
      merge_logs: true,
      time: true,
    },
  ],
};
