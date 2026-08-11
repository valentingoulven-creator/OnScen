# Décommissionnement complet de `getsoundy.com` — 2026-08-11

## Mission

Demande utilisateur : « Retire getsoundy.com, seul onscen.com doit fonctionner ».

Précisions obtenues (via questions à choix) :
- **Comportement** : hard stop (aucune redirection HTTP/HTTPS vers `onscen.com`, coupure nette).
- **Scope** : appliqué immédiatement en **production** et **staging**.
- **Emails** : toutes les adresses applicatives `@getsoundy.com` basculées vers `@onscen.com`.

## Contexte

La migration de domaine `getsoundy.com` → `onscen.com` avait déjà eu lieu le 2026-08-10
(cf. `commun/docs/ONSCEN-DOMAINE.md`), avec `onscen.com` comme domaine canonique et
`getsoundy.com` maintenu en parallèle (CORS, Caddy, cert pinning mobile, deep links)
pendant la transition. Cette session ferme cette transition : `getsoundy.com` est
retiré de tous les points où il subsistait encore.

## Travail effectué

### 1. Caddy — hard stop TLS (pas de redirection)

- `commun/deploy/Caddyfile` (prod) : blocs `getsoundy.com {}` et `www.getsoundy.com {}`
  supprimés. Sans bloc Caddy, aucun certificat Let's Encrypt n'est délivré pour ce
  host → le handshake TLS échoue directement (pas de 301/302, coupure nette voulue).
- `commun/deploy/Caddyfile.staging` : bloc `staging.getsoundy.com` supprimé (idem).
- `commun/deploy/sync-caddy.sh` et `sync-caddy-staging.sh` : ajout d'un garde-fou qui
  **refuse d'installer** un Caddyfile source contenant encore `getsoundy.com` (anti-
  régression si quelqu'un le réintroduit par erreur).
- `commun/deploy/caddy-watchdog.sh` et `install-caddy-guard.sh` : la détection de
  Caddyfile cassé/minimal se base désormais sur la présence de `onscen.com`.

**Incident rencontré** : le premier déploiement staging a été bloqué par ce garde-fou
lui-même, car les *commentaires* du Caddyfile source mentionnaient encore littéralement
« staging.getsoundy.com décommissionné » — un grep naïf `getsoundy.com` matche aussi les
commentaires explicatifs. Corrigé en reformulant les commentaires sans le nom de domaine
littéral.

### 2. Variables d'environnement VPS (prod + staging)

`commun/deploy/patch-env-onscen-domain.sh` (déjà existant depuis la migration du 10/08)
mettait à jour `WEB_APP_URL`, `CORS_ORIGIN`, `WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGIN` mais
incluait encore `getsoundy.com` dans la valeur `CORS_ORIGIN` (double-origine pendant la
transition). Corrigé pour n'injecter que `onscen.com` / `www.onscen.com`.

**Découverte en cours de vérification** : au-delà de ces 4 clés, le `.env` des deux VPS
contenait encore `getsoundy.com` dans :
- `ACCESS_ADMIN_EMAILS`, `SMTP_ADMIN_EMAIL`, `ALERT_EMAIL`, `PROD_ADMIN_EMAIL`,
  `VAPID_SUBJECT` (emails admin/alerting)
- `GOOGLE_CALLBACK_URL`, `YOUTUBE_CALLBACK_URL` (callbacks OAuth)
- `STAGING_DEMO_LOGIN_EMAIL` (staging uniquement)

Remplacé par `sed` global `getsoundy.com` → `onscen.com` sur les deux `.env` (backup
`.env.bak.email-migration` conservé sur chaque VPS), puis `pm2 reload --update-env`.

**⚠️ Point d'attention découvert pendant la vérification** : en testant si
`https://onscen.com/api/auth/google/callback` était bien enregistré comme redirect URI
autorisé dans Google Cloud Console (avant de changer `GOOGLE_CALLBACK_URL`), la requête
OAuth vers Google a retourné **`Error 401: deleted_client`** — le client OAuth Google
configuré dans le `.env` de production **a été supprimé côté console Google**. Le login
Google/YouTube est donc déjà non-fonctionnel en production, indépendamment de ce
changement de domaine. Action corrective hors-repo nécessaire : recréer un client OAuth
dans Google Cloud Console avec les redirect URIs `onscen.com`, puis mettre à jour
`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` sur les deux VPS.

### 3. Bug critique découvert : bundle frontend contaminé (2 sessions consécutives)

