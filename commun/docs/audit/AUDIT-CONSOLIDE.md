# AUDIT CONSOLIDÉ — OnScen (getsoundy.com)

**Rédigé par :** CTO virtuel (Staff Engineer / Architecte) — mode analyse uniquement, aucune ligne de code applicatif modifiée.
**Date de consolidation :** 2026-07-22
**Méthode :** fusion et dédoublonnage des 6 audits thématiques (v1 + v2) et des 2 rapports finaux existants dans `commun/docs/audit/`, puis vérification ponctuelle de l'état réel du code (`web/app/src/`, `commun/backend/src/`) et de la production (SSH lecture seule sur `onscen-prod`/`onscen-staging`, `git log`/`git ls-tree` sur le dépôt distant) pour dater précisément chaque finding.

**Sources fusionnées (v1 dans `audit/archive/`, v2 à la racine de `audit/`) :**

**Convention de statut utilisée dans ce document :**
- ✅ **Résolu** — corrigé en code **et** effectif en production/dépôt distant (vérifié).
- 🟡 **Partiellement résolu** — code corrigé mais déploiement/action complémentaire manquante, ou correction partielle du périmètre.
- ❌ **Toujours ouvert** — aucun changement depuis l'audit initial.
- 🔍 **À revérifier** — non vérifiable depuis ce poste (accès externe requis : Google Cloud Console, Dashboard Stripe, console Scaleway…).

---

## 1. Analyse

OnScen a fait l'objet d'un audit senior initial (2026-07-07, 6 domaines) suivi d'une session de corrections et d'un **re-audit de vérification** (2026-07-08, MODIF 960-965). Ce re-audit avait révélé un problème de méthode critique : **les corrections de code étaient réelles mais n'avaient ni été commitées, ni déployées** — le score « réel » restait donc bloqué à celui de l'audit initial malgré un travail de correction de qualité.

**Deux semaines se sont écoulées depuis (dernière donnée : 2026-07-22).** Cette consolidation ne se contente pas de fusionner les 14 documents : elle revérifie ponctuellement, à la date d'aujourd'hui, si l'écart « code corrigé / prod non mise à jour » signalé par le re-audit du 08/07 a été résorbé. Les vérifications suivantes ont été effectuées en lecture seule pendant cette consolidation :

