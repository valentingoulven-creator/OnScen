# Audit Senior — Stack & Qualité de Code — OnScen

Périmètre : Sections 1 (Audit Stack) et 12 (Qualité du code) du cahier des charges.
Méthode : lecture statique (Grep/Glob/Read) + exécution en lecture seule de `npm outdated`, `npm audit`, `eslint`, `sync-src.js --check`.

## 1. Résumé exécutif

Le monorepo OnScen est structuré en 4 packages npm indépendants (`web/app`, `ios/apptel`, `commun/backend`, `commun/msdev`) plus un package de tests d'agents (`commun/tests/agents`). Stack moderne (React 19, TypeScript ~6.0, Vite 8, Express 4, Node/PM2), 0 vulnérabilité `npm audit` détectée sur les 3 packages testés, bonne discipline sur `any` explicite, et une architecture mobile/web propre (script `sync-src.js` garantissant l'absence de doublons entre `web/app/src` et `ios/apptel/src`).

Cependant, l'audit révèle un **problème architectural critique** : le backend de production utilise une base de données **en mémoire** (`Map` JS dans `models/schema.ts`) comme source de vérité pour les lectures (y compris l'authentification), alors que la configuration PM2 de production tourne en **mode cluster à 2 instances**. Chaque worker a sa propre copie du store, sans mécanisme de synchronisation entre workers en dehors d'un flush asynchrone débouncé (800ms) vers PostgreSQL. Cela expose à des incohérences de données et des déconnexions aléatoires en production.

À cela s'ajoutent une gestion d'erreur silencieuse très répandue (`catch { }` sans log, >200 occurrences), des fichiers "god component" dépassant 2000-3300 lignes côté frontend, un mode `strict` TypeScript désactivé côté frontend/mobile (activé côté backend), et des erreurs ESLint réelles actuellement présentes sur `main` qui cassent la CI.

## 2. Stack identifiée (preuves : package.json)

| Domaine | Techno | Version | Fichier |
|---|---|---|---|
| Frontend web | React | 19.2.6 | `web/app/package.json:34-35` |
| Frontend web | TypeScript | ~6.0.2 | `web/app/package.json:58` |
| Frontend web | Vite | ^8.1.2 | `web/app/package.json:60` |
| Frontend web | Tailwind CSS | ^4.3.2 | `web/app/package.json:57` |
| Frontend web | Vitest / Playwright | ^3.2.4 / ^1.61.1 | `web/app/package.json:62,44` |
| Mobile Capacitor | Capacitor core/android/ios | ^8.4.1 | `ios/apptel/package.json:28,30,32` |
| Mobile Capacitor | React | 19.2.6 (identique web) | `ios/apptel/package.json:40-41` |
| Backend | Express | ^4.19.2 (résolu 4.22.2) | `commun/backend/package.json:50` |
| Backend | TypeScript | ^5.4.5 (résolu 5.9.3) | `commun/backend/package.json:80` |
| Backend | PostgreSQL driver `pg` | ^8.22.0 | `commun/backend/package.json:57` |
| Backend | Socket.IO + Redis adapter | ^4.8.3 / ^8.3.0 | `commun/backend/package.json:61,42` |
| Backend | Stripe | ^17.7.0 | `commun/backend/package.json:62` |
| Backend | LiveKit server SDK | ^2.16.0 | `commun/backend/package.json:54` |
| Process manager prod | PM2 cluster, 2 instances | — | `commun/deploy/ecosystem.config.cjs:32-33` |

## 3. Dépendances — npm outdated / npm audit (preuves brutes)

### web/app
```
npm audit --omit=dev → found 0 vulnerabilities
npm outdated (extrait) :
@stripe/react-stripe-js 3.10.0 → latest 6.7.0 (retard majeur x3)
@stripe/stripe-js 5.10.0 → latest 9.9.0 (retard majeur)
vitest 3.2.6 → latest 4.1.10 (retard majeur)
vite 8.1.2 → 8.1.3 (patch)
@sentry/react 10.62.0 → 10.64.0 (patch)
```

### commun/backend
```
npm audit --omit=dev → found 0 vulnerabilities
npm outdated (extrait) :
express 4.22.2 → latest 5.2.1 (majeure non migrée)
redis 4.7.1 → latest 6.1.0 (2 majeures de retard)
stripe 17.7.0 → latest 22.3.0 (5 majeures de retard)
bcryptjs 2.4.3 → latest 3.0.3
dotenv 16.6.1 → latest 17.4.2
typescript 5.9.3 → latest 6.0.3
```