Malgré toutes les corrections de code source (routes backend, composants React, listes
d'hôtes autorisés, etc.), les bundles JS **réellement servis en production et staging**
contenaient encore `getsoundy.com` en dur après le premier déploiement de cette session.

**Cause** : `web/app/.env.production` et `web/app/.env.preproduction` (fichiers
gitignorés, régénérés localement par `commun/scripts/sync-app-sentry-env.ps1` à partir
de la copie locale `commun/backend/.env.production`/`.env.preproduction`, elle-même une
copie miroir manuelle du `.env` VPS) n'avaient **jamais été resynchronisés** après la
migration du 10/08 — ils datent d'avant et contenaient toujours
`VITE_WEB_APP_URL=https://getsoundy.com`. Vite inline cette variable dans le bundle au
build time.

Ce bug s'est reproduit deux fois dans cette session : la première fois parce que la copie
locale n'avait jamais été corrigée, la seconde fois parce que le patch des `.env` VPS
(emails + callbacks OAuth) a eu lieu *après* le premier build/déploiement, rendant la
copie locale de nouveau désynchronisée pour un cycle.

**Fix définitif** : après le patch complet des `.env` VPS, resynchronisation de
`commun/backend/.env.production` et `.env.preproduction` depuis les VPS (`ssh ... cat
.env` → fichier local, encodage UTF-8 explicite pour éviter la corruption des accents),
régénération de `web/app/.env.production`/`.env.preproduction` via le script, puis
rebuild + redeploy complets des deux environnements. Bundles finaux vérifiés :
`index-DczpIz_X.js` (prod) et `index-DLmQBu7m.js` (staging), 0 occurrence de
« getsoundy » dans les deux.

### 4. Code source (~180 fichiers)

Remplacement systématique de `getsoundy.com` → `onscen.com` et `admin@getsoundy.com` →
`admin@onscen.com` à travers : constantes légales, User-Agent Nominatim (géoloc),
VAPID (web push), CSP/HSTS, prompts des agents IA internes, catalogue SaaS admin,
`sitemap.xml`/`robots.txt`/`index.html`, listes d'hôtes autorisés pour les liens internes
(`storyAppLink`, `reelAlbumLinkPlatform`, `linkifyText`), locales fr/en, pages admin
coûts fixes, scripts de seed (comptes de démo/test/production), tests unitaires backend
et frontend, fichiers `.env.*.example`, workflows GitHub Actions (CI, deploy preprod,
uptime health), tests E2E Playwright staging, ~30 scripts d'ops PowerShell/bash, règles
Cursor (`.cursor/rules/*.mdc`), `AGENTS.md`.

**Mobile** : `App.entitlements` (associated domains iOS), `nativeDeepLink.ts`
(`PROD_HOSTS`), `patch-android-native.mjs` (deep links `AndroidManifest.xml`),
`fetch-cert-pins.mjs` (pin TLS Android — ne cible plus que `onscen.com`). Fichiers
générés (`AndroidManifest.xml`, `network_security_config.xml`, gitignorés) régénérés
localement via les scripts npm correspondants.

**Auxiliaire VPS non versionné** : `/opt/onscen/deploy/auth-server/` (mini page de login
pour protection Caddy basic-auth, non branchée actuellement en prod) — texte
footer/description corrigé directement sur le VPS (pas de source locale dans le repo).

## Vérifications effectuées (preuves live)

| Vérification | Résultat |
|---|---|
| `https://onscen.com/health` | 200 OK, `env: production` |
| `https://www.onscen.com` | 301 → `onscen.com` |
| `https://getsoundy.com` | **525** (handshake TLS refusé — hard stop, pas de redirect) |
| `https://www.getsoundy.com` | **525** (idem) |
| `https://staging.getsoundy.com` | **525** (idem) |
| `https://staging.onscen.com` (via Host header direct sur l'IP VPS) | 200 OK — Caddy correctement configuré, seul le DNS manque |
| Bundle prod `index-DczpIz_X.js` | 0 occurrence "getsoundy" |
| Bundle staging `index-DLmQBu7m.js` | 0 occurrence "getsoundy" |
| `/opt/onscen/.env` (prod + staging) | 0 occurrence "getsoundy" (hors backup `.bak`) |
| PM2 `onscen-backend` / `onscen-backend-staging` | online, reload sans coupure |
| `verify-prod.sh` | Résultat : OK |

## Gaps connus restants (hors repo / décision humaine)

1. **Client OAuth Google supprimé** (`deleted_client`) — login Google/YouTube cassé
   indépendamment de cette session. Nécessite recréation manuelle dans Google Cloud
   Console + mise à jour `GOOGLE_CLIENT_ID`/`SECRET` sur les deux VPS.
2. **DNS `staging.onscen.com` absent** — déjà documenté depuis le 10/08, non résolu
   (nécessite une action côté registrar/Cloudflare DNS, le token Cloudflare disponible
   dans le repo est invalide/expiré — confirmé via `user/tokens/verify` → 401).
3. **Consoles tierces** (Meta/Facebook, Sign in with Apple) : `commun/docs/ONSCEN-DOMAINE.md`
   §4 documente que `getsoundy.com` doit aussi être retiré de ces consoles externes —
   non vérifié dans cette session (accès externe requis).
4. **Anciens chunks JS** (plusieurs centaines de fichiers non référencés par l'`index.html`
   actuel, dans `public/assets/` des deux VPS) contiennent encore `getsoundy.com` en dur —
   conservés intentionnellement par le processus de déploiement zero-downtime pour ne pas
   casser les clients ayant un cache navigateur actif ; s'auto-purgeront progressivement.

## Fichiers clés modifiés

Voir `modification.txt` (MODIF 1355) pour le détail complet. Fichiers les plus critiques :

- `commun/deploy/Caddyfile`, `Caddyfile.staging` — hard stop
- `commun/deploy/patch-env-onscen-domain.sh`, `sync-caddy.sh`, `sync-caddy-staging.sh`
- `commun/backend/src/routes/webauthn.ts`, `server.ts`, `legalConstants.ts`
- `web/app/src/lib/{storyAppLink,reelAlbumLinkPlatform,linkifyText}.ts`
- `ios/apptel/scripts/{patch-android-native,fetch-cert-pins}.mjs`
- `/opt/onscen/.env` (prod + staging, non versionné)

## Build / Déploiement

- Backend (`tsc build:prod`) : ✅ prod + staging
- Frontend (`vite build`) : ✅ prod + staging (2 passes, la 2e pour corriger le bundle
  contaminé par l'env local désynchronisé)
- Déploiement zero-downtime : ✅ prod (2x) + staging (2x)
