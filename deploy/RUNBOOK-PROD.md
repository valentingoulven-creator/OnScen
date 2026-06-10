# Runbook production — Soundy / MeloSong

Guide ops pour le VPS (`51.159.164.100`, `/opt/soundly`) et la base PostgreSQL Scaleway.

> **Ne jamais committer de secrets** (`.env`, mots de passe DB, clés OAuth, `legal-publisher.json` rempli).

---

## Fichiers sensibles sur le VPS

| Fichier | Emplacement | Rôle |
|---------|-------------|------|
| `.env` | `/opt/soundly/.env` | Variables d'environnement production |
| `legal-publisher.json` | `/opt/soundly/legal-publisher.json` | Mentions légales / CGU (éditeur, hébergeur) |
| Sauvegardes DB | `/opt/soundly/backups/` | Dumps `pg_dump` locaux |

Ces fichiers **ne sont pas** dans le dépôt Git. Les créer / éditer **uniquement sur le VPS** (ou localement pour test, sans commit).

---

## Checklist `/opt/soundly/.env`

Modèle complet : `backend/.env.production.example` (référence) et `deploy/.env.production.example`.

### Obligatoires en production

| Variable | Description |
|----------|-------------|
| `APP_ENV` | `production` |
| `PORT` | `3000` (défaut PM2 / Caddy) |
| `HOST` | `0.0.0.0` |
| `JWT_SECRET` | Secret long aléatoire (`openssl rand -hex 32`) |
| `ENCRYPTION_KEY` | Clé chiffrement tokens OAuth (32+ caractères) |
| `WEB_APP_URL` | `https://getsoundy.com` |
| `CORS_ORIGIN` | `https://getsoundy.com` |
| `DATABASE_URL` | URL PostgreSQL Scaleway (`?sslmode=require`) |
| `PG_SSL` | `1` (Managed DB Scaleway) |

### Recommandées

| Variable | Description |
|----------|-------------|
| `PG_POOL_MAX` | `10` (DB-DEV-S) |
| `PROD_ADMIN_EMAIL` / `PROD_ADMIN_PASSWORD` | Premier admin si base vide |
| `PROD_ADMIN_USERNAME` | Nom affiché admin |

### Optionnelles (selon features)

OAuth Google / Facebook / Spotify / Instagram, Stripe, contrôle d'accès — voir commentaires dans `backend/.env.production.example`.

### Édition sur le VPS

```bash
nano /opt/soundly/.env
pm2 reload melosong-backend --update-env
```

### ⚠ DATABASE_URL absent au démarrage

Si `APP_ENV=production` sans `DATABASE_URL`, le backend **avertit** et bascule sur **`/opt/soundly/data/store.json`** (fichier local, non recommandé en prod). Voir logs PM2 :

```bash
pm2 logs melosong-backend --lines 30
# [soundly] DATABASE_URL absent — repli sur store.json local ...
```

---

## `legal-publisher.json`

### Création sur le VPS

```bash
bash /opt/soundly/deploy/setup-legal-publisher.sh
nano /opt/soundly/legal-publisher.json
bash /opt/soundly/deploy/setup-legal-publisher.sh   # revérifie champs obligatoires
pm2 reload melosong-backend --update-env
```

Étapes détaillées :

1. Remplir `acompleter.txt` (dépôt local, ne pas committer si infos sensibles).
2. Le script copie `msdev/legal-publisher.example.json` → `/opt/soundly/legal-publisher.json` si absent.
3. Vérifier qu'**aucun** champ ne contient `[À compléter]`.
4. Redémarrer : `pm2 reload melosong-backend --update-env`

Le backend charge ce fichier depuis le **même répertoire que `.env`** (`/opt/soundly/`).

---

## Sauvegardes PostgreSQL

### Double couche recommandée

1. **Scaleway Managed Database** — sauvegardes automatiques console (voir ci-dessous).
2. **VPS** — dumps `pg_dump` via `deploy/backup-db.sh`.

### Script local VPS

```bash
# Prérequis : postgresql-client (apt install postgresql-client)
mkdir -p /opt/soundly/backups
set -a && source /opt/soundly/.env && set +a
bash /opt/soundly/deploy/backup-db.sh
```

- Sortie : `/opt/soundly/backups/soundy-YYYYMMDD-HHMMSS.sql.gz`
- Rétention locale : **14 jours** (`RETENTION_DAYS=30` pour override)
- Log : `/opt/soundly/backups/backup.log`

### Cron quotidien (03:15)

```bash
sudo bash /opt/soundly/deploy/install-backup-cron.sh
```

Équivalent manuel (`crontab -e`) :

```bash
15 3 * * * set -a && . /opt/soundly/.env && set +a && /bin/bash /opt/soundly/deploy/backup-db.sh >> /opt/soundly/backups/cron.log 2>&1
```

### Vérifier un dump

