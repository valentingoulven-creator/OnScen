# Migration infra OnScen (2026-08-10)

Renommage live exécuté sur **staging + prod** :

| Avant | Après |
|-------|--------|
| `/opt/soundly` | `/opt/onscen` |
| PM2 `melosong-backend-staging` | `onscen-backend-staging` |
| PM2 `melosong-backend` | `onscen-backend` |
| PostgreSQL `soundy` | `onscen-prod` |
| PostgreSQL `soundy_staging` | `onscen_staging` |
| Rôle PostgreSQL | **`soundy`** (inchangé — Scaleway n’autorise pas le rename de session) |

Domaine **getsoundy.com** inchangé.

## Scripts (repo)

- `commun/deploy/migrate-onscen-postgres.sh` — rename bases (depuis VPS prod, backends arrêtés)
- `commun/deploy/patch-env-onscen-db.sh` — met à jour `DATABASE_URL` dans `.env`
- `commun/deploy/migrate-onscen-live.sh` — `mv` + PM2 (`staging` \| `prod`)
- `commun/deploy/list-onscen-databases.sh` — contrôle rapide des noms de bases

## SSH

Voir `commun/scripts/ssh-config-snippet.txt` (`onscen-prod`, `onscen-staging` + alias legacy).

## Local / msdev

Si `commun/msdev/.env` ou `commun/backend/.env.production` pointent encore vers `/soundy` ou `soundy_staging`, aligner :

- prod : `.../onscen-prod?sslmode=...`
- staging : `.../onscen_staging?sslmode=...`

Variables Stripe : préférer `STRIPE_PRICE_ID_ONSCEN_PLUS` / `STRIPE_PRICE_ID_ONSCEN_ULTRA` (voir `setup-stripe-msdev.ps1`).

## Legacy

Process PM2 **`soundy-auth`** (non versionné) relancé sur prod sous `/opt/onscen` — à rapatrier ou retirer (audits SEC-7).
