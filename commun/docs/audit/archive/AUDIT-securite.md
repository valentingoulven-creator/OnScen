# AUDIT SÉCURITÉ SENIOR — OnScen (sections 3 & 6)

Périmètre : Environnements/Secrets + OWASP Top 10 · Méthode : lecture de code + `git log -p`/`git check-ignore` ciblés (342 commits scannés)

## Résumé exécutif

Le backend (`commun/backend/src`) est globalement bien construit du point de vue applicatif : Helmet + CSP par nonce, cookie JWT httpOnly/Secure/SameSite=Strict, whitelist d'algorithme JWT (HS256 explicite), CORS fail-closed en prod, admin routes systématiquement protégées par un pattern `authenticateJWT` + `requireAdmin` homogène, upload avec vérification magic-bytes, webhooks Stripe avec vérification de signature, OAuth avec `state` anti-CSRF, aucun `dangerouslySetInnerHTML`/`eval` côté frontend.

**Le point noir majeur n'est pas applicatif mais Git/process** : une règle `.gitignore` mal ancrée (patterns avec `/` sans préfixe `**/`) a laissé fuiter dans l'historique et l'arbre de travail actuel un **fichier de credentials réels** (email + mot de passe en clair d'un compte de production), une **clé privée RSA**, et des **données financières/personnelles confidentielles** du fondateur — alors que ces fichiers étaient explicitement destinés à ne jamais être committés.

## Tableau des problèmes

