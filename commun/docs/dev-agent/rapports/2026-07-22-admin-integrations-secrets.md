# Rapport Dev Agent — 2026-07-22 — Admin : onglet Intégrations (clés API tierces généralisées)

**Agent :** @onscen-dev-agent
**Date :** 2026-07-22
**Durée estimée :** ~2 h30 + ~1 h (suivi alertes, MODIF 761)
**Statut global :** ✅ Terminé

> **Mise à jour 2026-07-22 (suivi direct) :** ajout du système de
> détection/notification des clés à changer (MODIF 761) — voir section
> [« Suivi — Notification des clés à changer » ](#suivi--notification-des-clés-à-changer-modif-761)
> en fin de rapport.

---

## Mission

Généraliser le pattern « config Stripe live depuis l'admin » (write-only,
masqué, validé, appliqué à chaud, sans SSH) à **toutes** les clés d'API
tierces utilisées par l'app, dans un nouvel onglet Admin dédié
« Intégrations », sans dupliquer ni casser le code Stripe existant (déjà
en prod, déjà testé — 16 tests).

---

## Contexte / problème

Session précédente : [admin-stripe-live-config](./2026-07-22-admin-stripe-live-config.md)
a créé `stripeConfigAdmin.ts` / `adminStripeConfig.ts` /
`AdminStripeConfigCard.tsx`, intégrée dans `AdminDonationsTab.tsx`. Le
fondateur veut le même principe pour Google/YouTube, Facebook/Instagram,
Cloudflare Stream, LiveKit, Sightengine, ACRCloud, S3/Scaleway, Resend,
Anthropic/OpenAI, Web Push, TURN — dans un onglet dédié plutôt que dispersé
dans Donations.

---

## Inventaire réalisé (grep `commun/backend/src`, `.env.production.example`, `INFRA-ONSCEN.md`)

Providers réellement utilisés dans le code et couverts par le nouveau moteur
(11 providers, en plus de Stripe qui garde son module dédié) :

| Provider (id) | Variables | Usage réel |
|---|---|---|
| `google_oauth` | `GOOGLE_CLIENT_ID/SECRET`, `GOOGLE_CALLBACK_URL`, `YOUTUBE_CALLBACK_URL` | `routes/oauth.ts` — connexion sociale Google + liaison YouTube |
| `youtube_data_api` | `YOUTUBE_API_KEY` | `lib/youtubeDataApi.ts` — recherche/import playlists |
| `facebook_instagram` | `FACEBOOK_APP_ID/SECRET`, `FACEBOOK_CALLBACK_URL`, `INSTAGRAM_CALLBACK_URL` | `routes/oauth.ts`, `lib/instagramOAuth.ts` |
| `cloudflare_stream` | `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_STREAM_API_TOKEN`, `CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN` | `lib/cloudflareStream.ts` |
| `livekit` | `LIVEKIT_URL`, `LIVEKIT_API_KEY/SECRET` | `lib/livekit.ts` |
| `sightengine` | `SIGHTENGINE_API_USER/SECRET` | `lib/sightengineConfig.ts` — modération NSFW |
| `acrcloud` | `ACRCLOUD_ACCESS_KEY/SECRET`, `ACRCLOUD_HOST` | `lib/acrCloudConfig.ts` — empreinte audio |
| `s3_scaleway` | `S3_BUCKET/REGION/ENDPOINT`, `S3_ACCESS_KEY_ID/SECRET_ACCESS_KEY`, `S3_PUBLIC_BASE_URL` | `lib/objectStorage.ts` |
| `resend_email` | `RESEND_API_KEY`, `RESEND_FROM` | `lib/emailSend.ts` |
| `ai_agents` | `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` | `lib/aiAgents/llmClient.ts` |
| `web_push` | `VAPID_PUBLIC_KEY/PRIVATE_KEY`, `VAPID_SUBJECT` | `lib/webPush.ts` |
| `turn` | `TURN_URL/USERNAME/CREDENTIAL` | `lib/iceServers.ts` |

