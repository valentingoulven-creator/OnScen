# Audit complet du code — Soundy / MeloSongv2

**Date :** 2026-08-16  
**Périmètre :** code actuel de `HEAD` (`54c030f2`, 2026-07-08)  
**Méthode :** revue statique du code source (backend, frontend, config, tests, migrations). Pas d’exécution runtime, pas d’accès prod, pas de `npm audit` (dépendances non installées dans cet environnement).  
**Audits antérieurs :** ce rapport est indépendant. Il recoupe parfois `AUDIT-RAPPORT-FINAL-v2.md` (2026-07-08) mais s’appuie uniquement sur le code lu aujourd’hui.

**Légende :** **Confirmé** = visible dans le code. **Potentiel** = risque réel si une condition d’exploitation / de déploiement est réunie.

---

## 1. Compréhension générale

### 1.1 Technologie et frameworks

| Couche | Stack |
|--------|--------|
| Frontend web | React 19, Vite 8, TypeScript ~6, Tailwind 4, i18next, Socket.io-client, Leaflet, react-globe.gl, LiveKit, Stripe.js, Sentry, PWA |
| Mobile | Capacitor (`ios/apptel/`) — overrides uniquement ; source partagée = `web/app/src/` |
| Backend | Express 4, Socket.io 4, TypeScript 5 (strict), PostgreSQL + PostGIS, Redis optionnel, Stripe, LiveKit, Cloudflare Stream, Sightengine, S3 (Scaleway), Helmet, express-rate-limit |
| Auth | JWT HS256 — cookie httpOnly `soundy_auth` (web) + header `X-Auth-Token` (natif) ; OAuth Google / Apple / YouTube / Instagram ; WebAuthn ; TOTP 2FA |
| Process | PM2 `instances: 1` (forcé) — store applicatif en RAM |

### 1.2 Architecture

Monorepo 4 stacks :

```
web/app/src/          ← source de vérité frontend (~581 fichiers)
ios/apptel/src/       ← 27 overrides Capacitor (tous divergents du web)
android/              ← build APK/AAB (projet Capacitor Android encore ouvert — C5)
commun/backend/src/   ← API Express + Socket.io (~297 modules TS hors tests)
commun/msdev/         ← runtime dev :4080
commun/deploy/        ← PM2, Caddy, scripts zero-downtime
```

**Modèle de données hybride (point architectural central) :**

1. Un singleton `db` (`commun/backend/src/models/schema.ts`) tient users, salons, lives, DMs, feed, stories, notifs, etc. **en Maps / tableaux RAM**.
2. PostgreSQL sert de snapshot périodique + tables dédiées (geo PostGIS, donations, subscriptions, salons/lives).
3. Redis (si `REDIS_URL`) : rate limits, états OAuth Google/YouTube/WebAuthn, adapter Socket.io.
4. Flush dirty → PG toutes les ~10 s (`persist.ts` + `pgStore.ts`).

Production est volontairement **mono-worker** (`commun/deploy/ecosystem.config.cjs` L31–38) parce que le store RAM n’est pas partagé. C’est documenté et cohérent — mais c’est aussi le plafond de scale.

### 1.3 Rôle des modules principaux

| Module | Rôle |
|--------|------|
| `server.ts` | Express, Helmet/CSP, CORS, rate limits, montage des ~40 routeurs |
| `bootstrap.ts` | Boot : env, hydrate store, seed, persist loop, sockets |
| `middleware/auth.ts` | Cookie + header JWT, `tokenVersion`, scope 2FA, email vérifié |
| `routes/auth.ts` / `oauth.ts` | Register, login, reset, OAuth |
| `routes/salons.ts` / `lives.ts` | Salons YouTube géolocalisés, lives LiveKit/CF/WebRTC |
| `routes/dm.ts` / `chat.ts` / `groups.ts` | Messagerie |
| `routes/donations.ts` / `subscriptions.ts` | Stripe Connect |
| `routes/feed.ts` / `stories.ts` / `reels.ts` | Contenu social |
| `routes/geo.ts` | Nearby (PostGIS + fallback RAM) |
| `socket.ts` | Présence, chat, playback, signaling WebRTC |
| `lib/accessControl.ts` | Admin / comptes bloqués |
| `lib/productionStartup.ts` | Fail-fast prod (JWT, CORS, PG, Sightengine, webhooks Stripe) |
| `web/app/src/App.tsx` | « Routeur » maison (pas de React Router) |
| `web/app/src/context/AuthContext.tsx` | Session cookie + token mémoire |
| `web/app/src/lib/api/` | Client HTTP `credentials: 'include'` |

### 1.4 Flux de données importants

