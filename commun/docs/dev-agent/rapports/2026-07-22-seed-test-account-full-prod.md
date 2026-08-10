# Rapport Dev Agent — 2026-07-22 — Compte de test complet en production

**Agent :** @onscen-cto (analyse rapide, requalification RACI) → @onscen-dev-agent (implémentation)
**Date :** 2026-07-22
**Durée estimée :** ~2h30
**Statut global :** ✅ Terminé

---

## Mission

Demande explicite du fondateur (adressée en mode `@onscen-cto` mais reconnue comme tâche
d'implémentation, RACI oblige → `@onscen-dev-agent`) : créer **en production** un compte de
test complet (`demo_test_founder`) avec un cahier des charges chiffré précis — salons/lives/
événements suivis, événements monde, albums/morceaux, 100 follows, publications, reels,
stories, événements sponsorisés — étalé sur une fenêtre de 2 mois, pour valider l'app en
conditions réelles.

---

## Contexte / problème

Aucun script existant ne couvrait l'intégralité du périmètre demandé (albums, compositions,
reels, stories, sponsors, follows massifs). Les scripts `seed-production-*` existants
(`seed-production-testdata.ts`, `seed-production-sponsors.ts`, `seed-production-salons-lives.ts`,
`seed-production-world-random.ts`) couvrent chacun une tranche du besoin mais aucun ne combine
tout, et aucun ne fournit le volume demandé (100 follows, 40 albums/80 morceaux, etc.). Un
nouveau script dédié était nécessaire.

**Mécanisme de distinction compte test / compte réel** : le schéma (`commun/backend/src/models/schema.ts`)
ne propose aucun flag `is_demo`/`is_test`. Convention utilisée : préfixe d'id **`demo-`** (et
username `demo_test_founder`), cohérente avec les préfixes déjà en usage en prod
(`prod-seed-*`, `soundy_world_*`, `bot_*`). Documenté ici en l'absence de garde-fou schéma.

---

## Analyse du modèle de données (avant implémentation)

- **Persistance** : l'app charge tout son état en RAM au démarrage
  (`loadPersistedStoreFromPostgres`) et ne relit pas Postgres à la volée. Plusieurs tables
  (`feed_posts`, `stories`, `sponsors`, `user_follows`, `user_favorites`, `notifications`…)
  sont resynchronisées en full replace (delete des lignes absentes du snapshot mémoire) via
  `savePersistedStoreToPostgres()`. D'autres (`user_albums`, `user_compositions`, `user_reels`,
  `salons`, `lives`) sont upsert ciblés (`persistAlbumToPg`, `persistCompositionToPg`,
  `persistReelToPg`, `saveSalonsLivesToPostgres`). **Conséquence : un redémarrage pm2 est
  nécessaire après le seed** pour que le process applicatif recharge les nouvelles données en
  RAM (sans quoi le nouveau compte ne peut pas se connecter — confirmé par un test de login
  réel avant/après restart, voir plus bas).
- **Pas de suivi direct salon/live/event** : le modèle ne propose qu'un suivi `user → user`
  (`userFollows`, `followUser()`/`isFollowing()`). Interprétation retenue pour « le compte test
  suit 5 salons / 5 lives / 4 events » : le compte test suit l'hôte/auteur de chacun de ces
  5+5+4 contenus (14 utilisateurs dédiés), qui apparaissent ainsi dans son flux « Suivi ».
  Documenté explicitement comme choix arbitraire.
- **Événements sponsorisés** : confirmé le modèle réel (`lib/sponsors.ts`,
  `seed-production-sponsors.ts`) — une `FeedPost` (`isEvent: true`) + un `Sponsor`
  (`placement: 'map_sidebar_events'`, `linkedEventPostId`). Réutilisé à l'identique pour les
  20 événements sponsorisés, avec `admin@getsoundy.com` comme auteur (jamais le compte
  personnel du fondateur `Val`, pour ne pas polluer son profil réel).
- **user_reels porte une FK vers `users(id)`** (migration 029, `NOT VALID` mais **appliquée
  aux nouvelles lignes**) — contrairement à `user_albums`/`user_compositions` qui n'ont pas
  cette contrainte. Écueil rencontré à la 1ʳᵉ exécution (voir « Écueils »).
