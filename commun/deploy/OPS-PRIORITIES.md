# Priorités ops infra — OnScen

> Checklist actionnable post-audit (juillet 2026).  
> **Chemin VPS canonique :** `/opt/onscen` (résolution legacy via `commun/deploy/lib/onscen-root.sh`).

| P | Sujet | Effort | Coût | Statut |
|---|-------|--------|------|--------|
| **1** | Cloudflare CDN/WAF devant le site | ½ j | 0 € | ⏳ **Bloqué** — zone absente du compte CF (DNS OVH direct) |
| **1b** | Turnstile (captcha register / forgot) | 15 min | 0 € | Script `commun/scripts/setup-turnstile-vps.ps1` — clés test OK preprod ; widgets réels via dashboard CF |
| **2** | ACRCloud (copyright audio) | 1–2 h | ~€/mois | ⏳ **Bloqué** — compte + clés à créer |
| **3** | Gaps backup (staging + PG + S3 uploads) | 2–4 h | quelques € | ✅ **Fait** (staging crons + 1er dump + S3 off-site) |
| **4** | Monitoring uptime externe | 30 min | 0 € | ✅ **Fait** — `.github/workflows/uptime-health.yml` |
| **5** | Nettoyage secrets + doc chemins | 1 h | 0 € | ✅ **Fait** — doc `/opt/onscen` |

---

## P1 — Cloudflare devant le site (ÉLEVÉ)

**Objectif :** WAF gratuit, anti-DDoS L7, cache edge `/assets/*`. Caddy reste l'origine TLS.

**Guide détaillé :** [`CLOUDFLARE-CDN-WAF.md`](./CLOUDFLARE-CDN-WAF.md)

**État vérifié 2026-07-15 :** `getsoundy.com` et `staging.getsoundy.com` résolvent directement vers les IP VPS (OVH). Le compte Cloudflare (Stream) **ne contient pas encore la zone DNS** du domaine.

**Action manuelle obligatoire :**

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Add a site** → `getsoundy.com`.
2. Changer les **nameservers OVH** vers ceux fournis par Cloudflare (ou configurer enregistrements selon mode choisi).
3. Une fois la zone visible, lancer :
   ```powershell
   powershell -File commun/scripts/cloudflare-dns-check.ps1
   ```
4. Activer le proxy (nuage orange) sur les enregistrements A — voir [`CLOUDFLARE-CDN-WAF.md`](./CLOUDFLARE-CDN-WAF.md).

Diagnostic : `commun/scripts/cloudflare-dns-check.ps1` affiche `ZONE_MISSING` tant que l’étape 1–2 n’est pas faite.

**Ne pas confondre** avec Cloudflare **Stream** (`CLOUDFLARE_STREAM_*` — déjà configuré pour les lives RTMP).

---

## P2 — ACRCloud (légal / copyright uploads)

**Code prêt :** `commun/backend/src/lib/acrCloud.ts` — scan empreinte audio à l'upload.

### Activation prod