| # | Gravité | Fichier(s) | Ligne(s) | Description | Solution | Difficulté |
|---|---------|-----------|----------|--------------|----------|------------|
| 1 | **Critical** | `commun/docs/youtube-audit-demo-credentials.local.txt` | 4-6, 16-17 | Credentials réels en clair, actuellement trackés par Git (`git ls-files` le confirme) : email `yt.audit.demo2.soundy@gmail.com` / mot de passe `[REDACTED — mot de passe exposé, à faire tourner en priorité]` d'un compte de production réel sur getsoundy.com. Le nom du fichier dit "NE PAS COMMITTER" mais la règle `.gitignore` ligne 5 (`docs/youtube-audit-demo-credentials.local.txt`) est ancrée à la racine du repo (pas de `**/`) donc ne matche pas le chemin réel `commun/docs/...`. Vérifié avec `git check-ignore -v` → aucun match (exit 1). | `git rm --cached` le fichier ; révoquer/changer le mot de passe du compte et du Gmail associé immédiatement ; corriger la règle en `**/docs/youtube-audit-demo-credentials.local.txt` ; réécrire l'historique (BFG/filter-repo) si le repo a pu être cloné par un tiers. | S (fix) / M (purge historique) |
| 2 | **High** | `.gitignore` | 5, 16, 22, 23, 35 | Cause racine : plusieurs règles gitignore contiennent un `/` sans préfixe `**/`, donc ancrées à la racine du repo. Après la restructuration en monorepo (`commun/...`), ces règles ne protègent plus les fichiers réels situés sous `commun/msdev/`, `commun/docs/`. Confirmé par `git check-ignore -v` (aucun match) pour `commun/msdev/legal-publisher.json`, `commun/msdev/ceo-founder-context.json`, `commun/msdev/certs/dev-key.pem`, `commun/docs/youtube-audit-demo-credentials.local.txt`. | Préfixer toutes les règles à chemin composé par `**/` (ex. `**/docs/youtube-audit-demo-credentials.local.txt`, `**/msdev/certs/`, `**/msdev/legal-publisher.json`, `**/msdev/ceo-founder-context.json`) ; auditer `git ls-files` après coup pour vérifier qu'aucun autre fichier sensible n'est encore tracké. | S |
| 3 | **Medium** | `commun/msdev/certs/dev-key.pem` | 1-28 (fichier entier) | Clé privée RSA complète (`-----BEGIN PRIVATE KEY-----`) committée et actuellement trackée par Git. C'est le certificat TLS auto-signé de dev, utilisé pour tester HTTPS en LAN (accès caméra mobile). Impact limité (dev only) mais mauvaise pratique, et permettrait un MITM sur le LAN de dev si le même certificat est réutilisé. | `git rm --cached commun/msdev/certs/dev-key.pem commun/msdev/certs/dev-cert.pem`, régénérer via le script existant, corriger le `.gitignore` (finding #2). | S |
| 4 | **Medium** | `commun/msdev/legal-publisher.json` (19 lignes), `commun/msdev/ceo-founder-context.json` (43 lignes) | fichiers entiers | Données personnelles et financières confidentielles trackées par Git : nom complet, email Gmail personnel, SIREN, et pour le second fichier — trésorerie (10 000 €), burn rate mensuel (85 €), runway personnel (117 mois), stratégie GTM interne. Même cause racine que #2. | Idem #2 : untrack + corriger gitignore. Envisager rotation de l'email de contact si jugé sensible. | S |
| 5 | **Low** | `commun/backend/src/lib/jwtSecret.ts` | 3, 23-33 | `getJwtSecret()` retombe silencieusement sur un secret hardcodé (`melosong_secret_dev_fallback`) si `JWT_SECRET` est absent et que l'environnement n'est pas détecté comme "deployed" (`isDeployedEnv()` = prod/preprod uniquement). Un `console.warn` est émis mais rien ne bloque le démarrage en dev/msdev. | Ajouter une variable explicite `REQUIRE_JWT_SECRET=1` vérifiée aussi en CI/staging non couverts par `isDeployedEnv()`, ou échouer strictement dès que `NODE_ENV !== 'test'`. | S |
| 6 | **Low** | `commun/backend/.env.production.example` | 208 | `SENTRY_DSN=https://YOUR_KEY@o4511654862258176.ingest.de.sentry.io/4511654915866704` — la partie clé est un placeholder mais l'org ID et le project ID réels sont exposés dans un fichier d'exemple versionné. Risque limité mais donne de la reconnaissance. | Remplacer par un DSN 100% fictif dans le fichier `.example`. | S |
| 7 | **Low** | `commun/backend/src/server.ts` | 318 | CSP `'style-src': ["'self'", "'unsafe-inline'", ...]` — la directive autorise les styles inline, affaiblit légèrement la défense en profondeur CSP. `script-src` est correctement verrouillé par nonce. | Remplacer `'unsafe-inline'` par un nonce dédié aux styles, ou migrer vers des classes Tailwind pures. | M |
| 8 | **Info / vérifié OK** | `commun/backend/src/lib/reelAssets.ts` | 108-125 | `resolveReelVideoUrl`/`resolveReelPosterUrl` acceptent toute URL `https://` externe sans la télécharger côté serveur (pas de SSRF). La modération Sightengine des URLs distantes est activée par défaut, donc pas de bypass de modération par défaut. | — | — |

## Points vérifiés SANS anomalie détectée (avec preuve)