- **Géolocalisation événements monde** : les coordonnées des `eventLocation` sont résolues
  côté frontend via une liste de villes connues (`web/app/src/lib/worldPopulatedCityCoords.ts`,
  alignée sur `commun/backend/src/lib/botPopulatedCities.ts`). Les 30 événements monde et les
  17 événements sponsorisés internationaux utilisent exclusivement des noms de villes de cette
  liste pour garantir un pin carte correct sans dépendre du géocodage réseau (Nominatim).

---

## Actions réalisées

- [x] Exploration du schéma DB réel, des scripts `seed-production-*` existants, du mécanisme
  de persistance (`persist.ts`, `pgStore.ts`, `pgAlbums.ts`, `pgCompositions.ts`, `pgReels.ts`,
  `pgSalonsLives.ts`, `pgStoreSocialSync.ts`) et du modèle sponsors/follows/favorites.
- [x] Écriture du script `commun/backend/src/scripts/seed-test-account-full.ts` (idempotent,
  garde d'entrée sur l'existence du compte test, insertions uniquement — aucune donnée
  utilisateur réelle modifiée).
- [x] Génération de 12 fichiers audio MP3 réels (~180 s, tonalités sinus + fade, `ffmpeg`,
  aucun contenu protégé par le droit d'auteur) pour les 86 lignes `user_compositions`.
- [x] Build TypeScript local (`tsc --noEmit` + `npm run build`), déploiement du **seul fichier
  compilé** `dist/scripts/seed-test-account-full.js` + des 12 fichiers audio sur le VPS
  `onscen-prod` (aucun autre fichier applicatif touché — pas de code métier déployé).
- [x] Exécution contre la vraie base `onscen-prod` — échec à la 1ʳᵉ tentative (FK `user_reels`,
  voir écueil ci-dessous), correction de l'ordre de persistance, rebuild, redéploiement,
  ré-exécution réussie.
- [x] `pm2 restart onscen-backend` (nécessaire pour que l'app recharge les données depuis
  Postgres — sans code applicatif modifié).
- [x] Vérification exhaustive par comptage SQL direct (`psql`) sur chaque table concernée.
- [x] Test de connexion réel (`POST /api/auth/login`) avant (❌ échec attendu, RAM pas
  rechargée) et après (✅ 200 OK, JWT valide) le redémarrage pm2.
- [x] Découverte en cours de session d'un second jeu de données quasi identique créé par une
  session distincte (voir section dédiée) — vérification croisée qu'aucune donnée n'a été
  perdue de part et d'autre.
- [x] Nettoyage des fichiers de travail temporaires (scripts psql `/tmp/*.sh` sur le VPS,
  dossier `commun/backend/tmp-seed-audio/` en local).
- [x] Documentation (ce rapport, `INDEX.md`, `modification.txt`).

---

## ⚠️ Découverte importante : deux comptes de test coexistent désormais en prod

En cours de session, la commande `git status` a révélé des fichiers **non committés et non
présents en début de session** (`commun/scripts/seed/seed_demo_showcase.js`,
`cleanup_demo_showcase.js`, `verify_demo_showcase.js`,
`commun/docs/dev-agent/rapports/2026-07-22-demo-showcase-seed-prod.md`) décrivant une session
**distincte** ayant exécuté, en parallèle de la mienne, un seed quasi identique répondant au
même cahier des charges chiffré.

Vérification directe (psql, en fin de session) : les **deux jeux de données sont bien
réellement présents en production**, sans collision (préfixes d'id distincts) :

| | Compte A (autre session) | Compte B (cette session) |
|---|---|---|
| Username | `demo_test` | `demo_test_founder` |
| Id | `demo_user_test` | `demo-test-founder` |
| Email | `demo-test@getsoundy.com` | `demo.test.founder@getsoundy-demo.local` |
| Mot de passe | `DemoShowcase#2026!` (partagé avec 125 autres comptes) | Généré aléatoirement, unique (voir plus bas) |
| Préfixe id contenu | `demo_...` (underscore) | `demo-...` (hyphen) |

Comptage croisé final (aucune perte de données, les deux coexistent proprement) :

| Table | Avant les deux seeds | + Compte A | + Compte B | Total réel mesuré |
|---|---|---|---|---|
| `users` | 30 | +126 | +221 | **377** ✅ |
| `feed_posts` | 256 | +64 | +144 | **464** ✅ |
| `stories` | 0 | +30 | +30 | **60** ✅ |
| `sponsors` | 19 | +20 | +20 | **59** ✅ |
| `user_follows` | 6 | +100 | +100 | **206** ✅ |
| `user_reels` | 0 | +10 | +10 | **20** ✅ |
| `user_albums` | 0 | +42 | +42 | **84** ✅ |
| `user_compositions` | 0 | +86 | +86 | **172** ✅ |

**Recommandation** : le fondateur doit choisir lequel des deux comptes conserver pour ses
tests, et éventuellement demander le nettoyage de l'autre (un script `cleanup_demo_showcase.js`
existe déjà pour le compte A ; pour le compte B, voir requête de nettoyage en fin de rapport).
Aucune suppression n'a été effectuée de ma propre initiative (donnée destructive = décision
fondateur).