**Volontairement exclus** (documentés comme limitation, voir plus bas) :
`APPLE_PRIVATE_KEY` (PEM multiligne), `FIREBASE_SERVICE_ACCOUNT_JSON` (JSON
volumineux) — mal adaptés à un champ texte masqué simple ; variables
« cœur système » (`DATABASE_URL`, `JWT_SECRET`, `ENCRYPTION_KEY`,
`OPS_HEALTH_TOKEN`, `TOTP_ENCRYPTION_KEY`, `PROD_ADMIN_*`, `REDIS_URL`…) —
explicitement hors whitelist par design (sécurité).

---

## Architecture choisie

- **Registre déclaratif** (`externalSecretsRegistry.ts`) : chaque provider
  déclare ses variables (`kind: 'secret'|'public'`, `format` de validation,
  `required`). C'est l'**unique source de vérité** de la whitelist
  (`EXTERNAL_SECRET_WHITELIST`, dérivée automatiquement) — aucune variable
  absente du registre ne peut jamais être écrite via ce moteur, même si un
  payload malveillant l'inclut (double vérification : par provider ET
  globale, testé explicitement).
- **Moteur générique** (`externalSecretsAdmin.ts`) : status/masquage/
  validation/application, réutilise `upsertEnvFileKeys` (déjà générique,
  inchangé) et `getActiveEnvFilePath` (inchangé). Un provider sans champ
  requis (`ai_agents`) est considéré « configuré » dès qu'au moins un champ
  est renseigné (Anthropic OU OpenAI suffit).
- **Stripe non touché** : `stripeConfigAdmin.ts` / `adminStripeConfig.ts` /
  `AdminStripeConfigCard.tsx` restent intacts et testés (16 tests toujours
  verts). La carte Stripe est simplement réutilisée en premier dans le
  nouvel onglet — pas de migration, pas de risque de régression.
- **Frontend** : une carte générique (`AdminExternalSecretProviderCard`)
  pilotée entièrement par la réponse du backend (labels/format viennent du
  registre via `GET /api/admin/external-secrets`) — pas de registre
  dupliqué côté frontend. Formulaire toujours vide à l'ouverture (comme
  Stripe) : tous les champs requis doivent être ressaisis à chaque
  application (les champs optionnels laissés vides ne sont jamais écrasés).

---

## Flux complet

1. `GET /api/admin/external-secrets` (Dev staff) → statut masqué de tous
   les providers (valeur en clair pour les champs `public`, masquée pour
   les `secret`, `null` si non configuré).
2. Admin clique « Configurer » sur une carte → formulaire vide → saisit les
   champs requis (+ optionnels souhaités) → « Appliquer ».
