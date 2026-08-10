# OnScen — Environnements Dev / Pré-prod / Prod

## Vue d'ensemble

| Env | Cible | `APP_ENV` | Données | URL | Deploy |
|-----|-------|-----------|---------|-----|--------|
| **Dev** | PC local | `msdev` | `msdev/data/store.json` | `http://localhost:5173` | `npm run dev` |
| **Pré-prod** | VPS `soundly-staging` | `preproduction` | PostgreSQL `onscen_staging` | `https://staging.getsoundy.com` | `commun/scripts/deploy-preprod.ps1` ou **GitHub Actions** (auto) |
| **Prod** | VPS `soundly` | `production` | PostgreSQL `onscen-prod` | `https://getsoundy.com` | `commun/scripts/deploy-prod.ps1` |

## Infra

```
Dev (local)          Preprod VPS                    Prod VPS
localhost:5173       51.159.170.181                 51.159.164.100
     │                      │                              │
     └─ msdev :4080         └─ PM2 onscen-backend-staging └─ PM2 onscen-backend
                                   │                              │
                                   └────────── Scaleway PG ───────┘
                                        51.15.132.229:14440
                                        onscen_staging | onscen-prod
```

### VPS staging (Scaleway)

- **Nom** : `soundly-staging`
- **ID** : `05d0cabc-cd09-4d7a-8341-e4758d0d00c8`
- **Zone** : `fr-par-2`
- **Type** : DEV1-S
- **Chemin app** : `/opt/onscen`
- **SSH** : `ssh onscen-staging` (alias → `51.159.170.181`)

### DNS

Enregistrement **A** actif (OVH) :

```
staging.getsoundy.com  →  51.159.170.181
```

HTTPS Let's Encrypt via Caddy. Accès web protégé Basic Auth (user `staging`, mot de passe dans `msdev/.env` → `STAGING_BASIC_AUTH_*`).

Script vérif / ajout API : `commun/scripts/add-staging-dns-ovh.ps1`

## Commandes

```powershell
# Dev local
npm run dev

# Première mise en place staging (une fois)
commun/scripts/setup-staging-infra.ps1      # bootstrap VPS + base PG + SSH config
commun/scripts/setup-staging-env.ps1        # génère .env preprod + push VPS

# Deploy pré-prod (QA avant prod)
commun/scripts/deploy-preprod.ps1
npm run deploy:preprod

# Preprod automatique : push sur main/master → CI verte → workflow "Deploy Preprod"
# Secret GitHub : STAGING_SSH_PRIVATE_KEY — voir docs/GITHUB-ACTIONS-PREPROD.md

# Deploy prod (demande explicite uniquement)
commun/scripts/deploy-prod.ps1
npm run deploy:prod
```

## Fichiers d'environnement

| Fichier | Git | Usage |
|---------|-----|-------|
| `msdev/.env` | non | Dev local |
| `backend/.env.production` | non | Référence prod locale |
| `backend/.env.preproduction` | non | Référence staging locale |
| `backend/.env.production.example` | oui | Template prod |
| `backend/.env.preproduction.example` | oui | Template staging |
| `app/.env.production` | oui (sans secrets) | Build prod |
| `app/.env.preproduction` | non | Build staging |
| `/opt/onscen/.env` (VPS) | non | Runtime prod ou staging |

## Code backend — `APP_ENV=preproduction`

- `isDeployedEnv()` : prod **ou** preprod → PostgreSQL, CORS, cookies secure, modération fail-closed
- `isProductionEnv()` : **prod strict** (`APP_ENV=production` uniquement)
- Bootstrap : même chemin PG que prod, sans seed msdev

## Services externes (preprod)

| Service | Preprod | Prod |
|---------|---------|------|
| Stripe | `sk_test_` (clés test) | `sk_live_` |
| Google OAuth | Redirect URIs `staging.getsoundy.com/api/auth/...` | `getsoundy.com` |
| Sightengine | Mêmes clés (modération active) | prod |
| LiveKit / Cloudflare | Projet partagé ou test | prod |

Configurer les redirect URIs staging dans chaque console OAuth avant tests login social.

## Vérifications

```powershell
# Health staging (IP ou domaine)
curl http://51.159.170.181/health

ssh onscen-staging "pm2 status"
ssh onscen-staging "pm2 logs onscen-backend-staging --lines 30"
```

Réponse attendue : `"env":"preproduction"`, `"db":"ok"`.

## Scripts deploy

- `commun/deploy/environments.ps1` — config prod / preprod
- `commun/deploy/deploy_zero_downtime.ps1 -Environment preprod|prod`
- `commun/deploy/Caddyfile.staging` — HTTPS staging, preprod ouverte (`noindex`, pas d'allowlist IP)
- `commun/deploy/ecosystem.staging.config.cjs` — PM2 `onscen-backend-staging`

Voir aussi : `docs/INFRA-ONSCEN.md`, `commun/deploy/RUNBOOK-PROD.md`.
