# Audit Database & Infrastructure — Soundy

Méthode : lecture statique (code + migrations SQL) + accès SSH lecture seule sur `soundy-prod`/`soundy-staging`.

## Résumé exécutif

Architecture actuelle : Express + Socket.io, store applicatif en RAM (`db` — `models/schema.ts:821`) flushé périodiquement vers PostgreSQL (`pgStore.ts`), PM2 cluster à 2 workers en prod, Redis actif (socket adapter OK), 1 seul VPS, 1 seule instance PostgreSQL managée Scaleway partagée prod+staging. Les bases (indexation, paramétrage SQL, transactions sur le flush) sont globalement saines et le sujet est déjà bien documenté par l'équipe elle-même (`STACK-CIBLE.md`, `SCALABILITY.md`). Mais plusieurs risques structurels non résolus menacent la cohérence des données et la protection des paiements dès que le trafic augmentera.

**Score du domaine (DB + Infra) : 61/100**

Fondations solides (requêtes paramétrées, index composites/partiels/GIN pensés, transactions sur le flush, backups fonctionnels, Redis correctement câblé pour Socket.io et la majorité des rate-limiters, CSP scoping strict, HSTS actif) mais handicapé par des risques Critiques non résolus (cohérence RAM multi-worker, CASCADE DELETE sur les paiements) et une infrastructure à SPOF triple (1 VPS, 1 PG, 1 Redis) sans aucune redondance.

**Répartition des problèmes trouvés : 3 Critical · 6 High · 7 Medium · 2 Low** (18 au total)

## Top 5 des problèmes les plus critiques

1. **[Critical] Store applicatif en RAM dupliqué entre les 2 workers PM2 cluster → incohérence de données.** `models/schema.ts:821` définit `db` comme objet JS en mémoire (Maps/arrays) par process ; `ecosystem.config.cjs` lance `instances: 2, exec_mode: 'cluster'` ; aucun mécanisme (pub/sub, IPC) ne resynchronise ce store entre workers — seul le flush PG (10 s) et le chargement au boot existent. Un utilisateur routé alternativement vers worker A puis B peut voir des données différentes/manquantes.

2. **[Critical] `ON DELETE CASCADE` sur les tables de paiement.** `migrations/025_foreign_keys_not_valid.sql:8-34` : `donation_payments`, `creator_subscriptions` (×2 FK), `subscription_checkouts` référencent `users(id)` avec CASCADE. Supprimer un compte détruit silencieusement tout l'historique de paiement/abonnement Stripe — problématique légal/comptable.

3. **[Critical] Flush périodique = ré-upsert intégral de toutes les collections toutes les 10 s.** `pgStore.ts:397-434` + `pgStoreSocialSync.ts` (boucles `for` avec `await client.query` par ligne, puis `DELETE FROM x WHERE NOT id = ANY(...)` sur la table entière) à chaque cycle « dirty », dans une seule transaction. Aucune limite sur `db.directMessages` (contrairement aux chats salon/live cappés par `MAX_CHAT_MESSAGES_PER_ROOM`). Ne scale pas : O(volume total) requêtes séquentielles par flush.

4. **[High] Rate-limiters critiques non cluster-safe, y compris le brute-force login.** `server.ts:433-439` (`authLimiter`, 8 req/15 min) et `routes/geo.ts:94-116` (`nearbyAnonLimiter`/`nearbyAuthLimiter`) n'utilisent pas `store: createRateLimitStore(...)` (contrairement à `salons.ts`, `oauth.ts`, `webauthn.ts`) → chaque worker PM2 a son propre compteur mémoire, doublant de facto la limite réelle malgré Redis déjà disponible en prod (confirmé par SSH).

5. **[High] Aucune contrainte FK sur ~90 % des tables + rôle DB sur-privilégié.** `001_init.sql`/`002_complete_schema.sql` : ~30 tables (`feed_posts`, `notifications`, `gifts`, `user_reels`, `heart_events`…) n'ont aucune `REFERENCES users(id)` — seules 4 tables (paiements) en ont depuis la migration 025. Vérifié en SSH (`psql`) : le rôle applicatif `soundy` a `rolcreaterole=t, rolcreatedb=t` — privilèges excessifs pour un compte d'appli.

## Autres constats notables (High/Medium)

- Prod et staging partagent la même instance PostgreSQL (hôte unique `51.15.132.229:14440`) — effet de bord possible entre environnements.
- Triple SPOF confirmé en SSH : 1 VPS (`51.159.164.100`), 1 `postgres` managé, 1 process `redis-server` local — aucune réplication nulle part.
- `STRIPE_SECRET_KEY` en mode test sur `APP_ENV=production` (confirmé via logs PM2) — dons/paiements réels désactivés.
- Dérive de nommage `/opt/soundy` vs `/opt/soundly` : la racine réelle de l'app est `/opt/soundly`, mais `backup-db.sh` écrit dans `/opt/soundy/backups` (sans « ly »). Les sauvegardes fonctionnent (dump frais du 07/07/2026 vérifié), mais un dossier `/opt/soundly/backups/` abandonné contient des dumps figés au 30/06 — piège potentiel en cas de restauration d'urgence.
- Process `soundy-auth` tournant en prod (pm2, fork mode) : absent du dépôt Git, non documenté, hash de mot de passe de repli codé en dur dans le script, sessions en `Map` mémoire (perdues à chaque redeploy).
- Disque staging à 72 % d'usage (2,5 Go restants sur 8,9 Go).
- Interpolation de noms de table dans `pgStoreSocialSync.ts:31-40` (`pruneCompositePairs`) — pas d'injection active (params tous internes), mais pattern dangereux si réutilisé avec une entrée externe.
- Table `gifts` sans FK ni purge à la suppression de compte → orphelins permanents en PG.

## Impossible à vérifier avec les informations disponibles

- Sauvegardes automatiques console Scaleway (rétention réelle, dernier test de restauration) — accès console non disponible, seul le SSH VPS l'était.
- Atomicité complète du webhook Stripe (`donations.ts`/`pgDonations.ts`) end-to-end — non tracée en détail dans le temps imparti.
- Volume réel de trafic/DAU en production actuelle (pour prioriser l'urgence des risques de scale).
- Contenu exhaustif de `monitor-alerts.sh` (vérifie-t-il la liveness Redis/PG explicitement ?) — non lu en intégralité.
- Réglages exacts des « Allowed IPs » et politique de rétention des backups automatiques dans la console Scaleway Managed Database.

## Synthèse rapide

- **Problèmes par gravité** : 3 Critical · 6 High · 7 Medium · 2 Low (18 au total)
- **Score du domaine : 61/100**
