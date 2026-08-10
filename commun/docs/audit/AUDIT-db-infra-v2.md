# RE-AUDIT Database & Infrastructure — OnScen (v2, post-corrections)

Méthode : lecture statique du code (repo `C:\Dev\OnScen`) + lecture du contenu SQL des migrations 025-029
+ accès SSH **lecture seule** sur `onscen-prod` (`ssh onscen-prod`) et `onscen-staging` (`ssh onscen-staging`)
pour vérifier l'état **réellement déployé** (PM2 live, `.env` live, `psql` via `DATABASE_URL` sourcé du `.env`,
`df -h`). Aucune commande d'écriture/modification exécutée sur les VPS ou la base de données. Aucun fichier
de code source modifié — seul ce rapport et un script SQL/bash temporaire (créés puis supprimés) ont été écrits.

Rapport de référence : `commun/docs/audit/AUDIT-db-infra.md` (score initial **61/100**, 3 Critical · 6 High ·
7 Medium · 2 Low). Session de corrections analysée : `modification.txt` entrées **MODIF 961** (PM2
`instances: 1`) et **MODIF 963** (corrections DB/infra détaillées), toutes deux datées 2026-07-08.

## ⚠️ Constat transversal majeur (avant le détail par problème)

**Toutes les corrections de code de la session du 2026-07-08 (MODIF 960 à 965) existent dans le dépôt Git
mais n'ont PAS été déployées en production au moment de cet audit.** Preuves :

- Le build compilé en prod date d'avant la session de fixes : `ls -la --time-style=full-iso /opt/onscen/dist/index.js` → `2026-07-07 09:21:57 +0000` (la veille des corrections, datées 2026-07-08).
- Le process PM2 réellement actif en prod tourne encore avec **2 workers cluster**, pas 1 : `pm2 list` → deux lignes `onscen-backend` (`pm_id 28` et `29`), `mode: cluster`, `uptime: 25h`, confirmé aussi par `pm2 describe onscen-backend` (`exec mode: cluster_mode` ×2) et par le JSON `pm2 jlist` (`"instances":2, "PM2_INSTANCES":"2"` dans l'env du process). Le fichier source `commun/deploy/ecosystem.config.cjs:38` dit pourtant `instances: 1` — **le fichier est corrigé, le process vivant ne l'est pas** (pas de `pm2 reload`/redeploy depuis le fix).
- La table `schema_migrations` en base de prod (requête `SELECT * FROM schema_migrations ORDER BY 1 DESC LIMIT 8` via `psql "$DATABASE_URL"`) s'arrête à la **version 27** (appliquée le 2026-07-01). Les migrations **028 et 029 ne sont pas appliquées** en prod : les CASCADE destructeurs sur les paiements sont donc **toujours actifs en base réelle** à l'heure de cet audit, malgré le fix SQL présent dans le dépôt.
- Le script déployé `/opt/onscen/deploy/backup-db.sh` sur le VPS contient encore `BACKUP_DIR:-/opt/onscen/backups` (sans « ly », ancien chemin) — la correction du dépôt local n'est pas encore sur le VPS.

**Conséquence méthodologique pour ce rapport** : chaque problème est noté avec un statut **double** — *Code
(dépôt)* et *Prod (live)* — car pour ce projet un fix commité n'est PAS un fix déployé (rappel : la règle du
projet interdit tout déploiement prod sans demande explicite de l'utilisateur, donc ceci n'est pas une
anomalie du process de fix, juste un fait à documenter pour la priorisation du prochain déploiement).

## Statut détaillé — Top 5 (Critical/High) du rapport original

### 1. [Critical] Store applicatif en RAM dupliqué entre workers PM2

