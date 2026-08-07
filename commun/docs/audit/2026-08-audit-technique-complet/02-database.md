# Audit technique Soundy — Phase 2 : Base de données

**Date :** 2026-08-07
**Méthode :** lecture des 34 migrations (`commun/backend/src/db/migrations/*.sql`), `schema.ts`, `pgStore*.ts`, scripts de backup/déploiement, vérification ponctuelle des faits déjà établis par `commun/docs/audit/AUDIT-CONSOLIDE.md` (2026-07-22, DBI-1 à DBI-12) avec mise à jour des éléments datés.
**Convention risque :** 🔴 critique · 🟠 élevé · 🟡 moyen · 🟢 faible

---

## 2.1 Schéma de données — normalisation, index

**Constat :**
- **34 migrations SQL** versionnées (`001_...` à `034_user_follow_notifications.sql`, 3 nouvelles depuis le dernier audit consolidé du 22/07 : `032_store_meta_analytics_extended.sql`, `033_stripe_subscription_ledger.sql`, `034_user_follow_notifications.sql`).
- **104 `CREATE INDEX`** pour **55 `CREATE TABLE`** — couverture d'indexation globalement correcte en volume (~2 index/table en moyenne), incluant les index spatiaux GIST (Phase 3) et les index composites sur colonnes de tri/pagination fréquentes (`003_indexes.sql` dédié).
- **Seulement 15 occurrences `REFERENCES`** (contraintes FK) pour 55 tables — confirme le finding **DBI-5** de l'audit consolidé : la grande majorité des relations ne sont **pas** garanties par une contrainte FK au niveau base, l'intégrité référentielle reposant sur le code applicatif (`lib/pgStore*.ts`).
- 5 tables prioritaires ont reçu une FK `NOT VALID` dans la migration `029_content_tables_fk_not_valid.sql` (`feed_posts`, `notifications`, `gifts`, `user_reels`, `heart_events`) — confirmée déployée en prod au 22/07 (`schema_migrations` version 31).

**Risque : 🟡 Moyen** (déjà identifié — `DBI-5`) — absence de FK sur ~90 % des tables restantes ; risque d'incohérences orphelines silencieuses (ex. lignes enfants après suppression d'un parent sans cascade explicite gérée en code).

**Recommandation :** poursuivre l'extension des FK `NOT VALID` (non bloquantes, validables en différé) aux ~25 tables restantes, prioriser celles liées à la facturation/paiement (déjà fait, `028_payment_fk_preserve_history.sql`) et à la modération (`content_reports`, tables liées aux comptes bannis).

---

## 2.2 Requêtes lentes / N+1 potentielles

**Constat (hérité + reconfirmé, `DBI-3` `AUDIT-CONSOLIDE.md`) :**
- Le store applicatif (`commun/backend/src/lib/pgStore.ts`) effectue un **flush périodique par ré-upsert intégral de toutes les collections en mémoire toutes les 10 secondes**, plutôt qu'un flush incrémental (delta). Documenté comme tel dans le code lui-même (`pgStore.ts:397-416`).
- Seule la collection `directMessages` est plafonnée (`trimDirectMessages`) ; les autres collections (utilisateurs, salons, lives, reels, feed…) sont réécrites en totalité à chaque cycle.
- Ce pattern n'est pas un N+1 classique de requêtes ORM, mais un anti-pattern structurellement équivalent à l'échelle : le coût de chaque flush croît linéairement avec le volume total de données, indépendamment du nombre de changements réels.
- Analyse statique n'a pas permis d'identifier de N+1 SQL classique (boucle avec `SELECT` par itération) dans les routes consultées lors des phases précédentes (routes `geo.ts`, `donations.ts`, `lives.ts`) — les accès semblent batchés via les fonctions `pgStore*`.

**Risque : 🟡 Moyen** — ne bloque pas le fonctionnement actuel mais **ne scale pas** au-delà d'un certain volume de données (le coût du flush périodique croît avec la taille totale des tables, pas avec le trafic réel).

**Recommandation :** chantier de refonte du flush en delta incrémental (XL, déjà planifié et documenté dans le code) — prioriser avant toute croissance significative du volume de données (>~100k lignes par collection).

---

## 2.3 Stratégie de backup (fréquence, rétention, test de restauration)

**Constat :**