3. `PUT /api/admin/external-secrets/:provider` (Dev staff, rate limit
   20/15min Redis, skip msdev) :
   - 404 si provider inconnu ;
   - validation serveur par format (`validateProviderInput`) — 400 avec
     `fieldErrors` si invalide (champ requis manquant, clé non whitelistée,
     format incorrect) ;
   - `applyProviderConfig` : upsert dans le `.env` actif (refuse si le
     fichier n'existe pas) + `process.env` mis à jour immédiatement ;
   - `logAdminAction` (audit masqué, `action=external_secrets_update`).
4. **Hot reload confirmé pour tous les 11 providers** : chaque fonction de
   lecture (`getLiveKitUrl`, `isSightengineConfigured`,
   `youtubeDataApiKey`, `process.env.S3_BUCKET` dans `objectStorage.ts`,
   etc.) lit `process.env` directement à chaque appel, sans cache module
   — comme Stripe, **aucun redémarrage PM2 n'est nécessaire**. Exception
   notée : `web_push` mémorise un flag `configured` après le premier
   succès (`webPush.ts`) — la *première* configuration s'applique à chaud,
   mais un changement ultérieur des clés VAPID déjà configurées nécessite
   un redémarrage (limitation pré-existante du module, non introduite ici).

---

## Actions réalisées

- [x] Exploré l'existant : `stripeConfigAdmin.ts`, `envFileWriter.ts`,
  `adminStripeConfig.ts`, `AdminStripeConfigCard.tsx`,
  `AdminDonationsTab.tsx`, `AdminPage.tsx`, `AdminPrimaryNav.tsx`,
  `adminStaffRoles.ts`, `requireAdmin.ts`, `adminAuditLog.ts`,
  `rateLimitStore.ts`, `paths.ts`.
- [x] Inventaire des secrets réels (`.env.production.example`, grep
  `process.env.*KEY|SECRET|TOKEN`) → 11 providers retenus (tableau
  ci-dessus).
- [x] Backend : registre (`externalSecretsRegistry.ts`), moteur
  (`externalSecretsAdmin.ts`), routes (`adminExternalSecrets.ts`), montage
  `server.ts`.
- [x] Frontend : carte générique, onglet « Intégrations » (icône 🔑,
  Dev-only), intégration `AdminPage.tsx` / `AdminPrimaryNav.tsx` /
  `adminStaffRoles.ts`, API client, types, i18n FR/EN complet.
- [x] Tests unitaires backend (28 nouveaux : 9 registre + 19 moteur).
- [x] `modification.txt` (MODIF 760) + ce rapport + `INDEX.md`.

---

## Fichiers modifiés

| Fichier | Changement |
|---------|------------|
| `commun/backend/src/lib/externalSecretsRegistry.ts` | Nouveau — registre 11 providers + whitelist stricte |
| `commun/backend/src/lib/externalSecretsRegistry.test.ts` | Nouveau — 9 tests |
| `commun/backend/src/lib/externalSecretsAdmin.ts` | Nouveau — status/masquage/validation/application génériques |
| `commun/backend/src/lib/externalSecretsAdmin.test.ts` | Nouveau — 19 tests |
| `commun/backend/src/routes/adminExternalSecrets.ts` | Nouveau — GET/PUT `/api/admin/external-secrets(/:provider)` |
| `commun/backend/src/server.ts` | Montage du router |
| `web/app/src/components/AdminExternalSecretProviderCard.tsx` | Nouveau — carte générique par provider |
| `web/app/src/pages/AdminIntegrationsTab.tsx` | Nouveau — onglet (Stripe + providers génériques) |
| `web/app/src/pages/AdminPage.tsx` | +onglet `integrations` |
| `web/app/src/components/AdminPrimaryNav.tsx` | +`AdminPrimaryTabId` `'integrations'` |
| `web/app/src/lib/adminStaffRoles.ts` | +`integrations` dans `ADMIN_DEV_ONLY_TAB_IDS` |
| `web/app/src/lib/api/admin.ts` | +`getExternalSecretsStatus`/`updateExternalSecretProvider` |
| `web/app/src/types.ts` | +`ExternalSecretFieldStatus`/`ExternalSecretProviderStatus`/… |
| `web/app/src/locales/fr.json`, `en.json` | `admin.tabs.integrations`, `admin.integrations.*` |
| `modification.txt` | MODIF 760 |

**Non modifié (volontairement)** : `stripeConfigAdmin.ts`, `adminStripeConfig.ts`,
`AdminStripeConfigCard.tsx`, `AdminDonationsTab.tsx`, `envFileWriter.ts`, `paths.ts`.

---

## Commandes exécutées

```text
cd commun/backend && npm test           → ✅ 437/437 (89 fichiers, dont 28 nouveaux)
cd commun/backend && npx tsc --noEmit   → ✅
cd web/app && npx tsc --noEmit          → ✅
cd web/app && npm run build             → ✅
cd web/app && npx vitest run            → ✅ 473/473 (1 échec pré-existant hors sujet, voir ci-dessous)
```

---

## Tests & vérifications

| Vérification | Résultat |
|--------------|----------|
| Tests unitaires backend (nouveaux) | ✅ 28/28 (`externalSecretsRegistry.test.ts` 9, `externalSecretsAdmin.test.ts` 19) |
| Suite complète backend | ✅ 437/437 (89 fichiers) — aucune régression Stripe (toujours testé) |
| Typecheck backend (`tsc --noEmit`) | ✅ |
| Typecheck frontend (`tsc --noEmit`) | ✅ |
| Build frontend (`npm run build`) | ✅ |
| Suite complète frontend (`vitest run`) | ✅ 473/473 tests passés — 1 fichier en échec (`mapSearchIntent.test.ts`, `localStorage is not defined`), **pré-existant, reproductible en isolation avant toute modification de cette session, sans lien avec ce travail** (fichier non touché ; échec dû à l'environnement de test de ce fichier précis, pas à un import ajouté par cette session) |
| Régression `mapMarkersKey.test.ts` (mentionnée dans le rapport précédent) | ✅ Aucune — 2/2 tests passent (déjà corrigé par une session antérieure, MODIF 759) |
| Test manuel | Non fait (nécessite un environnement avec `.env` réel + compte Dev staff — voir section ci-dessous) |

---

## modification.txt

- [x] Entrée ajoutée (MODIF 760 — Admin : onglet Intégrations (clés API tierces généralisées))

---

## Bloquers / décisions requises

| Sujet | Action fondateur |
|-------|------------------|
| `mapSearchIntent.test.ts` échoue (`localStorage is not defined`), pré-existant, sans lien avec cette session | À corriger séparément (config vitest/environment pour ce fichier) |
| Apple Sign In (`APPLE_PRIVATE_KEY`) et Firebase (`FIREBASE_SERVICE_ACCOUNT_JSON`) non couverts | Ces secrets sont des blobs multiligne (PEM / JSON) mal adaptés à un champ masqué simple — restent gérables uniquement par SSH/édition manuelle du `.env`, sauf si le fondateur souhaite un champ `textarea` dédié (à discuter, hors scope de cette session) |
| Aucune vraie clé n'a été saisie/testée en environnement réel | Le founder doit tester manuellement avec ses propres clés (voir procédure ci-dessous) — jamais de vraie clé en dur dans le code/tests de cette session |

---

## Prochaines étapes

1. Founder : se connecter à l'admin (compte Dev staff) → Admin → onglet
   « Intégrations » (icône 🔑) → vérifier que les providers déjà configurés
   sur le VPS (Sightengine, LiveKit, S3…) apparaissent bien « Configuré ».
2. Tester une saisie réelle sur un provider non critique (ex. `youtube_data_api`
   avec une vraie clé YouTube Data API) → vérifier badge + fonctionnement
   (recherche YouTube dans un salon) sans redémarrage.
3. Si besoin d'Apple Sign In / Firebase depuis l'admin, spécifier le besoin
   exact (champ `textarea` multiligne) pour une session dédiée.
4. Envisager d'étendre le même moteur à d'autres futurs providers en
   ajoutant simplement une entrée dans `externalSecretsRegistry.ts` (aucun
   autre fichier à toucher côté génération de l'UI).

---

## Notes techniques

### Sécurité — whitelist stricte (exigence explicite de la demande)

- `EXTERNAL_SECRET_WHITELIST` est **dérivée automatiquement** du registre :
  aucune constante de liste noire à maintenir séparément, aucun risque de
  désynchronisation.
- `applyProviderConfig()` vérifie que **chaque** clé du payload appartient
  aux champs déclarés du provider ciblé (pas seulement à la whitelist
  globale) — un payload `{ SIGHTENGINE_API_USER: '…', DATABASE_URL: '…' }`
  envoyé sur `PUT /external-secrets/sightengine` est rejeté avant d'écrire
  quoi que ce soit (`throw`, testé explicitement).
- La route valide aussi côté serveur (`validateProviderInput`) avant tout
  appel à `applyProviderConfig` — retourne 400 avec `fieldErrors` sans
  jamais toucher au `.env`.
- Audit trail (`admin_audit_log`, action `external_secrets_update`) avec
  valeurs **masquées** (champs `secret`) ou en clair uniquement pour les
  champs explicitement déclarés `public` dans le registre (ex. Client ID,
  URL de callback — jamais un secret).

### Pourquoi ne pas avoir migré Stripe dans le nouveau moteur

La demande autorisait explicitement à « garder Stripe tel quel ». Migrer
aurait dupliqué un risque de régression sur un flux de paiement réel déjà en
prod et testé (16 tests), pour un bénéfice DRY marginal (Stripe a une
sémantique propre : cohérence live/test entre 2 clés, ce qui ne rentre pas
proprement dans le modèle générique champ-par-champ sans complexifier le
registre pour un seul provider). Le principe DRY est respecté au niveau
UX/architecture (même moteur `upsertEnvFileKeys`, même pattern d'auth/rate
limit/audit, même style de carte) sans dupliquer la logique métier Stripe.

### Limitations connues

- Comme pour Stripe : pas de stockage chiffré en base dédié — écriture
  directe dans le `.env` serveur, protégé par les permissions filesystem du
  VPS.
- Champs requis systématiquement à ressaisir à chaque application (même
  comportement que `AdminStripeConfigCard` — pas de pré-remplissage, même
  pour les champs publics) : cohérent et prévisible, mais implique de
  ressaisir un Client ID déjà connu si on ne veut changer qu'un autre champ
  du même provider.
- `web_push` (VAPID) : hot-reload garanti seulement pour la *première*
  configuration (flag `configured` mémorisé en module, limitation
  pré-existante de `webPush.ts`, non introduite par cette session).
- Apple Sign In et Firebase non couverts (blobs multiligne PEM/JSON) — voir
  Bloquers.
- Pas de rotation/historique des anciennes valeurs — traçable uniquement via
  `admin_audit_log` + horodatage du `.env` sur le VPS.

### Test manuel (à faire par le founder ou en preprod)

1. `npm run dev` (msdev) ou déployer en preprod.
2. Se connecter avec un compte `staffRole: 'dev'`.
3. Aller dans Admin → onglet « Intégrations ».
4. Vérifier les cartes déjà configurées côté serveur (ex. si `SIGHTENGINE_API_USER`
   est déjà dans le `.env`, la carte doit afficher « Configuré » + le login
   en clair (champ public) sans exposer le secret.
5. Cliquer « Configurer » sur un provider non configuré (ex. `turn`), saisir
   des valeurs de test → « Appliquer » → vérifier le badge passe à
   « Configuré » et que le formulaire se referme et se vide.
6. Vérifier en logs/DB que `admin_audit_log` contient une entrée
   `external_secrets_update` avec les valeurs masquées.
7. Recharger la page → le statut doit persister (lu depuis `process.env`,
   valable jusqu'au prochain redémarrage ; en prod, aussi relu depuis le
   `.env` au démarrage suivant).

---

## Suivi — Notification des clés à changer (MODIF 761)

**Demande :** « mets la notification des clé à changer si besoin » —
généraliser l'alerte `stripe_test_on_production` à tout provider du
registre, sans jamais renvoyer une valeur en clair, en réutilisant
`GET /api/admin/external-secrets` (pas de nouvel endpoint).

### Logique de détection par provider

Fichier : `commun/backend/src/lib/externalSecretsAlerts.ts` —
`getProviderIssues(providerDef)`, 4 règles **conservatrices** (aucune
heuristique floue, uniquement des signaux documentés/fiables) :

| # | Type | Règle | Sévérité | Exemple réel |
|---|------|-------|----------|--------------|
| 1 | `test_mode_in_production` | Valeur pointant vers un mode test/sandbox documenté, alors que `APP_ENV=production` | critical | `RESEND_FROM` contenant `resend.dev` (domaine non vérifié, 100 emails/jour — documenté dans `.env.production.example`) |
| 2 | `partial_config` | Variable **requise** absente, **uniquement si le provider est déjà partiellement configuré** (≥1 champ déjà rempli) — un provider entièrement vide reste « non configuré », pas une alerte | critical | LiveKit avec `LIVEKIT_URL`+`LIVEKIT_API_KEY` définis mais `LIVEKIT_API_SECRET` manquant |
| 3 | `invalid_format` | Valeur en place ne respecte plus le format déclaré dans le registre (réutilise `FORMAT_VALIDATORS`, même règles qu'à la saisie) | warning | `LIVEKIT_URL` modifié manuellement en SSH et ne commençant plus par `wss://` |
| 4 | `placeholder_value` | Valeur **strictement identique** (insensible à la casse, comparaison exacte — jamais une sous-chaîne) à un exemple/placeholder connu | critical | `changez_moi` (issu de `.env.production.example`), `devkey`/`secret` (défauts LiveKit `--dev` local) |

Le mode test/live (case 1 de la demande) n'a été **généralisé qu'où un
indicateur réellement documenté existe** (`RESEND_FROM`/`resend.dev`) — aucun
autre provider du registre n'a de préfixe test/live distinguable dans son
format actuel (contrairement à Stripe `sk_live_`/`sk_test_`), donc aucune
règle inventée n'a été ajoutée pour eux (conforme à la consigne « reste
conservateur — pas de faux positif »). Le mécanisme (`TEST_INDICATOR_PATTERNS`
dans `externalSecretsAlerts.ts`) est extensible : ajouter une entrée suffit
si un futur provider a un indicateur fiable.

**Chaque `ExternalSecretIssue` = `{ type, severity, field, messageKey }`** —
jamais la valeur de la clé, uniquement son nom de variable et le type de
problème (contrainte de sécurité respectée, testée explicitement —
`externalSecretsAlerts.test.ts`, « never leaks a raw secret value »).

### Où les alertes apparaissent dans l'UI

1. **Carte provider** (`AdminExternalSecretProviderCard.tsx`) : badge à 3
   états — `✅ OK` (configuré, aucun problème) / `⚠️ Action requise`
   (au moins un problème détecté — priorité sur le statut `configured`) /
   `○ Non configuré` (rien renseigné, feature optionnelle non activée, pas
   une alerte). La liste précise des problèmes s'affiche sous le badge
   (couleur rouge si critique, orange si warning).
2. **Bannière d'onglet** (`AdminIntegrationsTab.tsx`) : récapitulatif en
   tête d'onglet si ≥1 provider a un problème (« N intégration(s)
   nécessitent une action » + liste providers).
3. **Dashboard global** (`AdminCostsTab.tsx`, Admin → Analytics → Costs,
   même emplacement que `stripe_test_on_production`) : un `ProdSaasAlert`
   par `ExternalSecretIssue`, visible dès la connexion admin, **uniquement
   en environnement déployé** (prod/preprod — pas de bruit en dev local).
4. **Carte Stripe** : `AdminStripeConfigCard.tsx` affichait **déjà**
   `testOnProdWarning` avant cette session (bannière ambre si `mode==='test'`
   et `configured`) — non modifiée, le principe demandé y est déjà appliqué.
   Étendre les règles 2–4 (partial/format/placeholder) à Stripe lui-même a
   été volontairement écarté pour ne pas toucher un module déjà testé et en
   prod (cohérent avec la consigne de la session précédente) — voir
   Limitations.

### Fichiers modifiés/créés (MODIF 761)

| Fichier | Changement |
|---------|------------|
| `commun/backend/src/lib/externalSecretsRegistry.ts` | `FORMAT_VALIDATORS` déplacé ici et exporté (source unique, saisie + lecture) |
| `commun/backend/src/lib/externalSecretsAlerts.ts` | Nouveau — `getProviderIssues()`, 4 règles |
| `commun/backend/src/lib/externalSecretsAlerts.test.ts` | Nouveau — 10 tests |
| `commun/backend/src/lib/externalSecretsAdmin.ts` | `ExternalSecretProviderStatus` +`issues[]` |
| `commun/backend/src/lib/prodSaasStatus.ts` | `ProdSaasAlert` +`params?`, `buildAlerts()` généralisé |
| `web/app/src/components/AdminExternalSecretProviderCard.tsx` | Badge 3 états + liste des problèmes |
| `web/app/src/pages/AdminIntegrationsTab.tsx` | Bannière récapitulative |
| `web/app/src/pages/AdminCostsTab.tsx` | `ProdSaasAlerts` résout les params avant `t()` |
| `web/app/src/types.ts` | +`ExternalSecretIssue*`, `ProdSaasAlert.params` |
| `web/app/src/locales/fr.json`, `en.json` | `admin.integrations.issues.*`, `card.badge*`, `alertBanner*` |
| `modification.txt` | MODIF 761 |

**Non modifié (volontairement)** : `stripeConfigAdmin.ts`,
`adminStripeConfig.ts`, `AdminStripeConfigCard.tsx` (alerte déjà présente),
aucun nouvel endpoint (enrichissement de `GET /api/admin/external-secrets`
existant, comme demandé).

### Tests & vérifications (MODIF 761)

| Vérification | Résultat |
|--------------|----------|
| Tests unitaires backend (nouveaux) | ✅ 10/10 (`externalSecretsAlerts.test.ts`) |
| Suite complète backend | ✅ 447/447 (90 fichiers) — dont `prodSaasStatus.test.ts` (5/5, aucune régression sur `stripe_test_on_production`) |
| Typecheck backend (`tsc --noEmit`) | ✅ |
| Typecheck frontend (`tsc --noEmit`) | ✅ |
| Build frontend (`npm run build`) | ✅ |
| Suite complète frontend (`vitest run`) | ✅ 473/473 — même échec pré-existant hors sujet (`mapSearchIntent.test.ts`, sans lien) |

### Limitations connues (MODIF 761)

- Règle 1 (test/sandbox en prod) généralisée uniquement à `RESEND_FROM` —
  aucun autre provider actuel n'a d'indicateur test/live fiable et
  documenté ; le mécanisme est prêt à en accueillir d'autres sans
  changement d'architecture.
- La règle `partial_config` ne se déclenche que si le provider est **déjà**
  partiellement configuré — un provider jamais configuré (feature
  optionnelle non activée) reste `○ Non configuré`, pas une alerte, par
  choix conservateur explicite (éviter le bruit sur des intégrations
  volontairement désactivées : ACRCloud/LiveKit/Cloudflare/etc. déjà
  couverts par leurs propres alertes dédiées `acrcloud_missing` etc. dans
  `prodSaasStatus.ts` quand c'est pertinent).
- Alertes du dashboard global (`AdminCostsTab`) limitées aux environnements
  déployés (prod/preprod) — en dev local (msdev), les problèmes restent
  visibles uniquement dans l'onglet Intégrations (comportement voulu, pas
  une régression).
- Stripe (`AdminStripeConfigCard`) ne bénéficie pas des règles 2–4
  (partial/format/placeholder) de ce détecteur générique — seule sa propre
  alerte `stripe_test_on_production` (déjà existante) s'applique. Étendre
  serait possible dans une session dédiée si souhaité, sans risque pour le
  module Stripe actuel (lecture seule, pas d'écriture).

---

*Généré par OnScen Dev Agent — ne pas éditer le template `_TEMPLATE.md`*