| Vérification | Résultat constaté aujourd'hui (2026-07-22) |
|---|---|
| `git log -1 HEAD` / `origin/master` | `c4791057` (« fix: audit senior complet… »), **identique** en local et sur `origin/master` — le commit de sécurité **a bien été poussé** depuis le 08/07. |
| `git ls-files` / `git cat-file -e HEAD:<fichier>` sur les 4 fichiers sensibles | Les 4 fichiers (credentials YouTube, clé TLS, `legal-publisher.json`, `ceo-founder-context.json`) sont **absents de `HEAD` et de `origin/master`** — untrack désormais réellement effectif et versionné. |
| `git log --all -- commun/docs/youtube-audit-demo-credentials.local.txt` | Le fichier existe toujours dans l'historique (commit `72370fc8`, antérieur au fix) — **purge d'historique toujours pas faite**, risque résiduel non nul même si le repo est privé. |
| `pm2 jlist` sur `onscen-prod` | `onscen-backend` : **`instances:1`, `exec_mode:cluster_mode`, uptime 2h** au moment du contrôle — **la mitigation `instances:1` est maintenant réellement déployée en prod** (elle ne l'était pas au 08/07). |
| `psql` prod — `SELECT MAX(version) FROM schema_migrations` | **31** (était 27 au 08/07) — **les migrations 028 et 029 sont maintenant appliquées en prod** : le `CASCADE DELETE` sur les tables de paiement est bien passé en `SET NULL`, et les 5 FK `NOT VALID` sur les tables de contenu sont en place. |
| `psql` prod — privilèges du rôle `onscen` | `rolcreaterole=t, rolcreatedb=t` — **toujours sur-privilégié**, non traité. |
| Variables d'environnement prod (lecture des clés, valeurs masquées) | `STRIPE_SECRET_KEY` **toujours `sk_test_…`** malgré `APP_ENV=production` et `DONATIONS_ENABLED=1` ; `LEGAL_PUBLISHER_ADDRESS` **est maintenant renseignée** en prod (adresse réelle, confirmé aussi par `TODO-MANUAL.md`) ; `soundy-auth` (process PM2 fork, non versionné dans Git) **toujours actif**, uptime 21 jours. |
| DB staging (`onscen-staging`) | `DATABASE_URL` pointe toujours vers le même hôte `51.15.132.229:14440` que la prod (base logique différente `onscen_staging`) — **toujours partagé**. |
| `TODO-MANUAL.md` (revue 2026-07-15) + `OPS-PRIORITIES.md` | Confirme : Cloudflare WAF/CDN toujours **à faire** (accès DNS OVH manquant), compte ACRCloud + clés prod toujours **à faire** (inscription non faite), mentions légales **adresse résolue**, JWT httpOnly/révocation par version déjà en place. |

**Conclusion de l'analyse** : contrairement à la situation figée décrite par le re-audit du 08/07, **une partie significative des correctifs critiques a depuis été déployée** (PM2 instances:1 live, migrations paiements appliquées, fix sécurité poussé sur le dépôt distant). Le produit a donc progressé au-delà de l'état « 64/100, rien de déployé » documenté par `AUDIT-RAPPORT-FINAL-v2.md`. Il reste cependant des risques réels et non résolus, détaillés ci-dessous, dont deux sont d'une gravité opérationnelle immédiate (clé Stripe test en prod avec dons activés ; historique Git non purgé).

## 2. Risques transversaux (au-delà du détail par domaine)

1. **Écart configuration/réalité en production** — un pattern récurrent des deux audits initiaux (correctifs codés mais non déployés) s'est en grande partie résorbé, mais illustre un manque de vérification post-déploiement systématique. Recommandation : ajouter une étape de vérification automatisée post-déploiement (smoke test qui interroge `pm2 jlist`, `schema_migrations`, et la présence des fichiers sensibles côté Git) dans `deploy_zero_downtime.ps1`.
2. **Clé Stripe de test en production avec la fonctionnalité dons activée** — c'est un risque opérationnel plus qu'une faille de sécurité : soit les dons réels ne fonctionnent pas du tout pour les utilisateurs (mauvaise expérience, perte de confiance), soit — pire — il existe une confusion sur l'environnement réellement utilisé qui pourrait mener à un déploiement de fausses transactions. À trancher en priorité absolue avant toute communication publique sur les dons.
3. **Historique Git non purgé** — le repo est privé (facteur atténuant réel), mais 3 secrets réels (credentials compte prod, clé TLS, données financières/personnelles du fondateur) restent récupérables par quiconque a ou aura accès au dépôt et remonte l'historique. Décision explicitement différée à l'utilisateur dans les 2 audits — toujours en attente.
4. **Processus `soundy-auth` fantôme** — tourne en prod depuis 21+ jours, absent de Git, avec un mot de passe de repli en dur et des sessions perdues à chaque redémarrage. Aucun audit (v1 ou v2) n'a pu déterminer sa fonction exacte ni son périmètre d'exposition — à documenter/auditer en priorité.

## 3. Sécurité

**Score consolidé retenu : 82/100** *(v1 : 78 → v2 : 70, dégradé car fix non commité → aujourd'hui : commit confirmé poussé sur `origin/master`, ce qui lève la pénalité qui avait fait chuter le score en v2 ; +9 pts vs v1 pour JWT strict + Sentry DSN assaini déjà acquis en v2 ; -5 pts résiduels pour l'historique Git non purgé)*

| # | Statut | Finding | Fichier(s) | Risque | Recommandation | Effort |
|---|---|---|---|---|---|---|
| SEC-1 | 🟡 **Partiellement résolu** | Fuite de credentials réels (compte prod `getsoundy.com`), clé privée TLS, données perso/financières du fondateur — untrack Git désormais **commité et poussé** (`c4791057`, confirmé sur `origin/master`), mais présents dans un commit antérieur (`72370fc8`) de l'historique | `commun/docs/youtube-audit-demo-credentials.local.txt`, `commun/msdev/certs/dev-key.pem`, `commun/msdev/legal-publisher.json`, `commun/msdev/ceo-founder-context.json` | Moyen (repo privé = facteur atténuant, mais accès historique = fuite totale récupérable) | (a) Confirmer la **rotation effective** du mot de passe `yt.audit.demo2.soundy@gmail.com` — jamais vérifiable depuis le code, à faire manuellement si pas fait ; (b) purger l'historique Git (BFG/`git filter-repo`) après validation explicite utilisateur (opération destructive, réécrit tous les hash de commit) | S (rotation) / M (purge historique) |
| SEC-2 | ✅ **Résolu** | `.gitignore` mal ancré (règles composées sans `**/`) | `.gitignore` | — | Aucune (règles `**/docs/…`, `**/msdev/certs/`, `**/msdev/legal-publisher.json`, `**/msdev/ceo-founder-context.json` confirmées présentes et poussées) | — |
| SEC-3 | ✅ **Résolu** | Fallback JWT hardcodé silencieux en dev/msdev | `commun/backend/src/lib/jwtSecret.ts` | — | Aucune — `throw` strict hors `NODE_ENV==='test'`, 7 tests dédiés passent | — |
| SEC-4 | ✅ **Résolu** | DSN Sentry avec org/project ID réels dans `.env.production.example` | `commun/backend/.env.production.example`, `web/app/.env.production.example` | — | Aucune — placeholders 100% fictifs confirmés des deux côtés | — |
| SEC-5 | ⚪ **Non corrigé, décision assumée et raisonnable** | CSP `style-src: 'unsafe-inline'` | `commun/backend/src/server.ts` | Faible (`script-src` déjà verrouillé par nonce ; 44 fichiers `.tsx` utilisent `style={{}}`, migration coûteuse pour un gain limité) | Non prioritaire — envisager seulement si un incident CSS-injection est constaté | M |
| SEC-6 | ❌ **Toujours ouvert (nouveau, mineur)** | Route `/phone-preview` avec CSP permissive (`unsafe-inline`) et sans garde d'environnement (accessible en prod, contrairement à `/msdev-mobile`) | `commun/backend/src/server.ts` | Faible (page statique, pas d'interpolation de requête, pas de vecteur XSS identifié) | Ajouter le même garde `APP_ENV`/`MSENV` que `/msdev-mobile` par cohérence | S |
| SEC-7 | ❌ **Toujours ouvert** | Processus `soundy-auth` non versionné dans Git, hash de mot de passe de repli en dur, sessions en `Map` mémoire perdues à chaque redémarrage | Script absent du dépôt (`/opt/onscen/deploy/auth-server/server.js` sur le VPS uniquement) | Moyen — surface d'attaque non auditable, fonction/périmètre exacts inconnus | Documenter sa fonction, le rapatrier dans le dépôt versionné, migrer les sessions vers Redis/PG si utilisé en prod réellement | M |
| SEC-8 | 🔍 **À revérifier** | Rotation effective du mot de passe du compte `yt.audit.demo2.soundy@gmail.com` | — | — | Vérifier manuellement (accès Google/Gmail hors périmètre code) | S |
| SEC-9 | 🔍 **À revérifier** | Si un tiers a cloné le dépôt privé avant le fix du 08/07 | — | — | Vérifier les logs d'accès GitHub si disponibles | — |

**Points positifs reconfirmés stables (aucune régression détectée)** : Helmet/CSP par nonce sur `script-src`, JWT HS256 whitelisté avec `tokenVersion` (révocation par version, cf. `TODO-MANUAL.md` ELEV-01 ✅), cookies httpOnly/Secure/SameSite=Strict (cf. `TODO-MANUAL.md` CRIT-01 ✅ web), CORS fail-closed, 8+ routers admin avec pattern `authenticateJWT`+`requireAdmin` homogène (incluant le nouveau `adminPayments.ts`), upload avec magic-bytes, 0 XSS/SQLi/SSRF trouvé sur les deux passes, OAuth avec `state` anti-CSRF, webhooks Stripe signés.

## 4. Légal — RGPD / YouTube / Copyright

**Scores consolidés retenus : RGPD 90/100 · YouTube 75/100 · Copyright 96/100**
*(RGPD : v1 72 → v2 86 → aujourd'hui 90, l'adresse postale réelle étant désormais confirmée renseignée en prod via `LEGAL_PUBLISHER_ADDRESS` ; YouTube et Copyright inchangés depuis le v2 du 08/07, aucune évolution trouvée dans `modification.txt` sur ce périmètre)*