| Élément | Valeur | Source |
|---|---|---|
| Fréquence | Quotidienne, cron **03:15** | `commun/deploy/backup-db.sh`, `INFRA-SOUNDY.md` |
| Méthode | `pg_dump` + `gzip -9` | `backup-db.sh:41` |
| Rétention locale VPS | **14 jours** (`RETENTION_DAYS=14`) | `backup-db.sh:17` |
| RPO documenté | ≤ 24 h | `INFRA-SOUNDY.md` |
| RTO documenté | 30 min – 2 h (restore sur base test) | `INFRA-SOUNDY.md` |
| Procédure de restauration | Documentée (`gunzip \| psql`) | `commun/deploy/RUNBOOK-PROD.md:236-248` |
| Test de restauration réel effectué | 🔍 **Non prouvé** — recommandé trimestriel dans le runbook, mais aucune trace d'exécution/journal de test dans le dépôt | `RUNBOOK-PROD.md:254` |
| Backups managés Scaleway (2ᵉ couche) | Rappel explicite dans le script (« activer aussi les sauvegardes automatiques Scaleway ») ; rétention/config réelle **non vérifiable depuis le code** (console Scaleway) | `backup-db.sh` (commentaire final), `DBI-12` |

**Risque : 🟡 Moyen** — une stratégie de backup existe et est raisonnable sur le papier (quotidien + rétention 14j + couche managée), mais **aucune preuve d'un test de restauration effectivement réalisé** n'existe dans le dépôt. Un backup jamais restauré en conditions réelles est un backup non fiable par construction.

**Recommandation :** exécuter un test de restauration trimestriel daté (restore sur instance de test + vérification `/health` + comptage de lignes), journaliser le résultat dans `commun/deploy/` ou `commun/docs/audit/` pour preuve d'audit future.

---

## 2.4 Gestion des migrations (versionnées, réversibles)

**Constat :**
- Migrations **versionnées** dans Git, numérotées séquentiellement (`001` à `034`), suivies par une table `schema_migrations` en base (version courante confirmée à **31** en prod au 22/07/2026 par l'audit consolidé ; 3 migrations supplémentaires ajoutées depuis en code, à appliquer).
- **Aucun mécanisme de rollback/`down` migration** identifié (pas de fichiers `*_down.sql` ou équivalent) — les migrations sont **append-only**, cohérent avec l'usage de FK `NOT VALID` (réversible par nature car non bloquant) mais risqué pour les migrations structurantes (renommage/suppression de colonne) qui n'ont pas de chemin de retour arrière automatisé.

**Risque : 🟡 Moyen** — approche append-only fonctionnelle mais fragile en cas d'erreur de migration en production (nécessite une intervention manuelle/backup pour revenir en arrière plutôt qu'un `down` scripté).

**Recommandation :** pour les migrations à fort risque (suppression/renommage de colonne), documenter systématiquement la procédure de rollback manuel dans le fichier de migration lui-même (commentaire SQL).

---

## 2.5 Chiffrement des données sensibles au repos

**Constat :**

| Donnée | Protection | Détail |
|---|---|---|
| Mots de passe utilisateurs | ✅ `bcrypt`, coût **12** | `commun/backend/src/routes/auth.ts:5,193,752,905` (`BCRYPT_SALT_ROUNDS = 12`) — conforme aux recommandations actuelles (≥10-12) |
| Mots de passe comptes de seed/admin scripts | ✅ `bcrypt`, coût **10** | `create-admin-user.ts:60`, `seed-production.ts:24`, `seed-test-account-full.ts:435` — légèrement inférieur au coût 12 utilisé en production réelle mais toujours dans la norme acceptable |
| Codes de secours 2FA | ✅ `bcrypt`, coût **8** | `routes/twoFactor.ts:180` — coût plus faible car codes à usage unique de forte entropie, compromis raisonnable |
| Secrets TOTP (2FA) | ✅ **AES-256-GCM** via `TOTP_ENCRYPTION_KEY` | `routes/twoFactor.ts:31-48`, obligatoire en prod (`productionStartup.ts`) |
| Tokens OAuth plateforme (YouTube/Instagram) | ✅ Chiffrés via `ENCRYPTION_KEY` au repos | `.env.production.example:9-11` |
| Numéros de carte bancaire | ✅ **Jamais stockés côté Soundy** — délégué à Stripe (Stripe.js/Checkout), confirmé dans le code des routes de paiement et la doc légale | `creatorMonetization.ts:37-38`, `donations.ts` |
| Chiffrement au repos de la base PostgreSQL elle-même (disque) | 🔍 Dépend de l'offre Scaleway Managed Database — non vérifiable depuis le code (à confirmer console Scaleway) | — |