---

## Écueil rencontré et corrigé

1ʳᵉ exécution : échec sur `demo-reel-test-01` — `insert or update on table "user_reels"
violates foreign key constraint "user_reels_author_fk"` (migration `029_content_tables_fk_not_valid.sql`,
FK `NOT VALID` mais **appliquée aux nouvelles lignes**). Cause : le script persistait
albums/compositions/reels **au fil de leur création**, avant l'appel final à
`savePersistedStoreToPostgres()` qui upsert les utilisateurs — les auteurs n'existaient donc
pas encore côté Postgres au moment du premier `INSERT INTO user_reels`.

**Correction** : restructuration pour persister albums/compositions/reels **après**
`savePersistedStoreToPostgres()` + `saveSalonsLivesToPostgres()`. La 1ʳᵉ tentative avait déjà
écrit 42 albums + 86 compositions (tables sans FK vers `users`, donc pas bloquées) avec des
`user_id` momentanément orphelins ; la 2ᵉ exécution (idempotente, `ON CONFLICT DO UPDATE`) les
a corrigés sans duplication. Aucune donnée corrompue au final (vérifié par comptage).

---

## Mapping demande → implémentation

| Demande fondateur | Implémentation réelle | Vérifié |
|---|---|---|
| Compte test | `demo_test_founder` / `demo-test-founder` | ✅ |
| Suit 5 salons / 5 lives / 4 events | Suit l'hôte/auteur de 5 salons + 5 lives + 4 events dédiés (interprétation documentée ci-dessus, pas de suivi direct salon/live/event dans le schéma) | ✅ 5+5+4 |
| 30 événements monde non suivis | `feed_posts` (`isEvent`), 30 auteurs distincts, villes multi-continents (Asie, Europe, Amériques, Afrique, Océanie), non suivis | ✅ 30 |
| 2 albums test × 3 morceaux 180s | `user_albums` + `user_compositions` (durationSec=180, fichiers MP3 réels) | ✅ 2 / 6 |
| 40 autres users × 1 album × 2 morceaux | idem | ✅ 40 / 80 |
| Suit 100 utilisateurs | `user_follows` (test → 100 users, voir composition détaillée ci-dessous) | ✅ 100 |
| 10 événements créés par test | `feed_posts` (userId=test, isEvent=true), mix France/monde | ✅ 10 |
| 10 reels (mix documenté) | 3 compte test + 4 utilisateurs suivis + 3 utilisateurs non suivis | ✅ 10 |
| 30 stories dont 5 suivis | 5 auteurs suivis + 25 non suivis, timestamps < 20h (voir écart TTL) | ✅ 30 (5+25) |
| 80 publications (20 suivis / 40 non suivis / 20 test) | `feed_posts` non-événement | ✅ 20+40+20 |
| 20 événements sponsorisés, 3 France | `feed_posts` + `sponsors` (`map_sidebar_events`), auteur `admin@getsoundy.com` | ✅ 20 (3 FR + 17 monde) |
| Fenêtre 2 mois | `createdAt` aléatoire sur les 60 derniers jours (posts/reels/events/albums) | ✅ (sauf stories, voir écart) |

