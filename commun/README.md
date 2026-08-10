# Stack Commun — OnScen

Infrastructure et code partagé par web, iOS et Android.

## Contenu

| Dossier | Rôle |
|---------|------|
| `backend/` | API Node.js + assets statiques (`public/`) |
| `scripts/` | Deploy, seed, sync-src, infra |
| `deploy/` | Runbook VPS, scripts shell, `deploy_zero_downtime.ps1` |
| `docs/` | Documentation projet |
| `msdev/` | Environnement dev local (`.env`, scripts LAN/ngrok) |
| `tests/` | Tests agents / charge |

## Commandes (depuis la racine)

```bash
npm run dev                 # backend :4080 + web :5173
npm run deploy:prod         # production getsoundy.com
npm run deploy:preprod      # staging
npm run src:status          # diagnostic app/src ↔ apptel/src
npm run backend:build
```

## Secrets locaux

- `commun/msdev/.env` — dev (jamais commit)
- `commun/backend/.env.production` — prod (jamais commit)