**Risque : 🟢 Faible** — le hashing des mots de passe et le chiffrement des secrets sensibles applicatifs sont conformes à l'état de l'art (bcrypt coût 12, AES-256-GCM). Point résiduel faible : cohérence du coût bcrypt entre scripts (8/10/12 selon contexte, tous acceptables mais non uniformes).

**Recommandation :** uniformiser à 12 pour tous les hachages de mot de passe (y compris scripts admin/seed), documenter le choix différencié pour les codes de secours 2FA (usage unique, acceptable).

---

## 2.6 Séparation des environnements (prod / staging / dev)

**Constat :**
- **Staging et production partagent la même instance PostgreSQL managée Scaleway** (`51.15.132.229:14440`), avec des bases logiques distinctes (`soundy-prod` / `soundy_staging`) — reconfirmé par `AUDIT-CONSOLIDE.md` (**DBI-6**, toujours ouvert au 22/07).
- Le développement local (msdev) utilise par défaut un **store en mémoire/fichier local**, pas une copie de la base de production — pas de risque direct de données de production exposées en dev par défaut.
- Aucune preuve dans le dépôt d'un processus d'anonymisation de données de production copiées vers staging/dev (le sujet ne se pose pas activement puisque staging utilise une base logique séparée, mais **alimentée par des scripts de seed synthétiques**, pas par un dump anonymisé de prod — bon point, mais à confirmer qu'aucun export manuel de prod n'est jamais fait vers staging).

**Risque : 🟡 Moyen** — le partage de l'instance physique PostgreSQL entre prod et staging reste un risque de contamination croisée (panne, saturation de ressources, erreur d'accès si mauvaise `DATABASE_URL`) même si les bases logiques sont isolées. Pas de risque RGPD direct identifié (staging ne contient pas de données réelles d'utilisateurs de production).

**Recommandation :** séparer physiquement l'instance PostgreSQL de staging de celle de production dès que le budget/trafic le justifie (déjà recommandé en priorité "IMPORTANT" dans `AUDIT-CONSOLIDE.md`).

---

## 2.7 Rôle applicatif de base de données

**Constat (reconfirmé) :** le rôle `soundy` utilisé par l'application dispose des privilèges `rolcreaterole=t, rolcreatedb=t` — bien plus que le strict nécessaire pour un compte applicatif (`DBI-5`/plan d'action `AUDIT-CONSOLIDE.md`, item 5).

**Risque : 🟡 Moyen** — en cas de compromission de la couche applicative (ex. injection SQL réussie, secret DB exfiltré), l'attaquant hériterait de privilèges d'administration de la base au lieu d'être cantonné aux tables applicatives.

**Recommandation :** `REVOKE CREATEROLE, CREATEDB FROM soundy;` — action simple (effort S), déjà identifiée comme priorité critique dans le plan d'action consolidé, toujours non exécutée à ce jour (nécessite validation utilisateur car touche un rôle de production).

---

## Synthèse des risques — Phase 2

| # | Sujet | Risque | Effort |
|---|---|---|---|
| DB-1 | ~90 % des tables sans contrainte FK (`DBI-5`) | 🟡 Moyen | L (25 tables restantes) |
| DB-2 | Flush périodique = ré-upsert intégral (pas de delta) (`DBI-3`) | 🟡 Moyen | XL |
| DB-3 | Backup quotidien + rétention 14j existants, mais **aucun test de restauration prouvé** | 🟡 Moyen | M |
| DB-4 | Migrations append-only sans rollback scripté | 🟡 Moyen | S (documentation) |
| DB-5 | Coût bcrypt non uniforme (8/10/12 selon script) | 🟢 Faible | S |
| DB-6 | Prod/staging sur la même instance PostgreSQL physique (`DBI-6`) | 🟡 Moyen | M (infra) |
| DB-7 | Rôle DB applicatif sur-privilégié (`CREATEROLE`/`CREATEDB`) | 🟡 Moyen | S (décision requise) |
| DB-8 | Triple SPOF DB (1 instance PG managée, pas de réplique lecture) — voir aussi Phase 12 | 🟠 Élevé (LT) | L |

*Findings DBI-1 à DBI-12 hérités et reconfirmés de `commun/docs/audit/AUDIT-CONSOLIDE.md` (2026-07-22) ; ce document se concentre sur les points explicitement demandés en Phase 2 et actualise les faits datés (nombre de migrations, ratio index/FK).*
