# Runbook production â€” OnScen / OnScen

Guide ops pour le VPS (`51.159.164.100`, `/opt/onscen`) et la base PostgreSQL Scaleway.

> **Priorités infra :** [`OPS-PRIORITIES.md`](./OPS-PRIORITIES.md) · **Cloudflare CDN/WAF :** [`CLOUDFLARE-CDN-WAF.md`](./CLOUDFLARE-CDN-WAF.md)

> **Ne jamais committer de secrets** (`.env`, mots de passe DB, clÃ©s OAuth, `legal-publisher.json` rempli).

---

## Fichiers sensibles sur le VPS

| Fichier | Emplacement | RÃ´le |
|---------|-------------|------|
| `.env` | `/opt/onscen/.env` | Variables d'environnement production |
| `legal-publisher.json` | `/opt/onscen/legal-publisher.json` | Mentions lÃ©gales / CGU (Ã©diteur, hÃ©bergeur) |
| Sauvegardes DB | `/opt/onscen/backups/` | Dumps `pg_dump` locaux |

Ces fichiers **ne sont pas** dans le dÃ©pÃ´t Git. Les crÃ©er / Ã©diter **uniquement sur le VPS** (ou localement pour test, sans commit).

---

## Checklist `/opt/onscen/.env`

ModÃ¨le complet : `backend/.env.production.example` (rÃ©fÃ©rence) et `commun/deploy/.env.production.example`.

### Obligatoires en production

| Variable | Description |
|----------|-------------|
| `APP_ENV` | `production` |
| `PORT` | `3000` (dÃ©faut PM2 / Caddy) |
| `HOST` | `0.0.0.0` |
| `JWT_SECRET` | Secret long alÃ©atoire (`openssl rand -hex 32`) |
| `ENCRYPTION_KEY` | ClÃ© chiffrement tokens OAuth (32+ caractÃ¨res) |
| `WEB_APP_URL` | `https://getsoundy.com` |
| `CORS_ORIGIN` | `https://getsoundy.com` |
| `DATABASE_URL` | URL PostgreSQL Scaleway (`?sslmode=require`) |
| `PG_SSL` | `1` (Managed DB Scaleway) |

### RecommandÃ©es

| Variable | Description |
|----------|-------------|
| `PG_POOL_MAX` | `10` (DB-DEV-S) |
| `PROD_ADMIN_EMAIL` / `PROD_ADMIN_PASSWORD` | Premier admin si base vide |
| `PROD_ADMIN_USERNAME` | Nom affichÃ© admin |

### Optionnelles (selon features)

OAuth Google / Facebook / Apple / Instagram, Stripe, contrÃ´le d'accÃ¨s â€” voir commentaires dans `backend/.env.production.example`.

### Pourboires live (Stripe)

| Variable | Description |
|----------|-------------|
| `DONATIONS_ENABLED` | `1` pour activer les pourboires en production |
| `DONATION_PLATFORM_FEE_PERCENT` | Commission OnScen sur chaque pourboire (dÃ©faut **50**) |
| `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` | ClÃ©s Stripe |
| `STRIPE_WEBHOOK_SECRET` | Secret webhook (`/api/donations/webhook`, Ã©vÃ©nement `payment_intent.succeeded`) |

Les crÃ©ateurs doivent disposer dâ€™un compte **Stripe Connect** (`stripeConnectAccountId` sur le profil) pour recevoir les pourboires. La commission est appliquÃ©e via `application_fee_amount` ; le crÃ©ateur reÃ§oit le solde (frais Stripe en sus).

Voir aussi `commun/docs/juridique/MENTIONS-LEGALES-DONS.md`.

### Cloudflare Stream (live vidÃ©o CDN â€” optionnel)

Active la diffusion live via RTMP â†’ HLS/CDN (spectateurs illimitÃ©s). Sans ces variables, les lives restent en WebRTC mesh.

| Variable | Description |
|----------|-------------|
| `CLOUDFLARE_ACCOUNT_ID` | ID compte (barre latÃ©rale dashboard Cloudflare) |
| `CLOUDFLARE_STREAM_API_TOKEN` | Token API : **Account â†’ Stream â†’ Edit** ; ajouter **Account â†’ Analytics â†’ Read** pour les minutes livrÃ©es dans lâ€™onglet admin **CoÃ»t** |
| `CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN` | Sous-domaine `customer-XXX.cloudflarestream.com` (XXX seul) |

CrÃ©ation du token : [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens) â†’ **Create Token** â†’ **Custom token** â†’ Permissions : Account / Stream / Edit â†’ Create Token (copier une seule fois).


