# Déploiement OnScen — PostgreSQL & Caddy

**Runbook production** (backups, `.env`, `legal-publisher.json`, vérifs ops) : [`RUNBOOK-PROD.md`](RUNBOOK-PROD.md)

**Priorités infra audit** (Cloudflare CDN, ACRCloud, backup gaps, uptime) : [`OPS-PRIORITIES.md`](OPS-PRIORITIES.md)

## Déploiement zero-downtime (production)

Script recommandé pour les mises à jour prod sans coupure :

```powershell
cd OnScen
powershell -ExecutionPolicy Bypass -File commun/deploy/deploy_zero_downtime.ps1
```

| Option | Effet |
|--------|--------|
| `-SkipBuild` | Réutilise `backend/dist/` local (pas de `tsc`) |
| `-SkipFrontend` | Ignore build Vite + swap `public/` |
| `-VerifyProd` | Lance `verify-prod.sh` sur le VPS après le health check public |

Étapes : build backend + frontend → sync `dist/` + `package.json` → swap atomique `public.new` → `npm install --omit=dev` si besoin → migrations → `pm2 reload onscen-backend --update-env` → Caddy → `curl https://getsoundy.com/health` → (optionnel) `verify-prod.sh`.

Déploiement initial / setup DB Scaleway : `backend/deploy-scaleway.ps1`.

---

## Caddy / HTTPS — règles impératives

Le fichier **`commun/deploy/Caddyfile`** est la **seule source de vérité** (getsoundy.com + IP + Basic Auth + bypass API).

| Emplacement | Rôle |
|-----------|------|
| `commun/deploy/Caddyfile` (repo) | Canonique — versionner ici |
| `/opt/onscen/deploy/Caddyfile` (VPS) | Copie déployée |
| `/etc/caddy/Caddyfile` (VPS) | Config active Caddy |
| `/root/Caddyfile.production.backup` (VPS) | Backup immuable (`chattr +i`) |

### Déployer Caddy correctement

```bash
# Depuis le PC (recommandé) — inclut sync + watchdog
cd OnScen/backend
powershell -ExecutionPolicy Bypass -File deploy-scaleway.ps1

# Sur le VPS uniquement
sudo bash /opt/onscen/deploy/install-caddy-guard.sh
sudo bash /opt/onscen/deploy/sync-caddy.sh
```

### Surveillance automatique

- **`/root/caddy-watchdog.sh`** (cron `*/5`) : vérifie port **443** + présence de `getsoundy.com`, restaure depuis le canonique si cassé.
- **`/root/healthcheck.sh`** (cron `*/2`) : redémarre PM2 si `/health` échoue (avec délai de grâce 30 s).

Logs : `/var/log/caddy-watchdog.log`, `/var/log/caddy-sync.log`, `/var/log/melosong-healthcheck.log`

### ⛔ Ne JAMAIS faire manuellement

- Écrire un Caddyfile minimal `:80 { reverse_proxy ... }` dans `/etc/caddy/Caddyfile`
- Mettre à jour `/root/Caddyfile.production` avec une config HTTP-only (ancien piège)
- `echo '...' > /etc/caddy/Caddyfile` ou `cat <<EOF` sans getsoundy.com
- Désactiver le cron watchdog

### Diagnostic rapide

```bash
ss -tlnp | grep -E ':443|:80'
grep getsoundy.com /etc/caddy/Caddyfile
tail -20 /var/log/caddy-watchdog.log
caddy validate --config /etc/caddy/Caddyfile
```

---

## Architecture