```
Auth     : login/register → Set-Cookie soundy_auth → GET /me → token mémoire (Socket.io)
Salons   : POST /api/salons → RAM + PG → Socket.io salon_{id} → playback YouTube sync
Lives    : POST /api/lives/start → activeLiveByHost (lock synchrone) → LiveKit/CF/WebRTC
Paiements: create-intent / Checkout → webhook Stripe signé → gifts / creatorSubscriptions
Geo      : GET /api/geo/nearby → PostGIS ST_DWithin (si actif) sinon scan Haversine RAM
Social   : feed/stories/reels en RAM + sync PG
DM       : tableaux RAM + caps par paire (`chatHistory.ts`)
```

### 1.5 Dépendances principales

**Backend :** express ^4.19.2, socket.io ^4.8.3, pg ^8.22.0, stripe ^17.7.0, jsonwebtoken ^9.0.2, bcryptjs ^2.4.3, helmet ^8.2.0, livekit-server-sdk ^2.16.0, redis ^4.7.1, @sentry/node ^10.62.0.

**Frontend :** react ^19.2.6, vite ^8.1.2, livekit-client ^2.20.0, leaflet ^1.9.4, react-globe.gl ^2.38.0, @stripe/stripe-js ^5.10.0, i18next ^26.3.4.

**Écarts notables vs écosystème actuel (août 2026) :** Express 4 alors qu’Express 5.2.x est stable — **ne pas migrer sans chantier dédié**. Stripe Node 17 est dans la bonne famille. React 19 / Vite 8 sont à jour.

### 1.6 Incohérences architecturales

1. **PG n’est pas la source de vérité en lecture** pour auth, DM, feed, notifs — le code scanne la RAM. Les index PG (email/username, migration 026) ne sont pas utilisés sur les hot paths.
2. **Redis partiel** : Google/YouTube/WebAuthn y vont ; Instagram OAuth, présence, analytics restent en mémoire.
3. **Trois arbres frontend** : `web/app/src` (canonique), `ios/apptel/src` (forks), `app/src` (4 fichiers legacy). Les docs agent mentionnent encore `app/src/` comme source de vérité.
4. **Pas de couche services HTTP** : les routeurs parlent directement à `db.*`.
5. **Pas de React Router** : navigation par `useState` dans un `App.tsx` de ~1586 lignes — deep links partiels.

### 1.7 Informations manquantes (pas de supposition)

Cet audit **n’a pas** :

- l’état runtime prod (PM2, migrations 028/029 appliquées, `STRIPE_SECRET_KEY` live vs test, `REDIS_URL`, `LEGAL_PUBLISHER_ADDRESS`) ;
- un `npm audit` / lockfile installé (pas de `node_modules` ici) ;
- des mesures de charge (latence persist, taille bundle réelle, volume users) ;
- l’historique Git filtré (les blobs sensibles existent encore dans les commits antérieurs à `54c030f2`).

---

## 2. Bugs et erreurs

### 2.1 IDOR — historique chat salon/live sans contrôle d’accès — **Confirmé** — ÉLEVÉE

**Fichier :** `commun/backend/src/routes/chat.ts` — `GET /salon/:salonId`, `GET /live/:liveId`

```56:67:commun/backend/src/routes/chat.ts
chatRouter.get('/salon/:salonId', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const raw = db.salonChats.get(req.params.salonId) || [];
  const messages = raw.filter((m) => !hasBlocked(me, m.senderId));
  res.json({ messages: enrichChatMessages(messages) });
});
```

**Problème :** tout utilisateur authentifié lit l’historique d’un salon invite-only (ou d’un live) s’il connaît l’ID. Le socket `join_salon` appelle `canJoinSalon` ; les routes REST salons utilisent `salonMemberOr403`. Ces GET ne le font pas.

**Impact :** fuite de conversations privées (salons sur invitation). Les IDs ne sont pas des secrets forts.

**Correction :**

```ts
chatRouter.get('/salon/:salonId', authenticateJWT, async (req, res) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const salon = db.salons.get(req.params.salonId);
  if (!salon || !canJoinSalon(salon, me)) {
    res.status(403).json({ error: 'Accès refusé' });
    return;
  }
  const raw = db.salonChats.get(req.params.salonId) || [];
  res.json({ messages: enrichChatMessages(raw.filter((m) => !hasBlocked(me, m.senderId))) });
});
```

Même logique pour les lives : vérifier existence + ban + éventuellement `assertCanJoinLiveAsViewer` (quota, pas d’ACL privée aujourd’hui — les lives sont publics). Priorité salon > live.

---

### 2.2 Diagnostic logs — `userId` client de confiance — **Confirmé** — MOYENNE

**Fichier :** `commun/backend/src/routes/diagnosticLogs.ts` L86–94