**Composition exacte des 100 utilisateurs suivis** : 5 hôtes salons + 5 hôtes lives + 4 auteurs
d'événements suivis + 5 auteurs de stories suivis + 20 auteurs de publications suivies + 15
des 40 « utilisateurs albums » + 46 comptes suivis génériques (sans autre rôle, juste pour
compléter le quota exact de 100).

---

## Écarts / limitations documentés

1. **Suivi salon/live/event** : voir interprétation ci-dessus (le schéma ne le permet pas
   nativement) — escaladé comme constat d'architecture, pas de code applicatif modifié.
2. **Follows sans timestamp** : `userFollows: Map<string, Set<string>>` ne stocke **aucune**
   date de création par relation — impossible d'étaler les 100 follows sur 2 mois sans
   migration de schéma (hors périmètre demandé : « ne déploie pas de nouveau code
   applicatif »). Toutes les autres dimensions (posts, events, reels) sont bien étalées.
3. **Stories concentrées sur ~20h (pas 2 mois)** : TTL story = 24h (`expiresAt = createdAt +
   24h`). Un étalement sur 2 mois aurait rendu la quasi-totalité des 30 stories déjà expirées
   et invisibles dans l'app aujourd'hui — contradictoire avec l'objectif « tester l'app ».
   Écart assumé et documenté.
4. **Morceaux audio mutualisés** : 12 fichiers MP3 réels distincts (tonalités, générées
   `ffmpeg`, aucun contenu protégé) réutilisés en pool sur les 86 lignes `user_compositions`
   (titre/artiste distincts en base, octets audio mutualisés). Pragmatique pour de la donnée
   de démo — évite de générer 86 fichiers sans valeur ajoutée.
5. **Reels en `mediaType: 'image'`** (posterUrl Unsplash, pas de vidéo) pour les 10 reels —
   évite d'héberger des fichiers vidéo factices ; le schéma `UserReel` supporte nativement ce
   mode.
6. **Deux comptes de test coexistent en prod** (voir section dédiée) — décision fondateur
   requise.