- **Code (dépôt)** : ✅ Résolu. `commun/deploy/ecosystem.config.cjs:38` → `instances: 1` (commentaire
  explicatif lignes 31-37 référençant l'audit). Confirmé par lecture directe du fichier.
- **Prod (live)** : ❌ Toujours ouvert. `pm2 list`/`pm2 jlist` sur `onscen-prod` montrent 2 processus
  `onscen-backend` en `cluster_mode` actifs depuis 25h (donc démarrés avant le fix d'aujourd'hui). Le
  risque d'incohérence de lecture entre workers documenté dans l'audit original **existe toujours en
  production** tant qu'un `pm2 reload`/redémarrage avec la nouvelle config n'a pas eu lieu.
- **Statut global : PARTIELLEMENT RÉSOLU (mitigation codée, non déployée).**

### 2. [Critical] `ON DELETE CASCADE` sur les tables de paiement

- **Code (dépôt)** : ✅ Résolu. `commun/backend/src/db/migrations/028_payment_fk_preserve_history.sql`
  (lignes 28-74) bascule les 4 FK (`donation_payments.sender_id`, `creator_subscriptions.subscriber_id`,
  `creator_subscriptions.creator_id`, `subscription_checkouts.subscriber_id`) de `ON DELETE CASCADE` vers
  `ON DELETE SET NULL NOT VALID`, avec colonnes rendues nullable au préalable (lignes 28-31) et détection
  défensive via `pg_constraint.confdeltype = 'c'` avant de toucher la contrainte (n'échoue pas si déjà
  migré). `commun/backend/src/lib/accountDeletionPg.ts` (lignes 17-23) ne supprime plus explicitement les
  lignes de paiement — seules `webauthn_credentials` et `push_subscriptions` sont purgées. Le commentaire
  (lignes 6-15) explique correctement le nouveau flux (SET NULL par Postgres, plus de double destruction).
- **Prod (live)** : ❌ Toujours ouvert. `schema_migrations` en base réelle s'arrête à la version 27 — la
  migration 028 **n'est pas appliquée**. Les FK CASCADE de la migration 025/026 sont donc toujours actives :
  une suppression de compte en prod aujourd'hui détruirait encore l'historique de paiement Stripe.
- **Statut global : PARTIELLEMENT RÉSOLU (fix SQL + code prêts, migration non exécutée en prod).**

### 3. [Critical] Flush périodique = ré-upsert intégral de toutes les collections

- **Code (dépôt)** : ⚠️ Non résolu sur le fond — **mitigation ciblée uniquement**, comme annoncé dans
  MODIF 963. `commun/backend/src/lib/pgStore.ts` (lignes 397-416) documente explicitement le chantier XL
  restant (« Refonte complète NON faite ici volontairement »). Le seul changement concret est
  `commun/backend/src/lib/chatHistory.ts` : nouvelle fonction `trimDirectMessages()` (lignes 46-67) qui
  cappe `db.directMessages` par paire d'utilisateurs à `MAX_DIRECT_MESSAGES_PER_PAIR` (défaut 500, ligne 7),
  appelée depuis `purgeUnboundedChatHistory()` (ligne 80), elle-même appelée dans `snapshotStore()`
  (`commun/backend/src/lib/storeCore.ts:94`, avant la construction du `PersistedStore` qui sera flushé) et
  dans `commun/backend/src/lib/dataRetention.ts:56`. La mécanique de flush elle-même
  (`writeStore()` dans `pgStore.ts:417+`, boucles `for`/`await client.query` par ligne dans
  `pgStoreSocialSync.ts`) n'a pas changé : le ré-upsert intégral O(volume total) par cycle de 10s reste
  identique. L'interpolation de nom de table dans `pruneCompositePairs()`
  (`commun/backend/src/lib/pgStoreSocialSync.ts:32,40` — `` `DELETE FROM ${table}` ``) est également
  **toujours présente**, non corrigée (risque théorique documenté dans l'audit original, params internes
  uniquement donc pas d'injection active actuellement).
- **Prod (live)** : le cap `directMessages` n'est de toute façon pas encore live (build prod du 07/07,
  avant le fix).
- **Statut global : PARTIELLEMENT RÉSOLU (mitigation ciblée sur le seul point sans plafond ; refonte
  complète toujours ouverte, documentée comme chantier XL séparé — voir section « Actions manuelles »).**

### 4. [High] Rate-limiters non cluster-safe (`authLimiter`, `nearby*`)

- **`authLimiter`** (`commun/backend/src/server.ts:453-464`) : utilise déjà `store: createRateLimitStore('auth')`
  (ligne 463). **L'audit original était obsolète sur ce point précis** — confirmé par lecture directe, ce
  fichier n'a pas été modifié dans MODIF 963 (aucun changement nécessaire, comme documenté dans
  `modification.txt` ligne ~20609-20611).