`POST /api/` (ingest) est optionnellement authentifié. Le serveur fait `entry.userId ?? user?.id` : un client peut attribuer des logs à n’importe quel utilisateur.

**Pourquoi :** pollution admin, fausse piste d’incident, injection de contexte trompeur.

**Correction :** ignorer `userId` / `username` du body. Si JWT présent → identité serveur. Sinon → `null`. En prod, exiger l’auth pour l’ingest.

---

### 2.3 Thread DM sans pagination — **Confirmé** — ÉLEVÉE (perf / crash client)

**Fichier :** `commun/backend/src/routes/dm.ts` L320–347

`GET /thread/:userId` filtre **tous** les `db.directMessages` et renvoie le thread entier. Un cap existe à l’écriture (`chatHistory.ts`, 500/paire) mais l’endpoint n’a pas de `limit`/`before`.

**Pourquoi :** payload lourd, jank mobile, timeout possible.

**Correction :** `?limit=50&before=ts` + curseur. Ne jamais renvoyer plus de N messages.

---

### 2.4 Instagram OAuth state en mémoire seule — **Confirmé** — ÉLEVÉE (si scale / restart)

**Fichier :** `commun/backend/src/lib/instagramOAuth.ts` L10–38

`pendingStates = new Map(...)` — pas Redis, contrairement à Google/YouTube/WebAuthn.

**Pourquoi :** restart mid-flow → CSRF state perdu. `PM2 instances > 1` → worker mismatch. Aujourd’hui mitigé par `instances: 1`.

**Correction :** même pattern Redis TTL que `youtubeOAuth.ts`.

---

### 2.5 Flush PG intégral des collections dirty — **Confirmé** — ÉLEVÉE (scale)

**Fichier :** `commun/backend/src/lib/pgStore.ts` L397–437

Documenté dans le code : chaque persist dirty ré-upsert **toute** la collection (users, social, feed, stories, hearts, notifs) puis `DELETE … WHERE NOT id = ANY(...)`.

**Pourquoi :** O(volume total) toutes les ~10 s dès qu’un champ est dirty. À quelques milliers d’users + feed, la latence et les locks PG explosent. `max_memory_restart: 512M` peut tuer le process pendant un gros flush.

**Correction :** journal de dirty keys (userId / postId) + upsert delta. Chantier XL déjà identifié dans `STACK-CIBLE.md`.

---

### 2.6 Lookups auth O(n) — **Confirmé** — MOYENNE

**Fichier :** `commun/backend/src/routes/auth.ts` L171, 278, 795, 821, 856 (et `oauth.ts`)

Login / register / reset / verify parcourent `[...db.users.values()]`. Aucun `Map` email→id. Les index PG 026 existent mais ne sont pas lus.

**Pourquoi :** login linéaire. Race register mitigée par unique PG, pas par la RAM.

**Correction :** `usersByEmail` / `usersByUsername` maintenus à l’écriture, ou lecture PG sur ces chemins.

---

### 2.7 Erreurs PG / web-push avalées — **Confirmé** — MOYENNE

| Endroit | Problème |
|---------|----------|
| `lib/pgStore.ts` L96 | `pgSaveTail = job.catch(() => {})` — premier échec PG silencieux |
| `lib/notifications.ts` L69–71 | échec web-push ignoré |

**Pourquoi :** perte de durabilité / notifs sans alerte ops.

**Correction :** logger + métrique Sentry ; retry borné.

---

### 2.8 FK `NOT VALID` non validées — **Potentiel** — MOYENNE

**Fichiers :** migrations `028_payment_fk_preserve_history.sql` L77–80, `029_content_tables_fk_not_valid.sql`

Les `VALIDATE CONSTRAINT` sont commentés. Postgres n’applique pas les FK aux lignes existantes tant que ce n’est pas validé.

**Correction :** après check orphelins en prod : `ALTER TABLE … VALIDATE CONSTRAINT …`.

---

### 2.9 Compteur unread notifications O(n) — **Confirmé** — FAIBLE / MOYENNE

**Fichier :** `commun/backend/src/routes/notifications.ts` L47 — scan de tout `db.notifications`. Liste plafonnée à 50, pas le count.

---

### 2.10 `OBS_OPEN_TO_ALL = true` — **Confirmé** — MOYENNE (produit)

**Fichier :** `commun/backend/src/lib/platformPlans.ts` L11

OBS / Cloudflare Stream ouverts à tous les comptes « phase test ». Oubli en prod = coût Stream + contournement des plans payants.

**Correction :** `false` en production, ou flag env `OBS_OPEN_TO_ALL=0` forcé par `assertProductionStartup`.

---

### 2.11 Race live start — **Mitigé, potentiel si cluster** — FAIBLE aujourd’hui