| # | Statut | Finding | Fichier(s) | Risque | Recommandation | Effort |
|---|---|---|---|---|---|---|
| LEG-1 | ✅ **Résolu** *(mis à jour par cette consolidation — était 🟡 dans le v2)* | Mentions légales : adresse postale placeholder + email de contact personnel | `commun/msdev/legal-publisher.json`, `commun/backend/src/lib/legalPublisher.ts` | — | Les e-mails pro sont corrigés depuis le v2. **Vérifié aujourd'hui** : `LEGAL_PUBLISHER_ADDRESS` contient une adresse réelle en prod (confirmé par lecture de l'environnement du process PM2 + `TODO-MANUAL.md` C6 « Partiel → adresse via env prod »). Reste à s'assurer que la même variable est bien renseignée sur `onscen-staging`. | S (vérif. staging) |
| LEG-2 | ✅ **Résolu** | `app_diagnostic_logs` sans purge programmée | `commun/backend/src/lib/dataRetention.ts`, `appDiagnosticLogs.ts` | — | Purge intégrée au passage périodique (6h), rétention 5 mois | — |
| LEG-3 | ✅ **Résolu** | Pas de révocation OAuth YouTube à la suppression de compte | `commun/backend/src/routes/auth.ts` | — | `revokeAndDisconnectYoutube()` appelé avant la cascade de suppression, échec non bloquant | — |
| LEG-4 | ✅ **Résolu** | E-mails en clair dans des `console.log` de scripts admin/seed | `maskPii.ts` + 4 fichiers appelants | — | Masquage via `maskEmail()`, re-grep de contrôle négatif | — |
| LEG-5 | ❌ **Toujours ouvert** | DPA (art. 28 RGPD) avec Scaleway/Cloudflare/Stripe/Resend en statut `'pending'` | `web/app/src/content/legal/dpa.ts` | Moyen (conformité contractuelle RGPD sous-traitants) | Finaliser la signature des DPA standards — action contractuelle hors code | M |
| LEG-6 | ❌ **Toujours ouvert, bloquant produit** | App OAuth Google (`youtube.readonly`) toujours en mode « Testing » non vérifié | `commun/docs/GOOGLE-OAUTH-TEST-USERS.md` | Élevé pour l'usage produit — bloque YouTube pour tout utilisateur non whitelisté | Soumettre l'app à la vérification Google (processus externe, délai hors contrôle) | L (délai Google) |
| LEG-7 | ✅ **Résolu** | Code mort fallback Piped/Invidious (non conforme ToS YouTube) présent dans le build de production | `commun/backend/src/lib/youtubeRemote.ts` + build | — | Suppression physique confirmée par exécution réelle de `npm run build:prod` (fichier absent de `dist/`) ; garde-fou runtime + try/catch appelants en complément (défense en profondeur à 3 niveaux) | — |
| LEG-8 | ❌ **Toujours ouvert, mineur** | `controls: 0` sur le lecteur YouTube — zone grise Branding Guidelines | `web/app/src/components/SalonYouTubePlayer.tsx` | Faible | Revue légale formelle si volume d'utilisateurs significatif | S |
| LEG-9 | ❌ **Toujours ouvert** | Flux de contenu utilisateur vers Sightengine/ACRCloud non documenté dans la politique de confidentialité | `web/app/src/content/legal/privacy.ts` | Faible-Moyen | Ajouter une mention explicite des deux prestataires dans `privacy.ts` | S (doc) |
| LEG-10 | **Copyright — confirmé propre, sans régression** | Recherche exhaustive `ytdl-core`/`yt-dlp`/scraping/ffmpeg-sur-YouTube reproduite à l'identique, y compris sur tous les fichiers créés depuis l'audit initial | Tout le monorepo | — | Aucune violation trouvée — point fort du produit, à maintenir en vigilance à chaque nouvelle intégration YouTube | — |

## 5. Stripe / Paiements

**Score consolidé retenu : 80/100** *(v1 : 61 → v2 : 83, code confirmé ; -3 pts dans cette consolidation pour un problème opérationnel critique découvert en vérification prod : clé de test active en production alors que les dons sont activés)*

