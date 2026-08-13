# Phase 2 — Base de données

**Date :** 2026-08-10  
**Périmètre :** `commun/backend/src/db/`, `lib/pgStore*.ts`, `commun/deploy/*backup*`

> **🔄 Rafraîchissement 2026-08-11 (soir)** : aucun changement DB (schéma, migrations, backups) identifié depuis ce matin. Les correctifs du jour (RESEND_FROM, notifications, ouverture inscriptions, getsoundy) n'affectent pas cette phase. Constats et recommandations ci-dessous inchangés.

---

## 2.1 Schéma & normalisation

| Point | Constat | Risque | Recommandation |
|-------|---------|--------|----------------|
| Modèle hybride | PostgreSQL stocke entités relationnelles (users, lives, donations…) **et** gros JSON `payload` / store persisté pour compatibilité historique | **moyen** | Poursuivre migrations 025–034 (FK, drift fix) ; réduire dépendance au blob monolithique |
| Index | Fichiers `003_indexes.sql`, index ciblés migrations 021–034 (FK, feed, analytics) | faible | Revue EXPLAIN sur requêtes search / feed en charge |
| Normalisation | Données financières et auth partiellement normalisées (`password_hash`, ledger Stripe) ; social encore JSON-heavy | **moyen** | Extraire progressivement champs requêtés souvent (listings, modération) |

---

## 2.2 Requêtes lentes & N+1

| Point | Constat | Risque | Recommandation |
|-------|---------|--------|----------------|
| Nearby / geo | Préfiltre PostGIS `ST_DWithin` quand extension active ; sinon scan RAM + fallback documenté | **élevé** à l’échelle sans PostGIS | Garantir PostGIS prod + monitoring couverture `geom` (admin diagnostic) |
| Hydratation store | Chargement store complet en mémoire au boot — coût CPU/RAM croît avec utilisateurs | **élevé** | Pagination store, caches Redis par domaine |
| N+1 SQL | Peu de ORM ; requêtes SQL explicites — risque N+1 sur routes listant relations non auditées ligne à ligne | **moyen** | Profiler staging avec `log_min_duration_statement` sur top endpoints |

---

## 2.3 Backups & restauration

| Point | Constat | Risque | Recommandation |
|-------|---------|--------|----------------|
| Scripts | `commun/deploy/backup-db.sh`, `backup-offsite.sh`, `verify-backup.sh`, `db-health-check.sh` (alerte si backup > 36 h) | faible (si cron VPS actif) | **Vérifier en prod** que cron tourne et que `verify-backup` passe |
| Test restauration | Script `verify-backup.sh` — pas de preuve d’un **restore complet** récent dans le repo | **élevé** | Restauration trimestrielle sur instance jetable + compte rendu |
| Uploads | Archive uploads séparée (`uploads-*.tar.gz`) | **moyen** | Tester restauration couplée DB + fichiers S3/local |

---

## 2.4 Migrations

| Point | Constat | Risque | Recommandation |
|-------|---------|--------|----------------|
| Versionnement | 34 fichiers SQL numérotés `001`–`034`, appliqués au boot (`migrations/`) | faible | — |
| Réversibilité | Pas de migrations `DOWN` automatiques | **moyen** | Documenter rollback manuel par migration critique |
| Drift | Migrations 024–026 corrigent dérive schéma — signe d’historique mouvant | **moyen** | Schéma canonique généré (pg_dump --schema-only) en artefact CI |

---

## 2.5 Chiffrement & données sensibles au repos

| Point | Constat | Risque | Recommandation |
|-------|---------|--------|----------------|
| Mots de passe | Colonne `password_hash`, bcrypt (`auth.ts`, rounds dédiés) ; OAuth sans mot de passe local | faible | Envisager montée coût bcrypt si hardware le permet |
| Secrets app | Chiffrement AES-256-GCM pour secrets 2FA / tokens sensibles (doc + tests `externalSecrets*`) | faible | Rotation clé documentée |
| PII en clair | Coordonnées précises en DB (`latitude`/`longitude` + `geom`) ; affichage public flouté côté API (`blurCoordinate` ~50 m) | **moyen** | Minimiser stockage précision si non nécessaire (RGPD) |

---

## 2.6 Séparation environnements

| Point | Constat | Risque | Recommandation |
|-------|---------|--------|----------------|
| Bases logiques | Prod vs staging documentés ; **même instance PostgreSQL managée Scaleway** (bases distinctes) | **élevé** | Isoler instance staging ou snapshots read-only ; pas de copie prod brute en dev |
| msdev | Données locales / seeds (`msdev123`, comptes démo) | faible | Ne jamais pointer msdev vers DSN prod |
| ✅ Rôle DB | **Corrigé 2026-08-11** : le rôle applicatif `soundy` avait `CREATEROLE` **et** `CREATEDB` (aucune migration ne requiert ces privilèges — vérifié par grep sur `db/migrations/`). `ALTER ROLE soundy NOCREATEROLE NOCREATEDB` appliqué en prod. Vérifié post-changement : `/health` → `db:ok`, application fonctionnelle sans régression | résolu | — |

---

## 2.7 Synthèse phase 2

Actions prioritaires restantes : **test restauration backup** (E6, hors scope — nécessite exercice ops planifié), **PostGIS + couverture geom**, **réduction store RAM** (C5, refonte architecture).

**Mise à jour 2026-08-11 :** privilèges DB least-privilege appliqués (`REVOKE CREATEROLE/CREATEDB` sur le rôle applicatif prod).