`routes/lives.ts` réserve `activeLiveByHost` **avant** le premier `await`. Correct en mono-process. Cassé si `instances > 1` sans lock Redis.

---

### 2.12 Frontend non-strict — **Confirmé** — MOYENNE

`web/app/tsconfig.app.json` : pas de `strict` / `strictNullChecks`. Backend `strict: true`. Null/undefined mal typés côté UI = crashes runtime possibles (`user.x` sur user partiel).

---

### 2.13 Session web dépend du token JSON — **Potentiel** — MOYENNE

`App.tsx` gate `!user || !token`. `/me` renvoie encore `token`. Si on retire le JWT du JSON (hardening XSS), le web affiche login malgré un cookie valide.

**Correction :** gate web sur `user` seul ; token optionnel (natif / socket).

---

## 3. Sécurité

### 3.1 Contrôles déjà solides (ne pas affaiblir)

| Contrôle | Preuve |
|----------|--------|
| Cookie JWT httpOnly, Secure (deployed), SameSite=Strict | `middleware/auth.ts` L50–65 |
| Révocation `tokenVersion` (logout, password change, reset) | `tokenVersion.ts` + `authenticateJWT` |
| Algorithme JWT figé HS256 | `jwtSecret.ts` L6–7 |
| JWT_SECRET obligatoire (prod + hors test) | `jwtSecret.ts` L23–34 |
| Scope `2fa_pending` rejeté | `authenticateJWT` L122–124 |
| bcrypt (cost 10) | `auth.ts` L182 |
| Reset token hashé SHA-256 | `auth.ts` ~828–856 |
| Forgot-password anti-énumération | toujours `{ ok: true }` |
| Admin prod = flag DB uniquement | `accessControl.ts` L139–147 |
| SQL paramétré `$1…$n` | loaders PG |
| Helmet + nonce CSP scripts | `server.ts` L314–361 |
| Rate limits auth / API / geo / dons | `server.ts` |
| Stripe `constructEvent` + fail-fast secrets | `donations.ts`, `productionStartup.ts` L101–117 |
| Uploads : MIME + magic bytes + caps | `chatAttachmentAssets.ts`, `compositionAssets.ts` |
| msdev bloqué en prod | `msdevGuard.ts` |
| SKIP_EMAIL_VERIFICATION interdit en prod | `productionStartup.ts` L46–49 |
| Fichiers sensibles **retirés de HEAD** | `git cat-file` → GONE |

### 3.2 Secrets — HEAD propre, historique sale — **Confirmé** — ÉLEVÉE (résiduel)

Les fichiers suivants **ne sont plus dans HEAD** (commit `54c030f2`) :

- `commun/docs/youtube-audit-demo-credentials.local.txt`
- `commun/msdev/certs/dev-key.pem`
- `commun/msdev/legal-publisher.json`
- `commun/msdev/ceo-founder-context.json`

Ils restent dans l’historique (`6eee6d57` et ancêtres). Repo privé = surface réduite, **pas nulle**.

**Renforcer (ne pas contourner) :**

1. Rotation de tout secret qui a vécu dans ces fichiers (Gmail démo YouTube, éventuellement autres).
2. `git filter-repo` / BFG si le repo a été cloné hors cercle restreint.
3. Vérifier que `.gitignore` actuel (`**/.env`, `**/msdev/certs/`, etc.) reste en place — **c’est le cas**.

Aucun `sk_live_` / mot de passe prod dans les sources trackées aujourd’hui.

### 3.3 Injections SQL / XSS / CSRF

- **SQLi :** non observée. Recherche globale = scan RAM (`globalSearch.ts`). ILIKE PG bound.
- **XSS React :** aucun `dangerouslySetInnerHTML` dans `web/app/src` / `ios/apptel/src`. `LinkifiedText` filtre `javascript:`. Marqueurs carte passent par `escapeHtml()`.
- **CSP :** scripts noncés ; `style-src 'unsafe-inline'` assumé (Tailwind runtime) — impact XSS CSS, pas script.
- **CSRF :** SameSite=Strict + cookie httpOnly. Suffisant tant que l’API n’est pas appelée cross-site avec credentials. Le serveur CORS **n’a pas** `credentials: true` (`server.ts` L363–367) — cohérent avec same-origin prod ; à ajouter seulement si SPA et API sont cross-origin.

### 3.4 Auth / sessions — résidus

1. **JWT encore dans le JSON login / `/me`** (`auth.ts` L334, L366). Cookie httpOnly empêche le vol via `document.cookie`, pas via XSS lisant la réponse XHR / mémoire React. **Potentiel — MOYENNE.** Omettre `token` pour les clients web ; le garder pour Capacitor.
2. **Tokens email/reset dans query string** — logs proxy, Referer. **FAIBLE.** Préférer fragment ou POST one-time.
3. **bcrypt cost 10** — acceptable 2024, un peu bas en 2026 (12 recommandé). **FAIBLE.** Monter progressivement (rehash on login).
4. **`authenticateJWT` renvoie `email` en 403 `email_not_verified`** (L149). L’attaquant a déjà le JWT de la victime dans ce cas. **FAIBLE.**