- **`nearbyAnonLimiter`/`nearbyAuthLimiter`** (`commun/backend/src/routes/geo.ts:95-108` et `114-130`) :
  ✅ Résolu en code. Les deux limiteurs utilisent désormais `store: createRateLimitStore('nearby-anon')`
  (ligne 107) et `store: createRateLimitStore('nearby-auth')` (ligne 129), avec commentaires explicites
  référençant l'audit (lignes 105-106, 128).
- **Prod (live)** : ❌ Pas encore live — build prod du 07/07 (avant le fix). Chaque worker PM2 (rappel :
  toujours 2 en live, voir §1) a donc encore un compteur mémoire séparé pour ces deux routes en production
  actuellement.
- **Statut global : RÉSOLU EN CODE / NON DÉPLOYÉ.**

### 5. [High] Absence de FK sur ~90% des tables + rôle DB sur-privilégié

- **FK ajoutées** : ✅ Partiellement résolu en code.
  `commun/backend/src/db/migrations/029_content_tables_fk_not_valid.sql` ajoute des FK `NOT VALID` vers
  `users(id)` sur **5 tables** sur les ~30 identifiées par l'audit : `feed_posts` (ligne 26-36, CASCADE),
  `notifications.recipient_id`/`sender_id` (lignes 38-55, CASCADE), `gifts.sender_id` (lignes 57-68, SET
  NULL, colonne rendue nullable ligne 57), `user_reels.author_id` (lignes 70-79, CASCADE),
  `heart_events.from_id`/`to_id` (lignes 81-98, CASCADE). Chaque bloc est protégé par un
  `IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = ...)`, cohérent avec le pattern idempotent de
  `025_foreign_keys_not_valid.sql`. Reste ~25 tables encore sans FK (hors périmètre de cette session,
  documenté comme tel dans `modification.txt`).
- **Rôle `onscen` sur-privilégié** : ❌ Toujours ouvert, confirmé en direct via
  `psql "$DATABASE_URL" -c "SELECT rolname, rolcreaterole, rolcreatedb, rolsuper FROM pg_roles WHERE rolname='soundy';"`
  sur `onscen-prod` → `soundy | t | t | f` (`rolcreaterole=true`, `rolcreatedb=true`). Documenté comme
  action manuelle restante dans `modification.txt` (lignes 20623-20627), volontairement non exécutée
  (« action destructive sur un rôle de prod »).
- **Prod (live)** : migration 029 non appliquée en prod (idem §2, `schema_migrations` max = 27).
- **Statut global : PARTIELLEMENT RÉSOLU (5/30 tables en code, non déployé ; rôle DB toujours
  sur-privilégié — action manuelle requise, volontairement non faite).**

## Statut des autres constats (« Autres constats notables » de l'audit original)

