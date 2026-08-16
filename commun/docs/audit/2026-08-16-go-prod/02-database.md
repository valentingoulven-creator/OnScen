# Phase 2 — Base de données et backups

**Date :** 2026-08-16 · **Statut :** P0 (restore)  
**Niveau de preuve :** VÉRIFIÉ LIVE (SSH) + REPO + DOC

## Architecture

D’après `commun/docs/ENVIRONNEMENTS.md` (non re-prouvé par console Scaleway) :

- Instance PostgreSQL **commune** `51.15.132.229:14440`
- Bases séparées : `onscen-prod` / `onscen_staging`
- Health prod + staging : `"db":"ok"`

Rôles / permissions live : **NON VÉRIFIÉ** cette passe (pas de `\du`). Audit 08-11 E12 : rôle applicatif sans `CREATEROLE`/`CREATEDB` — **NON REVÉRIFIÉ**.

Secrets : `DATABASE_URL` présent (nom seulement) prod / staging / msdev. Jamais dumpé.

## Migrations

`commun/backend/src/db/migrations/` : `001` … `035_admin_audit_log_target_idx.sql`.  
`035` est **untracked** dans le working tree local (2026-08-16) — **pas de preuve** qu’elle est appliquée en prod.

Migrations destructives récentes : lecture ciblée `023`–`035` — pas de `DROP TABLE` massif observé ; `025`/`029` utilisent `NOT VALID` (approche compatible). Rollback DB : **pas de down migrations**. Stratégie = restore dump.

Idempotence / locks / downtime des migrations non appliquées : **NON VÉRIFIÉ** (pas d’exécution).

## Backups — VÉRIFIÉ LIVE prod

| Élément | Constat |
| ------- | ------- |
| Cron | `15 3 * * *` `backup-db.sh` |
| Dernier dump | `onscen-20260816-031501.sql.gz` **2,5 Mo** 03:15 |
| Série | Quotidien 01→16 août (préfixe `soundy-` puis `onscen-`) |
| Rétention | 14 jours (log : suppressions OK) |
| Offsite | Cron `0 4 * * *` `backup-offsite.sh` ; log `/opt/onscen/backups-offsite/offsite-cron.log` **2026-08-16 04:00:50** sync Object Storage OK (re-lu 13:20 CEST) |
| Uploads | Cron `30 4 * * *` `backup-uploads.sh` |
| Staging dumps | Présents mais **14 Ko** (base quasi vide — cohérent) |

Taille 2,5 Mo prod : cohérente avec ~10 comptes (audit 08-15), **pas** une preuve d’intégrité du dump.

## Restore

- Script : `commun/deploy/restore-db-staging.sh` (refuse prod, exige `CONFIRM=I_UNDERSTAND_STAGING`).
- MODIF 1434 : **ajout du script**, pas un exercice.
- `verify-backup.sh` : gzip lisible ≠ restore applicatif.
- Dernier restore testé : **aucune date dans le repo ni sur le VPS**.

**RECOVERY NON DÉMONTRÉE** → P0-01.

## Données personnelles

Purge compte / rétention / exports : code existant (audits 08-11 E5 logs ≤ 6 mois). **NON REVÉRIFIÉ** bout-en-bout cette passe. Données orphelines : **NON VÉRIFIÉ**. Persistance dans backups après suppression compte : risque documenté 08-11, inchangé.

## RPO / RTO

Documentés dans `commun/docs/INFRA-ONSCEN.md` : RPO ≤ 24 h ; RTO 30 min–2 h.  
RTO = **théorique** tant que le restore n’est pas démontré.