### 3.5 Autorisation

- DM / groupes : checks participants présents (`dm.ts`, `groups.ts`).
- Admin refunds : `isAccessAdmin`.
- **Chat REST :** trou confirmé (§2.1).
- **Composition `fileUrl` déjà uploadé** (`compositions.ts` L118–119) : réutilisation d’URL `/uploads/compositions/<24 hex>` sans preuve d’ownership. Brute-force irréaliste ; fuite d’URL = réutilisation. **FAIBLE.** Lier upload → `userId`.
- **Ingest diagnostic** : §2.2.

### 3.6 Uploads

Correctement bornés (10 Mo chat, 30 Mo audio, magic bytes, `Content-Disposition: attachment` + nosniff). Modération Sightengine obligatoire au boot prod. ACRCloud : warning si absent, pas de throw — uploads audio sans fingerprint catalogue. **Potentiel — MOYENNE** (copyright, pas sécu classique).

### 3.7 Stripe

Webhooks signés, raw body préservé, secrets exigés si dons/abos activés. Dédup via `db.gifts` + PG. `recordLiveDonation` se fie aux metadata Stripe (posées côté serveur dans `create-intent`). **Potentiel FAIBLE** si un PaymentIntent externe arrive avec metadata forgée et un secret webhook volé — hors modèle de menace normal.

`STRIPE_SECRET_KEY` commençant par `sk_test_` : warning startup uniquement (`productionStartup.ts` L119). **Potentiel ÉLEVÉ** si prod tourne encore en test — à vérifier sur le VPS, hors scope code.

### 3.8 CORS

Prod refuse `*` (`corsConfig.ts` + startup). msdev / dev sans config → `*`. Correct.

### 3.9 Escalade de privilèges

Admin = `user.isAdmin` en production. Listes env `ACCESS_ADMIN_*` ignorées en prod. Dernier admin non rétrogradable. Pas de finding d’escalade confirmé.

### 3.10 Dépendances vulnérables

Non vérifiable ici (pas de `node_modules`). À lancer :

```bash
cd commun/backend && npm audit --omit=dev
cd web/app && npm audit --omit=dev
```

`overrides.ws: ^8.21.0` déjà présent (backend + frontend).

---

## 4. Performance

### 4.1 Backend

| # | Gravité | Finding |
|---|---------|---------|
| P1 | ÉLEVÉE | Flush PG full-collection (§2.5) |
| P2 | MOYENNE | Auth / search / contacts = scan `db.users` |
| P3 | MOYENNE | Liste conversations DM : scan de tous les DMs + group messages (`dm.ts` L210–288) — déjà optimisé vs N×M, reste O(total messages) |
| P4 | MOYENNE | Geo fallback Haversine O(n) si PostGIS off |
| P5 | FAIBLE | `_socketEventCounters` sans eviction (`socket.ts`) |
| P6 | — | Caps chat 500/room, nearby cache 20 s, feed sort cache : **déjà bien** |

**Impact P1 :** c’est le goulot qui empêche N workers et 10k+ users actifs. Priorité scale #1 avec « PG = source de vérité lecture ».

### 4.2 Frontend

- Chunks `vendor-globe` (Three.js + react-globe.gl) et `vendor-map` (Leaflet) : gros, mais **manualChunks** dans `vite.config.ts` + `GlobeView` lazy. `HomePage` importe `MapView` en dur → le chunk map part avec l’onglet carte (OK) mais `HomePage` fait 2971 lignes.
- Pages lourdes lazy dans `App.tsx` : bon.
- `heic2any`, `zxcvbn`, `hls.js`, `livekit-client` isolés : bon.

**Optimisations concrètes :**

1. Dynamic `import()` de `MapView` depuis `HomePage` (impact : TTI onglet carte inchangé, TTI premier paint meilleur si Home n’est pas que map).
2. Bundle analyzer CI (`rollup-plugin-visualizer`) pour suivre les régressions.
3. Pagination DM + commentaires feed (`listFeedPostComments` sans limite).

### 4.3 Mémoire

Présence, analytics, rate-limit memory fallback, Instagram states : Maps process-local. Caps présents sur chats / profileCache (1000) / nearby (500). Risque principal = **taille du store RAM entier** (tous les users + feed) dans un process 512 Mo.

---

## 5. Architecture et maintenabilité

### 5.1 Ce qui tient