| # | Constat original | Statut | Preuve |
|---|---|---|---|
| a | Prod et staging partagent la même instance PostgreSQL (`51.15.132.229:14440`) | ❌ Toujours ouvert | `DATABASE_URL` de `onscen-staging` (`/opt/onscen/.env`) pointe vers le même hôte `51.15.132.229:14440` que la prod, confirmé par lecture directe SSH sur les deux VPS. Documenté comme action manuelle infra restante dans `modification.txt` (lignes 20628-20631). |
| b | Triple SPOF (1 VPS, 1 PG managé, 1 Redis local) | ❌ Toujours ouvert | Aucune modification de topologie infra dans MODIF 961/963 (hors scope, non traité). Impossible de re-vérifier la réplication Redis/PG sans accès console Scaleway — *impossible à vérifier au-delà de la topologie déjà connue*. |
| c | `STRIPE_SECRET_KEY` en mode test sur `APP_ENV=production` | ❌ Toujours ouvert | `grep STRIPE_SECRET_KEY /opt/onscen/.env` sur `onscen-prod` → `sk_test_51Thv4p...` (clé de test), alors que `APP_ENV=production` et `DONATIONS_ENABLED=1`. Non traité par MODIF 962 (audit Stripe) ni MODIF 963 (audit DB/infra) — c'est une rotation de secret, hors périmètre code. |
| d | Dérive de nommage `/opt/onscen` vs `/opt/onscen` sur les scripts de backup | ✅ Résolu en code / ❌ non déployé | `commun/deploy/backup-db.sh:12`, `verify-backup.sh:9`, `backup-offsite.sh:22-24` → tous `BACKUP_DIR:-/opt/onscen/backups` dans le dépôt. Mais le script **réellement présent sur le VPS** (`/opt/onscen/deploy/backup-db.sh`) contient encore `BACKUP_DIR:-/opt/onscen/backups` (ancien chemin, sans « ly ») — confirmé par `grep` SSH en direct. Le fix n'a pas encore été synchronisé sur le VPS (pas de `git pull`/déploiement depuis le fix). |
| e | Process `soundy-auth` non documenté, absent du dépôt Git, hash de mot de passe en dur, sessions en RAM | ❌ Toujours ouvert | `pm2 list` sur `onscen-prod` montre `soundy-auth` toujours actif (`pm_id 1`, fork mode, uptime 7 jours). Recherche dans le dépôt (`Glob **/auth-server/**`) : aucun résultat — toujours absent de Git. Non traité par MODIF 961/963 (hors scope). |
| f | Disque staging à 72% (2,5 Go restants sur 8,9 Go) | ⚠️ Quasiment inchangé | `df -h /` sur `onscen-staging` → `8.9G total, 6.4G used, 2.5G free, 73%` — situation identique (marge quasi nulle), non traité (infra pure). |
| g | Interpolation de nom de table dans `pgStoreSocialSync.ts` (`pruneCompositePairs`) | ❌ Toujours ouvert | Code inchangé, confirmé par lecture directe (`commun/backend/src/lib/pgStoreSocialSync.ts:21-42`) : `` `DELETE FROM ${table} ...` `` toujours présent. Pas d'injection active (paramètres internes uniquement), pattern à surveiller si réutilisé avec entrée externe. |
| h | Table `gifts` sans FK ni purge à la suppression de compte | ✅ Résolu en code / ❌ non déployé | Migration 029 (lignes 57-68) ajoute `gifts_sender_fk` en `ON DELETE SET NULL NOT VALID`. Non appliqué en base prod (voir §5). |

## Vérification de la cohérence SQL des migrations 028/029

- **Numérotation** : `Glob` sur `commun/backend/src/db/migrations/*.sql` confirme que la dernière migration
  existante avant cette session est `027_feed_post_upvotes.sql` — `028` et `029` sont donc les numéros
  suivants corrects, sans collision ni trou.
- **Style `NOT VALID`** : cohérent avec `025_foreign_keys_not_valid.sql` (qui utilise le même pattern
  `DO $$ ... IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = ...) THEN ALTER TABLE ... ADD
  CONSTRAINT ... NOT VALID; END IF; END $$;`). La migration 028 va plus loin en vérifiant en plus
  `confdeltype = 'c'` avant de DROP/ADD une contrainte existante — pattern défensif correct pour une
  migration idempotente qui modifie (plutôt que crée) une contrainte.
- **`026_unique_email_username_validate_fk.sql`** (lue en complément) confirme que les 4 FK touchées par la
  migration 028 avaient déjà été validées (`VALIDATE CONSTRAINT`, lignes 28-57) sans orphelin en prod avant
  cette session — le commentaire de 028 (lignes 23-26, « déjà validées en migration 026 ») est donc exact
  et vérifiable.
