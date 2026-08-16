# PV — Restore drill staging

**Date :** 2026-08-16 13:38 CEST  
**Opérateur :** `@onscen-dev-agent`  
**Cible :** `onscen_staging` uniquement (URL contient `staging`, garde prod du script)

## Preuve

| Étape | Résultat |
|-------|----------|
| Dump | `onscen-20260816-031501.sql.gz` (prod, 2,5 Mo) |
| `gzip -t` | OK |
| Script | `commun/deploy/restore-db-staging.sh` (drop schema public staging, puis pg_dump) |
| `CONFIRM` | `I_UNDERSTAND_STAGING` |
| Users après restore | 439 |
| Health staging | `db:ok` `env:preproduction` (après `pm2 reload`) |
| Dump temporaire | supprimé de `/tmp` staging |

Erreur attendue non bloquante : `permission denied for table spatial_ref_sys` (table système PostGIS). Les dumps suivants excluent ces données (`backup-db.sh --exclude-table-data=spatial_ref_sys`).

**Aucune écriture prod.**