- Découpage routes / `lib/` / `models/` lisible.
- Fail-fast prod exemplaire.
- Overrides Capacitor volontairement minces.
- Stack cible déjà écrite (`STACK-CIBLE.md`) — la direction est claire.
- Tests unitaires nombreux sur les libs sensibles (dons, access, JWT, YouTube, moderation).

### 5.2 Dette prioritaire

| Priorité | Zone | Pourquoi |
|----------|------|----------|
| 1 | RAM = source de vérité | Bloque cluster, persist O(n), lookups O(n) |
| 2 | God-components UI | `DmPage` 3514 L, `HomePage` 2971, `ActualiteTabPage` 2349, `ReelsTabPage` 2337, `LivePage` 1970, `App.tsx` 1586 |
| 3 | God-files backend | `salons.ts` 1158, `socket.ts` 1067, `schema.ts` 908, `sponsors.ts` 904 |
| 4 | Forks `ios/apptel` | 23 fichiers divergents — double fix |
| 5 | `app/src` legacy | 4 fichiers, docs obsolètes |
| 6 | Pas de couche services | Routeurs = logique + I/O |
| 7 | TS frontend non strict | Régressions null silencieuses |

### 5.3 SOLID / couplage

Les routeurs importent `db` directement → couplage fort, tests de routes rares. Les bons extraits (`salonAccess`, `tokenVersion`, `stripeClient`) montrent le pattern à généraliser.

**Refactor prioritaire (sans réécrire l’app) :**

1. Extraire `canAccessSalonChat` / `canAccessLiveChat` (fix IDOR + test).
2. Index email/username en RAM (petit, fort ROI).
3. Découper `DmPage` en conversation list / thread / composer (fichiers déjà partiellement extraits : `DmDirectMessageRow`).
4. Ne **pas** monter `PM2 instances` avant lecture PG.

---

## 6. Qualité du code

| Sujet | Constat |
|-------|---------|
| Style | Globalement cohérent (FR messages user, EN identifiants). Mix `alert` / toast / modal. |
| Typage | Backend strict. Frontend lint-only. |
| Erreurs | Beaucoup de `catch` vides volontaires (fallback OAuth, Cloudflare). OK s’ils sont loggés — plusieurs ne le sont pas. |
| Commentaires | Utiles sur auth/CSP/persist. Peu de commentaires périmés dangereux. |
| Fonctions trop longues | God-files ci-dessus. |
| Code mort | `app/src/` (4 fichiers). `peekOAuthExchangeCodeSync` legacy exporté. |
| i18n | `fr.json` / `en.json` riches ; nombreuses chaînes FR en dur (`App.tsx` « Réessayer », `alert('Erreur')`, barre PWA). |
| React Compiler | Règles en **warn** (`TODO-MANUAL`) — CI errors-only. |

Pas de reco cosmétique. Les extraits ci-dessus ont un ROI fiabilité / sécu / scale.

---

## 7. Tests

### 7.1 Inventaire (147 fichiers)

| Zone | Nb | Qualité |
|------|----|---------|
| Backend Vitest | 77 | Bonne sur **libs** (auth scope, donations, salon access, productionStartup, lives.start concurrency) |
| Frontend Vitest | 68 | Helpers purs uniquement (`environment: 'node'`) — **0 `*.test.tsx`** |
| E2E Playwright | 1 smoke (`/health` + `/auth`) | Minimal |
| ios/apptel | 1 (`feedFilter`) | Miroir |
| Agent scenarios | 8 | Hors `npm test` racine |

### 7.2 Bien couvert

Access control, JWT scope, email verification, login attempt limit, donations/subscriptions (logique), salon access, content moderation, CSP/CORS config, lives start race, YouTube quota, location privacy, tokenVersion, persist helpers.

### 7.3 Manques critiques (priorisés)

1. **Route IDOR** — `GET /api/chat/salon/:id` 403 si invite + user non membre.  
2. **Auth HTTP** — login cookie Set-Cookie, logout bump `tokenVersion`, `/me` sans header.  
3. **Webhook Stripe** — signature invalide → 400 ; replay → no double credit.  
4. **Upload** — magic-bytes reject + ownership composition URL.  
5. **E2E** — login → carte → salon → envoi message (1 happy path).  
6. **RTL** — `AuthContext` boot cookie ; `ConfirmModal`.  
7. **Diagnostic ingest** — ignore `userId` client.

Les tests unitaires de libs ne protègent pas les trous d’autorisation au niveau route (le chat IDOR en est la preuve).

---

## 8. Dépendances et configuration

### 8.1 Dépendances

- Pas de dépendance clairement inutile dans les `package.json` lus (globe/map/livekit = produit).
- `heic2any` 0.0.4 : vieux, utile iOS — surveiller.
- Express 4 vs 5 : rester en 4 jusqu’à chantier.
- `typescript` frontend `~6.0.2` vs backend `^5.4.5` — deux majors, acceptable (Vite vs tsc Node).
- `npm audit` **non exécuté** (install absent).