- **Rendu des colonnes nullable avant `SET NULL`** : correct en 028 (lignes 28-31, `DROP NOT NULL` avant les
  `ALTER ... ADD CONSTRAINT ... ON DELETE SET NULL`) et en 029 pour `gifts.sender_id` (ligne 57). Sans ce
  `DROP NOT NULL` préalable, PostgreSQL rejetterait toute tentative de mise à NULL via la contrainte — cette
  étape est nécessaire et présente.
- **Aucune exécution locale/prod** : conforme à la consigne de la tâche (« ne les exécute PAS ») — vérifié
  uniquement par lecture statique + confirmation que `schema_migrations` en prod ne contient pas encore ces
  versions (donc elles n'ont pas non plus été appliquées accidentellement par un autre canal).
- **Conclusion** : migrations syntaxiquement valides et cohérentes avec le style du projet. Aucune anomalie
  trouvée dans le SQL lui-même — le seul point ouvert est le **déploiement** (non fait, voir constat
  transversal en tête de rapport).

## Actions manuelles d'infra toujours ouvertes (confirmé dans `modification.txt`, non exécutées)

Ces 3 points sont explicitement documentés comme volontairement non traités par l'agent de la session
(`modification.txt` lignes 20621-20634, section « ACTIONS MANUELLES D'INFRA RESTANTES ») et restent ouverts
selon la vérification live de ce re-audit :

1. **Révocation des privilèges excessifs du rôle DB `onscen`** — `REVOKE CREATEROLE, CREATEDB FROM soundy;`
   à exécuter manuellement en prod. Confirmé toujours actif via `psql` en direct
   (`rolcreaterole=t, rolcreatedb=t`). Action destructive sur un rôle de prod, nécessite validation explicite
   de l'utilisateur avant exécution — non exécutée par ce re-audit non plus (lecture seule).
2. **Séparation prod/staging PostgreSQL** — les deux environnements partagent toujours la même instance
   Scaleway (`51.15.132.229:14440`), confirmé en direct. Recommandation inchangée : base logique séparée
   au minimum, instance managée distincte idéalement. Action console Scaleway, hors du périmètre code.
3. **`VALIDATE CONSTRAINT` différée sur les FK `NOT VALID`** des migrations 028 et 029 — nécessite un scan
   complet par table après vérification qu'il n'existe pas d'orphelins en prod ; volontairement non inclus
   dans les migrations elles-mêmes (commentées en bas de chaque fichier, lignes 76-80 de 028 et 100-108 de
   029), à faire en migration séparée ultérieure.

Un **4ᵉ chantier**, plus large que ces 3 actions d'infra pure, est également documenté comme délibérément
non traité :

4. **Refonte complète du mécanisme de flush périodique** (ré-upsert intégral → flush incrémental delta) —
   qualifiée d'XL, nécessitant une revue dédiée (suivi des lignes modifiées/supprimées en RAM, garanties de
   cohérence en cas de crash entre deux flushes partiels). Documentée dans `pgStore.ts:397-416` et
   `modification.txt` (lignes 20595-20601) comme chantier séparé, non fait dans cette session — seule la
   mitigation ciblée sur `directMessages` (cap par paire) a été appliquée.

**Recommandation immédiate ajoutée par ce re-audit** (au-delà des 4 points déjà documentés) :

5. **Déployer les corrections en attente** — le constat transversal en tête de ce rapport montre que
   *tous* les fixes de code du 2026-07-08 (PM2 instances:1, migrations 028/029, rate limiters `nearby*`,
   chemins de backup) sont encore inertes en production faute de déploiement. Tant qu'un déploiement (build
   + `pm2 reload`/restart + exécution des migrations au boot) n'a pas eu lieu, le score « prod réelle »
   reste proche du score initial de 61/100 sur les points concernés — le score recalculé ci-dessous reflète
   la préparation du code, pas encore son effet en production.