### ios/apptel
```
npm audit --omit=dev → found 0 vulnerabilities
npm outdated : mêmes retards que web/app (Stripe, vite, vitest, sharp, @types/node)
```

**Constat** : aucune vulnérabilité connue exploitable détectée par `npm audit` (positif), mais des retards majeurs non négligeables sur des dépendances sensibles (Stripe côté paiement, Express, Redis). Ces majeures ne sont pas nécessairement urgentes (pas de CVE), mais elles accumulent de la dette de migration.

## 4. Dépendances potentiellement inutilisées

Vérification ciblée par grep d'import pour chaque dépendance runtime déclarée dans `web/app/package.json` (`@fontsource/plus-jakarta-sans`, `react-virtuoso`, `zxcvbn`, `heic2any`, `react-globe.gl`, `@simplewebauthn/browser`, `leaflet.markercluster`, `hls.js`, `@livekit/components-react`) : toutes sont importées quelque part dans `web/app/src`. Aucune dépendance clairement inutilisée trouvée sur l'échantillon vérifié.

**Impossible à vérifier avec les informations disponibles** : audit exhaustif de toutes les devDependencies et de `commun/backend`/`ios/apptel` (nécessiterait un outil dédié type `depcheck`/`knip`, non exécuté ici).

## 5. Architecture — constats structurels