### 8.2 Configuration

| Point | État |
|-------|------|
| `.env*.example` | Complets (backend prod/preprod, msdev, web prod) |
| Secrets gitignorés | Oui |
| `productionStartup` | Excellent fail-fast |
| CORS prod | Obligatoire |
| Cookie Secure | `isDeployedEnv()` |
| HSTS | Prod only |
| Exemples web | Encore « copier vers `app/.env.production` » — chemin obsolète |
| Pas de `.env.development.example` web | Dev = proxy Vite / msdev |
| `LEGAL_PUBLISHER_ADDRESS` | Hors repo (correct) — conformité LCEN = action fondateur |

### 8.3 Prod vs code

Le code **suppose** Redis optionnel, PostGIS optionnel, S3 optionnel. Sans Redis : rate limits et OAuth Google tiennent en RAM (OK à 1 worker). Sans PostGIS : geo O(n). Vérifier le VPS avant de conclure que le code déployé = ce HEAD (l’audit v2 de juillet avait trouvé un écart commit/deploy — **non revérifié ici**).

---

## 9. Expérience utilisateur

### 9.1 Points positifs

- Mobile-first : `dvh`, bottom-sheet `ConfirmModal`, safe-area, beaucoup de cibles 44 px.
- Error boundary (`AppErrorBoundary`) pour Leaflet / YouTube / WebGL / socket.
- Popup globale 5xx / réseau (`GlobalErrorPopup`).
- Lazy routes + spinner `PageFallback`.
- i18n FR/EN sur le cœur produit.

### 9.2 Problèmes confirmés

1. **~68 `alert()` / `window.confirm()`** dans `web/app/src` (DmPage, ChatPanel, Admin*, Live/Salon). Bloquant mobile, hors thème, hors i18n. `ConfirmModal` existe déjà.
2. États de chargement inégaux : DM = « Chargement... » texte ; pas de skeleton.
3. Chaînes FR hors i18n (boot session, PWA update, OAuth errors).
4. Bouton dismiss toast DM trop petit (`×` sans 44 px).
5. Navigation sans URL pour la plupart des onglets — bouton retour navigateur peu utile.
6. Timeout boot session 20 s → logout sur réseau lent (**potentiel**).
7. Admin overlay dans le shell (OK desktop, mauvais téléphone — assumé).

### 9.3 Accessibilité

`ConfirmModal` et toasts : `role="dialog"` / `aria-live`. Beaucoup de boutons icône sans `aria-label`. Clavier non systématique. Pas de finding de contraste dans le code (à tester visuellement).

### 9.4 Formulaires

Auth : âge 13+, version CGU, zxcvbn côté client. Reset / verify : messages anti-énumération côté forgot-password. `check-username` public rate-limité (énumération UX assumée).

---

## 10. Priorisation

### Critique

Aucun crash / RCE / SQLi / auth bypass admin **confirmé** dans le code actuel.

Le plus proche d’une critique **opérationnelle** (pas une faille OWASP classique) :

- **Flush PG full-collection** — peut saturer CPU/RAM/PG et faire redémarrer PM2 (512 Mo) dès que le volume monte. Aujourd’hui acceptable si la base users reste petite ; **critique à l’échelle visée (STACK-CIBLE)**.
- **Secrets encore dans l’historique Git** — si le repo privé fuit, credentials démo / clé TLS / données fondateur sont récupérables. Rotation + filter-repo.

### Élevé

1. **IDOR chat salon (invite-only)** — `routes/chat.ts`. Confirmé.  
2. **Thread DM non paginé** — charge et UX.  
3. **Instagram OAuth state RAM-only** — cassé au restart / futur cluster.  
4. **JWT dans le body JSON web** — XSS → vol de session (cookie httpOnly ne suffit plus).  
5. **`OBS_OPEN_TO_ALL = true`** — risque coût / pricing si oublié en prod.  
6. **Clé Stripe test en prod** — à **vérifier** sur le VPS (warning code only).  
7. **IAP natif absent** (C1) — rejet App Store, pas un bug runtime.

### Moyen

1. Diagnostic logs : `userId` client.  
2. Lookups auth O(n).  
3. Catch PG / web-push silencieux.  
4. FK `NOT VALID`.  
5. Frontend `strict` off.  
6. God-components / forks apptel.  
7. CORS `credentials` absent (si un jour cross-origin).  
8. ACRCloud optionnel.  
9. Commentaires feed / matches list sans limite.  
10. Adresse LCEN / DPA prestataires (hors code).  
11. ~68 `alert`/`confirm`.  
12. E2E / tests de routes absents.

