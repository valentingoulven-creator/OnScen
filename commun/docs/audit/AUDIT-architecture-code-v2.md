# RE-AUDIT Senior — Stack & Qualité de Code — OnScen (v2, post-corrections)

Périmètre : identique au rapport original (`AUDIT-architecture-code.md`) — Sections 1 (Audit Stack) et 12 (Qualité du code) du cahier des charges.
Méthode : re-lecture statique (Grep/Glob/Read) + ré-exécution en lecture seule de `npm outdated`, `npm audit`, `eslint`, `npm run build`, `npm test`, `sync-src.js --check`. **Aucun fichier de code source n'a été modifié pour produire ce rapport.**

Référence des corrections auditées : `modification.txt`, entrée **MODIF 961 — Fixes audit architecture/qualité de code** (2026-07-08), fichiers modifiés déclarés : `commun/deploy/ecosystem.config.cjs`, `web/app/src/components/MapView.tsx`, `commun/backend/src/lib/feedPosts.ts`, `commun/backend/src/lib/stories.ts`, `commun/backend/src/routes/auth.ts`, `commun/backend/package.json`.

## 1. Résumé exécutif

Sur les **11 problèmes** du rapport original (score initial 60/100) :

- **5 résolus** (#3 mojibake, #6 régression partielle sur les erreurs, #7 dead code MapView, #8 seuil lint backend, #9 erreurs ESLint backend).
- **1 mitigé mais non résolu structurellement** (#1 Critical : `instances: 2 → 1`, élimine le symptôme immédiat mais pas la cause racine — le store reste en mémoire, non partagé).
- **5 toujours ouverts, non traités, tels quels** (#2 strict mode, #4 catch silencieux, #5 god components, #10 dette de dépendances, #11 absence de couche services) — **explicitement documentés comme hors scope volontaire** dans MODIF 961 elle-même.

**Aucune régression de code n'a été introduite par les corrections de MODIF 961** : les diffs de `ecosystem.config.cjs`, `feedPosts.ts`, `stories.ts`, `commun/backend/package.json` et la portion mojibake de `auth.ts` sont propres, minimaux et conformes à la description. Le `build` (web/app `tsc -b && vite build`, backend `tsc`) passe à 0 erreur, l'ESLint backend passe à 0 erreur/0 warning, l'ESLint web/app passe de 447 problèmes (2 erreurs, 445 warnings) à **445 problèmes (0 erreur, 445 warnings)** — exactement la réduction attendue (suppression des 2 erreurs `no-useless-assignment`), sans changement du nombre de warnings préexistants (216 `set-state-in-effect` + 104 `exhaustive-deps`, identiques à l'audit initial).

**Un problème est trouvé lors de ce re-audit, mais il est sans lien avec MODIF 961** : la suite de tests backend (`npm test`, 357 tests) a **1 test en échec** (`sponsors.test.ts`) à cause d'une donnée de test avec date d'expiration dépassée (`endsAt: 1783224000000` = 2026-07-05, alors que la date système actuelle est 2026-07-08). Ce fichier (`commun/backend/src/lib/sponsors.ts`/`sponsors.test.ts`) n'est **pas** dans la liste des fichiers modifiés par MODIF 961 — ce n'est donc pas une régression de la correction auditée, mais une dette de test « bombe à retardement » préexistante, révélée par le temps qui passe. Le rapport original ne mesurait pas les tests (§9 « couverture de tests réelle — non mesurée »), donc ce point n'était pas visible au premier audit.

**Nouveau score du domaine : 66/100** (+6 points vs 60/100 initial). Justification détaillée en §5.

## 2. Tableau avant/après — les 11 problèmes originaux

| # | Gravité initiale | Problème (résumé) | Statut v2 | Preuve v2 | Gravité actuelle | Solution restante |
|---|---|---|---|---|---|---|
| 1 | **Critical** | Store en mémoire (`Map`) source de vérité + PM2 cluster 2 instances → incohérences de lecture entre workers | **Mitigé (pas résolu)** | `commun/deploy/ecosystem.config.cjs:38` : `instances: 1,` (était `instances: 2,` ligne 32 dans l'audit original) + commentaire explicatif lignes 31-37. `exec_mode: 'cluster'` conservé mais avec 1 seul worker, le risque d'incohérence inter-workers est éliminé de facto. `commun/backend/src/models/schema.ts:836-837` (`export const db = {\n users: new Map<string, User>(),`) et `commun/backend/src/middleware/auth.ts:126` (`const user = db.users.get(decoded.id);`) **inchangés** : l'architecture reste un store mémoire par-processus. | **High** (dégradé de Critical à High : le risque de production immédiat est neutralisé tant que `instances: 1` est respecté, mais la capacité de traitement du backend est divisée par 2, et le problème architectural de fond — source de vérité non partagée — demeure entier ; un futur repassage à `instances > 1` sans refonte réintroduirait le bug initial) | Refonte vers source de vérité partagée (Postgres/Redis) pour les lectures critiques (users, sessions), le store mémoire devenant un cache invalidé — chantier XL non entamé, documenté dans le commentaire du fichier et dans `AUDIT-architecture-code.md` §6 (#1). |
| 2 | High | `strict` TS absent en frontend/mobile vs actif en backend | **Toujours ouvert (non traité)** | Aucune occurrence de `"strict"` dans `web/app/tsconfig.app.json` ni `ios/apptel/tsconfig.app.json` (grep vide, confirmé). `commun/backend/tsconfig.json:6` conserve `"strict": true`. | High (inchangé) | Identique à l'audit original : activer `strict: true` progressivement, PRs incrémentales. Explicitement classé « hors scope volontaire » par MODIF 961 (« nécessite une revue humaine des erreurs de typage sur 591 fichiers frontend »). |
| 3 | High | Mojibake (caractères accentués → `?`) dans `auth.ts`, messages utilisateur | **Résolu** | Toutes les lignes citées par l'audit original sont corrigées : ex. ligne 862 `'Token expiré. Refais une demande de réinitialisation.'` (était `'Token expir?. Refais une demande de r?initialisation.'`), ligne 879 `'Mot de passe réinitialisé avec succès !'`, ligne 810 `'Adresse e-mail vérifiée avec succès !'`, ligne 869 `'Erreur interne lors de la mise à jour du mot de passe'`. Grep large sur tout `commun/backend/src` et tout `web/app/src` avec le pattern `[lettre]\?[lettre]` (hors query strings) : toutes les occurrences restantes vérifiées manuellement (`avatarUrl.ts:3`, `mapAds.ts:67`, `fr.json:284`, `donations.ts:199-200`, `salons.ts:715`, `publicLegalHtml.ts:106-108`, `ActualiteTabPage.tsx:1551`, etc.) sont des query strings légitimes (`?seed=`, `?w=80`, `?list=PL…`, `?lang=`, `?stripeConnect=`), pas du mojibake. | **Résolu** | Aucune. |
| 4 | Medium | Gestion d'erreur silencieuse généralisée (`catch {}` sans log) | **Toujours ouvert (non traité)** | `commun/backend/src/routes/auth.ts:703-706` : `} catch {\n res.status(500).json({ error: 'Erreur interne' });\n return;\n }` — toujours sans `console.error`/Sentry, identique au constat original (ex. `bcrypt.compare` sur `/change-password`). `web/app/src/components/MapView.tsx` (2 occurrences), `DmPage.tsx` (1 occurrence bloc vide), `GlobeView.tsx` (2), `StoryCameraView.tsx` (2), `StoriesInlineBar.tsx` (1), `ActualiteTabPage.tsx` (1) — blocs `catch {}`/`catch { /* ... */ }` toujours présents. | Medium (inchangé) | Identique à l'audit original : helper de log centralisé, prioriser auth/paiement. Explicitement classé « hors scope volontaire » par MODIF 961. |
| 5 | Medium | God-components > 2000-3300 lignes | **Toujours ouvert (non traité)** | Recomptage : `DmPage.tsx` = 3352 lignes (était 3342, +10 lignes de dérive naturelle hors scope), `HomePage.tsx` = 2743 (inchangé), `ActualiteTabPage.tsx` = 2193 (inchangé), `ReelsTabPage.tsx` = 2157 (inchangé), `PhotoImageEditor.tsx` = 2026 (inchangé), `LivePage.tsx` = 1849 (inchangé), `App.tsx` = 1503 (inchangé) ; backend `routes/salons.ts` = 1070 (inchangé), `socket.ts` = 998 (inchangé). | Medium (inchangé) | Identique à l'audit original. Explicitement classé « hors scope volontaire » par MODIF 961 (« refactor trop risqué en automatique »). |
| 6 | Medium | `npx eslint .` (web/app) : 447 problèmes (2 erreurs, 445 warnings) | **Partiellement résolu** (erreurs corrigées, warnings inchangés) | Ré-exécution `npx eslint .` (web/app) : **445 problèmes (0 erreur, 445 warnings)**. Les 2 erreurs ont disparu (voir #7). Répartition des warnings identique à l'audit initial : 216 `react-hooks/set-state-in-effect` + 104 `react-hooks/exhaustive-deps` (comptage exact reproduit). | Low-Medium (dégradé depuis Medium : plus d'erreur bloquante, mais 445 warnings de dette React Compiler toujours présents) | Warnings hors scope de MODIF 961 (dette connue, migration React Compiler en cours selon l'audit original). |
| 7 | Medium | Code mort + erreur ESLint bloquante `no-useless-assignment` dans `MapView.tsx:1193-1194,1219-1220,1259,1306` | **Résolu** | `web/app/src/components/MapView.tsx:1193-1194` : `let salonsToDraw: typeof visibleSalons;` / `let livesToDraw: typeof visibleLives;` (déclaration sans valeur initiale, remplace l'ancien `let salonsToDraw = visibleSalons;` / `let livesToDraw = visibleLives.filter(...)`). Assignation inconditionnelle lignes 1219-1220 dans le même bloc avant lecture lignes 1259/1306 — build TypeScript strict sur le flux de contrôle : `npm run build` (web/app) → ✅ 0 erreur (vérifié ci-dessous), donc pas de « used before assigned ». `npx eslint .` ne rapporte plus l'erreur `no-useless-assignment` (0 erreur au total, voir #6). | **Résolu** | Aucune. |
| 8 | Low | `commun/backend/package.json:15` : `--max-warnings=9999` | **Résolu** | `commun/backend/package.json:16` : `"lint": "eslint src --max-warnings=0",` (diff confirmé : `-    "lint": "eslint src --max-warnings=9999",` / `+    "lint": "eslint src --max-warnings=0",`). `npm run lint` (backend) ré-exécuté : exit code 0, 0 erreur, 0 warning affiché. | **Résolu** | Aucune. |
| 9 | Low | 2 erreurs ESLint réelles backend (`feedPosts.ts` variable inutilisée, `stories.ts` interface vide) | **Résolu** | `commun/backend/src/lib/feedPosts.ts:15` : import réduit à `import { normalizeEventTaggedUserIds, resolveTaggedUsers, type PublicTaggedUser } from './taggedUsers';` (suppression de l'import inutilisé `normalizeTaggedUserIds`, confirmé par diff). `commun/backend/src/lib/stories.ts:21` : `export type PublicStoryTaggedUser = PublicTaggedUser;` (remplace l'interface vide `export interface PublicStoryTaggedUser extends PublicTaggedUser {}`, confirmé par diff). `npm run lint` (backend, `--max-warnings=0`) → exit 0. | **Résolu** | Aucune. |
| 10 | Low | Dette de dépendances (Stripe x3/x5, Express 4→5, Redis 4→6, Vitest 3→4) | **Toujours ouvert (non traité), sans aggravation** | Ré-exécution `npm outdated` : web/app — `@stripe/react-stripe-js 3.10.0 → 6.7.0`, `@stripe/stripe-js 5.10.0 → 9.9.0`, `vitest 3.2.6 → 4.1.10`, `vite 8.1.2 → 8.1.3` (identiques à l'audit initial, à la patch `vite`/`vitest` près). Backend — `express 4.22.2 → 5.2.1`, `redis 4.7.1 → 6.1.0`, `stripe 17.7.0 → 22.3.0`, `typescript 5.9.3 → 6.0.3` (identiques). `npm audit --omit=dev` : **0 vulnérabilité** sur les 3 packages (web/app, commun/backend, ios/apptel), confirmé à l'identique. | Low (inchangé) | Identique à l'audit original. Explicitement classé « hors scope volontaire » par MODIF 961. |
| 11 | Low | Absence de couche `services/` explicite | **Toujours ouvert (non traité)** | `commun/backend/src/` : `routes/` = 45 fichiers (était 44, +1 fichier de dérive naturelle hors scope), `lib/` = 288 fichiers (était 271, +17 dérive naturelle), `middleware/` = 5 (inchangé), `models/` = 1 seul fichier (`schema.ts`, toujours types + store, inchangé). Pas de dossier `services/` (`Test-Path .../src/services` → `False`). | XL (inchangé) | Identique à l'audit original. Explicitement classé « hors scope volontaire » par MODIF 961. |

**Comptage** : Résolus = 5 (#3, #7, #8, #9, et #6 partiellement compté côté « erreurs ») · Mitigé sans résolution structurelle = 1 (#1) · Toujours ouverts tels quels = 5 (#2, #4, #5, #10, #11) · Partiellement résolu = 1 (#6, warnings restants).

Si on compte strictement : **5 résolus, 1 mitigé (partiel), 5 ouverts, 1 partiel (#6)** sur 11.

## 3. Nouveaux problèmes trouvés lors du re-audit

### 3.1 Test backend en échec — donnée de test expirée (sans lien avec MODIF 961)

- **Fichier** : `commun/backend/src/lib/sponsors.test.ts:236-242`, données dans `commun/backend/src/lib/sponsors.ts:79-98`.
- **Preuve** : `npm test` (vitest) → `FAIL src/lib/sponsors.test.ts > sponsors > affiche Solar au zoom ville quand Le Crès est dans le viewport` — `AssertionError: expected [ 'premium', 'salon', 'live', …(4) ] to include 'solar-festival-cres'` (`sponsors.test.ts:240`). Résultat global : **1 test failed | 356 passed (357 tests, 77 fichiers dont 76 passed / 1 failed)**.
- **Cause racine** : `commun/backend/src/lib/sponsors.ts:93` définit `endsAt: 1783224000000` pour le sponsor `solar-festival-cres`, soit **2026-07-05T04:00:00Z** (converti). La date système au moment du re-audit est **2026-07-08**, donc `isSponsorActiveAt()` (`sponsors.ts:364-369`) retourne désormais `false` pour ce sponsor (`at > sponsor.endsAt`), et le test — qui appelle `listActiveMapAds(undefined, cresViewport)` sans figer le temps (`vi.setSystemTime`) — échoue légitimement puisque l'événement est passé.
- **Lien avec MODIF 961** : **Aucun**. `sponsors.ts` et `sponsors.test.ts` ne figurent pas dans la liste des fichiers modifiés par MODIF 961 (`ecosystem.config.cjs`, `MapView.tsx`, `feedPosts.ts`, `stories.ts`, `auth.ts`, `commun/backend/package.json`). Ce n'est donc pas une régression introduite par les corrections auditées, mais une dette de test préexistante (« bombe à retardement » liée à une date d'événement en dur, sans mock de temps dans le test), non détectée au premier audit car celui-ci ne mesurait pas l'exécution des tests (cf. `AUDIT-architecture-code.md` §9 : « Couverture de tests réelle — non mesurée »).
- **Gravité** : Low-Medium (CI potentiellement rouge selon la configuration ; aucun impact utilisateur, le sponsor expiré ne s'affichant simplement plus, comportement correct côté produit).
- **Solution proposée** : figer le temps dans ce test (`vi.setSystemTime` sur une date antérieure à `endsAt`) plutôt que d'utiliser `Date.now()` réel, ou passer un `at` explicite dans l'appel `listActiveMapAds(fixedTimestamp, cresViewport)`.

### 3.2 Aucune régression de code trouvée dans les fichiers modifiés par MODIF 961

Diffs complets relus (`git diff` contre `HEAD`) pour les 6 fichiers déclarés modifiés par MODIF 961 :

- `commun/deploy/ecosystem.config.cjs` : diff isolé à `instances: 2 → 1` + commentaire. Propre.
- `commun/backend/src/lib/feedPosts.ts` : diff isolé à la suppression de l'import inutilisé. Propre.
- `commun/backend/src/lib/stories.ts` : diff isolé au remplacement interface vide → type alias. Propre.
- `commun/backend/package.json` : diff isolé au changement `--max-warnings`. Propre.
- `commun/backend/src/routes/auth.ts` : diff contient bien les corrections mojibake **et** un ajout non lié à MODIF 961 (révocation OAuth YouTube à la suppression de compte, `isPlatformConnected`/`revokeAndDisconnectYoutube`, lignes 44-45 et 757-765) — **cet ajout provient de MODIF 964 (audit RGPD)**, une session de corrections distincte appliquée le même jour sur le même fichier, sans conflit avec les corrections mojibake de MODIF 961. Confirmé par `modification.txt` ligne 20948 (MODIF 964) et par le fait que cet ajout n'est pas mentionné dans la description de MODIF 961.
- `web/app/src/components/MapView.tsx` : diff contient bien le fix `no-useless-assignment` (lignes 1193-1194, 1219-1220) **et** des changements non liés à MODIF 961 : synchronisation crossfade globe/carte plate (lignes ~691-710, ~999-1010, provenant de **MODIF 956**, `modification.txt` ligne 20272-20296, daté 2026-07-07) et ajout de `loading="lazy" decoding="async"` sur les marqueurs Leaflet (3 occurrences, provenant de **MODIF 965**, `modification.txt` ligne 21115+, audit APIs externes/performance). Aucune de ces modifications superposées ne touche aux lignes du fix MODIF 961 ; le build (`tsc -b && vite build`) passe à 0 erreur, confirmant l'absence de conflit ou de régression entre ces sessions cumulées dans l'arbre de travail non commité.

**Conclusion** : le `git status` du dépôt montre un arbre de travail avec de nombreux fichiers modifiés par plusieurs sessions MODIF successives du même jour (956, 960-965), toutes non commitées. Les changements spécifiques à MODIF 961 sont bien isolés et corrects dans ce contexte ; aucune régression de code n'est imputable aux corrections de MODIF 961 elles-mêmes.

## 4. Ré-exécution des vérifications de l'audit initial

### 4.1 npm audit / npm outdated

| Package | `npm audit --omit=dev` | `npm outdated` (extrait, vs audit initial) |
|---|---|---|
| `web/app` | **0 vulnérabilité** (inchangé) | `@stripe/react-stripe-js` 3.10.0→6.7.0, `@stripe/stripe-js` 5.10.0→9.9.0, `vitest` 3.2.6→4.1.10, `vite` 8.1.2→8.1.3 — identique à l'audit initial |
| `commun/backend` | **0 vulnérabilité** (inchangé) | `express` 4.22.2→5.2.1, `redis` 4.7.1→6.1.0, `stripe` 17.7.0→22.3.0, `typescript` 5.9.3→6.0.3, `bcryptjs` 2.4.3→3.0.3, `dotenv` 16.6.1→17.4.2 — identique à l'audit initial |
| `ios/apptel` | **0 vulnérabilité** (inchangé) | mêmes retards que web/app (Stripe, vite, vitest, sharp) — identique à l'audit initial |

Aucune régression, aucune amélioration : la dette de dépendances (#10) n'a pas été traitée, conformément à ce que documente MODIF 961.

### 4.2 ESLint

- `commun/backend` → `npm run lint` (désormais `--max-warnings=0`) → **exit code 0, 0 erreur, 0 warning**. (Audit initial : 2 erreurs réelles présentes — `feedPosts.ts`, `stories.ts`.)
- `web/app` → `npx eslint .` → **445 problèmes (0 erreur, 445 warnings)**, exit code 0. (Audit initial : 447 problèmes — 2 erreurs, 445 warnings.) Répartition des warnings vérifiée identique : 216 `react-hooks/set-state-in-effect` + 104 `react-hooks/exhaustive-deps`.

### 4.3 Comptage de lignes des god-components

Voir tableau détaillé en §2, ligne #5. Toutes les tailles sont inchangées à ±10 lignes près (dérive naturelle hors scope), confirmant qu'aucun découpage n'a été effectué — cohérent avec le choix documenté de MODIF 961 de ne pas traiter ce point (risque de régression trop élevé pour un refactor automatisé).

### 4.4 Grep TODO/FIXME/HACK

- `web/app/src` : 3 fichiers avec occurrences (`legalConfig.ts`, `dpa.ts`, `dpia.ts`) — tous des `// TODO:` de contenu légal (placeholders à compléter par l'équipe juridique/légale : raison sociale, SIREN, adresse), pas des marqueurs de dette technique. Conforme au constat de l'audit initial (« Aucun marqueur TODO/FIXME/HACK réel trouvé — faux positifs uniquement »).
- `commun/backend/src` : 4 fichiers (`ceoAiTeamRecommendations.ts`, `ceoStrategicKnowledge.ts`, `systemPrompts.ts`, `devDataContext.ts`) — occurrences du littéral `TODO-MANUAL` (nom de fichier/convention interne au module CEO IA), pas des marqueurs de dette technique. Faux positifs, conforme à l'audit initial.

### 4.5 Grep mojibake (pattern `[lettre accentuée]\?[lettre]`, hors query strings)

Grep large exécuté sur tout `commun/backend/src` et tout `web/app/src` : de nombreuses occurrences trouvées par le pattern brut, **toutes vérifiées manuellement** (`avatarUrl.ts`, `mapAds.ts`, `fr.json`, `donations.ts`, `salons.ts`, `publicLegalHtml.ts`, `ActualiteTabPage.tsx`, `sponsors.ts`, `youtubeSearch.ts`, etc.) et confirmées être des **query strings légitimes** (`?seed=`, `?w=80&h=80`, `?list=PL…`, `?lang=`, `?stripeConnect=`, `?token=`), pas du mojibake. Aucune occurrence réelle de corruption d'encodage restante, ce qui confirme l'affirmation de MODIF 961 (« grep large … aucune autre occurrence de mojibake trouvée »).

### 4.6 sync-src.js --check

`node commun/scripts/sync-src.js --check` → **✓ Aucun doublon — architecture propre.** (identique à l'audit initial).

## 5. Build / Lint / Tests — confirmation

| Vérification | Résultat | Détail |
|---|---|---|
| `web/app` → `npm run build` (`tsc -b && vite build`) | ✅ **Succès** (exit 0) | Build complet, 1107 modules transformés, bundles générés dans `commun/backend/public/assets/`. Aucune erreur TypeScript ni Vite. |
| `commun/backend` → `npm run build` (`tsc`) | ✅ **Succès** (exit 0) | Compilation TypeScript backend sans erreur. |
| `commun/backend` → `npm run lint` (`eslint src --max-warnings=0`) | ✅ **Succès** (exit 0) | 0 erreur, 0 warning. |
| `web/app` → `npx eslint .` | ✅ **0 erreur** (exit 0) | 445 warnings préexistants (dette React Compiler, hors scope). |
| `commun/backend` → `npm test` (vitest, 357 tests / 77 fichiers) | ⚠️ **1 test en échec** (exit 1) | `sponsors.test.ts` — voir §3.1. Sans lien avec MODIF 961. 356/357 tests passent. |
| `sync-src.js --check` | ✅ **Succès** | Aucun doublon web/mobile. |

**Aucune régression de build/lint n'a été introduite par MODIF 961.** Le seul point rouge (test `sponsors.test.ts`) est une dette préexistante sans rapport avec les fichiers corrigés.

## 6. Score du domaine : 66 / 100 (vs 60/100 initial, +6)

Justification du delta :

- **+8 points** : les 3 erreurs ESLint bloquantes réelles (#7 MapView, #9 feedPosts/stories) sont corrigées avec preuve (builds/lints repassés au vert), et le mojibake visible utilisateur (#3) est intégralement corrigé — ce sont les points de gravité immédiate/visible les plus faciles à vérifier objectivement.
- **+3 points** : mitigation du risque Critical #1 (retour à `instances: 1`) élimine le risque de production concret (401 aléatoires) à court terme, même si ce n'est pas la solution architecturale de fond.
- **+1 point** : seuil de lint backend durci (`--max-warnings=9999 → 0`), ce qui empêche une régression silencieuse future.
- **-3 points** (nouveau, non présent dans le score initial) : découverte d'un test en échec (`sponsors.test.ts`) lors de la ré-exécution de la suite de tests — absent du premier audit (qui ne mesurait pas les tests), donc une dette réelle non comptabilisée avant. Pénalité limitée car sans lien avec les corrections auditées et sans impact utilisateur direct.
- **-3 points** (inchangé) : le problème architectural de fond du #1 n'est pas résolu, seulement mitigé — la dette technique et le risque potentiel (si `instances` remonte sans refonte) restent entiers ; score non ramené à un niveau « Critical résolu » complet.
- Points inchangés vs audit initial (ni aggravés, ni améliorés) : -8 (strict mode absent), -6 (catch silencieux généralisés), -6 (god-components + 445 warnings ESLint web/app), -3 (dette dépendances). Ces 5 problèmes sont **explicitement documentés comme hors scope volontaire** par l'équipe dans MODIF 961 — non traités par choix, pas par oubli.
- Points conservés (comme à l'audit initial) : 0 vulnérabilité `npm audit` sur les 3 packages, absence de dette TODO réelle, architecture mobile/web propre et outillée (`sync-src.js` OK), découplage routes/lib backend correct, `strict: true` toujours actif côté backend.

**Calcul détaillé** : 60 (score initial) + 8 (erreurs bloquantes + mojibake corrigés) + 3 (mitigation Critical #1) + 1 (seuil lint backend) − 3 (test en échec découvert) − 3 (fond architectural #1 non résolu, pénalité résiduelle distincte de la pénalité initiale déjà retirée) = **66/100**.

## 7. Impossible à vérifier avec les informations disponibles

- Comportement réel en production du backend en mode `instances: 1` depuis la mitigation (fréquence de 401, charge CPU réelle, temps de réponse sous charge) — analyse statique du code uniquement, pas d'accès aux métriques de production dans le cadre de ce re-audit.
- Étendue exhaustive du bug d'encodage mojibake sur des fichiers non-`.ts`/`.tsx` (ex. contenu de base de données déjà persisté avant la correction, emails déjà envoyés avec l'ancien texte corrompu, contenu généré dynamiquement stocké en PostgreSQL avant le fix).
- Audit exhaustif des dépendances inutilisées (nécessiterait `depcheck`/`knip`, non exécuté, identique à la limite documentée dans l'audit initial).
- Couverture de tests réelle (%) — non mesurée (seul le résultat pass/fail de la suite existante a été vérifié, pas la couverture du code).
- État réel du pipeline CI GitHub Actions (déduit de l'exécution locale des mêmes commandes, pas d'un run CI observé — identique à la limite de l'audit initial).
- Duplication de logique métier au-delà des noms de fichiers entre `web/app/src` et `ios/apptel/src` (au-delà du contrôle de doublons de `sync-src.js`, qui ne vérifie que l'absence de fichiers dupliqués, pas la logique).
- Impact exact de la baisse de capacité de traitement liée à `instances: 1` sur le temps de réponse en production sous charge réelle (nombre d'utilisateurs simultanés, etc.) — non mesurable statiquement.