| # | Statut | Finding | Fichier(s) | Risque | Recommandation | Effort |
|---|---|---|---|---|---|---|
| STR-1 | ✅ **Résolu** | Aucune clé d'idempotence Stripe | `commun/backend/src/routes/donations.ts`, `subscriptions.ts`, `adminPayments.ts` | — | Clés SHA-256 déterministes sur PaymentIntent/Checkout/Refund, vérifié par lecture de code | — |
| STR-2 | ✅ **Résolu** | Déduplication webhook uniquement en mémoire locale → double-crédit possible en cluster PM2 | `donations.ts:487-515`, `subscriptions.ts:503-533`, migrations `010`/`012` (contraintes `UNIQUE`) | — | Check PostgreSQL ajouté en complément du check RAM ; risque définitivement écarté car `instances:1` est désormais **déployé** (confirmé aujourd'hui), donc même la fenêtre de risque résiduelle multi-worker n'existe plus tant que ce paramètre n'est pas remonté sans refonte | — |
| STR-3 | ✅ **Résolu** | Aucun remboursement programmatique implémenté alors que promis dans les CGU | `commun/backend/src/routes/adminPayments.ts` (nouveau) | — | 2 routes admin fonctionnelles, protégées, idempotentes, journalisées | Reste : aucun test automatisé (voir STR-8), pas de resynchronisation si remboursement fait depuis le Dashboard Stripe hors app |
| STR-4 | ✅ **Résolu** | Incohérence de nommage env `SOUNDY`/`SOUNDLY` | `.env.example`, scripts, docs | — | 0 occurrence de `SOUNDLY` restante dans du code/scripts actifs | — |
| STR-5 | ✅ **Résolu** | Pas de blocage boot si `STRIPE_WEBHOOK_SECRET` absent | `commun/backend/src/lib/productionStartup.ts` | — | `throw` si fonctionnalité activée sans secret webhook correspondant | — |
| STR-6 | ✅ **Résolu** | `invoice.payment_failed` non traité (pas de dunning) | `commun/backend/src/routes/subscriptions.ts` | — | Notification + `paymentFailedAt` persisté | — |
| STR-7 | ✅ **Résolu** | 7 instanciations `new Stripe()` sans `apiVersion` pinné | `commun/backend/src/lib/stripeClient.ts` (nouveau) | — | Factory centralisée, 1 seule instanciation restante (dans la factory) | — |
| STR-8 | ❌ **Toujours ouvert** | Aucun test HTTP sur les webhooks Stripe ni sur `adminPayments.ts`/`stripeClient.ts` (nouveaux fichiers qui déplacent de l'argent réel) | `commun/backend/src` | Moyen — filet de sécurité automatisé absent sur un périmètre financier sensible | Ajouter des tests d'intégration (signature invalide → 400, doublon, remboursement) | M |
| STR-9 | ❌ **Toujours ouvert** | `country: 'FR'` en dur dans `stripe.accounts.create` | `commun/backend/src/routes/donations.ts` | Faible (limitation produit) | Paramétrer si expansion internationale prévue | S |
| STR-10 | ❌ **Toujours ouvert** | Identifiants de compte Connect prod en clair dans un script versionné | `commun/scripts/stripe-connect-setup.sh` | Faible (info opérationnelle, pas un secret Stripe au sens strict) | Paramétrer via variables d'environnement | S |
| **STR-11** | ❌ **CRITIQUE — Toujours ouvert — Action requise côté utilisateur (ré-investigué 2026-07-22 soir, aucun fix automatique possible)** | `STRIPE_SECRET_KEY` **toujours en mode test** (`sk_test_…`) sur `onscen-prod` alors que `APP_ENV=production` **et** `DONATIONS_ENABLED=1` | Variable d'environnement VPS prod (`/opt/onscen/.env`, confirmé aussi dans **tous** les backups `.env.bak*` présents sur le VPS — aucun n'a jamais contenu de clé `sk_live_`) | **Élevé — confirmé, pas juste suspecté** : `donations.ts:385-393` utilise `stripe.paymentIntents.create` (Connect destination charge, `automatic_payment_methods: { enabled: true }`) avec la clé test. En mode test Stripe, un vrai numéro de carte n'est **jamais transmis au réseau bancaire réel** : Stripe renvoie un `payment_intent.succeeded` fictif sans qu'aucun fonds réel ne bouge. Concrètement, un utilisateur qui fait un don avec sa vraie carte voit une confirmation de succès dans l'app, le créateur voit le don crédité, **mais aucun argent réel n'est transféré ni au créateur ni à la plateforme** — risque de confusion/fraude perçue plus que faille de sécurité, mais impact business et réputationnel élevé si découvert après lancement public. | **Décision produit à trancher en priorité absolue** — voir §5.1 ci-dessous pour le détail de l'investigation et les 3 options concrètes | S (config) + décision business |

### 5.1 Investigation complémentaire STR-11 (2026-07-22, soir) — aucune clé live disponible nulle part

**Vérifications effectuées (lecture seule, SSH `onscen-prod`) :**

- `STRIPE_SECRET_KEY` sur `/opt/onscen/.env` (fichier réellement chargé par `onscen-backend` via `env_file` dans `pm2 jlist`) : `sk_test_51Thv4p…` — confirmé par lecture directe de l'environnement du process PM2 (`pm2_env.env.STRIPE_SECRET_KEY`), pas seulement du fichier `.env` statique.
- `STRIPE_PUBLISHABLE_KEY` : `pk_test_51Thv4p…` (même préfixe test, cohérent avec la clé secrète — pas de mismatch live/test entre les deux clés).
- `APP_ENV` effectif du process `onscen-backend` (`pm2_env.env.APP_ENV`) : `production` — confirmé, `NODE_ENV=production` également. `DONATIONS_ENABLED=1`, `SUBSCRIPTIONS_ENABLED=0` (les abonnements créateurs sont donc actuellement désactivés en prod, seuls les dons/pourboires live sont concernés par ce risque).
- **Tous** les 9 fichiers `.env.bak*` présents sur `/opt/onscen/` (`.env.bak.`, `.env.bak.manual`, `.env.bak-resend-*`, `.env.bak.202606*` × 4, `.env.bak.livekit`) ont été grep-és pour `STRIPE_SECRET_KEY`/`STRIPE_PUBLISHABLE_KEY` : **100% en `sk_test_`/`pk_test_`**, aucun historique de clé live sur ce VPS.
- `commun/msdev/.env` et `commun/backend/.env.production` (local, poste dev) : **absents** de ce poste — aucune clé (live ou test) n'y a été trouvée localement lors de cette session (impossibles à lire, donc ni confirmés ni infirmés comme source de clé live — mais la règle infra les décrit comme des copies synchronisées de la même config, pas une source alternative).
- `commun/scripts/stripe-connect-setup.sh:6,11` : le compte Connect par défaut (`acct_1ThwQ2FsKQ6HX3Pk`) a été créé via ce script en utilisant `STRIPE_SECRET_KEY` sourcé depuis `/opt/onscen/.env` (chemin historique, aujourd'hui `/opt/onscen/.env`) — donc **ce compte Connect a été créé en mode test également** (les comptes Connect créés avec une clé test n'existent que dans l'espace de test Stripe, indépendant du mode live). Aucune preuve qu'un compte Stripe live ait jamais été activé pour OnScen.
- `commun/backend/.env.production.example:46` : `# STRIPE_SECRET_KEY=sk_live_...` — un simple exemple commenté/placeholder, jamais une vraie clé.
- Grep exhaustif `sk_live_|pk_live_` sur tout le dépôt : aucune occurrence d'une vraie clé live (seulement des mentions de préfixe dans du code de détection `stripeConfig.ts`, des exemples, et de la documentation d'audit).
- **Point positif découvert** : le code dispose déjà d'une détection et d'une alerte dédiées à ce problème précis — `commun/backend/src/lib/stripeConfig.ts` (`getStripeKeyMode()`), exposée dans `commun/backend/src/lib/prodSaasStatus.ts:112-118` (alerte `stripe_test_on_production`, sévérité `critical`, visible dans le panneau admin coûts SaaS via `admin.costs.saas.alerts.stripeTestOnProd`) et dans `stripePlatformStatus.ts` (rapport Stripe admin avec `keyMode`). `productionStartup.ts:119-124` émet aussi un `console.warn` (non bloquant) au boot si `sk_test_` détecté sur `APP_ENV=production`. **Conclusion : le code sait déjà détecter et signaler ce problème à l'admin ; ce qui manque n'est pas du code, c'est la clé secrète elle-même.**

**Conclusion de l'investigation : aucune clé Stripe live n'a été trouvée nulle part dans l'infrastructure accessible (VPS prod + ses 9 backups, dépôt Git, exemples, documentation). Il n'existe aucune preuve qu'un compte Stripe live ait jamais été configuré pour OnScen.** Conformément à la consigne de la session, **aucune modification n'a été appliquée** : ni remplacement de clé (aucune clé live à substituer), ni désactivation de `DONATIONS_ENABLED` (décision produit hors périmètre technique).

**Options concrètes pour l'utilisateur/fondateur (à trancher, aucune n'a été appliquée automatiquement) :**

