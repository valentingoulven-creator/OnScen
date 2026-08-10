# Rapport Dev Agent — 2026-07-22 — Compte démo « showcase » complet en production

**Agent :** @onscen-cto (analyse de risque) → @onscen-dev-agent (implémentation)
**Date :** 2026-07-22
**Durée estimée :** ~2 h
**Statut global :** ✅ Terminé

---

## Mission

Créer en production un compte de test « démo » complet (`demo-test@getsoundy.com`) avec un
écosystème riche autour de lui (salons, lives, événements, albums/morceaux, reels, stories,
sponsors, follows) selon un cahier des charges chiffré précis, **sans déployer de code
applicatif** — uniquement des données, avec marquage clair pour nettoyage ultérieur.

---

## Étape 1 — Analyse de risque (CTO)

### 1. Mécanisme démo/seed existant

Recherche dans `commun/backend/src/` (`seed`, `demo`, `bot`, `isTestAccount`) : aucune colonne
`is_demo`/`is_seed_data`, mais **plusieurs conventions de préfixe déjà en prod** :
- `bot_*` (comptes bots salons/lives, filtrés via `isBotHost()` dans `seed-bots.ts`, exposés au
  client via `isBot` sur les endpoints carte/salon/nearby, et bloqués pour les notations).
- `soundy_world_*` / `salon_soundy_world_*` (bots « monde » — `seed-world-random.ts`,
  `seed-production-world-random.ts`, déjà exécutés en prod : 20 salons + 20 lives + 50 events).
- `prod-seed-*` (`seed-production-testdata.ts` / `seed_prod_testdata.js` — 5 followers +
  8 events + 7 posts + 2 cœurs sur le compte `Val`/`admin@getsoundy.com`).

Aucune de ces conventions ne couvre l'intégralité des types d'entités demandés (albums,
compositions, reels, stories, sponsors). **Décision : nouveau préfixe dédié `demo_` (id) /
`demo-` (email)**, distinct des préfixes existants, documenté ici et dans le code des scripts.

### 2. Architecture OnScen — risque majeur identifié

Le backend (`commun/backend/src/lib/pgStore.ts`, `persist.ts`) charge **tout son état en
mémoire au démarrage** (`loadPersistedStoreFromPostgres`) et le **re-synchronise
intégralement vers PostgreSQL toutes les 10 s** (`flushPersistIfDirty` → `savePersistedStoreToPostgres`).
Pour plusieurs tables (`user_follows`, `feed_posts`, `feed_post_favorites`, `stories`,
`sponsors`, `user_favorites`, `notifications`…), cette synchronisation fait un
`DELETE ... WHERE NOT (id = ANY(mémoire))` — c'est-à-dire que **toute ligne insérée
directement en base pendant que le process tourne serait effacée dans les 10 secondes**, et de
toute façon **invisible à l'application** (qui ne relit pas Postgres à la volée). D'autres
tables (`user_albums`, `user_compositions`, `user_reels`, `salons`, `lives`) sont en revanche
upsert/delete ciblés (pas de purge globale) mais restent **également invisibles sans
redémarrage**, car mises en cache mémoire au boot uniquement.

→ **Conclusion : un redémarrage bref du process pm2 est incontournable** (arrêt → écriture
PostgreSQL directe → démarrage, qui recharge la mémoire). C'est exactement le procédé déjà
utilisé par `commun/scripts/seed/run_seed_production.ps1` pour les seeds antérieurs (précédent
établi), mais à une échelle ~15× plus grande ici. **Coût réel et documenté : quelques secondes
à ~1 minute d'indisponibilité de l'API pour les utilisateurs réels**, non évitable sans
réécrire l'architecture de persistance (hors périmètre de cette tâche). Risque jugé
**acceptable** (précédent, fenêtre courte, hors code applicatif) mais **pas nul** — signalé
explicitement ici comme demandé.

### 3. Marquage / nettoyage

Toutes les entités créées (users, salons, lives, albums, compositions, événements, sponsors,
reels, stories, follows, favorites) portent un id préfixé `demo_...` (email `demo-...@...`).
Un script de nettoyage symétrique (`cleanup_demo_showcase.js`) a été écrit et **testé avec
succès sur staging** (tous les compteurs reviennent à 0).

### 4. Pistes audio (3 min / 2 min)

