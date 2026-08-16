# [P0-01] Démontrer la restauration d’un backup PostgreSQL

## Contexte
OnScen a des dumps quotidiens (2,5 Mo) et un sync S3 offsite. Le prompt GO prod traite un backup jamais restauré comme **RECOVERY NON DÉMONTRÉE** — STOP CONDITION. Le script `commun/deploy/restore-db-staging.sh` existe depuis MODIF 1434 mais aucun exercice n’est daté.

## Problème
Impossible de prouver qu’on peut récupérer la production. RTO documenté (30 min–2 h) reste théorique. Une migration ou corruption rendrait la perte définitive.

## Preuve
- SSH prod 2026-08-16 : `/opt/onscen/backups/onscen-20260816-031501.sql.gz` (2,5 Mo), cron 03:15, rétention 14 j.
- Offsite : `backups-offsite/offsite-cron.log` sync OK 2026-08-16 04:00:50.
- `commun/deploy/restore-db-staging.sh` (refuse prod, exige `CONFIRM=I_UNDERSTAND_STAGING`).
- `commun/deploy/verify-backup.sh` = test gzip, pas restore applicatif.
- Niveau : **VÉRIFIÉ LIVE + REPO**.

## Impact
NO-GO. Perte de comptes, lives, paiements (si activés), UGC.

## Résultat attendu
Un restore **staging** réussi, daté, avec l’app staging qui répond `/health` après restore. Aucune écriture prod.

## Critères d'acceptation
- [x] `gzip -t` du dump choisi OK
- [x] Restore uniquement vers une URL contenant `staging` (garde du script)
- [x] `psql` : tables métier présentes (ex. `users` = 439)
- [x] `http://127.0.0.1:3000/health` staging → `db:ok` après restore + reload
- [x] PV dans `commun/docs/audit/2026-08-16-go-prod/restore-drill.md`
- [x] Pas de restore sur `onscen-prod`

**Statut 2026-08-16 :** fait. Script mis à jour (drop schema staging avant restore).

## Fichiers concernés
- `commun/deploy/restore-db-staging.sh`
- `commun/deploy/verify-backup.sh`
- `commun/deploy/backup-db.sh`
- `commun/deploy/backup-offsite.sh`
- `commun/docs/INFRA-ONSCEN.md`