**Mettre a jour un token existant (Analytics Read)** : [API Tokens](https://dash.cloudflare.com/profile/api-tokens) -> **Edit** sur le token reference par `CLOUDFLARE_STREAM_API_TOKEN` -> ajouter **Account -> Analytics -> Read** (garder **Account -> Stream -> Edit**) -> **Save**. Si vous editez le meme token, ne changez pas `/opt/onscen/.env`.

**Verification prod** : REST Stream `/stream/live_inputs` = HTTP 200 ; GraphQL minutes livrees echoue avec `not authorized for that account` tant que **Analytics Read** manque. Apres dashboard : admin **Cout** ou `GET /api/admin/cloudflare-usage` (JWT admin) -> `minutesDeliveredSource: graphql`.

AprÃ¨s ajout sur le VPS :

```bash
nano /opt/onscen/.env
# Ajouter CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_STREAM_API_TOKEN, CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN
pm2 reload onscen-backend --update-env
```

Le sous-domaine customer peut Ãªtre lu aprÃ¨s le premier live input (Stream â†’ Live Inputs) ou dÃ©fini manuellement depuis lâ€™URL HLS.

### LiveKit Cloud (live camÃ©ra navigateur â€” optionnel, prioritaire)

Diffusion **camÃ©ra + micro depuis le navigateur** (sans OBS). Prioritaire sur Cloudflare Stream si les deux sont configurÃ©s. Sans LiveKit ni Cloudflare, les lives restent en WebRTC mesh.

| Variable | Description |
|----------|-------------|
| `LIVEKIT_URL` | URL WebSocket du projet (`wss://xxx.livekit.cloud`) |
| `LIVEKIT_API_KEY` | ClÃ© API LiveKit |
| `LIVEKIT_API_SECRET` | Secret API LiveKit |

**Dashboard** : [cloud.livekit.io](https://cloud.livekit.io) â†’ **Create project** â†’ **Settings â†’ Keys** â†’ Create key (copier URL + key + secret une seule fois).

Plan **Build** (gratuit) : **100 participants simultanÃ©s**, **5000 min/mois**. Au-delÃ , passer au plan Ship ou limiter les spectateurs.

### TURN / WebRTC mesh (live caméra navigateur)

Sans LiveKit ni Cloudflare, les spectateurs se connectent en WebRTC mesh. Les identifiants TURN **ne doivent jamais** être dans le frontend : le client appelle `GET /api/lives/ice-servers` (JWT requis).

| Variable | Description |
|----------|-------------|
| `TURN_URL` | URL(s) TURN (`turn:host:3478?transport=udp`, plusieurs séparées par virgule) |
| `TURN_USERNAME` | Nom d'utilisateur TURN |
| `TURN_CREDENTIAL` | Mot de passe TURN |

Google STUN (`stun:stun.l.google.com:19302`) est toujours renvoyé en fallback. Si les variables TURN sont absentes, seul le STUN est exposé.

Après ajout sur le VPS :

```bash
nano /opt/onscen/.env
# LIVEKIT_URL=wss://xxx.livekit.cloud
# LIVEKIT_API_KEY=...
# LIVEKIT_API_SECRET=...
pm2 reload onscen-backend --update-env
```

### Ã‰dition sur le VPS

```bash
nano /opt/onscen/.env
pm2 reload onscen-backend --update-env
```

### âš  DATABASE_URL absent au dÃ©marrage

Si `APP_ENV=production` sans `DATABASE_URL`, le backend **avertit** et bascule sur **`/opt/onscen/data/store.json`** (fichier local, non recommandÃ© en prod). Voir logs PM2 :

```bash
pm2 logs onscen-backend --lines 30
# [soundy] DATABASE_URL absent — repli sur store.json local ...
```

---

## `legal-publisher.json`

### CrÃ©ation sur le VPS

```bash
bash /opt/onscen/deploy/setup-legal-publisher.sh
nano /opt/onscen/legal-publisher.json
bash /opt/onscen/deploy/setup-legal-publisher.sh   # revÃ©rifie champs obligatoires
pm2 reload onscen-backend --update-env
```

Ã‰tapes dÃ©taillÃ©es :

1. Remplir `acompleter.txt` (dépôt local, ne pas committer si infos sensibles).
2. Copier `commun/deploy/legal-publisher.template.json` → `/opt/onscen/legal-publisher.json` (ou le script `setup-legal-publisher.sh` depuis l'exemple).
3. **Manuel obligatoire** : renseigner `siren`, `address` (postale complète éditeur) et `rcs`/`capital` si société — voir `acompleter.txt`.
4. Vérifier qu'**aucun** champ ne contient `[À compléter]`.
5. Redémarrer : `pm2 reload onscen-backend --update-env`

Le backend charge ce fichier depuis le **mÃªme rÃ©pertoire que `.env`** (`/opt/onscen/`).

---

## Sauvegardes PostgreSQL

### Double couche recommandÃ©e

1. **Scaleway Managed Database** â€” sauvegardes automatiques console (voir ci-dessous).
2. **VPS** â€” dumps `pg_dump` via `commun/deploy/backup-db.sh`.

### Script local VPS

```bash
# PrÃ©requis : postgresql-client (apt install postgresql-client)
mkdir -p /opt/onscen/backups
set -a && source /opt/onscen/.env && set +a
bash /opt/onscen/deploy/backup-db.sh
```

- Sortie : `/opt/onscen/backups/soundy-YYYYMMDD-HHMMSS.sql.gz`
- Rétention locale : **14 jours (2 semaines)** — `RETENTION_DAYS` pour override
- Log : `/opt/onscen/backups/backup.log`

### Cron quotidien (03:15)

```bash
sudo bash /opt/onscen/deploy/install-backup-cron.sh
```

Ã‰quivalent manuel (`crontab -e`) :

```bash
15 3 * * * set -a && . /opt/onscen/.env && set +a && /bin/bash /opt/onscen/deploy/backup-db.sh >> /opt/onscen/backups/cron.log 2>&1
```

### Sauvegarde uploads utilisateur

Fichiers : `/opt/onscen/public/uploads/` (avatars, sponsors, pièces jointes).

```bash
bash /opt/onscen/deploy/backup-uploads.sh
sudo bash /opt/onscen/deploy/install-uploads-backup-cron.sh   # quotidien 04:30
```

### Copie off-site (second chemin + Object Storage optionnel)

```bash
set -a && source /opt/onscen/.env && set +a
bash /opt/onscen/deploy/backup-offsite.sh
sudo bash /opt/onscen/deploy/install-offsite-backup-cron.sh   # 04:00 quotidien
```

Variables optionnelles `.env` : `BACKUP_OFFSITE_DIR`, `SCW_BUCKET`, `SCW_ACCESS_KEY`, `SCW_SECRET_KEY`.

### Checklist Scaleway (manuelle)

```bash
bash /opt/onscen/deploy/verify-scaleway-backup.sh
bash /opt/onscen/deploy/snapshot-vps-reminder.sh   # avant upgrade majeur
```

### VÃ©rifier un dump

```bash
bash /opt/onscen/deploy/verify-backup.sh
# ou avec un fichier prÃ©cis :
bash /opt/onscen/deploy/verify-backup.sh /opt/onscen/backups/soundy-20260610-031500.sql.gz
```

### Restauration PostgreSQL (procÃ©dure test)

> **Ne pas restaurer sur la base prod sans fenÃªtre de maintenance.** Tester d'abord sur une base vide.

```bash
export DATABASE_URL='postgresql://soundy:SECRET@host:5432/onscen_restore_test?sslmode=require'
createdb -h HOST -U soundy onscen_restore_test   # ou via console Scaleway
gunzip -c /opt/onscen/backups/soundy-XXXX.sql.gz | psql "$DATABASE_URL"
bash /opt/onscen/deploy/verify-backup.sh /opt/onscen/backups/soundy-XXXX.sql.gz
dropdb -h HOST -U soundy onscen_restore_test
```

Restauration prod : crÃ©er une **nouvelle** instance DB Scaleway ou contacter le support pour restore snapshot, puis mettre Ã  jour `DATABASE_URL` dans `.env`.

### RPO / RTO et cadence restore (P1-16)

Cibles **ops** (dumps VPS + S3) — le fondateur peut les durcir par écrit.

| Objectif | Cible | Preuve |
|----------|--------|--------|
| **RPO** | 24 h | cron dump ~03:15 (`backup-db.sh`) + off-site ~04:00 |
| **RTO staging** | exercice déjà fait | `commun/docs/audit/2026-08-16-go-prod/restore-drill.md` (2026-08-16) |
| **Cadence drill** | trimestrielle | `OPS-PRIORITIES.md` §3b — **prochain : avant le 2026-11-16** |

Le drill se fait **sur staging** (`restore-db-staging.sh`), jamais sur la base prod sans fenêtre de maintenance. Noter la date dans un nouveau PV `restore-drill.md` à chaque exercice.

### Console Scaleway â€” actions manuelles

1. [console.scaleway.com](https://console.scaleway.com) â†’ **Managed Databases** â†’ instance `onscen-prod`.
2. Onglet **Backups** : activer les **sauvegardes automatiques** (frÃ©quence selon plan, typ. quotidien).
3. Noter la **rÃ©tention** (7â€“30 j selon plan) ; tester un **restore** sur une instance de test au moins une fois par trimestre.
4. Onglet **Allowed IPs** : VPS `51.159.164.100/32` toujours autorisÃ©.
5. Avant upgrade majeur PostgreSQL : snapshot manuel + `backup-db.sh`.

---

## VÃ©rification ops (`verify-prod.sh`)

```bash
bash /opt/onscen/deploy/verify-prod.sh
```

ContrÃ´les : `/health`, `.env` + `DATABASE_URL` (hÃ´te masquÃ©), `legal-publisher.json`, PM2 `onscen-backend`, espace disque et inventaire backups.

### Cron hebdomadaire (optionnel)

```bash
sudo bash /opt/onscen/deploy/install-health-cron.sh
```

Log : `/opt/onscen/logs/verify-prod.log` (dimanche 06:00).

Depuis le PC, aprÃ¨s deploy : `commun/deploy/deploy_zero_downtime.ps1 -VerifyProd` exÃ©cute la mÃªme checklist via SSH.

---

## PM2 (`ecosystem.config.cjs`)

Fichier : `commun/deploy/ecosystem.config.cjs` â€” `autorestart`, `max_memory_restart: 512M`, logs dans `/opt/onscen/logs/`.

PremiÃ¨re installation ou recrÃ©ation du process :

```bash
mkdir -p /opt/onscen/logs
cd /opt/onscen
pm2 start commun/deploy/ecosystem.config.cjs
pm2 save
pm2 startup   # suivre les instructions affichÃ©es
```

Mises Ã  jour courantes (zero-downtime) : `pm2 reload onscen-backend --update-env` (via `commun/deploy/deploy_zero_downtime.ps1`).

Au dÃ©marrage prod, le backend logue une ligne JSON structurÃ©e (`event: startup`, version, `DEPLOY_COMMIT` si dÃ©fini).

---

## Workflow dÃ©veloppement

Voir [`docs/DEV-WORKFLOW.md`](../docs/DEV-WORKFLOW.md) â€” clone hors iCloud (`C:\Dev\OnScen`), push rÃ©gulier, CI GitHub Actions.

---

## Scripts deploy (rÃ©fÃ©rence)

| Script | Usage |
|--------|--------|
| `commun/deploy/backup-db.sh` | Dump PostgreSQL â†’ `/opt/onscen/backups/` |
| `commun/deploy/backup-uploads.sh` | Archive uploads quotidienne |
| `commun/deploy/backup-offsite.sh` | Copie secondaire + S3 optionnel |
| `commun/deploy/verify-backup.sh` | IntÃ©gritÃ© d'un dump `.sql.gz` |
| `commun/deploy/verify-prod.sh` | Checklist ops VPS (âge backups, crons) |
| `commun/deploy/verify-scaleway-backup.sh` | Checklist manuelle console Scaleway |
| `commun/deploy/snapshot-vps-reminder.sh` | Rappel snapshot VPS |
| `commun/deploy/install-backup-cron.sh` | Cron quotidien 03:15 (backup-db) |
| `commun/deploy/install-uploads-backup-cron.sh` | Cron quotidien uploads (04:30) |
| `commun/deploy/install-offsite-backup-cron.sh` | Cron quotidien off-site |
| `commun/deploy/install-health-cron.sh` | Cron hebdo verify-prod (optionnel) |
| `commun/deploy/setup-legal-publisher.sh` | CrÃ©e / valide `legal-publisher.json` |
| `commun/deploy/ecosystem.config.cjs` | Config PM2 (logs, mÃ©moire, autorestart) |
| `commun/deploy/healthcheck.sh` | Cron â€” redÃ©marre PM2 si `/health` KO |
| `commun/deploy/sync-caddy.sh` | Sync Caddyfile canonique |
| `commun/deploy/migrate-remote.sh` | Migrations SQL manuelles |

AprÃ¨s dÃ©ploiement Git sur le VPS :

```bash
sed -i 's/\r$//' /opt/onscen/deploy/*.sh
chmod +x /opt/onscen/deploy/*.sh
```

---

## DÃ©veloppement local â€” `msdev/data/`

Le dossier `msdev/data/` contient `store.json` (persistance msdev). **Ne pas synchroniser via iCloud** (conflits, corruption). Voir `msdev/data/README.md`.

---

## Liens

- OAuth Google / YouTube test users (403 `access_denied`) : [`docs/GOOGLE-OAUTH-TEST-USERS.md`](../docs/GOOGLE-OAUTH-TEST-USERS.md)
- Setup DB dÃ©taillÃ© : `commun/deploy/README.md`
- DÃ©ploiement zero-downtime : `commun/deploy/deploy_zero_downtime.ps1`
- Audit sÃ©curitÃ© : MODIF 319 dans `modification.txt`