- **Développement (msdev)** : mémoire + `msdev/data/store.json` (inchangé).
- **Production** : cache mémoire identique + persistance **PostgreSQL** si `APP_ENV=production` et `DATABASE_URL` sont définis.
- Les salons / lives restent éphémères (temps réel) ; users, DMs, fil, stories, etc. sont durables (comme `store.json` aujourd'hui).

---

## Option A — Scaleway Managed Database (recommandé prod)

### 1. Créer la base de données sur la console Scaleway

1. Ouvrir [console.scaleway.com](https://console.scaleway.com)
2. Menu gauche → **Managed Databases** → **Create a Database Instance**
3. Choisir :
   - **Moteur** : PostgreSQL **16**
   - **Région** : Paris (fr-par) — même région que le VPS OnScen
   - **Plan** : `DB-DEV-S` (~15 €/mois, 1 vCPU / 2 Go RAM / 10 Go SSD) pour démarrer
   - **Nom de l'instance** : `onscen-prod` (ou autre)
4. Cliquer **Create a Database Instance** et attendre la création (~2 min)

### 2. Créer la base et l'utilisateur

Dans l'onglet **Databases** de l'instance :
1. Cliquer **Add Database** → nom : `onscen`
2. Onglet **Users** → **Add User** :
   - Nom : `onscen`
   - Mot de passe fort (32+ caractères aléatoires)
   - Rôle : `ALL PRIVILEGES` sur la base `onscen`

### 3. Configurer le réseau (liste blanche IP)

Dans l'onglet **Allowed IPs** de l'instance :
1. Cliquer **Add an IP**
2. Entrer l'IP publique du VPS OnScen : `51.159.164.100/32`
3. Sauvegarder

> Si tu utilises un VPC Scaleway dans la même région, tu peux autoriser l'IP privée
> à la place de l'IP publique (plus sécurisé).

### 4. Récupérer l'URL de connexion

Dans l'onglet **Overview** de l'instance, copier le **Connection string** ou
construire manuellement :

```
postgresql://soundy:MOTDEPASSE@<host-scaleway>.pg.sdb.scaleway.com:5432/soundy?sslmode=require
```

Exemple réel (à adapter) :
```
postgresql://soundy:Xk9#mP2vLq...@rdb-prod-fr-par-xxxxx.pg.sdb.scaleway.com:5432/soundy?sslmode=require
```

### 5. Configurer `/opt/onscen/.env` sur le VPS

```env
APP_ENV=production

# PostgreSQL (Scaleway Managed Database)
DATABASE_URL=postgresql://soundy:MOTDEPASSE@<host>.pg.sdb.scaleway.com:5432/soundy?sslmode=require
PG_SSL=1
PG_POOL_MAX=10

# Timeouts (optionnel — valeurs par défaut)
# PG_CONNECT_TIMEOUT_MS=10000
# PG_IDLE_TIMEOUT_MS=30000
# PG_QUERY_TIMEOUT_MS=60000
# PG_STATEMENT_TIMEOUT_MS=30000

# Premier admin (si base vide)
PROD_ADMIN_EMAIL=admin@melosong.app
PROD_ADMIN_PASSWORD=<mot-de-passe-fort>
```

### 6. Déployer et lancer les migrations

Les migrations s'appliquent **automatiquement** au premier démarrage du serveur.
Pour les appliquer manuellement avant de redémarrer :

```bash
# Sur le VPS, depuis le répertoire du backend
cd /opt/onscen/backend

# S'assurer que DATABASE_URL est disponible dans l'environnement
export $(grep -v '^#' /opt/onscen/.env | xargs)

# Option A : via le script de déploiement
../commun/deploy/postgres-setup.sh --migrate-only

# Option B : directement (si le script n'est pas disponible)
node -e "
require('dotenv').config({ path: '/opt/onscen/.env' });
const { runMigrations } = require('./dist/db/migrate');
runMigrations().then(() => { console.log('OK'); process.exit(0); })
  .catch(e => { console.error(e); process.exit(1); });
"
```

### 7. Redémarrer le service

```bash
pm2 restart onscen-backend
```

### 8. Vérifier

```bash
# Logs de démarrage — doit afficher :
# [soundy] Pool PostgreSQL initialisé — max=10 ...
# [soundy] Migration v1 (001_init.sql) appliquée
# [soundy] Migration v2 (002_complete_schema.sql) appliquée
# [soundy] Migration v3 (003_indexes.sql) appliquée
# [soundy] Données restaurées depuis PostgreSQL
journalctl -u onscen-backend -n 50 --no-pager
```

---

## Option B — PostgreSQL sur le même VPS (MVP)

⚠ **DEV1-S (1.9 Go RAM)** : Postgres + Node + Caddy sur une seule machine est **limite**. OK pour tests ; préférez l'option A en prod.

```bash
sudo ./commun/deploy/postgres-setup.sh --local-docker
# ou
sudo ./commun/deploy/postgres-setup.sh --local-apt
./commun/deploy/postgres-setup.sh --env-snippet   # modèle .env
```

Puis `--migrate-only` avec `DATABASE_URL` exporté.

---

## Schéma SQL — couverture

Fichiers : `backend/src/db/migrations/`

| Migration | Contenu |
|-----------|---------|
| `001_init.sql` | Tables de base : `users`, `direct_messages`, `feed_posts`, `stories`, `salon_chats`, `live_chats`, `live_bans`, `user_follows`, `user_blocks`, `user_mutes`, `user_favorites`, `feed_post_likes`, `feed_post_comments`, `feed_post_favorites`, `message_groups`, `group_messages`, curseurs de lecture, `access_policy`, `access_invite_codes` |
| `002_complete_schema.sql` | Entités complètes : `salons`, `lives`, `salon_queues`, `salon_proposals`, `salon_bans`, `gifts`, `donation_payments`, `creator_subscriptions`, `subscription_checkouts`, `host_ratings`, `notifications`, `heart_events`, `music_matches`, `user_reels`, `reel_likes`, `reel_comments`, `reel_shares`, `reel_views`, `dm_pending_pairs` + colonnes générées (`created_at`, `expires_at_ts`, `account_status`, etc.) |
| `003_indexes.sql` | Index production : full-text (GIN), géolocalisation, pagination, composite, partiels |

---

## Variables d'environnement

| Variable | Défaut | Description |
|----------|--------|-------------|
| `APP_ENV` | — | `production` pour activer le mode prod |
| `DATABASE_URL` | — | URL PostgreSQL complète (requis en prod) |
| `PG_SSL` | — | `1` pour SSL (Managed DB Scaleway) |
| `PG_SSL_REJECT_UNAUTHORIZED` | `1` | `0` pour ignorer les erreurs de certificat (non recommandé) |
| `PG_POOL_MAX` | `10` | Connexions max dans le pool |
| `PG_CONNECT_TIMEOUT_MS` | `10000` | Délai max pour obtenir une connexion |
| `PG_IDLE_TIMEOUT_MS` | `30000` | Délai avant fermeture d'une connexion idle |
| `PG_QUERY_TIMEOUT_MS` | `60000` | Timeout requête côté driver Node |
| `PG_STATEMENT_TIMEOUT_MS` | `30000` | Timeout requête côté PostgreSQL (`statement_timeout`) |
| `PROD_ADMIN_EMAIL` | — | Email premier admin (si base vide) |
| `PROD_ADMIN_PASSWORD` | — | Mot de passe premier admin |

---

## Recommandations de dimensionnement Scaleway

| Trafic | Plan | `PG_POOL_MAX` | Notes |
|--------|------|---------------|-------|
| < 1k utilisateurs actifs | DB-DEV-S (~15 €/mo) | 10 | MVP — suffisant |
| 1k–10k | DB-PRD-S (~50 €/mo) | 20 | HA disponible |
| 10k+ | DB-PRD-M+ (~100 €/mo) | 50 | + pgBouncer recommandé |

> Pour `DB-DEV-S` : `max_connections = 100` côté PostgreSQL.
> `PG_POOL_MAX` doit rester ≤ 80 (laisser de la marge pour les admins).
