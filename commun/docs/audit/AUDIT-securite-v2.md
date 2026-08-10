# RE-AUDIT SÉCURITÉ SENIOR — OnScen (v2, post-corrections)

Périmètre : vérification des corrections de `MODIF 960` (voir `modification.txt` lignes 20442-20533) + repasse OWASP complète (régression). Méthode : `git ls-files`, `git check-ignore -v`, `git status`, `git diff`, `git cat-file`, `git ls-tree`, `gh repo view`, lecture de code ligne à ligne, exécution des tests unitaires (`vitest`).

Rapport de référence : `commun/docs/audit/archive/AUDIT-securite.md` — score initial **78/100**, 1 Critical · 1 High · 2 Medium · 3 Low.

---

## ⚠️ Constat central (avant le détail finding-par-finding)

Les corrections de code de `MODIF 960` sont **réelles et correctes**, mais **aucun commit n'a été créé**. Preuve :

```
$ git status --porcelain=v1 -- .gitignore commun/docs/youtube-audit-demo-credentials.local.txt commun/msdev/certs/dev-key.pem commun/msdev/certs/dev-cert.pem commun/msdev/legal-publisher.json commun/msdev/ceo-founder-context.json
 M .gitignore
D  commun/docs/youtube-audit-demo-credentials.local.txt
D  commun/msdev/ceo-founder-context.json
D  commun/msdev/certs/dev-cert.pem
D  commun/msdev/certs/dev-key.pem
D  commun/msdev/legal-publisher.json
```