### Faible

1. CSP `style-src unsafe-inline`.  
2. Tokens verify/reset en query.  
3. bcrypt cost 10.  
4. Composition URL reuse.  
5. Username check public.  
6. Ingest diagnostic unauthenticated (pollution).  
7. i18n incomplet / `app/src` legacy.  
8. Compteurs socket sans eviction.  
9. Docs chemins `app/` obsolètes.

---

## 11. Plan d’action

### 1. Corrections urgentes — P0

| Action | Pourquoi |
|--------|----------|
| Ajouter `canJoinSalon` / équivalent live sur `GET /api/chat/salon/:id` et `GET /api/chat/live/:id` + test 403 | IDOR confirmé, correctif localisé |
| Vérifier VPS : `STRIPE_SECRET_KEY` live, migrations 028/029, `LEGAL_PUBLISHER_ADDRESS`, `REDIS_URL` | Écart code/prod déjà vu en juillet |
| Décider rotation + purge historique Git des 4 fichiers sensibles | Fuite résiduelle |
| Remettre `OBS_OPEN_TO_ALL` sous flag env, `false` par défaut en prod | Évite une surprise facture / pricing |

### 2. Corrections importantes — P1

| Action | Pourquoi |
|--------|----------|
| Pagination `GET /api/dm/thread/:userId` | Perf + mobile |
| Redis pour Instagram OAuth state | Alignement autres OAuth |
| Ne plus renvoyer `token` JSON aux clients web ; ajuster `App.tsx` | Réduire impact XSS |
| Forcer `userId` diagnostic côté serveur | Intégrité logs |
| Index RAM email/username (ou lecture PG) | Login O(n) |
| Logger les échecs `pgSaveTail` / web-push | Observabilité |

### 3. Refactorisations recommandées — P2

| Action | Pourquoi |
|--------|----------|
| Persist PG incrémental (dirty keys) | Débloque le scale |
| Lecture auth/geo/DM depuis PG | Permet N workers |
| Découper `DmPage` / `HomePage` / `salons.ts` / `socket.ts` | Maintenabilité |
| `strict: true` frontend par vagues | Moins de crashes null |
| Supprimer `app/src` + corriger docs agent | Source unique |

Ne pas réécrire Express → Fastify / Next / RN.

### 4. Tests à ajouter — P1–P2

1. Route chat IDOR (403 / 200).  
2. Cookie login + logout `tokenVersion`.  
3. Webhook Stripe signature + idempotence.  
4. E2E smoke authentifié (1 parcours).  
5. Ingest diagnostic ignore body `userId`.

### 5. Performance — P2

1. Persist delta.  
2. PostGIS obligatoire en prod (fail-fast si off).  
3. Analyzer bundle + lazy `MapView`.  
4. Caps commentaires feed / matches.

### 6. Sécurité — en continu

1. `npm audit` en CI.  
2. Ownership des uploads compositions.  
3. bcrypt 12 on login.  
4. Auth obligatoire pour diagnostic ingest en prod.  
5. Ne jamais relâcher Helmet / SameSite / webhook verify.

### 7. Long terme

Suivre `commun/docs/STACK-CIBLE.md` : Redis partout, PG source de vérité, BullMQ, cluster PM2, Cloudflare WAF/CDN, IAP stores, onboarding 3 étapes. C’est le bon plan — le code actuel est un palier, pas une impasse.

---

## Note globale : **6,5 / 10**

**Pourquoi pas plus bas :** l’auth web (cookie httpOnly + `tokenVersion`), le fail-fast prod, Helmet/CSP, les webhooks Stripe signés, les uploads validés, l’absence de SQLi/XSS React évidente, et une suite de tests de libs déjà sérieuse. Ce n’est pas un prototype fragile.

**Pourquoi pas plus haut :**

- le runtime « RAM = base » plafonne fiabilité et scale (flush O(n), 1 worker, lookups linéaires) ;
- un IDOR chat confirmé a échappé aux audits précédents — symptôme de tests de routes trop minces ;
- le frontend mélange god-components, `alert()`, i18n partiel et TypeScript non strict ;
- l’historique Git a contenu des secrets (HEAD propre, passé sale) ;
- l’e2e et les tests d’autorisation HTTP sont quasi absents.

**Lecture opérationnelle :** qualité **suffisante pour une prod à faible / moyen volume** si le VPS est aligné sur ce HEAD. **Insuffisante** pour l’objectif 500k sans exécuter la stack cible. Le prochain sprint le plus rentable n’est pas une refonte : **fermer l’IDOR chat, paginer les DM, et commencer le persist incrémental**.

---

*Audit @soundy-dev-agent — 2026-08-16 — revue statique uniquement.*