- **`.env` réels non trackés** : `git ls-files | grep .env` ne retourne que des fichiers `*.example` — aucun `.env` réel n'est dans Git.
- **Secrets classiques absents de l'historique** : recherches `git log --all -G` ciblées sur `sk_live_`, `AKIA[0-9A-Z]{16}`, `sk-ant-api`, `sk-proj-`, `AIzaSy...`, `ya29.` → aucune occurrence réelle.
- **CORS** (`commun/backend/src/lib/corsConfig.ts:5-29`) : refuse de démarrer en prod si `CORS_ORIGIN` absent (`throw`), pas de wildcard `*` en environnement déployé.
- **Helmet/CSP/HSTS** (`commun/backend/src/server.ts:294-342`) : nonce CSP par requête, `script-src` sans `unsafe-inline`, HSTS activé uniquement en prod stricte.
- **Clickjacking / headers** : Helmet active par défaut `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`.
- **Cookies/JWT** (`commun/backend/src/middleware/auth.ts:36-71, 114-159`) : `httpOnly: true`, `secure: isDeployedEnv()`, `sameSite: 'strict'`, algorithme JWT verrouillé (`{ algorithms: ['HS256'] }`), `tokenVersion` pour invalidation de session.
- **CSRF** : cookie `SameSite=Strict` ; OAuth avec `state` aléatoire 32 bytes, consommé une seule fois.
- **OAuth Google/Facebook/Apple** : `redirect_uri` toujours construit depuis `process.env.*_CALLBACK_URL` ; `state` vérifié avant tout échange de code.
- **Escalade de privilèges / IDOR admin** : 8 routers admin vérifiés, tous protégés par `authenticateJWT` + `requireAdmin()`. `setUserIsAdmin` empêche de retirer le dernier admin.
- **IDOR sur ressources utilisateur** : DM, support, compositions/albums vérifient systématiquement l'appartenance avant lecture/écriture/suppression.
- **Upload / validation MIME réel** : vérification des magic bytes (pas seulement l'extension/MIME déclaré).
- **Path traversal uploads** : noms de fichiers générés côté serveur avec `crypto.randomBytes` + regex stricte.
- **Fichiers uploadés non exécutables** : `Content-Disposition: attachment` + `X-Content-Type-Options: nosniff` sur `/uploads/`.
- **SQL injection** : aucune requête paramétrée trouvée construite par concatenation de valeurs utilisateur.
- **SSRF** : `geo.ts`/`tiles.ts` n'effectuent des `fetch()` que vers des hôtes constants.
- **XSS** : zéro occurrence de `dangerouslySetInnerHTML` ou `eval()`/`new Function()` dans `web/app/src` et `ios/apptel/src`.
- **Webhooks Stripe** : signature vérifiée via `stripe.webhooks.constructEvent` avant tout traitement.
- **Rate limiting** : limiteurs dédiés sur login/register/forgot-password/geo/oauth/exports RGPD/dons/abonnements.

## Impossible à vérifier avec les informations disponibles

- Visibilité réelle du repo GitHub (public ou privé) — nécessite un accès API GitHub authentifié.
- Contenu réel de la base PostgreSQL de production / secrets effectivement déployés sur le VPS.
- Rotation effective ou non du mot de passe `[REDACTED — mot de passe exposé, à faire tourner en priorité]` depuis sa création.
- Historique complet avant le commit `1367d0e1` ("Initial commit").
- Revue IDOR ligne-à-ligne exhaustive de `salons.ts`, `lives.ts`, `chat.ts`, `groups.ts`, `network.ts`, `push.ts`, `webauthn.ts`, `twoFactor.ts`, `stories.ts`, `feed.ts`, `reels.ts` (pattern homogène confirmé par grep, pas de revue ligne-à-ligne exhaustive).
- Audit exhaustif de la logique de stockage de tokens côté client au-delà de la confirmation du cookie httpOnly.

## Score du domaine : 78/100

Justification :
- Base solide (+) : Helmet/CSP par nonce, JWT avec whitelist d'algorithme et invalidation par version, cookies httpOnly/Secure/SameSite=Strict, CORS fail-closed, admin pattern homogène, uploads avec magic-bytes, webhooks signés, OAuth avec state anti-CSRF, zéro XSS, aucune injection SQL trouvée.
- Déduction majeure (-15) : fuite de credentials réels de production actuellement présente dans le repo (finding Critical #1).
- Déduction (-5) : cause racine gitignore non corrigée qui continuera à exposer de nouveaux fichiers similaires.
- Déduction (-2) : clé privée + données confidentielles additionnelles également exposées par la même cause racine.

## Fichiers à traiter en priorité (dans l'ordre)

1. `commun/docs/youtube-audit-demo-credentials.local.txt` — untrack + rotation immédiate du mot de passe/compte.
2. `.gitignore` — corriger l'ancrage des règles composées (`**/` manquant).
3. `commun/msdev/certs/dev-key.pem` + `dev-cert.pem` — untrack + régénération.
4. `commun/msdev/legal-publisher.json` + `commun/msdev/ceo-founder-context.json` — untrack.

## Synthèse rapide

- **Problèmes par gravité** : 1 Critical · 1 High · 2 Medium · 3 Low
- **Score du domaine : 78/100**