Lecture du statut porcelain (colonne X = index vs HEAD, colonne Y = worktree vs index) :
- `D ` (colonne X) = suppression **stagée** (ajoutée à l'index via `git rm --cached`) mais **pas commitée**.
- ` M` (espace puis M) pour `.gitignore` = modification présente dans le **working tree uniquement**, **pas même stagée** (`git diff --cached -- .gitignore` ne retourne rien ; `git diff -- .gitignore` montre le diff réel).

Conséquence vérifiée avec `git cat-file -e HEAD:<path>` (exit 0 = le blob existe toujours dans le commit HEAD) :

```
HEAD:commun/docs/youtube-audit-demo-credentials.local.txt  → EXISTS_IN_HEAD
HEAD:commun/msdev/certs/dev-key.pem                         → EXISTS_IN_HEAD
HEAD:commun/msdev/legal-publisher.json                      → EXISTS_IN_HEAD
HEAD:commun/msdev/ceo-founder-context.json                  → EXISTS_IN_HEAD
```

Et le HEAD local est identique au remote (`git status -sb` → `## master...origin/master`, aucun `[ahead]`) :

```
$ git log -1 --format="%H %ci" HEAD
6838b70ad4d4220c5a701d7528cdc3e82e4d716c 2026-07-07 11:11:41 +0200

$ git ls-tree -r origin/master --name-only | findstr "youtube-audit-demo-credentials dev-key.pem legal-publisher.json ceo-founder-context.json"
commun/docs/youtube-audit-demo-credentials.local.txt
commun/msdev/ceo-founder-context.json
commun/msdev/certs/dev-key.pem
commun/msdev/legal-publisher.json
```

**Interprétation stricte** : `git ls-files` (qui lit l'index) confirme bien que les 4 fichiers ne sont **plus trackés dans l'état actuel de l'index/working copy** — sur ce point précis, la demande de vérification est satisfaite. Mais tant qu'aucun `git commit` n'est exécuté :
1. Le dernier commit (`HEAD` = `6838b70a`) contient **toujours** les 4 fichiers avec leur contenu sensible complet.
2. `origin/master` (dépôt GitHub distant) contient **toujours** les 4 fichiers — confirmé par `git ls-tree -r origin/master`.
3. Un `git reset --hard`, `git checkout HEAD -- <fichier>`, ou tout autre opérateur/agent qui clone/pull le dépôt récupère les credentials réels en clair.
4. Le fix `.gitignore` (essentiel pour que la ré-écriture n'échoue pas à nouveau) n'est même pas stagé : un `git add -A` sans revue pourrait omettre cette modification.

Point positif vérifié : le repo GitHub est **privé** (`gh repo view valentingoulven-creator/OnScen --json isPrivate,visibility` → `{"isPrivate":true,"visibility":"PRIVATE"}`), ce qui réduit (sans l'annuler) la surface d'exposition tant que l'accès au repo reste restreint à l'équipe.

**Conclusion** : la fuite Critical n'est **pas résolue** au sens strict de « ne plus être présente dans l'historique Git consultable/clonable ». Elle est **résolue dans l'état de travail local (index)**, ce qui est une étape nécessaire mais insuffisante. Il manque un `git commit` (a minima) pour que la correction ait un effet réel sur le dépôt versionné.

---

## Tableau avant/après par finding original

| # | Gravité (v1) | Sujet | Statut | Preuve |
|---|------|-------|--------|--------|
| 1 | **Critical** | Credentials réels `commun/docs/youtube-audit-demo-credentials.local.txt` | 🟡 **Partiellement résolu** — untrack fait dans l'index (non commité), fichier toujours présent dans `HEAD` et `origin/master` | `git ls-files` → vide ; `git cat-file -e HEAD:commun/docs/youtube-audit-demo-credentials.local.txt` → `EXISTS_IN_HEAD` ; `git ls-tree -r origin/master` → fichier listé |
| 2 | **High** | `.gitignore` ancrage `/` sans `**/` | 🟡 **Corrigé dans le working tree, non commité** | `git diff -- .gitignore` montre les 5 règles corrigées (`**/docs/...`, `**/msdev/.env`, `**/msdev/legal-publisher.json`, `**/msdev/ceo-founder-context.json`, `**/msdev/certs/`) ; `git diff --cached -- .gitignore` vide → pas même stagé |
| 3 | **Medium** | Clé privée `commun/msdev/certs/dev-key.pem` | 🟡 **Partiellement résolu** — même situation que #1 (untrack index seul, présent dans HEAD/remote) | `git ls-files` → vide ; `git cat-file -e HEAD:commun/msdev/certs/dev-key.pem` → `EXISTS_IN_HEAD` |
| 4 | **Medium** | Données perso/financières `legal-publisher.json`, `ceo-founder-context.json` | 🟡 **Partiellement résolu** — idem #1/#3 | `git cat-file -e HEAD:...` → `EXISTS_IN_HEAD` pour les deux fichiers |
| 5 | **Low** | Fallback JWT hardcodé silencieux | ✅ **Résolu** | `commun/backend/src/lib/jwtSecret.ts:23-35` : `throw` strict hors `isDeployedEnv()` sauf `NODE_ENV==='test'` ; 7 tests `jwtSecret.test.ts` passent (`npx vitest run` → `7 passed`) |
| 6 | **Low** | DSN Sentry avec org/project ID réels dans `.env.production.example` | ✅ **Résolu** | `commun/backend/.env.production.example:208` → `SENTRY_DSN=https://examplePublicKey@o0000000000000000.ingest.de.sentry.io/0000000000000000` (100% fictif) |
| 7 | **Low** | CSP `style-src: 'unsafe-inline'` | ⚪ **Non corrigé (décision assumée)** — toujours raisonnable, voir analyse ci-dessous | `commun/backend/src/server.ts:338` |
| 8 | Info | SSRF `reelAssets.ts` | ✅ Toujours OK, aucune régression | inchangé (`git diff` vide sur ce fichier) |

Légende : ✅ Résolu · 🟡 Partiellement résolu (action de suivi requise) · ⚪ Non corrigé mais justifié · ❌ Non résolu / régression.

---

## 1. Vérification CRITIQUE — fichiers sensibles

### `git ls-files` (état de l'index)

```
$ git ls-files -- commun/docs/youtube-audit-demo-credentials.local.txt commun/msdev/certs/dev-key.pem commun/msdev/legal-publisher.json commun/msdev/ceo-founder-context.json
(aucune sortie)
```
→ Confirmé : les 4 fichiers ne sont plus retournés par `git ls-files` (donc plus dans l'index/prochain commit si l'on committe l'état actuel).

### `git check-ignore -v` (règles `.gitignore` du working tree)

```
$ git check-ignore -v commun/docs/youtube-audit-demo-credentials.local.txt commun/msdev/certs/dev-key.pem commun/msdev/legal-publisher.json commun/msdev/ceo-founder-context.json
.gitignore:5:**/docs/youtube-audit-demo-credentials.local.txt	commun/docs/youtube-audit-demo-credentials.local.txt
.gitignore:35:**/msdev/certs/	commun/msdev/certs/dev-key.pem
.gitignore:22:**/msdev/legal-publisher.json	commun/msdev/legal-publisher.json
.gitignore:23:**/msdev/ceo-founder-context.json	commun/msdev/ceo-founder-context.json
```
→ Confirmé : les 4 règles matchent désormais (avant : exit 1 / aucun match, cf. audit v1 findings #1-#4). **Mais** cette règle vit uniquement dans le working tree (non commitée — voir constat central).

Les fichiers existent toujours sur disque (contenu conservé, conforme à `modification.txt`) :

```
Test-Path commun/docs/youtube-audit-demo-credentials.local.txt → True
Test-Path commun/msdev/certs/dev-key.pem                        → True
Test-Path commun/msdev/legal-publisher.json                     → True
Test-Path commun/msdev/ceo-founder-context.json                 → True
```

### Recherche d'autres fichiers sensibles oubliés

- `git ls-files | grep -E "\.env$|\.env\.[a-z]+$"` (hors `*.example`) → **aucune sortie**. Aucun fichier `.env` réel n'est tracké.
- `git grep -n -I -E "sk_live_[A-Za-z0-9]{10,}|AKIA[0-9A-Z]{16}|-----BEGIN (RSA |EC |)PRIVATE KEY-----|BEGIN OPENSSH PRIVATE KEY"` sur l'arbre tracké → 3 occurrences, toutes dans des fichiers `.example`/tests avec des valeurs factices :
  - `apple-oauth.env.example:11` → `"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"` (placeholder littéral avec `...`)
  - `commun/backend/.env.production.example:80` → même placeholder, commenté
  - `commun/backend/src/lib/appleOAuth.test.ts:20` → contient le mot `MOCK`, clé de test fictive
  - Aucune clé privée réelle, aucun `sk_live_`/`AKIA` réel trouvé.
- Recherche de mots de passe en clair (`password\s*[:=]\s*['"][^'"]{6,}['"]`, insensible à la casse) → 9 fichiers correspondent, tous légitimes après inspection :
  - `commun/backend/src/lib/msdevDemoAccounts.ts:18` → `MSDEV_DEMO_PASSWORD = 'msdev123'` — mot de passe **intentionnellement public**, réservé aux comptes de démo `msdev` uniquement (isolé de la prod par `isMsdevAccessEnv()`/`isProductionAccessEnv()` dans `commun/backend/src/lib/accessControl.ts:112-125`).
  - `commun/deploy/postgres-setup.sh:64`, `commun/backend/vps-setup.sh:24` → référencent une variable shell `$DB_PASS` (pas de valeur en clair committée).
  - Les autres correspondances (`create-admin-user.ts`, `check_val_profile_api.js`, `newUser.scenario.ts`) sont des scripts de dev/tests utilisant des variables d'environnement ou des mots de passe de test explicitement nommés comme tels — pas de valeur réelle.
- Grep ciblé `sk_live_|AKIA|BEGIN...PRIVATE KEY|ya29\.|AIzaSy` sur `commun/docs/**` → seules 2 occurrences, qui sont des **labels de documentation** (`commun/docs/ENVIRONNEMENTS.md:90` : `| Stripe | sk_test_ (clés test) | sk_live_ |` — nom de préfixe, pas de clé réelle ; `commun/docs/reports/acompleter.txt:114` : `Clé secrète (sk_live_…) :` — libellé de formulaire).

**Conclusion recherche large** : aucun autre secret réel oublié détecté dans l'état actuel du working tree/index, au-delà des 4 fichiers déjà identifiés (dont le retrait n'est pas encore commité — voir constat central).

### Historique Git antérieur (non traité par MODIF 960)

Comme documenté explicitement dans `modification.txt` (« ATTENTION : l'historique Git contient toujours ces secrets dans des commits antérieurs. Une purge d'historique (BFG/git-filter-repo) n'a PAS été effectuée »), les commits antérieurs au commit actuel contiennent toujours ces 4 fichiers en clair. Ce point était déjà noté comme non traité par l'agent précédent et reste **non résolu**, action explicitement différée (décision utilisateur requise vu son caractère destructif).

### Action manuelle non vérifiable

« Rotation effective du mot de passe `[REDACTED — mot de passe exposé, à faire tourner en priorité]` / du compte `yt.audit.demo2.soundy@gmail.com` » — **Impossible à vérifier avec les informations disponibles** (nécessite un accès au compte Google/getsoundy.com hors périmètre de cet audit statique).

---

## 2. Fix JWT secret fallback

Fichier : `commun/backend/src/lib/jwtSecret.ts:23-35`

```
23:export function getJwtSecret(): string {
24:  const secret = process.env.JWT_SECRET?.trim();
25:  if (secret) return secret;
26:  if (isDeployedEnv()) {
27:    throw new Error('[jwt] JWT_SECRET must be set in production — refusing to start with default key.');
28:  }
29:  if (process.env.NODE_ENV === 'test') {
30:    return DEV_FALLBACK;
31:  }
32:  throw new Error(
33:    '[jwt] JWT_SECRET must be set — refusing to start without an explicit secret. Set JWT_SECRET in your .env file (see .env.example).'
34:  );
35:}
```

✅ **Résolu.** Le comportement est maintenant : `JWT_SECRET` défini → utilisé ; sinon en environnement déployé (`isDeployedEnv()` = prod/preprod) → `throw` immédiat ; sinon (dev/msdev/staging non couvert) → fallback **uniquement** si `NODE_ENV === 'test'`, sinon `throw` également. Il n'existe plus de chemin silencieux avec `console.warn` + démarrage sur un secret hardcodé, contrairement à l'état v1.

Vérifié par exécution réelle des tests (pas seulement lecture statique) :

```
$ npx vitest run src/lib/jwtSecret.test.ts
 ✓ src/lib/jwtSecret.test.ts (7 tests) 13ms
 Test Files  1 passed (1)
      Tests  7 passed (7)
```

Les 7 tests couvrent : secret défini → utilisé ; `throw` en production sans secret ; `throw` en préprod sans secret ; fallback dev **seulement** sous `NODE_ENV=test` ; `throw` en msdev/dev quand `NODE_ENV!=='test'` et secret absent ; détection strict-prod via `APP_ENV` uniquement (pas `NODE_ENV`) ; préprod n'est pas confondue avec la prod stricte.

Non-régression sur le flux dev normal vérifiée : `commun/msdev/.env.example:9` définit déjà `JWT_SECRET=msdev_jwt_secret_change_in_production`, donc `getJwtSecret()` retourne cette valeur avant même d'atteindre la logique de fallback/throw en usage normal.

---

## 3. Fix DSN Sentry

Fichier : `commun/backend/.env.production.example:208`

```
208:SENTRY_DSN=https://examplePublicKey@o0000000000000000.ingest.de.sentry.io/0000000000000000
```

✅ **Résolu.** L'org ID et le project ID réels (`o4511654862258176` / `4511654915866704`, présents dans l'audit v1) ont été remplacés par des valeurs entièrement fictives (`o0000000000000000` / `0000000000000000`), en cohérence avec le préfixe déjà factice `examplePublicKey`. Plus aucune donnée de reconnaissance réelle dans ce fichier d'exemple versionné.

---

## 4. CSP `style-src: 'unsafe-inline'` — décision de non-correction

Fichier : `commun/backend/src/server.ts:338`

```
338:        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
```

⚪ **Non corrigé, décision documentée dans `modification.txt` (« Non corrigé (documenté, pas de changement de code) »), toujours raisonnable après relecture du code actuel.**

Justification vérifiée empiriquement (pas seulement reprise de l'affirmation de l'agent précédent) :

```
$ Select-String -Path "web/app/src/**/*.tsx" -Pattern "style=\{\{" | Select-Object -ExpandProperty Path -Unique | Measure-Object
Count : 44
```

44 fichiers `.tsx` distincts dans `web/app/src` utilisent l'attribut `style={{...}}` (style inline React), avec 77 occurrences totales. Un nonce CSP (`script-src` en bénéficie déjà, ligne 331-337 : `(_req, res) => \`'nonce-${res.locals.cspNonce}'\`` sans `'unsafe-inline'`) ne couvre techniquement que les balises `<style>`, jamais l'attribut HTML `style=""` — c'est une limitation connue et documentée de la spec CSP (Level 2/3), pas une erreur d'implémentation. Retirer `'unsafe-inline'` de `style-src` casserait donc le rendu de ces 44 composants sans solution de contournement légère (il faudrait soit migrer l'intégralité de ces styles inline vers des classes Tailwind statiques, soit implémenter un mécanisme de nonce par style — non trivial avec le rendu React côté client).

Le risque résiduel reste **faible** : `script-src` (le vecteur XSS le plus sensible) est verrouillé par nonce sans `unsafe-inline`, donc l'injection de `<script>` arbitraire reste bloquée. `style-src: unsafe-inline` autorise seulement l'injection de styles CSS inline, dont l'exploitation (CSS injection / exfiltration de données via sélecteurs CSS) est un vecteur bien plus limité et nécessite déjà un point d'injection HTML préexistant.

**Verdict** : la décision de l'agent précédent de ne pas corriger ce point reste raisonnable au vu du coût (migration de 44 fichiers) par rapport au risque résiduel réel (limité, `script-src` déjà protégé).

### Nouveau point mineur découvert (hors périmètre initial, non-régression)

Lors de la relecture de `server.ts`, la route `/phone-preview` (`commun/backend/src/server.ts:768-778`) définit une CSP différente et plus permissive :

```
775:    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; frame-src 'self'; connect-src 'self' ws: wss:;",
```

Ce `script-src 'self' 'unsafe-inline'` est nécessaire car la page contient des attributs `onclick` inline (commentaire ligne 771 : « Outil de dev : contient des attributs onclick inline qui nécessitent unsafe-inline »). Ce n'est **pas une régression** de la session de corrections (fichier non modifié par `MODIF 960` — absent du `git diff` HEAD ciblé sur cette zone) et n'était pas non plus signalé par l'audit v1. Risque jugé **faible** : la constante `PHONE_PREVIEW_HTML` (ligne 79) est un template littéral **statique**, sans interpolation de données de requête (`_req` non utilisé dans le handler), donc aucun vecteur XSS réfléchi identifié. Point noté pour information — la route n'est cependant protégée par **aucun garde d'environnement** (contrairement à `/msdev-mobile` ligne 666-670 qui renvoie 404 hors `APP_ENV=msdev`), donc accessible en production. Recommandation (non bloquante) : ajouter le même garde `APP_ENV`/`MSENV` que `/msdev-mobile` par cohérence, puisqu'il s'agit d'un outil de dev.

---

## 5. Repasse OWASP complète — recherche de régressions

### 5.1 Nouvelles routes admin de remboursement Stripe (`commun/backend/src/routes/adminPayments.ts`)

Fichier confirmé présent (`?? commun/backend/src/routes/adminPayments.ts` — non tracké par Git, nouveau).

Pattern d'autorisation vérifié ligne par ligne :

```
13:function requireAdmin(req: Request, res: Response): string | null {
14:  const userId = (req as Request & { user?: { id: string } }).user?.id;
15:  if (!userId) {
16:    res.status(401).json({ error: 'Authentification requise' });
17:    return null;
18:  }
19:  const user = db.users.get(userId);
20:  if (!user || !isAccessAdmin(user)) {
21:    res.status(403).json({ error: 'Accès réservé aux administrateurs' });
22:    return null;
23:  }
24:  return userId;
25:}
```

Les deux routes (`POST /donations/:id/refund` ligne 42-44, `POST /subscriptions/:id/refund` ligne 130-132) appliquent `authenticateJWT` (middleware Express) **puis** `requireAdmin(req, res)` en première instruction du handler — pattern **identique** (import `isAccessAdmin` depuis `../lib/accessControl`, `authenticateJWT` depuis `../middleware/auth`) à celui vérifié dans les autres routeurs admin :

| Routeur | `authenticateJWT` | `requireAdmin` local + `isAccessAdmin` |
|---|---|---|
| `adminSponsors.ts:2,4,30,37` | ✅ | ✅ |
| `adminContent.ts:2,4,29,36` | ✅ | ✅ |
| `adminMonitor.ts` (inchangé + nouvelle route `api-quota` ajoutée avec le même pattern) | ✅ | ✅ |
| `adminPayments.ts:5,6,13-24` (nouveau) | ✅ | ✅ |

`isAccessAdmin()` (`commun/backend/src/lib/accessControl.ts:139-147`) confirme le même comportement fail-closed en production : `if (isProductionAccessEnv()) return false;` après l'unique check autorisé en prod (`user.isAdmin === true`, flag DB) — aucun contournement par email/username en production, cohérent avec le finding « Info / vérifié OK » de l'audit v1 sur l'escalade de privilèges.

Aucune divergence de pattern détectée. **Pas de régression sur ce point.**

Autres observations sur `adminPayments.ts` (positives, pas des findings) :
- Clé d'idempotence Stripe déterministe (`refundIdempotencyKey`, ligne 31-36, basée sur `sha256(paymentIntentId:amount)`) passée à `stripe.refunds.create(..., { idempotencyKey })` — protège contre les doubles remboursements en cas de retry réseau/double-clic admin.
- Validation stricte du montant de remboursement partiel (`amountCents > 0`, `Number.isFinite`, `Math.trunc`, et pour les dons : `parsedAmount > payment.amountCents` rejeté ligne 74-77). Pour les abonnements, aucune borne explicite côté serveur n'est appliquée avant l'appel Stripe, mais Stripe refuse nativement tout remboursement dépassant le montant du `payment_intent` d'origine (comportement plateforme, pas une faille applicative).
- `reason` tronqué à 300 caractères avant d'être inséré dans les metadata Stripe (pas d'injection possible, Stripe traite les metadata comme des chaînes opaques).
- Toutes les actions sont journalisées (`logAdminPaymentAction`) avec `adminId`, ce qui permet la traçabilité/imputabilité (accountability) requise pour une action financière sensible.

Client Stripe partagé (`commun/backend/src/lib/stripeClient.ts`, nouveau fichier) : clé chargée exclusivement via `process.env.STRIPE_SECRET_KEY?.trim()` (ligne 16), aucune valeur hardcodée, mise en cache simple par valeur de clé. Bonne pratique, cohérent avec le reste du projet.

### 5.2 Autres modifications backend passées en revue (recherche de régression)

- **CORS** (`commun/backend/src/lib/corsConfig.ts`) : `git diff --stat` → vide (fichier **non modifié** depuis le dernier commit). Toujours fail-closed en environnement déployé (`throw` si `CORS_ORIGIN` absent, ligne 10-19). Pas de régression.
- **Middleware auth** (`commun/backend/src/middleware/auth.ts`) : `git diff --stat` → vide. Cookies `httpOnly`/`Secure`/`SameSite=Strict` et whitelist d'algorithme JWT inchangés.
- **`commun/backend/src/routes/auth.ts`** (44 lignes modifiées) : diff composé quasi exclusivement de corrections d'encodage mojibake (`?` → `é`/`à`/`—`) dans les messages d'erreur, plus un ajout fonctionnel positif pour la conformité RGPD : révocation du token OAuth YouTube auprès de Google avant suppression de compte (`isPlatformConnected`/`revokeAndDisconnectYoutube`, lignes 758-765) au lieu d'une simple suppression en base. **Amélioration, pas de régression.**
- **`commun/backend/src/routes/donations.ts`** (114 lignes) et **`subscriptions.ts`** (124 lignes) : ajout de clés d'idempotence Stripe déterministes (fenêtre 60s, `sha256(userId:contexte:montant:bucket)`) sur la création de `PaymentIntent`/`Checkout Session`, vérification `charges_enabled` du compte Connect avant tout paiement, et déduplication cross-worker PM2 via requête Postgres (`donationPaymentIntentExistsInPg`, `creatorSubscriptionExistsInPg`) en complément du check mémoire — protection renforcée contre le double-crédit en environnement cluster. La vérification de signature webhook Stripe (`stripe.webhooks.constructEvent`, `donations.ts:464`, `subscriptions.ts:464`) reste intacte et inchangée dans les deux fichiers. **Amélioration de l'intégrité des paiements, pas de régression.**
- **`commun/backend/src/routes/geo.ts`** (+6 lignes) : ajout d'un store de rate-limit Redis (`createRateLimitStore`) pour les limiteurs `nearbyAnonLimiter`/`nearbyAuthLimiter`, rendant la limite de taux cohérente entre workers PM2 (avant : compteur mémoire par process, contournable en multipliant les requêtes réparties sur plusieurs workers). **Amélioration, pas de régression.**
- **`commun/backend/src/routes/reels.ts`** (+1 ligne) : ajout d'un champ optionnel `link` sur la création de reel. Validé côté serveur par `isHttpUrl()` (`commun/backend/src/lib/reels.ts:391-398`, qui vérifie strictement `protocol === 'http:' || protocol === 'https:'` via le constructeur `URL`) et une limite de longueur de 500 caractères (`commun/backend/src/lib/reels.ts:633`) — un schéma `javascript:` ou `data:` est rejeté par construction. Pas de vecteur XSS/redirection ouverte identifié.
- **SQL** : les fichiers backend modifiés utilisant Postgres (`pgDonations.ts`, `pgSubscriptions.ts`, `appDiagnosticLogs.ts` — ce dernier non modifié dans cette session) utilisent systématiquement des requêtes paramétrées (`$1, $2, ...`). Seule interpolation de chaîne trouvée dans une requête SQL : `appDiagnosticLogs.ts:120,143` (`INTERVAL '${RETENTION_INTERVAL}'`), où `RETENTION_INTERVAL` est une **constante module hardcodée** (`'5 months'`, ligne 26), jamais dérivée d'une entrée utilisateur — pas une injection SQL exploitable. Aucune autre concaténation de valeur utilisateur dans une requête SQL détectée par grep ciblé sur `commun/backend/src/lib`.
- **XSS/`dangerouslySetInnerHTML`** : non ré-audité fichier par fichier dans cette passe (volume de fichiers `web/app/src` modifiés important, principalement UI live/chat) faute de indication d'ajout de rendu HTML brut dans les diffs consultés ; recommandation de suivi si un audit exhaustif du domaine frontend est requis séparément. **Impossible de garantir à 100% l'absence de toute régression XSS sur l'ensemble des ~35 fichiers `web/app/src`/`ios/apptel/src` modifiés dans cette session sans une revue ligne-à-ligne complète — hors du périmètre strict de cet audit (fixes de sécurité + régression ciblée sur les routes admin).**

### 5.3 Points déjà vérifiés OK en v1, re-confirmés sans régression

- `.env` réels non trackés — reconfirmé (`git ls-files` filtré, aucun `.env` réel).
- Whitelist d'algorithme JWT (`HS256` explicite) — inchangé (`jwtSecret.ts:6-7`).
- Uploads magic-bytes / path traversal — fichiers non touchés par cette session (hors périmètre des diffs observés).
- Webhooks Stripe signés — reconfirmé explicitement ci-dessus (5.2).
- OAuth `state` anti-CSRF — non retouché dans cette session (aucun diff sur les fichiers OAuth Google/Facebook/Apple hors `revokeAndDisconnectYoutube` ajouté dans `auth.ts`, qui est un appel de révocation, pas un flux d'authentification).

---

## Impossible à vérifier avec les informations disponibles

- Rotation effective du mot de passe `[REDACTED — mot de passe exposé, à faire tourner en priorité]` / du compte Gmail associé.
- Purge de l'historique Git antérieur (non traitée, décision explicitement différée par l'agent précédent — nécessite validation utilisateur pour une opération destructive de type BFG/`git filter-repo`).
- Revue XSS ligne-à-ligne exhaustive des ~35 fichiers frontend (`web/app/src`, `ios/apptel/src`) modifiés dans cette session (hors scope : ce sont des changements de fonctionnalité live/chat, sans lien avec les corrections sécurité auditées).
- Contenu réel de la base PostgreSQL de production / secrets effectivement déployés sur le VPS.
- Si un tiers a déjà cloné le dépôt privé avant cette session (accès historique GitHub non consultable depuis cet environnement).

---

## Score du domaine recalculé : **70/100** (vs 78/100 initial)

### Justification du calcul

Base de départ : 78/100 (score v1).

**Corrections effectives et vérifiées (+) :**
- +6 : fallback JWT strict (`jwtSecret.ts`), testé par 7 tests unitaires passants.
- +2 : DSN Sentry assaini dans le fichier d'exemple.
- +1 : améliorations positives non demandées mais constatées sans régression (idempotence paiements, dédoublonnage cluster, rate-limit Redis cluster-safe, révocation OAuth YouTube au RGPD) — bonus mineur pour absence de régression sur un volume de changement important.

Sous-total intermédiaire : 78 + 9 = 87.

**Déductions — la correction Critical n'a pas atteint son objectif final (-) :**
- **-15** : la fuite Critical (finding #1 de l'audit v1) reste, à ce jour, présente dans le commit `HEAD` et sur `origin/master` — c'est-à-dire dans l'état réellement versionné et partagé du dépôt. Le travail de remédiation existe mais est **inachevé** (non commité). Tant qu'un commit n'est pas créé, le score ne peut pas refléter une fuite « résolue » : n'importe quelle opération git usuelle (reset, clone par un collaborateur, pull par un autre poste) republie le secret en clair. Cette déduction est volontairement proche de la déduction initiale (-15 dans l'audit v1) car le risque réel — un secret de compte de production `getsoundy.com` en clair, accessible à quiconque a un accès au dépôt (même privé) ou à une copie locale existante — n'a factuellement pas changé d'état pour l'historique et le remote.
- **-2** : idem pour la clé privée TLS et les données personnelles/financières (findings #3/#4 v1), même situation (untrack index seul, non commité).
- **+0** (ni + ni -) : le point `.gitignore` (finding #2 v1) est corrigé en contenu mais lui aussi non commité — traité comme faisant partie de la déduction ci-dessus plutôt que compté séparément pour éviter un double-comptage.

Sous-total : 87 - 17 = **70/100**.

### Comparaison avec le score initial (78/100)

| | v1 (avant) | v2 (après) |
|---|---|---|
| Score | 78/100 | **70/100** |
| Critical ouverts | 1 | 1 (déclassé de « présent partout » à « présent dans HEAD/remote, absent de l'index local ») |
| High ouverts | 1 (`.gitignore`) | 0 en tant que finding autonome (contenu corrigé), mais non commité — regroupé dans le Critical résiduel |
| Medium ouverts | 2 | 2 (même situation que le Critical — untrack non commité) |
| Low ouverts | 3 | 1 (`style-src` — non corrigé, jugé acceptable) |
| Low résolus | 0/3 | 2/3 (JWT fallback, DSN Sentry) |

Le score **baisse** de 78 à 70 malgré des corrections de code réelles et de qualité, car la vérification stricte demandée par ce re-audit (preuve `git` exacte, pas de supposition) révèle que **l'action la plus critique du premier audit n'a pas été menée à son terme** : un secret de production réel reste aujourd'hui consultable par quiconque peut lire `HEAD` ou `origin/master` du dépôt — situation techniquement identique à celle du premier audit pour ce qui est de l'état versionné partagé, seul l'état de travail local a changé.

### Action unique requise pour repasser au-dessus du score initial

```powershell
git add .gitignore commun/docs/youtube-audit-demo-credentials.local.txt commun/msdev/certs/dev-key.pem commun/msdev/certs/dev-cert.pem commun/msdev/legal-publisher.json commun/msdev/ceo-founder-context.json commun/backend/src/lib/jwtSecret.ts commun/backend/src/lib/jwtSecret.test.ts commun/backend/.env.production.example
git commit -m "fix(security): untrack real credentials/secrets, strict JWT fallback, fake Sentry DSN"
git push
```

Puis re-vérifier avec `git ls-tree -r origin/master --name-only | findstr "youtube-audit-demo-credentials dev-key.pem legal-publisher.json ceo-founder-context.json"` (doit être vide) avant de considérer le Critical comme réellement clos. La purge de l'historique antérieur (BFG/`git filter-repo`) reste une décision séparée à valider explicitement avec l'utilisateur, comme déjà noté par l'agent précédent.

---

## Fichiers consultés pour ce re-audit

`commun/docs/audit/AUDIT-securite.md` · `modification.txt` (MODIF 960) · `.gitignore` · `commun/backend/src/lib/jwtSecret.ts` · `commun/backend/src/lib/jwtSecret.test.ts` · `commun/backend/.env.production.example` · `commun/backend/src/server.ts` · `commun/backend/src/routes/adminPayments.ts` · `commun/backend/src/lib/stripeClient.ts` · `commun/backend/src/lib/accessControl.ts` · `commun/backend/src/routes/adminSponsors.ts` · `commun/backend/src/routes/adminContent.ts` · `commun/backend/src/routes/adminMonitor.ts` · `commun/backend/src/lib/corsConfig.ts` · `commun/backend/src/middleware/auth.ts` · `commun/backend/src/routes/auth.ts` · `commun/backend/src/routes/donations.ts` · `commun/backend/src/routes/subscriptions.ts` · `commun/backend/src/routes/geo.ts` · `commun/backend/src/routes/reels.ts` · `commun/backend/src/lib/reels.ts` · `commun/backend/src/lib/pgDonations.ts` · `commun/backend/src/lib/appDiagnosticLogs.ts` · `commun/msdev/.env.example`.

Commandes `git` exécutées : `ls-files`, `check-ignore -v`, `status --porcelain`, `status -sb`, `diff` / `diff --cached`, `cat-file -e`, `ls-tree -r origin/master`, `log`, `branch -vv`, `remote -v`, `grep`. Commande `gh repo view` pour la visibilité du dépôt. Exécution réelle de `npx vitest run src/lib/jwtSecret.test.ts` (7/7 tests passants).