- Backend : dossiers `routes/` (44 fichiers), `lib/` (271 fichiers), `middleware/` (5 fichiers), `models/` (1 seul fichier : `schema.ts`, 836 lignes).
- `models/schema.ts` ne contient pas un modèle de persistance (pas d'ORM/repository) : c'est un fichier de types TypeScript et la définition du store applicatif en mémoire (`export const db = { users: new Map(), salons: new Map(), ... }`, ligne 821-836). Il n'existe pas de couche `services/` séparée : `lib/` mélange logique métier, accès données en mémoire et appels API externes (YouTube, Stripe, LiveKit).
- Point positif : les fichiers de `routes/` ne font pas de SQL direct — ils délèguent à `lib/*` (ex. `commun/backend/src/routes/donations.ts:1-29` importe uniquement depuis `../lib/donations`, `../models/schema`, `../middleware/auth`).
- Mobile/Web : séparation propre et outillée. `ios/apptel/src` ne contient que 27 fichiers (overrides mobiles), `web/app/src` en contient 580. Le script `commun/scripts/sync-src.js --check` confirme : « ✓ Aucun doublon — architecture propre » (exécuté durant l'audit).

## 6. Tableau des problèmes trouvés

| # | Gravité | Fichier(s) | Ligne(s) | Description | Preuve | Solution | Difficulté |
|---|---|---|---|---|---|---|---|
| 1 | **Critical** | `commun/deploy/ecosystem.config.cjs`, `commun/backend/src/models/schema.ts`, `commun/backend/src/middleware/auth.ts`, `commun/backend/src/lib/persist.ts` | eco:32-33 ; schema:821-836 ; auth:126-130 ; persist:93-116 | Le backend prod tourne en PM2 cluster, 2 instances (`instances: 2, exec_mode: 'cluster'`) alors que la source de vérité applicative est un objet en mémoire par-processus (`Map`). Chaque requête authentifiée fait `db.users.get(decoded.id)` (auth.ts:126) sur le store local du worker qui traite la requête. La sauvegarde vers Postgres est asynchrone et débouncée à 800ms (persist.ts:93-100), sans mécanisme de rechargement/synchronisation inter-workers en cours de vie du process. Résultat probable : un utilisateur créé/modifié sur le worker A peut être invisible (401 « Token invalide ») ou obsolète sur le worker B tant que ce dernier n'a pas redémarré et relu Postgres. Le socket.io redis-adapter mitige la diffusion WebSocket, mais pas les lectures REST synchrones sur `db`. | `instances: 2,\nexec_mode: 'cluster',` (eco:32-33) ; `export const db = {\n users: new Map<string, User>(),` (schema:821-822) ; `const user = db.users.get(decoded.id);\nif (!user) { res.status(401)... }` (auth:126-129) | Choix à trancher explicitement : (a) revenir à `instances: 1` tant que le store mémoire est la source de vérité, ou (b) migrer les lectures critiques (users, sessions) vers Postgres/Redis partagé comme source de vérité unique, le cache mémoire devenant un simple cache local invalidé. Documenter le choix dans `STACK-CIBLE.md`. | **XL** |
| 2 | High | `web/app/tsconfig.app.json`, `ios/apptel/tsconfig.app.json` vs `commun/backend/tsconfig.json:6` | — | Le mode TypeScript `strict` n'est pas activé dans les configs frontend/mobile, alors qu'il l'est côté backend (`"strict": true`). Incohérence de rigueur de typage entre les deux plus gros pans du code (591 fichiers front vs 374 backend). | Aucune occurrence de `strict` dans tout `tsconfig.app.json` (web/app) | Activer `"strict": true` dans `web/app/tsconfig.app.json` et `ios/apptel/tsconfig.app.json`, corriger les erreurs en plusieurs PR incrémentales. | L |
| 3 | High | `commun/backend/src/routes/auth.ts` | 695, 785, 789, 798, 801, 840, 846, 850, 867 | Corruption d'encodage (mojibake) : les caractères accentués français sont remplacés par `?` dans des messages affichés à l'utilisateur final (produit francophone). | `res.status(400).json({ error: 'Token expir?. Refais une demande de r?initialisation.' });` (ligne 850) ; `res.json({ ok: true, message: 'Mot de passe r?initialis? avec succ?s !' });` (ligne 867) | Corriger l'encodage des chaînes concernées (re-saisir en UTF-8), vérifier l'encodage de sauvegarde du fichier, ajouter un check CI. Un grep plus large montre des occurrences suspectes possibles dans ~35 autres fichiers backend et ~29 frontend à vérifier manuellement. | S |
| 4 | Medium | `web/app/src/components/MapView.tsx` (14 occ.), `ReelsTabPage.tsx` (19), `DmPage.tsx` (6), `commun/backend/src/routes/auth.ts` (6) | ex. MapView.tsx:406-1046 ; DmPage.tsx:94-96,418-420,871-873,1232-1234 ; auth.ts:181-183,285-287,701-703,713-715,747-749,856-858 | Gestion d'erreur silencieuse généralisée : blocs `catch { /* ignore */ }` sans capture ni log, y compris côté backend où un échec `bcrypt.hash`/`bcrypt.compare` renvoie un 500 générique sans aucune trace serveur. | `} catch {\n /* ignore */\n }` (DmPage.tsx:94-96) ; `} catch {\n res.status(500).json({ error: 'Erreur interne...' });\n return;\n }` (auth.ts:181-183, sans log) | Introduire un helper de log centralisé (`logAndIgnore(err, context)`) ; pour les erreurs critiques (auth, paiement), logger via Sentry avant de renvoyer une réponse générique. | M |
| 5 | Medium | `DmPage.tsx`, `HomePage.tsx`, `ActualiteTabPage.tsx`, `ReelsTabPage.tsx`, `PhotoImageEditor.tsx`, `LivePage.tsx`, `App.tsx` ; backend `routes/salons.ts`, `socket.ts` | fichiers entiers | Fichiers "god component" très au-delà du seuil de 150 lignes : `DmPage.tsx` = 3342 lignes, `HomePage.tsx` = 2743, `ActualiteTabPage.tsx` = 2193, `ReelsTabPage.tsx` = 2157, `PhotoImageEditor.tsx` = 2026, `LivePage.tsx` = 1849, `App.tsx` = 1503 ; backend `routes/salons.ts` = 1070, `socket.ts` = 998 lignes. | Comptage de lignes (Measure-Object) | Découper en sous-composants/hooks métier dédiés ; prioriser `DmPage.tsx` et `App.tsx`. | L/XL |
| 6 | Medium | `web/app/src/App.tsx` (concentre l'essentiel) | multiples (214-681+) | `npx eslint .` sur `web/app` retourne 447 problèmes (2 erreurs, 445 warnings), dont 216 `react-hooks/set-state-in-effect` et 104 `react-hooks/exhaustive-deps`, majoritairement dans `App.tsx`. Migration React Compiler en cours (dette connue non résorbée). | Sortie brute `npx eslint .` ; `eslint.config.js:22-31` | Poursuivre le plan de migration déjà amorcé, suivre le compteur de warnings comme KPI de dette technique. | L |
| 7 | Medium | `web/app/src/components/MapView.tsx` | 1193-1194, 1219-1220, 1259, 1306 | Code mort réel et erreur ESLint bloquante actuellement présente : `let salonsToDraw = visibleSalons;` et `let livesToDraw = ...` sont toujours réécrasés sans condition juste après avant d'être lus — l'affectation initiale est totalement inutile. ESLint (`no-useless-assignment`) le signale en erreur, ce qui fait échouer `npm run lint`. | `1193:9 error The value assigned to 'salonsToDraw' is not used in subsequent statements no-useless-assignment` | Supprimer les affectations mortes lignes 1193-1194. Vérifier l'état réel de la CI sur `main`. | S |
| 8 | Low | `commun/backend/package.json` | 15 | `"lint": "eslint src --max-warnings=9999"` désactive de facto toute limite de warnings. | `"lint": "eslint src --max-warnings=9999",` | Abaisser progressivement le seuil, fixer `--max-warnings=0`. | S |
| 9 | Low | `commun/backend/src/lib/feedPosts.ts`, `stories.ts` | feedPosts.ts:15, stories.ts:21 | 2 erreurs ESLint réelles actuellement présentes côté backend : variable jamais utilisée, interface vide équivalente à son supertype. | `15:10 error 'normalizeTaggedUserIds' is defined but never used` | Supprimer la variable inutilisée / fusionner ou supprimer l'interface vide. | S |
| 10 | Low | `web/app/package.json`, `commun/backend/package.json`, `ios/apptel/package.json` | — | Dépendances avec retards majeurs : Stripe (x3 versions majeures front, x5 backend), Express 4→5, Redis 4→6, Vitest 3→4. Pas de CVE connue, mais dette de migration croissante. | Sorties `npm outdated` | Planifier une campagne de mise à jour progressive, en commençant par Stripe vu la criticité paiement. | M |
| 11 | Low | Absence de couche `services/` ; `commun/backend/src/models/schema.ts` (836 lignes) mélange types + store | schema.ts:1-836 | Pas de séparation formelle routes → services → repositories. `lib/` (271 fichiers) fait à la fois logique métier, accès « base » et intégrations tierces. | Comptage dossiers : `routes/`=44, `lib/`=271, `middleware/`=5, `models/`=1 fichier | Non bloquant à court terme ; introduire une couche `services/` explicite si l'équipe grossit. | XL |

**Comptage par gravité** : Critical = 1, High = 2, Medium = 4, Low = 4 (total = 11 problèmes documentés avec preuve).

## 7. Points positifs constatés (avec preuve)

- 0 vulnérabilité `npm audit --omit=dev` sur `web/app`, `commun/backend`, `ios/apptel`.
- Aucun marqueur TODO/FIXME/HACK réel trouvé (faux positifs uniquement).
- Usage explicite de `any` quasi inexistant côté frontend et backend.
- Aucun `console.log` résiduel dans `web/app/src` ; côté backend, cantonnés aux scripts de seed/diagnostic.
- Séparation web/mobile outillée et vérifiée saine (`sync-src.js --check` → « Aucun doublon »).
- Routes backend ne font pas de SQL direct ; délèguent systématiquement à `lib/*`.
- TypeScript `strict: true` déjà actif côté backend.

## 8. Score du domaine : 60 / 100

Justification :
- -25 points : incohérence architecturale critique in-memory store / PM2 cluster (risque de production réel).
- -8 points : strict mode TS absent côté frontend/mobile.
- -6 points : gestion d'erreur silencieuse généralisée sans logging.
- -6 points : fichiers god-component massifs (jusqu'à 3342 lignes) + 447 problèmes ESLint concentrés sur `App.tsx`.
- -4 points : erreurs ESLint réelles actuellement présentes potentiellement bloquantes en CI.
- -3 points : bug d'encodage utilisateur visible (mojibake) en production.
- -3 points : dette de dépendances (Stripe, Express, Redis en retard de plusieurs majeures).
- Points conservés pour : 0 vulnérabilité connue, absence de dette « TODO », faible usage d'`any`, architecture mobile/web propre et outillée, découplage routes/lib correct, strict mode déjà actif côté backend.

## 9. Impossible à vérifier avec les informations disponibles

- Étendue exhaustive du bug d'encodage (mojibake) au-delà de `auth.ts`.
- Audit exhaustif des dépendances inutilisées sur la totalité des devDependencies et sur `commun/backend`/`ios/apptel`.
- Couverture de tests réelle (%) — non mesurée.
- Comportement réel en production du cluster PM2 à 2 instances (fréquence effective des 401 aléatoires) — analyse statique uniquement.
- Duplication de logique métier (au-delà des noms de fichiers) entre `web/app/src` et `ios/apptel/src`.
- État réel du pipeline CI GitHub Actions (déduit de l'exécution locale d'eslint, pas d'un run CI observé).