7. **Redémarrage pm2 nécessaire** (~5-10s d'indisponibilité mesurée) — inhérent à
   l'architecture RAM-first existante, pas un choix évitable dans ce périmètre.

---

## Identifiants du compte de test créé

- **URL de connexion :** https://getsoundy.com (email + mot de passe standard)
- **Username :** `demo_test_founder`
- **Email :** `demo.test.founder@getsoundy-demo.local`
- **Mot de passe :** `OnScen-G29La4Z9rzBs!` *(généré aléatoirement, haché bcrypt en base — ne
  figure nulle part ailleurs que dans ce rapport ; à changer si le compte doit être communiqué
  à des tiers)*

---

## Fichiers modifiés / ajoutés

| Fichier | Changement |
|---------|------------|
| `commun/backend/src/scripts/seed-test-account-full.ts` | **Nouveau** — script de seed (non committé, voir note plus bas) |
| `commun/docs/dev-agent/rapports/2026-07-22-seed-test-account-full-prod.md` | **Nouveau** — ce rapport |
| `commun/docs/dev-agent/INDEX.md` | Entrée ajoutée (en tête) |
| `modification.txt` | Entrée MODIF 1205 ajoutée |
| Production PostgreSQL (`onscen-prod`) | +221 users, +5 salons, +5 lives, +144 feed_posts, +30 stories, +10 reels, +42 albums, +86 compositions, +100 user_follows, +20 sponsors |
| Production filesystem (`/opt/onscen/public/uploads/compositions/`) | +12 fichiers audio (`demo-seed-track-01..12.mp3`) |
| Production process (`onscen-backend`, pm2) | Redémarré une fois (rechargement RAM depuis Postgres) |

---

## Commandes exécutées

```text
cd commun/backend && npx tsc --noEmit -p tsconfig.json   → ✅
cd commun/backend && npm run build                        → ✅
scp dist/scripts/seed-test-account-full.js onscen-prod:... → ✅
scp tmp-seed-audio/*.mp3 onscen-prod:.../compositions/     → ✅ (12 fichiers)
ssh onscen-prod "node dist/scripts/seed-test-account-full.js"
  1ʳᵉ exécution → ❌ FK user_reels_author_fk (voir écueil)
  2ᵉ exécution (après fix + rebuild + redeploy) → ✅ tous les compteurs corrects
ssh onscen-prod "pm2 restart onscen-backend --update-env" → ✅
curl https://getsoundy.com/health                          → ✅ {"status":"OK",...}
curl -X POST .../api/auth/login (avant restart)             → ❌ (attendu, RAM pas rechargée)
curl -X POST .../api/auth/login (après restart)              → ✅ 200 OK, JWT + profil complets
psql (comptage SQL sur toutes les tables concernées)         → ✅ tous les comptages exacts
```

---

## Tests & vérifications

| Vérification | Résultat |
|--------------|----------|
| Type-check backend (`tsc --noEmit`) | ✅ |
| Build backend (`npm run build`) | ✅ |
| Exécution script contre la vraie base `onscen-prod` | ✅ (après correction FK) |
| Comptage SQL exact sur `users`, `salons`, `lives`, `feed_posts` (events + posts + sponso), `sponsors`, `stories`, `user_reels`, `user_albums`, `user_compositions`, `user_follows` | ✅ tous exacts |
| Health check prod après redémarrage pm2 | ✅ `{"status":"OK","db":"ok"}` |
| Login réel du nouveau compte (`POST /api/auth/login`) | ✅ 200 OK, JWT valide |
| Aucune donnée utilisateur réelle modifiée (insertions uniquement) | ✅ vérifié (`assertSafeUserSnapshot` + revue manuelle) |
| Absence de perte de données du second seed concurrent | ✅ vérifié par comptage croisé avant/après |

---

## modification.txt

- [x] Entrée ajoutée (MODIF 1205 — Compte de test complet en production)

---

## Bloquers / décisions requises

| Sujet | Action fondateur |
|-------|------------------|
| **Deux comptes de test coexistent en prod** (`demo_test` et `demo_test_founder`) | Choisir lequel conserver ; demander le nettoyage de l'autre si besoin (script de cleanup existant pour `demo_test`, requête à écrire pour `demo_test_founder` si le fondateur préfère garder l'autre) |
| Mot de passe démo (`OnScen-G29La4Z9rzBs!`) | Le changer si le compte doit être communiqué à des tiers externes |
| Script de seed non committé | Le committer si utile pour ré-exécution future (par défaut laissé en local, voir note) |
| Follow-up éventuel sur le flag `is_demo` | Si un besoin récurrent de comptes démo apparaît, envisager une vraie colonne dédiée (migration) plutôt que la convention par préfixe — hors périmètre ici |

---

## Prochaines étapes

1. Le fondateur teste le compte `demo_test_founder` (ou `demo_test`, selon son choix).
2. Décider du sort du compte non retenu (conserver les deux, ou nettoyer l'un).
3. Committer `seed-test-account-full.ts` si le fondateur souhaite le garder en repo pour
   réutilisation future (non fait par défaut, voir contrainte « ne pas commit sans demande
   explicite »).

---

## Notes techniques

- **Emplacement du script** : `commun/backend/src/scripts/seed-test-account-full.ts` (local,
  non committé). Le fichier compilé déployé sur le VPS est à
  `/opt/onscen/dist/scripts/seed-test-account-full.js` — **présent en prod** (pas retiré après
  usage, contrairement au script de la session concurrente ; réexécuter sans risque grâce à la
  garde d'idempotence sur `demo-test-founder`).
- **Fichiers audio déployés** : `/opt/onscen/public/uploads/compositions/demo-seed-track-01.mp3`
  à `-12.mp3` (12 fichiers, ~1,4 Mo chacun, 180s, tonalités sinus). **Ne pas supprimer** sans
  supprimer aussi les 86 lignes `user_compositions` qui les référencent (dont 6 appartiennent
  au compte test).
- **Idempotence** : relancer le script ne fait rien si `demo-test-founder` existe déjà
  (garde en tout début de `main()`). Pas de variable `FORCE` implémentée (non nécessaire —
  toute ré-exécution après succès est un no-op volontaire).

---

*Généré par OnScen Dev Agent — session hybride @onscen-cto (requalification RACI) → @onscen-dev-agent (implémentation)*