## Impossible à vérifier avec les informations disponibles

- Sauvegardes automatiques console Scaleway (rétention réelle, dernier test de restauration) — accès
  console non disponible dans cette session, seul le SSH VPS l'était (identique à l'audit original).
- Atomicité complète du webhook Stripe end-to-end (`donations.ts`/`pgDonations.ts`) après les changements
  de MODIF 962 — hors périmètre de ce re-audit DB/infra (voir plutôt un re-audit dédié de
  `AUDIT-stripe.md`).
- Contenu exhaustif de `monitor-alerts.sh` — non relu en intégralité dans cette session.
- Réglages exacts des « Allowed IPs » et politique de rétention des backups automatiques Scaleway Managed
  Database — inchangé depuis l'audit original, non vérifiable sans accès console.
- Date/heure exacte du dernier `git pull` sur le VPS prod — non trouvée (`/opt/onscen` n'est pas un dépôt
  git sur le VPS, `git log` y échoue avec `fatal: not a git repository`), le déploiement se fait
  probablement par transfert de build (rsync/scp) plutôt que par clone Git sur le serveur — cohérent avec
  l'horodatage du fichier `dist/index.js` utilisé comme preuve indirecte.

## Synthèse — décompte des problèmes (18 au total, rapport original)

| Statut | Nombre | Détail |
|---|---|---|
| **Résolu en code ET déployé en prod** | **0** | Aucun des points corrigés cette session n'est encore live (voir constat transversal). |
| **Résolu en code, non déployé en prod** | **4** | #3 flush (mitigation ciblée directMessages seulement — partiel, voir ligne dédiée ci-dessous), #4 rate-limiters `nearby*`, backup path drift, table `gifts` FK. |
| **Partiellement résolu (code partiel + non déployé, ou déjà partiellement vrai avant)** | **3** | #1 store RAM (mitigation instances:1, non déployée), #2 CASCADE paiements (SET NULL codé, migration non appliquée), #5 FK manquantes (5/30 tables, migration non appliquée, rôle DB inchangé) |
| **Toujours ouvert (aucun changement, y compris items déjà « vrais » avant comme `authLimiter`)** | **11** | flush intégral (chantier de fond, #3 pour sa partie structurelle), interpolation table `pgStoreSocialSync.ts`, rôle DB sur-privilégié, PG partagé prod/staging, triple SPOF, clé Stripe test en prod, process `soundy-auth` non versionné, disque staging 73%, ~25 tables encore sans FK, VALIDATE CONSTRAINT différée (028/029), refonte flush XL. |

Note de lecture : certains problèmes (#1, #2, #3, #5) apparaissent dans plusieurs colonnes ci-dessus car ils
ont des composantes multiples (ex. #5 = FK codées pour 5 tables **et** rôle DB toujours ouvert). Le compte
« problème par problème » demandé par la tâche est détaillé dans les sections précédentes ; en résumé
simplifié demandé pour la synthèse finale :

- **Résolus (code prêt, effet réel dès prochain déploiement)** : 2 sur 18 (#4 rate-limiters `nearby*`,
  dérive de nommage backup)
- **Partiellement résolus** : 4 sur 18 (#1 store RAM, #2 CASCADE paiements, #3 flush intégral — mitigation
  ciblée seulement —, #5 FK manquantes + rôle DB)
- **Toujours ouverts, sans aucun changement** : 12 sur 18 (triple SPOF, PG partagé prod/staging, clé Stripe
  test, process `soundy-auth`, disque staging, interpolation table, ~25 tables sans FK restantes, VALIDATE
  CONSTRAINT différée, + les 4 items « Impossible à vérifier » qui restent dans le même état d'incertitude)

## Score recalculé du domaine (DB + Infra)

### Score si l'on évalue uniquement l'état du code source (dépôt Git)

**68/100** (+7 vs 61/100 initial)

Justification : les 3 Critical ont chacun une mitigation ou un fix réel et vérifiable dans le code (store RAM
→ instances:1 ; CASCADE paiements → SET NULL propre avec anonymisation ; flush intégral → mitigation ciblée
sur le seul point sans plafond, refonte de fond toujours documentée comme restante). 2 des 6 High sont
résolus (rate-limiters `nearby*`, FK sur 5 tables prioritaires) ; le reste (rôle DB, PG partagé, SPOF,
process `soundy-auth`, clé Stripe test, ~25 tables sans FK) est inchangé. La progression est réelle mais
mesurée : on passe d'un état où le Critical #2 n'avait aucun début de solution à un état où le fix existe et
est de bonne qualité (idempotent, cohérent avec le style existant, documenté), ce qui justifie une remontée
modeste plutôt qu'un saut important — le chantier XL (flush incrémental) et la quasi-totalité des actions
d'infra pure (rôle DB, séparation environnements, SPOF) restent entiers.

### Score si l'on évalue l'état réellement en production (ce qui tourne aujourd'hui)

**62/100** (+1 vs 61/100 initial)

Justification : à l'heure de cet audit, la production tourne encore sur le build du 2026-07-07, avant
toutes les corrections de la session. Concrètement, en prod aujourd'hui : 2 workers PM2 cluster (risque
Critical #1 intact), CASCADE toujours actif sur les tables de paiement (risque Critical #2 intact),
rate-limiters `nearby*` toujours non cluster-safe, chemins de backup encore sur l'ancien nommage
`/opt/onscen/backups` (fonctionnels mais avec la même trappe potentielle qu'avant), rôle DB toujours
sur-privilégié, PG toujours partagé prod/staging. Le seul delta réel et déjà visible en prod par rapport à
l'audit initial est indirect : la migration 026 (antérieure à cette session) avait déjà validé les FK
paiements sans orphelin, donc le risque de rollback de VALIDATE CONSTRAINT est nul — mais ce n'est pas un
effet de la session MODIF 961/963, c'était déjà vrai avant. D'où un score quasiment inchangé.

**Score retenu pour ce rapport (moyenne pondérée, reflétant à la fois la qualité du travail de correction et
son absence d'effet tant que le déploiement n'a pas eu lieu) : 64/100** — à mi-chemin entre les deux vues
ci-dessus, avec la recommandation explicite que ce score ne deviendra réellement ~68-70/100 qu'après un
déploiement complet (build + `pm2 reload` + exécution des migrations 028/029 au boot).

| Vue | Score | Delta vs 61/100 |
|---|---|---|
| Code source (dépôt) | 68/100 | +7 |
| Production live (au moment de l'audit) | 62/100 | +1 |
| **Retenu (pondéré)** | **64/100** | **+3** |

## Conclusion

Le travail de correction de la session (MODIF 961 + 963) est de bonne qualité technique : migrations SQL
idempotentes et cohérentes avec le style du projet, choix `SET NULL` vs `CASCADE` bien justifiés et
documentés au cas par cas, mitigation ciblée honnête (le chantier XL du flush n'est pas maquillé en
« résolu »), rate-limiters correctement basculés sur Redis. **Mais aucun de ces fixes n'a d'effet réel en
production tant qu'un déploiement n'a pas eu lieu** — c'est le point le plus important de ce re-audit, plus
important que le détail de chaque ligne corrigée. Les risques Critical #1 (store RAM multi-worker) et #2
(CASCADE paiements) documentés dans l'audit original sont **toujours actifs sur `getsoundy.com`
aujourd'hui**, malgré leur résolution dans le dépôt Git.

Les actions manuelles d'infra pure (révocation privilèges rôle DB, séparation prod/staging, `VALIDATE
CONSTRAINT` différée sur 028/029, refonte complète du flush) restent, comme prévu et documenté par l'équipe
elle-même, **hors du périmètre d'un fix automatisé** et nécessitent une décision/exécution humaine
explicite — ce re-audit confirme qu'elles sont toujours listées comme telles et toujours non exécutées.