1. **Activer un compte Stripe live** — se connecter au [Dashboard Stripe](https://dashboard.stripe.com), terminer l'activation du compte live (KYC entreprise, RIB), récupérer `sk_live_…`/`pk_live_…` + régénérer les webhooks en mode live (`whsec_…` différent du test), puis remplacer les 3 variables (`STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`) dans `/opt/onscen/.env` et `pm2 reload onscen-backend --update-env` (zero-downtime, `instances:1` cluster_mode supporte le reload). **Recréer aussi le compte Connect créateur en mode live** (l'actuel `acct_1ThwQ2FsKQ6HX3Pk` est un compte test, invalide en live) via une nouvelle exécution de `stripe-connect-setup.sh` une fois les clés live en place.
2. **Désactiver explicitement les dons en prod** en attendant la clé live — mettre `DONATIONS_ENABLED=0` dans `/opt/onscen/.env` + `pm2 reload onscen-backend --update-env`. Le code gère déjà ce cas proprement (`isDonationsEnabled()` dans `commun/backend/src/lib/donations.ts:33-36` retourne `false`, l'UI de don se masque côté frontend via l'endpoint de statut). Solution la plus sûre à très court terme si aucune décision business n'est encore prise sur le lancement des dons réels.
3. **Statu quo documenté** — laisser tel quel mais s'assurer que l'équipe/le fondateur a bien conscience que les dons actuels sur `getsoundy.com` ne produisent **aucun mouvement d'argent réel** (ce qui peut être acceptable en phase de test/bêta fermée avec des utilisateurs informés, mais dangereux si des utilisateurs réels et non informés font des dons en pensant qu'ils sont réels). Dans ce cas, envisager un message UI explicite (« Mode démo — aucun paiement réel ») tant que l'option 1 n'est pas mise en œuvre.