Aucun fichier placeholder existant. Décision : génération de **fichiers audio silencieux
(tonalité sinusoïdale très faible + fade in/out) via `ffmpeg`**, localement, **zéro contenu
protégé par le droit d'auteur**. 4 fichiers « masters » (2× 3 min, 2× 2 min) réutilisés sur les
86 lignes `user_compositions` (seul le titre/artiste diffère en base — les octets audio sont
mutualisés, ce qui est un choix pragmatique pour de la donnée de démo). Déposés dans
`public/uploads/compositions/` (chemin confirmé en observant les uploads réels déjà présents en
prod — `chat-attachments/`, `sponsors/`), conformément au format attendu par
`compositionAssets.ts` (`/uploads/compositions/<fichier>.mp3`).

### 5. Décision finale

**Aucun risque bloquant identifié** — implémentation autorisée avec les mitigations ci-dessus
(préfixe `demo_`, script de nettoyage testé, test préalable sur staging, fenêtre
d'indisponibilité minimisée, pas de contenu protégé).

---

## Étape 2 — Implémentation

### Mapping comptages demandés → modèle de données réel

| Demande | Implémentation | Nombre |
|---|---|---|
| Compte test principal | `demo_user_test` / `demo-test@getsoundy.com` | 1 |
| Suit 5 salons / 5 lives | `user_favorites` (fan=test, host=hébergeur) — mécanisme réel « suivre un créateur » (notif live/salon) | 10 favorites |
| Suit 4 événements | `feed_post_favorites` (test → 4 posts événement dédiés) | 4 |
| 30 événements monde non suivis | `feed_posts` (isEvent=true), auteurs variés, **non** favorisés par test | 30 |
| 2 albums test × 3 morceaux × 3 min | `user_albums` + `user_compositions` (durationSec=180) | 2 albums / 6 morceaux |
| 40 autres users × 1 album × 2 morceaux | idem (durationSec=120) | 40 albums / 80 morceaux |
| Suit 100 utilisateurs | `user_follows` (test → 100 users) | 100 |
| 10 événements créés par test | `feed_posts` (userId=test, isEvent=true) | 10 |
| 10 reels (test + autres) | `user_reels` (mediaType='image' — pas de vidéo générée, voir écarts) | 2 test + 8 autres |
| 30 stories, dont 5 suivis par test | `stories` — 5 auteurs ∈ pool suivi, 25 auteurs **hors** pool suivi | 30 (5+25) |
| 20 événements sponsorisés, 3 France | `feed_posts` + `sponsors` (placement `map_sidebar_events`, `linkedEventPostId`) | 20 (3 FR) |
| Fenêtre 2 mois | `WINDOW_START = now-60j` → `WINDOW_END = now` (passé récent → aujourd'hui, choix documenté dans le script) | — |

**Total utilisateurs distincts créés (hors compte test) : 125** = 40 « album users » (suivis) +
60 « generic users » (suivis, sans album — complètent le pool des 100 suivis) + 25 « outer
users » (**non suivis**, servent uniquement aux 25 stories « non suivies »). Ce total de 125
(plutôt que 100) est nécessaire car la demande implique explicitement que 25 des 30 auteurs de
story soient **hors** des 100 comptes suivis (« parmi eux, 5 sont suivis ») — un pool de
seulement 100 aurait rendu cette contrainte incohérente (tous auraient été suivis).

### Scripts créés (`commun/scripts/seed/`)

- `seed_demo_showcase.js` — script Node autonome (pg + bcryptjs + dotenv, aucune dépendance au
  code TypeScript compilé du backend → **zéro déploiement de code applicatif**). Idempotent :
  vérifie l'existence de `demo_user_test` avant d'écrire (`DEMO_SEED_FORCE=1` pour forcer), et
  chaque INSERT est `ON CONFLICT DO NOTHING`. Toute l'écriture est dans une transaction unique
  (`BEGIN`/`COMMIT`, rollback si erreur).
- `cleanup_demo_showcase.js` — supprime tout ce qui est préfixé `demo_`/`demo-`, dans l'ordre
  FK-safe (engagements reels → reels → compositions/albums → favorites → events → sponsors →
  stories → follows/favorites → lives/salons → users). Transaction unique.
- `verify_demo_showcase.js` — script de vérification en lecture (comptages SQL), utilisé pour
  la validation ci-dessous.

### Test préalable sur staging (`onscen-staging`)

1. Copie des 4 masters audio + scripts vers `/opt/onscen/` (staging).
2. `pm2 stop onscen-backend-staging` → `node seed_demo_showcase.js` → `pm2 start`.
3. Vérification SQL : **tous les compteurs correspondent exactement** à la demande.
4. Re-exécution du seed sans `FORCE` → confirmé idempotent (« existe déjà — rien à faire »).
5. `pm2 stop` → `node cleanup_demo_showcase.js` → **tous les compteurs reviennent à 0** → `pm2 start`.
6. Nettoyage des fichiers de test sur staging (scripts + masters audio) ; `/health` OK après
   chaque redémarrage.

### Exécution en production (`onscen-prod`)

1. Copie des 4 masters audio + scripts vers `/opt/onscen/`.
2. `pm2 stop onscen-backend` → `node seed_demo_showcase.js` → `pm2 start onscen-backend`
   (fenêtre d'indisponibilité ≈ 15–20 s, mesurée sur les horodatages des commandes).
3. `curl https://getsoundy.com/health` → `{"status":"OK",...}` (rétabli).
4. Test de connexion réel : `POST /api/auth/login` avec `demo-test@getsoundy.com` /
   `DemoShowcase#2026!` → **200 OK**, JWT + profil complet retournés.
5. Scripts `.js` retirés de `/opt/onscen/` après usage (seuls les 4 fichiers audio masters
   restent, référencés par les 86 lignes `user_compositions`).

---

## Vérification finale — comptages SQL exacts (production)

| Vérification | Attendu | Obtenu |
|---|---|---|
| Comptes utilisateurs créés (`demo_%`) | — | 126 |
| Salons | 5 | ✅ 5 |
| Lives | 5 | ✅ 5 |
| Albums (total) | 42 (2+40) | ✅ 42 |
| Compositions (total) | 86 (6+80) | ✅ 86 |
| Compositions test à 180 s | 6 | ✅ 6 |
| Compositions autres à 120 s | 80 | ✅ 80 |
| Événements (total) | 64 (10+4+30+20) | ✅ 64 |
| Événements créés par test | 10 | ✅ 10 |
| Événements suivis par test (favorites) | 4 | ✅ 4 |
| Événements monde non suivis | 30 | ✅ 30 |
| Événements sponsorisés | 20 | ✅ 20 |
| Sponsors créés | 20 | ✅ 20 |
| Sponsors en France | 3 | ✅ 3 |
| Reels | 10 | ✅ 10 |
| Stories (total) | 30 | ✅ 30 |
| Stories suivies par test | 5 | ✅ 5 |
| Stories non suivies | 25 | ✅ 25 |
| Follows depuis test | 100 | ✅ 100 |
| Favorites depuis test (salons+lives) | 10 | ✅ 10 |
| Users avec 1 album (40 attendus) | 40 | ✅ 40 |
| Compte test présent | 1 | ✅ 1 |
| Login réel `demo-test@getsoundy.com` | 200 OK | ✅ 200 OK |

**Tous les comptages correspondent exactement à la demande initiale.**

---

## Compte de démonstration principal

- **Email :** `demo-test@getsoundy.com`
- **Username :** `demo_test`
- **Mot de passe :** `DemoShowcase#2026!` (identique pour les 125 autres comptes démo, non
  destiné à un usage réel — à changer si le compte doit être communiqué largement).

---

## Nettoyage ultérieur (rollback complet)

1. `scp commun/scripts/seed/cleanup_demo_showcase.js onscen-prod:/opt/onscen/`
2. `ssh onscen-prod "pm2 stop onscen-backend && cd /opt/onscen && node cleanup_demo_showcase.js && pm2 start onscen-backend"`
3. Optionnel : `ssh onscen-prod "rm -f /opt/onscen/public/uploads/compositions/demo_master_*.mp3 /opt/onscen/cleanup_demo_showcase.js"`

Testé et validé sur staging (tous compteurs → 0) avant d'être documenté ici pour la prod.

---

## Écarts / limitations par rapport à la demande initiale

1. **Reels en `mediaType: 'image'`** (pas de vidéo) — générer 10 vidéos de démonstration
   dépassait le périmètre raisonnable de cette tâche (encodage vidéo + hébergement) ; le schéma
   `UserReel` autorise nativement ce mode (`mediaType: 'image' | 'video'`), donc aucune
   incohérence fonctionnelle, mais l'affichage sera une image fixe plutôt qu'une vidéo.
2. **Stories réparties sur 2 mois vs TTL 24 h** — le modèle `Story` a un `expiresAt = createdAt
   + 24h` (nature éphémère du produit). Réparties sur 60 jours comme demandé, la grande
   majorité des 30 stories seront donc déjà « expirées » aujourd'hui (cohérent avec de vraies
   stories historiques) — seules celles dont l'horodatage tombe dans les dernières ~24 h
   apparaîtront actives dans le fil « stories » actuel. Documenté ici comme compromis entre
   « étaler sur 2 mois » et « stories actuellement visibles ».
3. **Pistes audio mutualisées** — 4 fichiers audio (silence/tonalité, générés `ffmpeg`, sans
   droit d'auteur) réutilisés sur les 86 lignes de morceaux (seuls titre/artiste diffèrent en
   base). Choix pragmatique pour éviter de générer/héberger 86 fichiers distincts sans valeur
   ajoutée pour une démo.
4. **125 utilisateurs « autres » créés (pas seulement 40 ou 100)** — nécessaire pour satisfaire
   simultanément « suit 100 utilisateurs » ET « 5 des 30 auteurs de story sont suivis » (donc
   25 auteurs de story doivent être hors des 100 suivis). Voir tableau de mapping ci-dessus.
5. **Aucun code applicatif déployé** — seuls des scripts *hors* du serveur applicatif (exécutés
   une fois puis retirés de la prod) et des données ont été ajoutés. Le redémarrage pm2
   recharge le **code déjà en production**, sans nouvelle version.
6. **Indisponibilité brève de l'API en prod** (~15–20 s) pendant `pm2 stop` → seed → `pm2
   start` — inhérent à l'architecture actuelle (voir analyse de risque), pas un choix évitable
   dans le cadre de cette tâche.

---

## Fichiers modifiés / ajoutés

| Fichier | Changement |
|---------|------------|
| `commun/scripts/seed/seed_demo_showcase.js` | **Nouveau** — script de seed démo showcase (idempotent) |
| `commun/scripts/seed/cleanup_demo_showcase.js` | **Nouveau** — script de nettoyage symétrique |
| `commun/scripts/seed/verify_demo_showcase.js` | **Nouveau** — script de vérification SQL (comptages) |
| `modification.txt` | Entrée MODIF 1202 ajoutée |
| Production PostgreSQL (`onscen-prod`) | +126 users, +5 salons, +5 lives, +42 albums, +86 compositions, +64 feed_posts, +20 sponsors, +10 reels, +30 stories, +100 user_follows, +10 user_favorites, +4 feed_post_favorites (toutes préfixées `demo_`) |
| Production filesystem (`/opt/onscen/public/uploads/compositions/`) | +4 fichiers audio masters (`demo_master_*.mp3`, silencieux, générés ffmpeg) |

---

## Commandes exécutées

```text
ffmpeg (local)                                    → 4 fichiers audio générés ✅
node --check seed_demo_showcase.js / cleanup_*.js  → ✅ syntaxe OK
Dry-run local (DB injoignable, logique pure)       → ✅ aucune exception
scp + ssh onscen-staging (seed/verify/cleanup)     → ✅ tous les compteurs exacts, cleanup → 0
scp + ssh onscen-prod (seed/verify)                → ✅ tous les compteurs exacts
curl https://getsoundy.com/health                  → ✅ status OK après redémarrage
curl POST /api/auth/login (demo-test@getsoundy.com) → ✅ 200 OK
```

---

## Tests & vérifications

| Vérification | Résultat |
|---|---|
| Syntaxe scripts (`node --check`) | ✅ |
| Dry-run construction des données (sans DB) | ✅ aucune exception |
| Seed + vérif + cleanup sur staging | ✅ tous comptages exacts, cleanup → 0 |
| Seed + vérif sur production | ✅ tous comptages exacts (tableau ci-dessus) |
| Health check prod après redémarrage | ✅ `{"status":"OK"}` |
| Login réel compte test prod | ✅ 200 OK, JWT valide |

---

## modification.txt

- [x] Entrée ajoutée (MODIF 1202 — Scripts seed/cleanup démo showcase production)

---

## Bloquers / décisions requises

| Sujet | Action fondateur |
|-------|------------------|
| Mot de passe démo partagé (`DemoShowcase#2026!`) | Changer si le compte doit être communiqué à des tiers externes |
| Nettoyage après démo | Exécuter `cleanup_demo_showcase.js` (procédure ci-dessus) quand la démo n'est plus nécessaire |
| Reels sans vidéo réelle | Accepter le rendu image fixe, ou demander une itération avec vidéos générées si besoin |

---

## Prochaines étapes

1. Utiliser le compte `demo-test@getsoundy.com` pour la démo.
2. Nettoyer via `cleanup_demo_showcase.js` une fois la démo terminée.
3. Si un besoin récurrent de données démo apparaît, envisager un vrai flag `is_demo` en base
   (migration dédiée) plutôt que la convention par préfixe — hors périmètre de cette tâche.

---

*Généré par OnScen Dev Agent — session hybride @onscen-cto (risque) → @onscen-dev-agent (implémentation)*