1. Créer un compte [acrcloud.com](https://www.acrcloud.com/) (essai 14 j, ~150M morceaux).
2. Créer un projet **Audio & Video Recognition** (région EU recommandée).
3. Récupérer **Access Key** + **Access Secret**.
4. Sur le VPS prod :

```bash
ssh onscen-prod
nano /opt/onscen/.env
```

Ajouter (voir `commun/backend/.env.production.example`) :

```env
ACRCLOUD_ENABLED=1
ACRCLOUD_ACCESS_KEY=<key>
ACRCLOUD_ACCESS_SECRET=<secret>
ACRCLOUD_HOST=https://identify-eu-west-1.acrcloud.com
ACRCLOUD_MATCH_SCORE_THRESHOLD=80
ACRCLOUD_FAIL_OPEN=0
```

5. Recharger :

```bash
pm2 reload onscen-backend --update-env
```

6. Test : upload d'un extrait musical connu → doit être refusé si score ≥ seuil.

**Vérification sans exposer les secrets :**

```bash
node commun/scripts/audit-external-env.cjs /opt/onscen/.env
# → [moderation] OK ACRCLOUD_ACCESS_KEY / ACRCLOUD_ACCESS_SECRET
```

**Coût :** selon plan ACRCloud (volume scans/mois) — à valider avant fin d'essai.

---

## P3 — Combler les gaps backup

### 3a — Crons backup sur **staging** ✅ (2026-07-15)

Installés + premier dump `soundy-20260715-190702.sql.gz` + sync S3. Prérequis : `install-pg-client-staging.sh` (pg_dump 16+).

```bash
ssh onscen-staging
sudo bash /opt/onscen/deploy/install-backup-cron.sh
sudo bash /opt/onscen/deploy/install-uploads-backup-cron.sh
sudo bash /opt/onscen/deploy/install-offsite-backup-cron.sh
sudo bash /opt/onscen/deploy/install-pg-client-staging.sh   # une fois
```

Prod : crons déjà OK (`verify-prod.sh`).

### 3b — Vérifier snapshots PostgreSQL Scaleway ✅ (plan actif)

Instance `onscen-db` : `backup_schedule.disabled=false`, rétention **7 j**, prochain run planifié.  
CLI `scw rdb backup list` peut retourner `[]` (droits IAM) — la console reste la référence.

```bash
bash /opt/onscen/deploy/verify-scaleway-backup.sh
```

Actions console [Managed Databases → onscen-db → Backups](https://console.scaleway.com/databases) :

- [ ] Sauvegardes automatiques **activées**
- [ ] Dernière backup **< 24 h**
- [ ] Rétention notée (typ. 7 j DB-DEV-S)
- [ ] **Test restore trimestriel** sur instance `onscen_restore_test` (procédure `RUNBOOK-PROD.md`)

### 3c — `S3_BUCKET` uploads utilisateurs ✅ (prod)

`S3_BUCKET` et `SCW_BUCKET` déjà présents sur prod/staging. Off-site sync staging validé.

| Variable | Rôle |
|----------|------|
| `SCW_BUCKET` | Sync dumps `backup-offsite.sh` |
| `S3_BUCKET` | Uploads runtime (avatars, reels, sponsors) via `objectStorage.ts` |

Sans `S3_BUCKET`, fichiers sur disque VPS (`public/uploads/`) — dépendent du backup hebdo.

```bash
# Depuis poste dev (CLI scw configuré) ou console Scaleway
bash commun/deploy/setup-s3-user-uploads.sh
# Puis sur VPS :
ssh onscen-prod "nano /opt/onscen/.env"   # S3_BUCKET, clés, S3_PUBLIC_BASE_URL
ssh onscen-prod "pm2 reload onscen-backend --update-env"
```

Test : upload avatar → URL publique S3 ; log boot `[startup] S3 uploads actifs`.

---

## P4 — Monitoring uptime externe (30 min)

`commun/deploy/monitor-alerts.sh` + cron VPS ne détectent pas un VPS **totalement mort**.

### Option A — GitHub Actions ✅ (déployé)

Workflow `.github/workflows/uptime-health.yml` — ping `/health` prod + staging toutes les **5 min** (runners GitHub = externe).

### Option B — UptimeRobot (gratuit, optionnel)

1. [uptimerobot.com](https://uptimerobot.com) → monitor HTTP(S).
2. URL : `https://getsoundy.com/health`
3. Intervalle : **5 min** · alerte email (SMS option payant).
4. Répéter pour `https://staging.getsoundy.com/health`.

### Option C — Cloudflare Health Checks

Disponible une fois **P1** (proxy CF) actif — ping `/health` depuis plusieurs régions.

### Complément

- Conserver `healthcheck.sh` cron VPS (redémarrage PM2 local).
- Sentry (`SENTRY_DSN`) pour erreurs applicatives — pas substitut uptime.

---

## P5 — Nettoyage (faible)

### 5a — Clés orphelines `.env`

Vérifier périodiquement qu'aucune variable sans référence code ne traîne sur le VPS :

```bash
commun/scripts/audit-external-env.cjs /opt/onscen/.env
```

### 5b — Documentation chemins VPS

**Canonique :** `/opt/onscen` · scripts : `/opt/onscen/deploy/` (déployé depuis `commun/deploy/`).

Fichiers corrigés : `INFRA-ONSCEN.md`, `RUNBOOK-PROD.md`, `ENVIRONNEMENTS.md`, scripts deploy.

---

## Commandes rapides (prod)

```bash
ssh onscen-prod
source /opt/onscen/deploy/lib/onscen-root.sh
bash "$DEPLOY_DIR/verify-prod.sh"
bash "$DEPLOY_DIR/verify-scaleway-backup.sh"
node /opt/onscen/commun/scripts/audit-external-env.cjs /opt/onscen/.env
```

---

## Références

- [`RUNBOOK-PROD.md`](./RUNBOOK-PROD.md)
- [`docs/INFRA-ONSCEN.md`](../docs/INFRA-ONSCEN.md)
- [`docs/ENVIRONNEMENTS.md`](../docs/ENVIRONNEMENTS.md)
- [`TODO-MANUAL.md`](../../TODO-MANUAL.md) — section Infra ops

---

*Dernière mise à jour : 2026-07-15*