```bash
bash /opt/soundly/deploy/verify-backup.sh
# ou avec un fichier précis :
bash /opt/soundly/deploy/verify-backup.sh /opt/soundly/backups/soundy-20260610-031500.sql.gz
```

### Restauration PostgreSQL (procédure test)

> **Ne pas restaurer sur la base prod sans fenêtre de maintenance.** Tester d'abord sur une base vide.

```bash
export DATABASE_URL='postgresql://soundy:SECRET@host:5432/soundy_restore_test?sslmode=require'
createdb -h HOST -U soundy soundy_restore_test   # ou via console Scaleway
gunzip -c /opt/soundly/backups/soundy-XXXX.sql.gz | psql "$DATABASE_URL"
bash /opt/soundly/deploy/verify-backup.sh /opt/soundly/backups/soundy-XXXX.sql.gz
dropdb -h HOST -U soundy soundy_restore_test
```

Restauration prod : créer une **nouvelle** instance DB Scaleway ou contacter le support pour restore snapshot, puis mettre à jour `DATABASE_URL` dans `.env`.

### Console Scaleway — actions manuelles

1. [console.scaleway.com](https://console.scaleway.com) → **Managed Databases** → instance `soundy-prod`.
2. Onglet **Backups** : activer les **sauvegardes automatiques** (fréquence selon plan, typ. quotidien).
3. Noter la **rétention** (7–30 j selon plan) ; tester un **restore** sur une instance de test au moins une fois par trimestre.
4. Onglet **Allowed IPs** : VPS `51.159.164.100/32` toujours autorisé.
5. Avant upgrade majeur PostgreSQL : snapshot manuel + `backup-db.sh`.

---

## Vérification ops (`verify-prod.sh`)

```bash
bash /opt/soundly/deploy/verify-prod.sh
```

Contrôles : `/health`, `.env` + `DATABASE_URL` (hôte masqué), `legal-publisher.json`, PM2 `melosong-backend`, espace disque et inventaire backups.

### Cron hebdomadaire (optionnel)

```bash
sudo bash /opt/soundly/deploy/install-health-cron.sh
```

Log : `/opt/soundly/logs/verify-prod.log` (dimanche 06:00).

Depuis le PC, après deploy : `deploy_zero_downtime.ps1 -VerifyProd` exécute la même checklist via SSH.

---

## PM2 (`ecosystem.config.cjs`)

Fichier : `deploy/ecosystem.config.cjs` — `autorestart`, `max_memory_restart: 512M`, logs dans `/opt/soundly/logs/`.

Première installation ou recréation du process :

```bash
mkdir -p /opt/soundly/logs
cd /opt/soundly
pm2 start deploy/ecosystem.config.cjs
pm2 save
pm2 startup   # suivre les instructions affichées
```

Mises à jour courantes (zero-downtime) : `pm2 reload melosong-backend --update-env` (via `deploy_zero_downtime.ps1`).

Au démarrage prod, le backend logue une ligne JSON structurée (`event: startup`, version, `DEPLOY_COMMIT` si défini).

---

## Workflow développement

Voir [`docs/DEV-WORKFLOW.md`](../docs/DEV-WORKFLOW.md) — clone hors iCloud (`C:\Dev\MeloSongv2`), push régulier, CI GitHub Actions.

---

## Scripts deploy (référence)

| Script | Usage |
|--------|--------|
| `deploy/backup-db.sh` | Dump PostgreSQL → `/opt/soundly/backups/` |
| `deploy/verify-backup.sh` | Intégrité d'un dump `.sql.gz` |
| `deploy/verify-prod.sh` | Checklist ops VPS |
| `deploy/install-backup-cron.sh` | Cron quotidien 03:15 (backup-db) |
| `deploy/install-health-cron.sh` | Cron hebdo verify-prod (optionnel) |
| `deploy/setup-legal-publisher.sh` | Crée / valide `legal-publisher.json` |
| `deploy/ecosystem.config.cjs` | Config PM2 (logs, mémoire, autorestart) |
| `deploy/healthcheck.sh` | Cron — redémarre PM2 si `/health` KO |
| `deploy/sync-caddy.sh` | Sync Caddyfile canonique |
| `deploy/migrate-remote.sh` | Migrations SQL manuelles |

Après déploiement Git sur le VPS :

```bash
sed -i 's/\r$//' /opt/soundly/deploy/*.sh
chmod +x /opt/soundly/deploy/*.sh
```

---

## Développement local — `msdev/data/`

Le dossier `msdev/data/` contient `store.json` (persistance msdev). **Ne pas synchroniser via iCloud** (conflits, corruption). Voir `msdev/data/README.md`.

---

## Liens

- Setup DB détaillé : `deploy/README.md`
- Déploiement zero-downtime : `deploy_zero_downtime.ps1`
- Audit sécurité : MODIF 319 dans `modification.txt`