**Aucune action destructive/irréversible n'a été effectuée. Aucun secret n'a été affiché en clair dans ce document ni dans les logs de session** (toutes les lectures de clés ont été systématiquement masquées via `sed`/grep de préfixe uniquement — voir méthode ci-dessus). Un fichier temporaire (`pm2 jlist` complet, contenant les variables d'environnement en clair du process) a été créé localement pour parsing puis **supprimé immédiatement** après lecture, avant tout commit.

## 6. Base de données & Infrastructure

**Score consolidé retenu : 76/100** *(v1 : 61 → v2 : 64 (pondéré code/prod, rien déployé) → aujourd'hui : hausse significative car les correctifs des 3 Critical sont désormais confirmés déployés en prod)*

| # | Statut | Finding | Fichier(s) | Risque | Recommandation | Effort |
|---|---|---|---|---|---|---|
| DBI-1 | ✅ **Résolu et déployé** *(mis à jour par cette consolidation — était 🟡 « mitigé, non déployé » au v2)* | **[Critical]** Store applicatif en RAM dupliqué entre workers PM2 cluster | `commun/deploy/ecosystem.config.cjs`, `commun/backend/src/models/schema.ts` | Résiduel Moyen — la mitigation (`instances:1`) est **confirmée live** (`pm2 jlist` sur `onscen-prod`, 2026-07-22), le risque immédiat de 401 aléatoires/incohérences est éliminé. Le problème de fond (store mémoire non partagé) demeure : un futur retour à `instances > 1` sans refonte réintroduirait le bug | Chantier XL toujours ouvert : migrer la source de vérité des lectures critiques (users, sessions) vers Postgres/Redis partagé. En attendant, **ne jamais repasser `instances` au-dessus de 1** sans cette refonte | XL (refonte) / — (mitigation déjà déployée) |
| DBI-2 | ✅ **Résolu et déployé** *(mis à jour — était 🟡 « migration non appliquée en prod » au v2)* | **[Critical]** `ON DELETE CASCADE` sur les tables de paiement | `commun/backend/src/db/migrations/028_payment_fk_preserve_history.sql` | Faible désormais | **Confirmé** : `schema_migrations` en prod est à la version **31** (>28/29) au 2026-07-22, contre 27 au 08/07 — la migration est appliquée, les 4 FK de paiement sont en `SET NULL`. Reste à faire un `VALIDATE CONSTRAINT` différé (déjà planifié, non urgent) | S (validate constraint) |
| DBI-3 | 🟡 **Partiellement résolu (mitigation ciblée seulement)** | **[Critical]** Flush périodique = ré-upsert intégral de toutes les collections toutes les 10s | `commun/backend/src/lib/pgStore.ts`, `pgStoreSocialSync.ts` | Moyen — ne scale pas au-delà d'un certain volume | Seule `directMessages` est plafonnée (`trimDirectMessages`). La refonte de fond (flush incrémental delta) reste un chantier XL non entamé, explicitement documenté comme tel dans le code lui-même (`pgStore.ts:397-416`) | XL |
| DBI-4 | ✅ **Résolu et déployé** | Rate-limiters `nearbyAnonLimiter`/`nearbyAuthLimiter` non cluster-safe | `commun/backend/src/routes/geo.ts` | — | Basculés sur `createRateLimitStore` (Redis) ; `authLimiter` était déjà correct (audit v1 erroné sur ce point précis) | — |
| DBI-5 | 🟡 **Partiellement résolu** | Absence de FK sur ~90% des tables + rôle DB sur-privilégié | Migration `029_content_tables_fk_not_valid.sql` (5 tables) ; rôle `onscen` | Moyen | FK `NOT VALID` ajoutées sur 5 tables prioritaires (`feed_posts`, `notifications`, `gifts`, `user_reels`, `heart_events`) et **confirmées appliquées en prod** (migration 31). **Rôle DB toujours sur-privilégié** — confirmé aujourd'hui via `psql` (`rolcreaterole=t, rolcreatedb=t`) — action volontairement différée (destructive sur rôle de prod, nécessite validation utilisateur explicite) | L (25 tables restantes) / S (revoke rôle, décision requise) |
| DBI-6 | ❌ **Toujours ouvert** | Prod et staging partagent la même instance PostgreSQL (`51.15.132.229:14440`) | Infra Scaleway | Moyen (risque de contamination croisée entre environnements) | **Reconfirmé aujourd'hui** via `onscen-staging` (`DATABASE_URL` → même hôte, base logique `onscen_staging` distincte). Recommandation inchangée : instance managée distincte | M (infra, fenêtre de maintenance) |
| DBI-7 | ❌ **Toujours ouvert** | Triple SPOF (1 VPS, 1 PostgreSQL managé, 1 Redis local) sans réplication | Infra | Élevé à long terme (aucune haute disponibilité) | Prévoir réplication PG (lecture) et/ou Redis Sentinel à mesure que le trafic croît ; documenté dans `STACK-CIBLE.md`/`SCALABILITY.md` | L |
| DBI-8 | ❌ **Toujours ouvert (voir détail complet STR-11 §5.1)** | `STRIPE_SECRET_KEY` en mode test sur `APP_ENV=production` | `.env` VPS prod (`/opt/onscen/.env` + ses 9 backups, tous confirmés en `sk_test_`) | Élevé — voir détail STR-11 | Décision produit à trancher entre 3 options documentées (activer clé live / désactiver `DONATIONS_ENABLED` / statu quo assumé) — ré-investigué le 2026-07-22 soir, aucune clé live trouvée nulle part dans l'infra accessible | S (config) + décision business |
| DBI-9 | ❌ **Toujours ouvert** | Process `soundy-auth` non versionné, sessions RAM, hash de repli en dur (voir aussi SEC-7) | VPS uniquement | Moyen | Documenter/rapatrier dans le dépôt | M |
| DBI-10 | ❌ **Toujours ouvert** | Interpolation de nom de table dans `pruneCompositePairs()` (`pgStoreSocialSync.ts`) | `commun/backend/src/lib/pgStoreSocialSync.ts` | Faible (paramètres internes uniquement, pas d'injection active) | Pattern à corriger par hygiène si réutilisé avec une entrée externe un jour | S |
| DBI-11 | 🔍 **À revérifier** | Disque staging (72-73% d'usage lors des deux premiers audits) | VPS staging | Faible-Moyen | Revérifier `df -h` régulièrement, alerter avant saturation | S |
| DBI-12 | 🔍 **À revérifier** | Politique de rétention/tests de restauration des backups automatiques Scaleway | Console Scaleway (non accessible depuis le code) | Moyen | Vérifier manuellement dans la console Scaleway ; tester une restauration à blanc | M |

## 7. APIs externes & Performance

**Scores consolidés retenus : APIs externes 84/100 · Performance 87/100** *(inchangés depuis le v2 du 08/07 — aucune évolution de code trouvée sur ce périmètre dans `modification.txt` depuis cette date ; confirmé par `TODO-MANUAL.md` du 15/07 que les 2 actions infra restantes — Cloudflare, ACRCloud — sont toujours en attente)*

| # | Statut | Finding | Fichier(s) | Risque | Recommandation | Effort |
|---|---|---|---|---|---|---|
| API-1 | ✅ **Résolu (viewers) / résiduel documenté (host)** | **[High]** Mode WebRTC mesh P2P legacy exposant les IP publiques par défaut | `web/app/src/lib/liveVideoRelay.ts`, `useLiveVideoRelay.ts` | Faible-Moyen | Détection réelle du TURN (`hasTurnServer`), viewers forcés en `relay` si TURN dispo, repli sûr sinon (comportement historique préservé, pas de régression). Host garde `'all'` par choix documenté (1 acteur vs N viewers) | — |
| API-2 | ❌ **Toujours ouvert, confirmé par `TODO-MANUAL.md`** | Absence de CDN/WAF Cloudflare devant l'app principale | `commun/deploy/Caddyfile` | Moyen (pas de protection DDoS réseau, pas de cache edge) | **Confirmé toujours bloqué** : `OPS-PRIORITIES.md` liste ce point en priorité 1, bloqué par l'accès DNS OVH manquant (action manuelle fondateur) | M (accès externe requis) |
| API-3 | ✅ **Résolu** | Pas de suivi de quota ACRCloud/Sightengine (code) | `commun/backend/src/lib/apiQuotaMonitor.ts` | — | Compteur + alerte + route admin `/api-quota` implémentés et vérifiés | — |
| API-3b | ❌ **Nouveau constat de cette consolidation** | Le monitoring de quota ACRCloud est opérationnel **au niveau code**, mais `TODO-MANUAL.md` (revue 15/07) indique que le **compte ACRCloud et les clés `ACRCLOUD_*` en prod restent à créer/configurer** — la fonctionnalité de reconnaissance musicale pourrait donc ne pas être active du tout en prod, indépendamment du monitoring | Config VPS prod | Moyen (fonctionnalité produit potentiellement inactive) | Clarifier si la reconnaissance audio ACRCloud est un besoin produit actif ; si oui, finaliser l'inscription et la configuration des clés | S (une fois le compte créé) |
| API-4 | ✅ **Résolu** | Compression gzip uniquement, pas de Brotli | `commun/backend/src/server.ts` | — | Brotli confirmé actif au niveau librairie (`compression@1.8.1`, qualité 7) | — |
| API-5 | ✅ **Résolu** | Images toujours réencodées en JPEG, jamais WebP | `web/app/src/lib/imageConstraints.ts` | — | Pipeline WebP avec repli JPEG, 4 tests dédiés passent | Dette mineure : constantes `outputFormat: 'image/jpeg'` mortes non nettoyées |
| API-6 | 🟡 **Partiellement résolu** | Lazy-loading partiel sur les `<img>` (14/34 fichiers) | 16 composants listés dans MODIF 965 | Faible | Étendu à 16 composants supplémentaires ; exceptions résiduelles sur des aperçus d'upload (impact réseau faible car affichés immédiatement) ; pas de `srcset` ajouté | S (résiduel) |
| API-7 | ❌ **Toujours ouvert, hors scope volontaire** | CSS Tailwind bundle 391 Ko non splitté | `commun/backend/public/assets/*.css` | Faible-Moyen | Confirmé inchangé (même taille en octets) ; analysé et jugé non défaillant structurellement (purge Tailwind v4 fonctionne par construction) — refonte jugée hors scope par l'utilisateur | M |
| API-8 | ❌ **Toujours ouvert** | Flux Sightengine/ACRCloud non documenté dans la politique de confidentialité | `web/app/src/content/legal/privacy.ts` | Faible-Moyen | Ajouter mention explicite (voir aussi LEG-9, doublon) | S |
| API-9 | ⚪ **Non corrigé, décision documentée** | TTL LiveKit 9h sans refresh token | `commun/backend/src/lib/livekit.ts` | Faible (borné par suppression de room en fin de live) | Non prioritaire, limitation SDK `livekit-client` documentée | S |
| API-10 | ✅ **Résolu** | Pas d'état UI dédié pour `ConnectionState.Reconnecting` | `web/app/src/components/LiveKitVideoStage.tsx` | — | État "Reconnexion…" ajouté | — |

## 8. Architecture & Code

**Score consolidé retenu : 68/100** *(v1 : 60 → v2 : 66 → légère hausse aujourd'hui car la mitigation Critical #1 est désormais confirmée déployée en prod, ce qui n'était pas encore le cas à la date du re-audit du 08/07)*

| # | Statut | Finding | Fichier(s) | Risque | Recommandation | Effort |
|---|---|---|---|---|---|---|
| ARC-1 | ✅ **Mitigé et déployé** *(voir DBI-1 — même finding, vu sous l'angle architecture)* | Store en mémoire + PM2 cluster 2 workers | `ecosystem.config.cjs`, `models/schema.ts` | Moyen résiduel | Refonte XL toujours à faire ; mitigation confirmée live aujourd'hui | XL |
| ARC-2 | ❌ **Toujours ouvert (hors scope volontaire)** | `strict` TS désactivé en frontend/mobile vs actif en backend | `web/app/tsconfig.app.json`, `ios/apptel/tsconfig.app.json` | Moyen (bugs `null`/`undefined` non détectés à la compilation) | Activer progressivement, PR incrémentales | L |
| ARC-3 | ✅ **Résolu** | Mojibake (encodage cassé) dans les messages utilisateur | `commun/backend/src/routes/auth.ts` | — | Toutes occurrences corrigées, re-grep large négatif | — |
| ARC-4 | ❌ **Toujours ouvert (hors scope volontaire)** | Gestion d'erreur silencieuse généralisée (`catch {}` sans log) | `auth.ts`, `MapView.tsx`, `DmPage.tsx`, `GlobeView.tsx`, etc. | Moyen (incidents production invisibles) | Helper de log centralisé, prioriser auth/paiement | M |
| ARC-5 | ❌ **Toujours ouvert (hors scope volontaire)** | Fichiers god-component (`DmPage.tsx` 3352 lignes, `HomePage.tsx` 2743, etc.) | `web/app/src/pages/*` | Moyen (maintenabilité) | Découpage en sous-composants/hooks, prioriser `DmPage.tsx` | L/XL |
| ARC-6 | ✅ **Résolu** | Erreurs ESLint bloquantes réelles (`MapView.tsx`, `feedPosts.ts`, `stories.ts`) | 3 fichiers | — | 0 erreur confirmée sur les deux passes de build/lint | — |
| ARC-7 | 🟡 **Partiellement résolu** | 447 problèmes ESLint web/app (dette React Compiler) | `web/app/src/App.tsx` principalement | Faible-Moyen | Les 2 erreurs bloquantes corrigées ; 445 warnings préexistants inchangés (`set-state-in-effect`, `exhaustive-deps`) — migration en cours, non résorbée | L |
| ARC-8 | ✅ **Résolu** | Seuil `--max-warnings=9999` backend désactivant le lint | `commun/backend/package.json` | — | Passé à `--max-warnings=0`, confirmé 0/0 | — |
| ARC-9 | ❌ **Toujours ouvert (hors scope volontaire)** | Absence de couche `services/` (routes → lib mélange logique métier + accès données + intégrations tierces) | `commun/backend/src/lib/` (288 fichiers) | Faible court terme, XL long terme | Introduire une couche `services/` explicite si l'équipe grossit | XL |
| ARC-10 | ❌ **Toujours ouvert, sans aggravation** | Dette de dépendances (Stripe x5 majeures backend, Express 4→5, Redis 4→6, TypeScript, Vitest) | `package.json` (3 packages) | Faible (0 CVE constatée par `npm audit` sur les 3 passes) | Campagne de migration progressive, prioriser Stripe | M |
| ARC-11 | ❌ **Découvert lors du re-audit du 08/07, sans lien avec les corrections** | Test `sponsors.test.ts` en échec (date de festival fictive dépassée, `endsAt` en dur sans `vi.setSystemTime`) | `commun/backend/src/lib/sponsors.test.ts` | Faible (CI potentiellement rouge, aucun impact utilisateur) | Figer le temps dans le test plutôt que `Date.now()` réel | S |

## 9. Récapitulatif des scores

| Domaine | v1 (07-07) | v2 (08-07, code local) | v2 (08-07, prod réelle) | **Consolidé — aujourd'hui (22-07)** |
|---|---|---|---|---|
| Sécurité | 78 | 70 | 70 | **82** |
| Stripe / Paiements | 61 | 83 | — | **80** *(pénalité opérationnelle STR-11)* |
| DB & Infrastructure | 61 | 68 | 62 | **76** |
| RGPD | 72 | 86 | — | **90** |
| YouTube | 68 | 75 | — | **75** |
| Copyright | 93 | 96 | — | **96** |
| APIs externes | 78 | 84 | — | **84** |
| Performance | 82 | 87 | — | **87** |
| Architecture & Code | 60 | 66 | — | **68** |

*Méthodologie : scores calculés selon la même logique pondérée que les rapports sources (base + corrections vérifiées − pénalités pour risques non résolus/déploiement manquant), ajustés par les vérifications ponctuelles effectuées le 2026-07-22 (SSH lecture seule sur `onscen-prod`/`onscen-staging`, `git log`/`git ls-tree` sur `origin/master`). Ce ne sont pas des re-audits exhaustifs domaine par domaine — pour une precision totale, un nouveau re-audit complet par domaine reste recommandé après le prochain cycle de corrections.*

## 10. Plan d'action priorisé

### 🔴 CRITIQUE (à traiter immédiatement, jours)

| # | Action | Domaine | Effort | Pourquoi maintenant |
|---|---|---|---|---|
| 1 | **Décider du sort de `STRIPE_SECRET_KEY` en mode test sur `APP_ENV=production`** — ré-investigué le 22/07 soir : **aucune clé live trouvée nulle part** (VPS + 9 backups + dépôt Git), 3 options documentées en STR-11 §5.1 (activer compte live / `DONATIONS_ENABLED=0` en attendant / statu quo assumé et documenté) | Stripe / DB-Infra | S (config) + décision business | Chaque don réel actuel produit un `payment_intent.succeeded` fictif (carte réelle jamais débitée en mode test Stripe) — aucun fonds ne bouge, risque de confusion/fraude perçue par l'utilisateur donateur |
| 2 | **Vérifier/effectuer la rotation du mot de passe** du compte `yt.audit.demo2.soundy@gmail.com` (compte réel `getsoundy.com`) | Sécurité | S | Jamais confirmée depuis l'audit initial (07-07), un compte de production reste potentiellement exposé |
| 3 | **Purger l'historique Git** (BFG/`git filter-repo`) des 4 fichiers sensibles, après validation explicite | Sécurité | M | Le fix HEAD est fait, mais le commit `72370fc8` contient toujours les secrets en clair |
| 4 | **Documenter/rapatrier le process `soundy-auth`** (non versionné, 21+ jours d'uptime, hash de repli en dur) | Sécurité / DB-Infra | M | Surface d'attaque non auditable, fonction exacte inconnue de tous les audits successifs |
| 5 | **Révoquer `CREATEROLE`/`CREATEDB` du rôle DB `onscen`** en prod (`REVOKE CREATEROLE, CREATEDB FROM soundy;`) | DB-Infra | S | Confirmé toujours actif aujourd'hui ; privilège excessif pour un compte applicatif, action simple une fois validée |

### 🟠 IMPORTANT (semaines)

| # | Action | Domaine | Effort |
|---|---|---|---|
| 6 | Refonte du flush périodique (ré-upsert intégral → flush incrémental delta) | DB-Infra | XL |
| 7 | Séparer les instances PostgreSQL prod/staging | DB-Infra | M (infra) |
| 8 | Activer Cloudflare (proxy DNS + WAF + cache) devant l'app principale — bloqué par accès DNS OVH | APIs externes | M (accès externe) |
| 9 | Soumettre l'app OAuth Google à la vérification (sortir du mode Testing) | Légal/YouTube | L (délai Google) |
| 10 | Ajouter des tests d'intégration HTTP sur les webhooks Stripe et `adminPayments.ts` | Stripe | M |
| 11 | Étendre les FK aux ~25 tables encore sans contrainte + `VALIDATE CONSTRAINT` différée sur 028/029 | DB-Infra | L |
| 12 | Décider de l'avenir de la fonctionnalité ACRCloud (compte à créer ou fonctionnalité à retirer/masquer) | APIs externes | S (une fois décidé) |
| 13 | Finaliser la signature des DPA (Scaleway, Cloudflare, Stripe, Resend) | Légal | M (contractuel) |
| 14 | Activer `strict: true` TypeScript en frontend/mobile, par étapes | Architecture | L |
| 15 | Réduire le triple SPOF (réplication PG et/ou Redis) à mesure que le trafic croît | DB-Infra | L |

### 🟢 AMÉLIORATION CONTINUE (non bloquant)

| # | Action | Domaine | Effort |
|---|---|---|---|
| 16 | Découper les god-components (`DmPage.tsx`, `HomePage.tsx`, `ActualiteTabPage.tsx`…) | Architecture | L/XL |
| 17 | Introduire un helper de log centralisé pour remplacer les `catch {}` silencieux | Architecture | M |
| 18 | Campagne de mise à jour des dépendances majeures (Stripe SDK, Express 5, Redis 6, TypeScript) | Architecture | M |
| 19 | Documenter le flux Sightengine/ACRCloud dans la politique de confidentialité | Légal / APIs | S |
| 20 | Nettoyer le code mort résiduel (constantes `outputFormat: 'image/jpeg'`, garde `/phone-preview`) | Architecture / APIs | S |
| 21 | Introduire une couche `services/` explicite si l'équipe grossit | Architecture | XL |
| 22 | Fixer le test `sponsors.test.ts` (figer le temps plutôt que `Date.now()` réel) | Architecture | S |
| 23 | Revue formelle des YouTube Branding Guidelines (`controls: 0`) si volume utilisateurs significatif | Légal | S |
| 24 | Réduire le TTL LiveKit (9h) si un mécanisme de refresh devient disponible côté SDK | APIs externes | S |

## 11. Ce qui reste impossible à vérifier depuis ce poste

- Statut réel de vérification de l'app OAuth Google dans la Google Cloud Console (accès non disponible).
- Valeur exacte des quotas ACRCloud/Sightengine souscrits et marge de consommation (nécessite accès dashboards fournisseurs).
- Signature effective des DPA (statut contractuel hors repo).
- Si un tiers a cloné le dépôt privé avant le fix de sécurité du 08/07 (logs d'accès GitHub non consultables depuis ce poste).
- Rotation effective du mot de passe du compte YouTube de démo (accès Gmail/Google hors périmètre).
- Politique de rétention et derniers tests de restauration des backups automatiques Scaleway Managed Database (console non accessible).
- Fréquence/latence réelle observée en production depuis le passage à `instances:1` (accès métriques temps réel non disponible dans cette session).

## 12. Confirmation de méthode

- **Aucun des 14 fichiers d'audit sources n'a été modifié ou supprimé** — ils restent l'historique de référence, consultables tels quels.
- **Aucun fichier de code applicatif (`web/app/src/`, `commun/backend/src/`, `ios/apptel/src/`) n'a été modifié** pendant la production de ce document. Toutes les vérifications ont été faites en lecture seule (`git log`, `git ls-files`, `git cat-file`, lecture de fichiers, SSH lecture seule `pm2 jlist`/`psql SELECT`/`df -h`/`source .env` pour affichage masqué).
- Ce document est un **nouveau fichier** (`AUDIT-CONSOLIDE.md`) ; il ne remplace ni n'altère les 14 rapports sources.
